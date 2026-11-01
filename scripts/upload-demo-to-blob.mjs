// @agent:   claude
// @project: hanbridge-inspector
// @purpose: Upload demo-car media from demo-data/<carId> to Vercel Blob and write src/lib/agent/blob-manifest.json
//           (carMedia / ensureMediaFile read it on Vercel). Resumable + idempotent (state in demo-data/.blob-state.json).
//           photos, sheets, inspector_report_ru.txt, out/photo-index.json: as is.
//           sheets/*.pdf: personal data redacted first (scripts/redact_diag_pdf.py: name/address line, phones, links, VIN tail) - the repo/manifest is public.
//           video: voice-grade copy (144p, AAC 64k mono) - the agent only needs the inspector's voice from it;
//           paint_gauge.mp4 stays original because gauge frames are read from the picture. --videos original uploads everything as is.
//   node --env-file=.env.local scripts/upload-demo-to-blob.mjs [--cars a,b] [--videos voice|original] [--budget 150] [--concurrency 4] [--dry] [--verify]
// @created: 2026-11-01
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { put } from "@vercel/blob";

const run = promisify(execFile);
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i < 0 ? d : (process.argv[i + 1]?.startsWith("--") || process.argv[i + 1] === undefined ? true : process.argv[i + 1]); };
const DEMO = path.join(process.cwd(), "demo-data");
const STATE_FILE = path.join(DEMO, ".blob-state.json");
const MANIFEST_FILE = path.join(process.cwd(), "src/lib/agent/blob-manifest.json");
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const cars = (arg("cars", "") || readdirSync(DEMO).filter((d) => statSync(path.join(DEMO, d)).isDirectory()).join(",")).split(",").filter(Boolean);
const videoMode = arg("videos", "voice");
const budgetMs = Number(arg("budget", 150)) * 1000;
const concurrency = Number(arg("concurrency", 4));
const dry = arg("dry", false) === true;
const verify = arg("verify", false) === true;
const t0 = Date.now();
const timeLeft = () => budgetMs - (Date.now() - t0);

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".pdf": "application/pdf", ".txt": "text/plain; charset=utf-8", ".json": "application/json", ".mp4": "video/mp4", ".mov": "video/quicktime" };
const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : {};
const saveState = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 1));
const ls = (d) => (existsSync(d) ? readdirSync(d).filter((f) => !f.startsWith(".") && statSync(path.join(d, f)).isFile()).sort() : []);

if (verify) {
  const m = JSON.parse(readFileSync(MANIFEST_FILE, "utf8"));
  const items = Object.entries(m.cars).flatMap(([c, dirs]) => Object.entries(dirs).flatMap(([d, files]) => Object.entries(files).map(([n, url]) => ({ c, d, n, url }))));
  let bad = 0, done = 0, bytes = 0; const q = [...items];
  await Promise.all(Array.from({ length: 8 }, async () => { for (let it; (it = q.shift()); ) {
    try { const r = await fetch(it.url, { method: "HEAD" }); bytes += Number(r.headers.get("content-length") ?? 0); if (!r.ok) { bad++; console.log("BAD", r.status, it.c, it.d, it.n); } } catch (e) { bad++; console.log("ERR", it.c, it.d, it.n, e.message); }
    done++;
  } }));
  console.log(`verify: ${done} urls, ${bad} bad, ${(bytes / 1048576).toFixed(1)} MB`);
  process.exit(bad ? 1 : 0);
}

if (!dry && !process.env.BLOB_READ_WRITE_TOKEN) { console.error("BLOB_READ_WRITE_TOKEN missing (use --env-file=.env.local)"); process.exit(2); }

// ---- plan
const jobs = [];
for (const carId of cars) {
  const base = path.join(DEMO, carId);
  const add = (dir, name, file, extra = {}) => jobs.push({ carId, dir, name, file, blobPath: dir === "root" ? `demo/${carId}/${name}` : `demo/${carId}/${dir}/${name}`, ...extra });
  for (const n of ls(path.join(base, "photos"))) if (/\.(jpe?g|png)$/i.test(n)) add("photos", n, path.join(base, "photos", n));
  for (const n of ls(path.join(base, "sheets"))) {
    add("sheets", n, path.join(base, "sheets", n), { redactPdf: /\.pdf$/i.test(n) });
    // text of the redacted PDF: read_diagnostic_report uses it on Vercel (no pdftotext there)
    if (/\.pdf$/i.test(n)) add("sheets", `${n}.txt`, path.join(base, "sheets", n), { redactText: true });
  }
  if (existsSync(path.join(base, "out", "photo-index.json"))) add("out", "photo-index.json", path.join(base, "out", "photo-index.json"));
  if (existsSync(path.join(base, "inspector_report_ru.txt"))) add("root", "inspector_report_ru.txt", path.join(base, "inspector_report_ru.txt"));
  for (const n of ls(path.join(base, "video"))) if (/\.(mp4|mov)$/i.test(n)) add("video", n, path.join(base, "video", n), { transcode: videoMode !== "original" && n !== "paint_gauge.mp4" });
}
const keyOf = (j) => `${j.carId}/${j.dir}/${j.name}`;

