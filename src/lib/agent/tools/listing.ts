// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: makeListingPhoto: plate hidden deterministically (SAM box -> blur + HANBRIDGE plate), Muse Image studio background with car-pixel diff guard, hero image per report
// @created: 2026-10-29
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { head, put } from "@vercel/blob";
import { editImage, generateImage } from "@/lib/meta/image";
import type { SamBox, SamInstance } from "@/lib/meta/sam";
import type { Finding } from "@/lib/schema";
import { segmentImage, type SegmentImageResult } from "./segment";

/** Badge required by TZ-04: a listing image is never report evidence. */
export const LISTING_BADGE =
  "Listing image · plate hidden · background edited by Muse Image · vehicle pixels unchanged";
export const LISTING_BADGE_NO_BG = "Listing image · plate hidden · vehicle pixels unchanged";

/** Mean per-channel |diff| inside the car mask above this rejects the edited background. */
export const CAR_PIXEL_DIFF_THRESHOLD = 10;

export const LISTING_PROMPT =
  "Replace the background with a neutral light studio: seamless pale grey wall and floor, one soft shadow under the car. " +
  "Keep the car itself exactly unchanged: same shape, colour, wheels, lights and position. No text, no logos, no other objects.";

export const HERO_PROMPT =
  "Abstract premium automotive backdrop in the Hanbridge brand style: deep charcoal background, one warm amber light streak, " +
  "soft gradient, subtle depth. No cars, no people, no text, no logos.";

export interface ListingPhotoResult {
  /** public URL of the listing image; null when skipped */
  url: string | null;
  plateHidden: boolean;
  backgroundEdited: boolean;
  rejectedReason?: string;
  /** mean per-channel |diff| inside the car mask (original vs edited), null when not measured */
  carMaskDiff: number | null;
  plateBox: SamBox | null;
  width: number;
  height: number;
  badge: string;
  trace: string[];
}

const safeName = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "_");

/** Plate box expanded by 8% of its size on every side, clamped to the frame. */
export function expandPlateBox(box: SamBox, frame: { w: number; h: number }, ratio = 0.08): SamBox {
  const padX = Math.round((box.x2 - box.x1) * ratio);
  const padY = Math.round((box.y2 - box.y1) * ratio);
  return {
    x1: Math.max(0, box.x1 - padX),
    y1: Math.max(0, box.y1 - padY),
    x2: Math.min(frame.w, box.x2 + padX),
    y2: Math.min(frame.h, box.y2 + padY),
    w: frame.w,
    h: frame.h,
  };
}

async function oriented(image: Buffer): Promise<{ buf: Buffer; w: number; h: number }> {
  const { data, info } = await sharp(image).rotate().toBuffer({ resolveWithObject: true });
  return { buf: data, w: info.width, h: info.height };
}

/** Deterministic plate hiding: blur (sigma 30 >= 25) + HANBRIDGE plate over the expanded box. */
export async function hidePlate(image: Buffer, plateBox: SamBox): Promise<Buffer> {
  const { buf, w, h } = await oriented(image);
  const box = expandPlateBox(plateBox, { w, h });
  const bw = box.x2 - box.x1;
  const bh = box.y2 - box.y1;
  if (bw <= 0 || bh <= 0) throw new Error("hidePlate: empty plate box");

  const blurred = await sharp(buf)
    .extract({ left: box.x1, top: box.y1, width: bw, height: bh })
    .blur(30)
    .toBuffer();
  // fit "HANBRIDGE" (9 glyphs, ~0.68em average advance) inside the box width as well as its height
  const fontPx = Math.max(8, Math.floor(Math.min(bh * 0.42, (bw * 0.88) / (9 * 0.68))));
  const plateSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${bw}" height="${bh}">` +
      `<rect width="${bw}" height="${bh}" rx="${Math.round(bh * 0.12)}" fill="#14181f"/>` +
      `<text x="50%" y="50%" dy="0.36em" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" ` +
      `font-size="${fontPx}" letter-spacing="1" fill="#f2f4f7">HANBRIDGE</text></svg>`,
  );
  return sharp(buf)
    .composite([
      { input: blurred, left: box.x1, top: box.y1 },
      { input: plateSvg, left: box.x1, top: box.y1 },
    ])
    .jpeg({ quality: 90 })
    .toBuffer();
}

/** Full-frame binary car mask (1 = car pixel) from a box-relative SAM instance. */
export async function carMaskRaster(car: SamInstance, frame: { w: number; h: number }): Promise<Uint8Array> {
  const out = new Uint8Array(frame.w * frame.h);
  if (!car.maskDecoded || !car.mask || car.maskWidth <= 0 || car.maskHeight <= 0) return out;
  const bw = Math.max(1, car.box.x2 - car.box.x1);
  const bh = Math.max(1, car.box.y2 - car.box.y1);
  const grey = Buffer.from(car.mask.map((v) => (v ? 255 : 0)));
  const resized = await sharp(grey, { raw: { width: car.maskWidth, height: car.maskHeight, channels: 1 } })
    .resize(bw, bh, { kernel: "nearest" })
    .raw()
    .toBuffer();
  for (let y = 0; y < bh; y++) {
    const fy = car.box.y1 + y;
    if (fy < 0 || fy >= frame.h) continue;
    for (let x = 0; x < bw; x++) {
      const fx = car.box.x1 + x;
      if (fx < 0 || fx >= frame.w) continue;
      if (resized[y * bw + x] > 127) out[fy * frame.w + fx] = 1;
    }
  }
  return out;
}

