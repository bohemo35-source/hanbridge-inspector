// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Upload the web copies of each car's paint-gauge video (540p, inspector's voice kept) to the project Blob store under demo/<car>/gauge/; writes src/lib/garage/gauge-videos.json {carId: {url, source}}
// @created: 2026-11-02
// usage: NODE_USE_ENV_PROXY=1 node --env-file=.env.local scripts/film4/upload-gauge.mjs <dir with <car>-gauge.mp4>
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { put } from "@vercel/blob";
const dir = process.argv[2];
const SRC = { "kia-sportage": "245538_file_245538_0.mp4", "kia-morning": "VIDEO-2026-10-27-15-02-03.mp4", "audi-a5-2005": "9e399e1d-aa27-4150-a5f4-1dfc1dbb2cfd.mp4", "bmw-x3-8278": "578920ee-896b-4fb9-bec4-d3c6d766bdca.mp4", "bmw-530i-8053": "VIDEO-2026-04-14-21-10-10.mp4", "mini-cooper-s": "paint_gauge.mp4" };
const OUT = new URL("../../src/lib/garage/gauge-videos.json", import.meta.url);
const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
for (const [car, source] of Object.entries(SRC)) {
  if (out[car]) { console.log(car, "already", out[car].url); continue; }
  const b = await put(`demo/${car}/gauge/${car}-gauge.mp4`, readFileSync(`${dir}/${car}-gauge.mp4`), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "video/mp4" });
  out[car] = { url: b.url, source };
  writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(car, b.url);
}
