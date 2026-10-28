// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: SAM 3.1 client: image prep, /responses call, text parser, mask decoding, box scaling
// @created: 2026-10-28
import { decodeMaskToRaster } from "@meta-sam/parser";
import sharp from "sharp";
import { metaFetch } from "./client";

export interface SamBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** source image width the coordinates refer to */
  w: number;
  /** source image height the coordinates refer to */
  h: number;
}

export interface SamInstance {
  /** object id from the SAM record, null when absent */
  id: number | null;
  box: SamBox;
  /** binary mask (0/1), row-major, maskWidth x maskHeight, relative to the box; null when not decoded */
  mask: Uint8Array | null;
  maskWidth: number;
  maskHeight: number;
  maskDecoded: boolean;
}

export interface SamResult {
  /** width of the image actually sent to SAM */
  width: number;
  /** height of the image actually sent to SAM */
  height: number;
  instances: SamInstance[];
}

export function scaleBox(
  box: SamBox,
  from: { w: number; h: number },
  to: { w: number; h: number },
): SamBox {
  const sx = to.w / from.w;
  const sy = to.h / from.h;
  return {
    x1: Math.round(box.x1 * sx),
    y1: Math.round(box.y1 * sy),
    x2: Math.round(box.x2 * sx),
    y2: Math.round(box.y2 * sy),
    w: to.w,
    h: to.h,
  };
}

function parseKeyValues(body: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of body.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) map.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
  }
  return map;
}

function decodeMaskData(data: string): { mask: Uint8Array | null; width: number; height: number; decoded: boolean } {
  // data = "<H>,<W>,<enc><payload>" where enc is "~" (lossless) or "!" (one_bit)
  const first = data.indexOf(",");
  const second = data.indexOf(",", first + 1);
  if (first < 0 || second < 0) return { mask: null, width: 0, height: 0, decoded: false };
  const height = Number(data.slice(0, first));
  const width = Number(data.slice(first + 1, second));
  const payload = data.slice(second + 1);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || !payload) {
    return { mask: null, width: 0, height: 0, decoded: false };
  }
  try {
    const mask = decodeMaskToRaster({
      encoding: payload.startsWith("!") ? "one_bit" : "lossless",
      payload,
      width,
      height,
    });
    return { mask, width, height, decoded: true };
  } catch {
    return { mask: null, width, height, decoded: false };
  }
}

const RECORD_RE = /(?:^|,)?(\d+)?<\|box;([^|]*)\|>(?:<\|mask;([^|]*)\|>)?/g;

export function parseSamText(text: string): SamInstance[] {
  if (!text || !text.trim()) return [];
  const instances: SamInstance[] = [];
  for (const m of text.matchAll(RECORD_RE)) {
    const kv = parseKeyValues(m[2]);
    const num = (k: string) => Number(kv.get(k));
    const box: SamBox = { x1: num("x1"), y1: num("y1"), x2: num("x2"), y2: num("y2"), w: num("w"), h: num("h") };
    if ([box.x1, box.y1, box.x2, box.y2, box.w, box.h].some((v) => !Number.isFinite(v))) continue;
    let mask: Uint8Array | null = null;
    let maskWidth = 0;
    let maskHeight = 0;
    let maskDecoded = false;
    if (m[3]) {
      const maskKv = parseKeyValues(m[3]);
      const data = maskKv.get("data");
      if (data) {
        const d = decodeMaskData(data);
        mask = d.mask;
        maskWidth = d.width;
        maskHeight = d.height;
        maskDecoded = d.decoded;
      }
    }
    instances.push({ id: m[1] !== undefined ? Number(m[1]) : null, box, mask, maskWidth, maskHeight, maskDecoded });
  }
  return instances;
}

export async function samSegment(image: Buffer, concept: string): Promise<SamResult> {
  const prepared = await sharp(image)
    .rotate()
    .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer({ resolveWithObject: true });
  const width = prepared.info.width;
  const height = prepared.info.height;
  const dataUrl = `data:image/jpeg;base64,${prepared.data.toString("base64")}`;

  const res = await metaFetch("/responses", {
    method: "POST",
    model: "sam-3.1",
    timeoutMs: 30000,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sam-3.1",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: concept },
            { type: "input_image", image_url: dataUrl },
          ],
        },
      ],
    }),
  });
  const raw = (await res.json()) as {
    output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
    output_text?: string;
  };
  const text =
    raw.output?.flatMap((o) => o.content ?? []).map((c) => c.text ?? "").join("") || raw.output_text || "";
  return { width, height, instances: parseSamText(text) };
}
