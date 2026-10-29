// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: findDefects tool: crop main car (SAM) -> Spark vision defects -> Findings in original coords
// @created: 2026-10-28
import sharp from "sharp";
import { z } from "zod";
import { PANEL_VALUES, type Panel } from "@/lib/domain/panels";
import { samSegment, scaleBox, type SamBox } from "@/lib/meta/sam";
import { sparkJson } from "@/lib/meta/spark";
import type { Finding } from "@/lib/schema";
import { selectMainCar } from "./segment";

const PanelEnum = z.enum(PANEL_VALUES as unknown as [Panel, ...Panel[]]);

export const DefectViewSchema = z.enum([
  "front", "rear", "left", "right", "front_left", "front_right", "rear_left", "rear_right", "detail", "interior", "engine",
]);
export type DefectView = z.infer<typeof DefectViewSchema>;

const CropBoxSchema = z.object({ x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number() });

export const DefectsDraftSchema = z.object({
  view: DefectViewSchema,
  panels_visible: z.array(PanelEnum),
  defects: z.array(
    z.object({
      panel: PanelEnum,
      kind: z.enum(["scratch", "dent", "rust", "repaint", "putty", "panel_replaced", "mechanical", "other"]),
      severity: z.enum(["low", "medium", "high", "critical"]),
      box: CropBoxSchema,
      description_en: z.string(),
      description_ru: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});
export type DefectsDraft = z.infer<typeof DefectsDraftSchema>;

export const DEFECTS_SPEC = `Return ONE JSON object with exactly this shape (no extra keys):
{
  "view": "one of: front, rear, left, right, front_left, front_right, rear_left, rear_right, detail, interior, engine",
  "panels_visible": ["one or more of: front_bumper, hood, front_left_fender, front_right_fender, front_left_door, front_right_door, rear_left_door, rear_right_door, rear_left_fender, rear_right_fender, trunk, rear_bumper, roof, unknown"],
  "defects": [
    {
      "panel": "one of the panel ids above",
      "kind": "one of: scratch, dent, rust, repaint, putty, panel_replaced, mechanical, other",
      "severity": "one of: low, medium, high, critical",
      "box": {"x1": "number, px in the attached crop image", "y1": "number", "x2": "number", "y2": "number"},
      "description_en": "string",
      "description_ru": "string",
      "confidence": "number 0..1"
    }
  ]
}
Only report defects actually visible in the image (scratch, dent, rust, broken/mechanical, other). Do NOT report repaint, putty/filler or panel replacement from a photo — paint thickness cannot be seen. If none, return "defects": [].
Example:
{"view":"rear","panels_visible":["trunk","rear_bumper"],"defects":[{"panel":"trunk","kind":"scratch","severity":"low","box":{"x1":100,"y1":120,"x2":260,"y2":140},"description_en":"Light scratch on the trunk lid.","description_ru":"Лёгкая царапина на крышке багажника.","confidence":0.7}]}`;

export interface FindDefectsResult {
  view: DefectView;
  panels_visible: Panel[];
  findings: Finding[];
  /** crop box in original photo coordinates */
  cropBox: SamBox;
  width: number;
  height: number;
}

async function orientedSize(image: Buffer): Promise<{ w: number; h: number }> {
  const meta = await sharp(image).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  return (meta.orientation ?? 1) >= 5 ? { w: h, h: w } : { w, h };
}

export async function findDefects(opts: {
  carId: string;
  photoId: string;
  image: Buffer;
}): Promise<FindDefectsResult> {
  const original = await orientedSize(opts.image);

  // 1) main car geometry from SAM, scaled to original coordinates
  const seg = await samSegment(opts.image, "car");
  const scaledCars = seg.instances.map((i) => ({
    ...i,
    box: scaleBox(i.box, { w: seg.width, h: seg.height }, original),
  }));
  const mainCar = selectMainCar(scaledCars, original);

  // 2) crop around the main car (+5% margin), or the whole photo when no car found
  const base: SamBox = mainCar?.box ?? { x1: 0, y1: 0, x2: original.w, y2: original.h, w: original.w, h: original.h };
  const padX = Math.round((base.x2 - base.x1) * 0.05);
  const padY = Math.round((base.y2 - base.y1) * 0.05);
  const cropBox: SamBox = {
    x1: Math.max(0, base.x1 - padX),
    y1: Math.max(0, base.y1 - padY),
    x2: Math.min(original.w, base.x2 + padX),
    y2: Math.min(original.h, base.y2 + padY),
    w: original.w,
    h: original.h,
  };
  const cropW = cropBox.x2 - cropBox.x1;
  const cropH = cropBox.y2 - cropBox.y1;

  const crop = await sharp(opts.image)
    .rotate()
    .extract({ left: cropBox.x1, top: cropBox.y1, width: cropW, height: cropH })
    .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer({ resolveWithObject: true });
  const sentW = crop.info.width;
  const sentH = crop.info.height;
  const dataUrl = `data:image/jpeg;base64,${crop.data.toString("base64")}`;

  // 3) Spark vision on the crop
  const draft = await sparkJson(
    DefectsDraftSchema,
    [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `You are a used-car inspection expert. This is a ${sentW}x${sentH} px crop of one inspection photo. ` +
              `Determine the view, list panels_visible, and report every visible defect with its box in crop pixel coordinates (0..${sentW}, 0..${sentH}).`,
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    DEFECTS_SPEC,
  );

  // 4) defect boxes: crop-sent coords -> crop-original coords -> original photo coords
  const toOriginal = (b: { x1: number; y1: number; x2: number; y2: number }): SamBox => ({
    x1: Math.round(cropBox.x1 + (b.x1 / sentW) * cropW),
    y1: Math.round(cropBox.y1 + (b.y1 / sentH) * cropH),
    x2: Math.round(cropBox.x1 + (b.x2 / sentW) * cropW),
    y2: Math.round(cropBox.y1 + (b.y2 / sentH) * cropH),
    w: original.w,
    h: original.h,
  });

  // paint thickness (repaint / filler) and panel replacement are not provable from a photo — gauge, voice or inspector text only
  const VISUAL_KINDS = new Set(["scratch", "dent", "rust", "mechanical", "other"]);
  const findings: Finding[] = draft.defects.filter((d) => VISUAL_KINDS.has(d.kind)).map((d, i) => ({
    id: `${opts.photoId}-defect-${i + 1}`,
    panel: d.panel,
    kind: d.kind,
    severity: d.severity,
    description_en: d.description_en,
    description_ru: d.description_ru,
    confidence: d.confidence,
    evidence: [{ type: "frame", mediaId: opts.photoId, box: toOriginal(d.box), panel: d.panel }],
    verified: false,
  }));

  return { view: draft.view, panels_visible: draft.panels_visible, findings, cropBox, width: original.w, height: original.h };
}
