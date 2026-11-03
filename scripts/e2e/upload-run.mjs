// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: e2e of «check your own car»: posts photos (resized like the browser, ≤1280 px) + optional typed gauge numbers / video URL to /api/upload-run and prints the SSE steps and the result
// @created: 2026-11-03
// usage: node scripts/e2e/upload-run.mjs <baseUrl> <make> <model> <year> <body> <photo…> [--paint panel=µm,…] [--video <blob url>]
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
const paint = opt("--paint"), video = opt("--video");
const [base, make, model, year, bodyType, ...photos] = args;
const fd = new FormData();
fd.append("make", make); fd.append("model", model); fd.append("year", year); fd.append("bodyType", bodyType);
for (const [i, p] of photos.entries()) {
  const jpg = await sharp(readFileSync(p)).rotate().resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  fd.append("photos", new Blob([jpg], { type: "image/jpeg" }), `photo-${i + 1}${path.extname(p) ? ".jpg" : ""}`);
}
for (const kv of (paint ?? "").split(",").filter(Boolean)) { const [k, v] = kv.split("="); fd.append(`paint_${k}`, v); }
if (video) fd.append("videoUrl", video);
const t0 = Date.now();
const res = await fetch(`${base}/api/upload-run`, { method: "POST", body: fd });
if (!res.ok || !res.body) { console.log("HTTP", res.status, await res.text()); process.exit(1); }
const dec = new TextDecoder(); let buf = "";
for await (const chunk of res.body) {
  buf += dec.decode(chunk, { stream: true });
  const blocks = buf.split("\n\n"); buf = blocks.pop() ?? "";
  for (const b of blocks) {
    const ev = b.match(/event: (\w+)/)?.[1]; const data = b.match(/data: (.*)/s)?.[1]; if (!ev || !data) continue;
    const p = JSON.parse(data);
    if (ev === "step") console.log(`${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s #${p.i} ${p.ok ? "✓" : "✗"} ${p.tool} ${p.argsSummary?.slice(0, 60) ?? ""} → ${p.outputSummary?.slice(0, 220) ?? ""}`);
    else console.log(ev.toUpperCase(), JSON.stringify(p));
  }
}
console.log("total", ((Date.now() - t0) / 1000).toFixed(1), "s");
