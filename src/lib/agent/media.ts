// @agent:   claude
// @project: hanbridge-inspector
// @purpose: Demo-car media access. Local demo-data/<carId> when present (dev), otherwise Vercel Blob via blob-manifest.json
//           (written by scripts/upload-demo-to-blob.mjs). Blob files are downloaded once per instance into /tmp.
//           MEDIA_SOURCE=blob forces Blob (parity test), MEDIA_SOURCE=local forces demo-data.
// @created: 2026-11-01
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import manifestJson from "./blob-manifest.json";

/** "root" = files next to the folders (inspector_report_ru.txt). */
export type MediaDir = "photos" | "video" | "sheets" | "out" | "root";
interface Manifest { version: number; cars: Record<string, Partial<Record<MediaDir, Record<string, string>>>> }
const manifest = manifestJson as Manifest;

/** Cars uploaded by a visitor for one run: their files live in a local temp dir of this instance (never in Blob). */
const uploadedDirs = new Map<string, string>();
export function registerLocalCar(carId: string, dir: string) { uploadedDirs.set(carId, dir); }
const localBase = (carId: string) => uploadedDirs.get(carId) ?? path.join(process.cwd(), "demo-data", carId);
const localDir = (carId: string, dir: MediaDir) => (dir === "root" ? localBase(carId) : path.join(localBase(carId), dir));
export const tmpMediaRoot = () => path.join(tmpdir(), "hanbridge-media");

export function mediaSource(carId: string): "local" | "blob" {
  if (uploadedDirs.has(carId)) return "local";
  const forced = process.env.MEDIA_SOURCE;
  if (forced === "local") return "local";
  if (forced === "blob") return manifest.cars[carId] ? "blob" : "local";
  return existsSync(localBase(carId)) || !manifest.cars[carId] ? "local" : "blob";
}

/** Sorted file names in one media folder (same order as the old readdirSync listing). */
export function listMedia(carId: string, dir: MediaDir, exts: string[]): string[] {
  const ok = (f: string) => exts.some((e) => f.toLowerCase().endsWith(e));
  try {
    const names = mediaSource(carId) === "blob" ? Object.keys(manifest.cars[carId]?.[dir] ?? {}) : readdirSync(localDir(carId, dir));
    return names.filter(ok).sort();
  } catch { return []; }
}

export function hasMedia(carId: string, dir: MediaDir, name: string): boolean {
  return mediaSource(carId) === "blob" ? Boolean(manifest.cars[carId]?.[dir]?.[name]) : existsSync(path.join(localDir(carId, dir), name));
}

export const blobUrl = (carId: string, dir: MediaDir, name: string): string | undefined => manifest.cars[carId]?.[dir]?.[name];

const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "_");
export const tmpMediaPath = (carId: string, dir: MediaDir, name: string) =>
  path.join(tmpMediaRoot(), safe(carId), dir, `${createHash("sha1").update(name).digest("hex").slice(0, 8)}-${safe(name)}`);

const inflight = new Map<string, Promise<string>>();

async function download(url: string, dest: string): Promise<string> {
  const have = await stat(dest).catch(() => null);
  if (have && have.size > 0) return dest;
  await mkdir(path.dirname(dest), { recursive: true });
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const part = `${dest}.${process.pid}.${attempt}.part`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), createWriteStream(part));
      await rename(part, dest);
      return dest;
    } catch (e) { lastErr = e; await rm(part, { force: true }); await new Promise((r) => setTimeout(r, 400 * attempt)); }
  }
  throw new Error(`media download failed (${new URL(url).pathname}): ${(lastErr as Error)?.message ?? lastErr}`);
}

/** Absolute path of a media file: demo-data when local, else downloaded from Blob into /tmp (once per instance). */
export async function ensureMediaFile(carId: string, dir: MediaDir, name: string): Promise<string> {
  if (mediaSource(carId) === "local") return path.join(localDir(carId, dir), name);
  const url = blobUrl(carId, dir, name);
  if (!url) throw new Error(`media not in manifest: ${carId}/${dir}/${name}`);
  const dest = tmpMediaPath(carId, dir, name);
  let p = inflight.get(dest);
  if (!p) { p = download(url, dest).finally(() => inflight.delete(dest)); inflight.set(dest, p); }
  return p;
}

export async function readMediaBuffer(carId: string, dir: MediaDir, name: string): Promise<Buffer> {
  return readFile(await ensureMediaFile(carId, dir, name));
}
export async function readMediaText(carId: string, dir: MediaDir, name: string): Promise<string> {
  return readFile(await ensureMediaFile(carId, dir, name), "utf8");
}
