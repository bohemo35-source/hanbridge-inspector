// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Generate garage env/floor/wall textures via Muse Image (muse-image-1.0), provenance in public/garage/prompts.json
// @created: 2026-10-29
// Usage: node scripts/garage/generate-assets.mjs   (reads META_API_KEY from env or .env.local; run ONCE)
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import sharp from "sharp";

const ASSETS = {
  "env-garage": {
    width: 2048,
    prompt:
      "Wide 2:1 panoramic interior of a modern clean car inspection garage at night, linear LED ceiling light strips, dark panel walls, tool cabinets along the back wall, warm soft light glowing from the depth, empty centre with no car, no people, no text, no logos, photorealistic, cinematic",
  },
  "floor-epoxy": {
    width: 1024,
    prompt:
      "Seamless tileable texture of dark polished concrete and epoxy garage floor viewed directly from above, subtle mottling and faint reflections, no perspective, no objects, no markings, no text, photorealistic flat texture",
  },
  "wall-panel": {
    width: 1024,
    prompt:
      "Seamless tileable texture of dark brushed metal wall panels with fine vertical seams, matte industrial surface, viewed straight on, no perspective, no objects, no text, no logos, photorealistic flat texture",
  },
};

function loadKey() {
  if (process.env.META_API_KEY) return process.env.META_API_KEY;
  try {
    const env = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
    const m = env.match(/^META_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch { /* fall through */ }
  return null;
}

const key = loadKey();
if (!key) { console.error("META_API_KEY is not set"); process.exit(1); }

const outDir = new URL("../../public/garage/", import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });
const provenance = [];
for (const [name, cfg] of Object.entries(ASSETS)) {
  const file = `${outDir}${name}.jpg`;
  const start = Date.now();
  if (existsSync(file)) {
    console.log(`skip existing ${name}.jpg`);
    provenance.push({ file: `${name}.jpg`, prompt: cfg.prompt, model: "muse-image-1.0", date: new Date().toISOString(), ms: 0, bytes: statSync(file).size, skipped: true });
    continue;
  }
  const res = await fetch("https://api.meta.ai/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "muse-image-1.0", prompt: cfg.prompt, n: 1 }),
  });
  const ms = Date.now() - start;
  if (!res.ok) { console.error(`${name}: HTTP ${res.status} in ${ms}ms`); process.exitCode = 1; continue; }
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) { console.error(`${name}: no b64_json (${ms}ms)`); process.exitCode = 1; continue; }
  let quality = 82;
  let buf = await sharp(Buffer.from(b64, "base64")).resize({ width: cfg.width, withoutEnlargement: true }).jpeg({ quality }).toBuffer();
  while (buf.length > 1_000_000 && quality > 55) { quality -= 9; buf = await sharp(Buffer.from(b64, "base64")).resize({ width: cfg.width, withoutEnlargement: true }).jpeg({ quality }).toBuffer(); }
  writeFileSync(file, buf);
  console.log(`${name}.jpg saved in ${ms}ms bytes=${buf.length} q=${quality}`);
  provenance.push({ file: `${name}.jpg`, prompt: cfg.prompt, model: "muse-image-1.0", date: new Date().toISOString(), ms, bytes: buf.length, quality });
}
writeFileSync(`${outDir}prompts.json`, JSON.stringify(provenance, null, 2) + "\n");
console.log("prompts.json saved");
