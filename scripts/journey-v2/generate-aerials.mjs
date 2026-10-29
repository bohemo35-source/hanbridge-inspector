// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Generate top-down (nadir) aerial road plates for the journey-v2 road block via Muse Image; appends prompts.json, logs time per call
// @created: 2026-10-30
// Usage: node scripts/journey-v2/generate-aerials.mjs   (META_API_KEY from env or .env.local; skips existing files)
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import sharp from "sharp";

const STYLE = "Strictly top-down nadir aerial drone photograph, camera pointing straight down at 90 degrees, no perspective, no horizon, no sky. A single empty two-lane asphalt road with faint white edge lines crosses the whole frame diagonally from the bottom-left corner to the top-right corner, the road is about 6 percent of the frame width. No cars, no vehicles, no people, no text, no logos, no signs. Soft natural daylight, photorealistic, sharp detail, muted cinematic colours.";
const ASSETS = {
  "aerial-coast": `Coastal road along the Sea of Japan: dark blue sea with gentle surf and rocky shoreline on the upper-left side of the road, green grassy hills with low shrubs on the other side. ${STYLE}`,
  "aerial-forest": `Road through dense Siberian taiga: dark green conifer and birch forest canopy on both sides of the road, a few small clearings. ${STYLE}`,
  "aerial-steppe": `Road through the Kazakh steppe: wide dry golden-ochre grassland with subtle texture, dirt tracks and sparse shrubs on both sides, late afternoon soft light with long faint shadows. ${STYLE}`,
  "aerial-suburb": `Road through a quiet suburb: small detached houses with grey and dark roofs, gardens, trees and driveways on both sides of the road. ${STYLE}`,
};
function loadKey() {
  if (process.env.META_API_KEY) return process.env.META_API_KEY;
  try { const m = readFileSync(new URL("../../.env.local", import.meta.url), "utf8").match(/^META_API_KEY=(.+)$/m); if (m) return m[1].trim().replace(/^["']|["']$/g, ""); } catch { /* */ }
  return null;
}
const key = loadKey();
if (!key) { console.error("META_API_KEY is not set"); process.exit(1); }
const outDir = new URL("../../public/journey-v2/", import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });
const provPath = `${outDir}prompts.json`;
let provenance = [];
try { provenance = JSON.parse(readFileSync(provPath, "utf8")); } catch { /* new */ }
for (const [name, prompt] of Object.entries(ASSETS)) {
  const file = `${outDir}${name}.jpg`;
  if (existsSync(file)) { console.log(`skip existing ${name}.jpg`); continue; }
  const start = Date.now();
  const res = await fetch("https://api.meta.ai/v1/images/generations", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "muse-image-1.0", prompt, n: 1 }) });
  const ms = Date.now() - start;
  if (!res.ok) { console.error(`${name}: HTTP ${res.status} in ${ms}ms`); process.exitCode = 1; continue; }
  const b64 = (await res.json())?.data?.[0]?.b64_json;
  if (!b64) { console.error(`${name}: no b64_json (${ms}ms)`); process.exitCode = 1; continue; }
  const raw = Buffer.from(b64, "base64");
  const meta = await sharp(raw).metadata();
  let q = 82, out = await sharp(raw).jpeg({ quality: q }).toBuffer();
  while (out.length > 1_000_000 && q > 40) { q -= 10; out = await sharp(raw).jpeg({ quality: q }).toBuffer(); }
  writeFileSync(file, out);
  console.log(`${name}.jpg saved in ${ms}ms ${meta.width}x${meta.height} bytes=${out.length} q=${q}`);
  provenance = provenance.filter((p) => p.file !== `${name}.jpg`);
  provenance.push({ file: `${name}.jpg`, prompt, model: "muse-image-1.0", date: new Date().toISOString(), ms, bytes: out.length, quality: q });
}
writeFileSync(provPath, JSON.stringify(provenance, null, 2));
console.log("prompts.json saved", statSync(provPath).size);