/** Background-edit mask PNG (white = editable background, black = car to keep). */
export async function backgroundEditMaskPng(car: SamInstance, frame: { w: number; h: number }): Promise<Buffer> {
  const carMask = await carMaskRaster(car, frame);
  const grey = Buffer.from(carMask.map((v) => (v ? 0 : 255)));
  return sharp(grey, { raw: { width: frame.w, height: frame.h, channels: 1 } }).png().toBuffer();
}

/** Mean per-channel absolute difference inside the mask; both images are resized to (w,h). Infinity when the mask is empty. */
export async function meanDiffInsideMask(
  a: Buffer,
  b: Buffer,
  mask: Uint8Array,
  frame: { w: number; h: number },
): Promise<number> {
  const rawOf = async (img: Buffer) =>
    sharp(img).rotate().resize(frame.w, frame.h, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const [ra, rb] = await Promise.all([rawOf(a), rawOf(b)]);
  let sum = 0;
  let count = 0;
  for (let p = 0; p < frame.w * frame.h; p++) {
    if (!mask[p]) continue;
    const o = p * 3;
    sum += Math.abs(ra[o] - rb[o]) + Math.abs(ra[o + 1] - rb[o + 1]) + Math.abs(ra[o + 2] - rb[o + 2]);
    count++;
  }
  if (count === 0) return Number.POSITIVE_INFINITY;
  return sum / (count * 3);
}

export async function makeListingPhoto(opts: {
  carId: string;
  photoId: string;
  imagePath?: string;
  imageUrl?: string;
  image?: Buffer;
  /** reuse an existing segmentImage result (skips the SAM calls) */
  segment?: SegmentImageResult;
  /** test/demo override; default public/generated/<carId> */
  outDir?: string;
  urlPrefix?: string;
}): Promise<ListingPhotoResult> {
  const trace: string[] = [];
  const sources = [opts.imagePath, opts.imageUrl, opts.image].filter(Boolean).length;
  if (sources > 1) throw new Error("makeListingPhoto: pass at most one of imagePath / imageUrl / image");

  let image: Buffer;
  if (opts.image) image = opts.image;
  else if (opts.imagePath) image = await readFile(opts.imagePath);
  else if (opts.imageUrl) {
    const res = await fetch(opts.imageUrl);
    if (!res.ok) throw new Error(`makeListingPhoto: imageUrl fetch failed: ${res.status}`);
    image = Buffer.from(await res.arrayBuffer());
  } else if (!opts.segment) {
    throw new Error("makeListingPhoto: imagePath, imageUrl or image is required");
  } else {
    throw new Error("makeListingPhoto: image bytes are required even when segment is reused");
  }
  const { w, h } = await oriented(image);

  let segment = opts.segment;
  if (!segment) {
    let segPath = opts.imagePath;
    if (!segPath && !opts.imageUrl) {
      segPath = path.join(tmpdir(), `listing-${safeName(opts.carId)}-${safeName(opts.photoId)}.jpg`);
      await writeFile(segPath, image);
    }
    segment = await segmentImage({
      carId: opts.carId,
      photoId: opts.photoId,
      ...(segPath ? { imagePath: segPath } : { imageUrl: opts.imageUrl }),
    });
    trace.push(`segment_image: car=${segment.car ? "found" : "none"} plate=${segment.licensePlate ? "found" : "none"}`);
  }

  const outDir = opts.outDir ?? path.join(process.cwd(), "public", "generated", safeName(opts.carId));
  const urlPrefix = opts.urlPrefix ?? `/generated/${safeName(opts.carId)}`;

  const plate = segment.licensePlate;
  if (!plate) {
    trace.push("skipped: plate_not_found");
    return {
      url: null,
      plateHidden: false,
      backgroundEdited: false,
      rejectedReason: "plate_not_found",
      carMaskDiff: null,
      plateBox: null,
      width: w,
      height: h,
      badge: LISTING_BADGE_NO_BG,
      trace,
    };
  }

  let hidden = await hidePlate(image, plate.box);
  trace.push(`plate_hidden: box ${plate.box.x1},${plate.box.y1}-${plate.box.x2},${plate.box.y2} (+8%, blur sigma 30, HANBRIDGE plate)`);

  let backgroundEdited = false;
  let rejectedReason: string | undefined;
  let carMaskDiff: number | null = null;

  const car = segment.car;
  if (!car || !car.maskDecoded || !car.mask) {
    rejectedReason = "car_mask_unavailable";
    trace.push("background: skipped, car mask unavailable");
  } else {
    try {
      // edits input as in the smoke run (<=1024 px wide); result is verified in that same size
      const sentW = Math.min(w, 1024);
      const sentH = Math.max(1, Math.round((h * sentW) / w));
      const sent = await sharp(hidden).resize(sentW, sentH).jpeg({ quality: 88 }).toBuffer();
      const scaledCar: SamInstance = {
        ...car,
        box: {
          x1: Math.round((car.box.x1 * sentW) / w),
          y1: Math.round((car.box.y1 * sentH) / h),
          x2: Math.round((car.box.x2 * sentW) / w),
          y2: Math.round((car.box.y2 * sentH) / h),
          w: sentW,
          h: sentH,
        },
      };
      const maskPng = await backgroundEditMaskPng(scaledCar, { w: sentW, h: sentH });
      const edited = await editImage({ image: sent, mask: maskPng, prompt: LISTING_PROMPT });
      trace.push(`image_edit: maskUsed=${edited.maskUsed} ms=${edited.ms}`);
      const sentMask = await carMaskRaster(scaledCar, { w: sentW, h: sentH });
      carMaskDiff = await meanDiffInsideMask(sent, edited.image, sentMask, { w: sentW, h: sentH });
      trace.push(`car_pixel_diff: ${carMaskDiff.toFixed(2)} (threshold ${CAR_PIXEL_DIFF_THRESHOLD})`);
      if (carMaskDiff > CAR_PIXEL_DIFF_THRESHOLD) {
        rejectedReason = `vehicle_pixels_changed: meanDiff ${carMaskDiff.toFixed(2)} > ${CAR_PIXEL_DIFF_THRESHOLD}`;
        trace.push("background: rejected, vehicle pixels changed; fallback = plate hidden, original background");
      } else {
        // the generator may redraw a readable plate: hide it again on the accepted result
        const restored = await sharp(edited.image).resize(w, h, { fit: "fill" }).jpeg({ quality: 90 }).toBuffer();
        hidden = await hidePlate(restored, plate.box);
        backgroundEdited = true;
        trace.push("background: accepted, plate re-hidden on edited image");
      }
    } catch (e) {
      rejectedReason = `image_edit_failed: ${e instanceof Error ? e.message.slice(0, 200) : "unknown"}`;
      trace.push(`background: edit failed, fallback = plate hidden, original background (${rejectedReason})`);
    }
  }

  const result: ListingPhotoResult = {
    url: `${urlPrefix}/${safeName(opts.photoId)}-listing.jpg`,
    plateHidden: true,
    backgroundEdited,
    ...(rejectedReason ? { rejectedReason } : {}),
    carMaskDiff,
    plateBox: plate.box,
    width: w,
    height: h,
    badge: backgroundEdited ? LISTING_BADGE : LISTING_BADGE_NO_BG,
    trace,
  };
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, `${safeName(opts.photoId)}-listing.jpg`), hidden);
  await writeFile(path.join(outDir, `${safeName(opts.photoId)}-listing.json`), JSON.stringify(result, null, 2));
  return result;
}

