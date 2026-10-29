// @agent:   claude
// @project: hanbridge-inspector
// @purpose: Open-weight photo triage: Muse Glimmer (our Modal GPU) looks at EVERY inspection photo and indexes view /
//           whole-car / close-up / visible panels. The cloud agent then spends Spark + SAM only on the right photos,
//           and the listing photo is chosen from real whole-car 3/4 views. Cached per car.
// @created: 2026-10-29
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { glimmerJson, GLIMMER_MODEL } from "@/lib/meta/glimmer";
import { PANEL_IDS } from "@/lib/domain/panels";
import { photoPath } from "../catalog";

export const VIEWS = ["front", "rear", "left", "right", "front_left", "front_right", "rear_left", "rear_right", "detail", "interior", "engine", "underbody", "document", "other"] as const;
const QUARTER = new Set(["front_left", "front_right", "rear_left", "rear_right"]);

const EntrySchema = z.object({
  view: z.string().transform((v) => ((VIEWS as readonly string[]).includes(v) ? v : "other")),
  whole_car: z.boolean(),
  close_up: z.boolean(),
  panels: z.array(z.string()).default([]).transform((a) => a.filter((p) => (PANEL_IDS as readonly string[]).includes(p))),
  note: z.string().default(""),
});
export type PhotoIndexEntry = z.infer<typeof EntrySchema> & { photoId: string; ms: number };
export interface PhotoIndex { carId: string; model: string; createdAt: string; entries: PhotoIndexEntry[]; failed: string[]; totalMs: number }

const SPEC = `Schema: {"view": one of ${VIEWS.join("|")}, "whole_car": true if the entire car body is in frame (not cropped), "close_up": true if it shows only a part/detail, "panels": array of visible body panels from [${PANEL_IDS.join(", ")}], "note": max 12 words}. Left/right are the car's own sides (driver sits left).`;

const cacheFile = (carId: string) => path.join(process.cwd(), "demo-data", carId, "out", "photo-index.json");

export function readPhotoIndex(carId: string): PhotoIndex | null {
  try { return existsSync(cacheFile(carId)) ? (JSON.parse(readFileSync(cacheFile(carId), "utf8")) as PhotoIndex) : null; } catch { return null; }
}

export async function indexPhotos(opts: { carId: string; photos: string[]; concurrency?: number; useCache?: boolean; firstTimeoutMs?: number }): Promise<PhotoIndex> {
  if (opts.useCache !== false) { const c = readPhotoIndex(opts.carId); if (c && c.entries.length >= Math.min(opts.photos.length, 1)) return c; }
  const t0 = Date.now();
  const entries: PhotoIndexEntry[] = []; const failed: string[] = [];
  const one = async (photoId: string, timeoutMs: number) => {
    const s = Date.now();
    try {
      const jpg = await sharp(photoPath(opts.carId, photoId)).rotate().resize(640, 640, { fit: "inside" }).jpeg({ quality: 80 }).toBuffer();
      const e = await glimmerJson(EntrySchema, [{ role: "user", content: [
        { type: "text", text: "Used-car inspection photo. Classify it." },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpg.toString("base64")}` } },
      ] }], SPEC, { timeoutMs, maxTokens: 900 });
      entries.push({ ...e, photoId, ms: Date.now() - s });
    } catch { failed.push(photoId); }
  };
  // first call wakes the GPU container (cold start can take minutes) — run it alone with a long timeout
  const [first, ...rest] = opts.photos;
  if (first) await one(first, opts.firstTimeoutMs ?? 300000);
  const conc = opts.concurrency ?? 6;
  for (let i = 0; i < rest.length; i += conc) await Promise.all(rest.slice(i, i + conc).map((p) => one(p, 90000)));
  entries.sort((a, b) => a.photoId.localeCompare(b.photoId));
  const idx: PhotoIndex = { carId: opts.carId, model: GLIMMER_MODEL, createdAt: new Date().toISOString(), entries, failed, totalMs: Date.now() - t0 };
  try { mkdirSync(path.dirname(cacheFile(opts.carId)), { recursive: true }); writeFileSync(cacheFile(opts.carId), JSON.stringify(idx, null, 2)); } catch { /* read-only fs */ }
  return idx;
}

/** Defect-scan picks: whole-car or side views covering different sides first, then other exterior views. */
export function pickDefectPhotos(idx: PhotoIndex, n = 3): string[] {
  const ext = idx.entries.filter((e) => !["interior", "engine", "document", "underbody", "other"].includes(e.view));
  const score = (e: PhotoIndexEntry) => (e.whole_car ? 2 : 0) + (e.close_up ? -1 : 0) + e.panels.length * 0.1;
  const sorted = [...ext].sort((a, b) => score(b) - score(a));
  const out: string[] = []; const seen = new Set<string>();
  for (const e of sorted) { if (out.length >= n) break; if (seen.has(e.view)) continue; seen.add(e.view); out.push(e.photoId); }
  for (const e of sorted) { if (out.length >= n) break; if (!out.includes(e.photoId)) out.push(e.photoId); }
  return out;
}

/** Listing candidates: whole car in a 3/4 view first, then any whole-car exterior view. */
export function pickListingCandidates(idx: PhotoIndex): string[] {
  const whole = idx.entries.filter((e) => e.whole_car && !e.close_up);
  return [...whole.filter((e) => QUARTER.has(e.view)), ...whole.filter((e) => !QUARTER.has(e.view))].map((e) => e.photoId);
}