async function voiceCopy(j) {
  const out = path.join(os.tmpdir(), "hb-voice-cache", j.carId, j.name.replace(/\.[^.]+$/, "") + ".mp4");
  const src = statSync(j.file);
  const stamp = `${out}.stamp`;
  if (existsSync(out) && existsSync(stamp) && readFileSync(stamp, "utf8") === `${src.size}:${src.mtimeMs}`) return out;
  mkdirSync(path.dirname(out), { recursive: true });
  await run(FFMPEG, ["-y", "-v", "error", "-i", j.file, "-vf", "scale=-2:144,fps=2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "38", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "64k", "-ac", "1", "-ar", "16000", "-movflags", "+faststart", out]);
  writeFileSync(stamp, `${src.size}:${src.mtimeMs}`);
  return out;
}

async function redactedPdf(j) {
  const out = path.join(os.tmpdir(), "hb-redact-cache", j.carId, j.name);
  const src = statSync(j.file); const stamp = `${out}.stamp`;
  if (existsSync(out) && existsSync(stamp) && readFileSync(stamp, "utf8") === `${src.size}:${src.mtimeMs}`) return out;
  mkdirSync(path.dirname(out), { recursive: true });
  await run("python3", [path.join(process.cwd(), "scripts/redact_diag_pdf.py"), j.file, out]);
  writeFileSync(stamp, `${src.size}:${src.mtimeMs}`);
  return out;
}

const stats = { uploaded: 0, skipped: 0, failed: 0, bytes: 0, planned: jobs.length };
let stopped = false;
async function doJob(j) {
  if (timeLeft() < 8000) { stopped = true; return; }
  const k = keyOf(j);
  let file = j.file;
  if (j.transcode) { try { file = await voiceCopy(j); } catch (e) { stats.failed++; console.log("transcode failed", k, String(e.stderr ?? e.message).slice(0, 200)); return; } }
  if (j.redactText) { try { const pdf = await redactedPdf(j); file = `${pdf}.txt`; await run("pdftotext", ["-layout", pdf, file]); } catch (e) { stats.failed++; console.log("redact text failed (NOT uploaded)", k, String(e.stderr ?? e.message).slice(0, 200)); return; } }
  if (j.redactPdf) { try { file = await redactedPdf(j); } catch (e) { stats.failed++; console.log("redact failed (NOT uploaded)", k, String(e.stderr ?? e.message).slice(0, 200)); return; } }
  const st = statSync(file);
  const sig = `${st.size}:${st.mtimeMs}`;
  if (state[k]?.sig === sig && state[k]?.url) { stats.skipped++; return; }
  if (dry) { stats.uploaded++; stats.bytes += st.size; return; }
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await put(j.blobPath, await readFile(file), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream", cacheControlMaxAge: 31536000 });
      state[k] = { sig, size: st.size, url: res.url, transcode: Boolean(j.transcode) };
      stats.uploaded++; stats.bytes += st.size;
      if (stats.uploaded % 25 === 0) { saveState(); console.log(`  ${stats.uploaded} uploaded, ${(stats.bytes / 1048576).toFixed(1)} MB, ${Math.round((Date.now() - t0) / 1000)}s`); }
      return;
    } catch (e) { if (attempt === 4) { stats.failed++; console.log("FAILED", k, String(e.message).slice(0, 160)); } else await new Promise((r) => setTimeout(r, 600 * attempt)); }
  }
}
const queue = [...jobs];
await Promise.all(Array.from({ length: concurrency }, async () => { for (let j; (j = queue.shift()); ) { if (stopped) break; await doJob(j); } }));
if (!dry) saveState();

// ---- manifest from state (only files that still exist locally and are uploaded)
const manifest = { version: 1, generatedAt: new Date().toISOString(), videos: videoMode, cars: {} };
let missing = 0;
for (const j of jobs) {
  const e = state[keyOf(j)];
  if (!e?.url) { missing++; continue; }
  ((manifest.cars[j.carId] ??= {})[j.dir] ??= {})[j.name] = e.url;
}
for (const c of Object.values(manifest.cars)) for (const d of Object.keys(c)) c[d] = Object.fromEntries(Object.entries(c[d]).sort(([a], [b]) => a.localeCompare(b)));
if (!dry && missing === 0) writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 1) + "\n");
const per = Object.fromEntries(Object.entries(manifest.cars).map(([c, d]) => [c, Object.fromEntries(Object.entries(d).map(([k, v]) => [k, Object.keys(v).length]))]));
console.log(JSON.stringify({ ...stats, MB: +(stats.bytes / 1048576).toFixed(1), notUploadedYet: missing, manifestWritten: !dry && missing === 0, secs: Math.round((Date.now() - t0) / 1000), per }));
if (missing) console.log("INCOMPLETE: run again (resumes where it stopped)");
