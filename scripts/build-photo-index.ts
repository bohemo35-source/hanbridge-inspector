// @agent:   claude
// @project: hanbridge-inspector
// @purpose: Build demo-data/<carId>/out/photo-index.json (Muse Glimmer triage of every photo) so the agent run on Vercel never indexes live.
//           Resumable: progress is kept in out/photo-index.partial.json, each invocation stops after a time budget.
//           npx tsx --env-file=.env.local scripts/build-photo-index.ts <carId> [budgetSec=140] [photosPerChunk=12]
// @created: 2026-11-01
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { carMedia } from "../src/lib/agent/catalog";
import { glimmerConfigured, GLIMMER_MODEL } from "../src/lib/meta/glimmer";
import { indexPhotos, type PhotoIndex } from "../src/lib/agent/tools/photoIndex";

const carId = process.argv[2];
const budgetMs = Number(process.argv[3] ?? 140) * 1000;
const chunk = Number(process.argv[4] ?? 12);
if (!carId) { console.error("usage: build-photo-index.ts <carId> [budgetSec] [photosPerChunk]"); process.exit(2); }
if (!glimmerConfigured()) { console.error("GLIMMER_BASE_URL / GLIMMER_API_KEY not set"); process.exit(2); }

const outDir = path.join(process.cwd(), "demo-data", carId, "out");
const partialFile = path.join(outDir, "photo-index.partial.json");
const finalFile = path.join(outDir, "photo-index.json");
mkdirSync(outDir, { recursive: true });

const photos = carMedia(carId).photos;
const partial: PhotoIndex = existsSync(partialFile)
  ? (JSON.parse(readFileSync(partialFile, "utf8")) as PhotoIndex)
  : { carId, model: GLIMMER_MODEL, createdAt: new Date().toISOString(), entries: [], failed: [], totalMs: 0 };
const save = () => writeFileSync(partialFile, JSON.stringify(partial));

(async () => {
const t0 = Date.now();
let warm = partial.entries.length === 0; // GPU may be cold: first photo of a fresh run goes alone with the long timeout
for (let round = 0; Date.now() - t0 < budgetMs; round++) {
  const done = new Set([...partial.entries.map((e) => e.photoId), ...partial.failed]);
  let todo = photos.filter((p) => !done.has(p));
  // photos that failed once get one more try after everything else
  if (!todo.length) todo = partial.failed.filter((p) => !partial.entries.some((e) => e.photoId === p)).slice(0, chunk);
  if (!todo.length) break;
  const batch = todo.slice(0, chunk);
  const idx = await indexPhotos({ carId, photos: batch, useCache: false, persist: false, warm, firstTimeoutMs: Math.max(30000, budgetMs - (Date.now() - t0)) });
  warm = false;
  const gotIds = new Set(idx.entries.map((e) => e.photoId));
  partial.entries.push(...idx.entries);
  partial.failed = [...new Set([...partial.failed.filter((p) => !gotIds.has(p)), ...idx.failed])];
  partial.totalMs += idx.totalMs;
  save();
  console.log(`[${carId}] ${partial.entries.length}/${photos.length} indexed, failed=${partial.failed.length}, ${Math.round((Date.now() - t0) / 1000)}s`);
}
const complete = photos.every((p) => partial.entries.some((e) => e.photoId === p));
if (complete) {
  partial.entries.sort((a, b) => a.photoId.localeCompare(b.photoId));
  partial.createdAt = new Date().toISOString();
  writeFileSync(finalFile + ".tmp", JSON.stringify(partial, null, 2));
  renameSync(finalFile + ".tmp", finalFile);
  console.log(`[${carId}] DONE: ${partial.entries.length} entries -> ${path.relative(process.cwd(), finalFile)}`);
} else {
  console.log(`[${carId}] PARTIAL: ${partial.entries.length}/${photos.length}, run again`);
}
})().catch((e) => { console.error(e); process.exit(1); });