/** Listing images must never become Finding evidence. Throws on the first hit. */
export function assertFindingsFreeOfListingEvidence(findings: Finding[], listingPhotoIds: string[]): void {
  const ids = new Set(listingPhotoIds);
  for (const f of findings) {
    for (const ev of f.evidence) {
      if (ids.has(ev.mediaId) || (ev.maskRef ?? "").includes("-listing")) {
        throw new Error(`listing image used as evidence in finding ${f.id} (mediaId=${ev.mediaId})`);
      }
    }
  }
}

const heroCache = new Map<string, string>();

/** Hero background for a report page: generated once per report, cached in Blob (local fallback without a token). */
export async function getOrCreateHeroImage(reportId: string): Promise<{ url: string; generated: boolean }> {
  const cached = heroCache.get(reportId);
  if (cached) return { url: cached, generated: false };
  const name = `heroes/${safeName(reportId)}.png`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const existing = await head(name);
      if (existing?.url) {
        heroCache.set(reportId, existing.url);
        return { url: existing.url, generated: false };
      }
    } catch {
      // not generated yet
    }
    const gen = await generateImage({ prompt: HERO_PROMPT });
    const png = await sharp(gen.image).png().toBuffer();
    const blob = await put(name, png, { access: "public", contentType: "image/png", addRandomSuffix: false });
    heroCache.set(reportId, blob.url);
    return { url: blob.url, generated: true };
  }

  const dir = path.join(process.cwd(), "public", "generated", "heroes");
  const file = path.join(dir, `${safeName(reportId)}.png`);
  try {
    await readFile(file);
    const url = `/generated/heroes/${safeName(reportId)}.png`;
    heroCache.set(reportId, url);
    return { url, generated: false };
  } catch {
    const gen = await generateImage({ prompt: HERO_PROMPT });
    await mkdir(dir, { recursive: true });
    await writeFile(file, await sharp(gen.image).png().toBuffer());
    const url = `/generated/heroes/${safeName(reportId)}.png`;
    heroCache.set(reportId, url);
    return { url, generated: true };
  }
}

