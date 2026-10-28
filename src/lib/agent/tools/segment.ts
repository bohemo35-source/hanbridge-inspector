// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: segmentImage tool: SAM car / license plate / wheel -> main instances + mask Evidence
// @created: 2026-10-28
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { samSegment, scaleBox, type SamBox, type SamInstance } from "@/lib/meta/sam";
import type { Evidence } from "@/lib/schema";

export const SEGMENT_CONCEPTS = ["car", "license plate", "wheel"] as const;
export type SegmentConcept = (typeof SEGMENT_CONCEPTS)[number];

export interface SegmentImageResult {
  carId: string;
  photoId: string;
  /** original photo dimensions, boxes are in these coordinates */
  width: number;
  height: number;
  car: SamInstance | null;
  licensePlate: SamInstance | null;
  wheels: SamInstance[];
  byConcept: Partial<Record<SegmentConcept, SamInstance[]>>;
  evidence: Evidence[];
  ms: Partial<Record<SegmentConcept, number>>;
}

export const boxArea = (b: SamBox) => Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);

const largest = (list: SamInstance[]): SamInstance | null =>
  list.length ? list.reduce((a, b) => (boxArea(b.box) > boxArea(a.box) ? b : a)) : null;

/** Main car: largest box that covers the frame centre; falls back to largest overall. */
export function selectMainCar(instances: SamInstance[], frame: { w: number; h: number }): SamInstance | null {
  const cx = frame.w / 2;
  const cy = frame.h / 2;
  const centred = instances.filter((i) => i.box.x1 <= cx && cx <= i.box.x2 && i.box.y1 <= cy && cy <= i.box.y2);
  return largest(centred.length ? centred : instances);
}

/**
 * Main license plate: aspect 2..6, inside the main car box or at its lower edge,
 * largest wins. Background cars' plates are discarded.
 */
export function selectMainPlate(instances: SamInstance[], carBox: SamBox | null): SamInstance | null {
  const valid = instances.filter((i) => {
    const w = i.box.x2 - i.box.x1;
    const h = i.box.y2 - i.box.y1;
    return h > 0 && w / h >= 2 && w / h <= 6;
  });
  if (!carBox) return largest(valid);
  const carH = carBox.y2 - carBox.y1;
  const inside = valid.filter((i) => {
    const cx = (i.box.x1 + i.box.x2) / 2;
    const cy = (i.box.y1 + i.box.y2) / 2;
    const centreInside = cx >= carBox.x1 && cx <= carBox.x2 && cy >= carBox.y1 && cy <= carBox.y2;
    const atLowerEdge =
      cx >= carBox.x1 && cx <= carBox.x2 && cy > carBox.y2 && cy <= carBox.y2 + 0.15 * carH;
    return centreInside || atLowerEdge;
  });
  return largest(inside);
}

async function orientedSize(image: Buffer): Promise<{ w: number; h: number }> {
  const meta = await sharp(image).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  // EXIF orientations 5-8 swap width/height after .rotate()
  return (meta.orientation ?? 1) >= 5 ? { w: h, h: w } : { w, h };
}

const safeName = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "_");

async function saveMaskPng(
  carId: string,
  photoId: string,
  conceptSlug: string,
  instance: SamInstance,
): Promise<string | undefined> {
  if (!instance.maskDecoded || !instance.mask || instance.maskWidth <= 0 || instance.maskHeight <= 0) {
    return undefined;
  }
  const dir = path.join(process.cwd(), "public", "generated", safeName(carId));
  await mkdir(dir, { recursive: true });
  const file = `${safeName(photoId)}-${conceptSlug}.png`;
  const grey = Buffer.from(instance.mask.map((v) => (v ? 255 : 0)));
  await sharp(grey, {
    raw: { width: instance.maskWidth, height: instance.maskHeight, channels: 1 },
  })
    .png()
    .toFile(path.join(dir, file));
  return `/generated/${safeName(carId)}/${file}`;
}

export async function segmentImage(opts: {
  carId: string;
  photoId: string;
  imagePath?: string;
  imageUrl?: string;
  concepts?: SegmentConcept[];
}): Promise<SegmentImageResult> {
  const concepts = opts.concepts ?? [...SEGMENT_CONCEPTS];
  if (concepts.length === 0 || concepts.length > 3 || concepts.some((c) => !SEGMENT_CONCEPTS.includes(c))) {
    throw new Error(`concepts must be a non-empty subset of: ${SEGMENT_CONCEPTS.join(", ")}`);
  }
  if (!opts.imagePath === !opts.imageUrl) throw new Error("segmentImage: pass exactly one of imagePath / imageUrl");

  let image: Buffer;
  if (opts.imagePath) {
    image = await readFile(opts.imagePath);
  } else {
    const res = await fetch(opts.imageUrl!);
    if (!res.ok) throw new Error(`segmentImage: imageUrl fetch failed: ${res.status}`);
    image = Buffer.from(await res.arrayBuffer());
  }
  const original = await orientedSize(image);

  const ms: Partial<Record<SegmentConcept, number>> = {};
  const scaled = await Promise.all(
    concepts.map(async (concept) => {
      const t0 = Date.now();
      const result = await samSegment(image, concept);
      ms[concept] = Date.now() - t0;
      const instances = result.instances.map((i) => ({
        ...i,
        box: scaleBox(i.box, { w: result.width, h: result.height }, original),
      }));
      return [concept, instances] as const;
    }),
  );
  const byConcept: Partial<Record<SegmentConcept, SamInstance[]>> = Object.fromEntries(scaled);

  const car = byConcept.car ? selectMainCar(byConcept.car, original) : null;
  const licensePlate = byConcept["license plate"]
    ? selectMainPlate(byConcept["license plate"], car?.box ?? null)
    : null;
  const wheels = byConcept.wheel ?? [];

  const evidence: Evidence[] = [];
  const addEvidence = async (concept: SegmentConcept, instance: SamInstance | null, slug: string) => {
    if (!instance) return;
    const maskRef = await saveMaskPng(opts.carId, opts.photoId, slug, instance);
    evidence.push({ type: "mask", mediaId: opts.photoId, box: instance.box, ...(maskRef ? { maskRef } : {}) });
  };
  await addEvidence("car", car, "car");
  await addEvidence("license plate", licensePlate, "license-plate");
  for (let i = 0; i < wheels.length; i++) {
    await addEvidence("wheel", wheels[i], wheels.length > 1 ? `wheel-${i}` : "wheel");
  }

  return { carId: opts.carId, photoId: opts.photoId, width: original.w, height: original.h, car, licensePlate, wheels, byConcept, evidence, ms };
}
