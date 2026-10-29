// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Generate journey-v2 photo plates (empty foreground lane for the 3D car) via Muse Image; appends prompts.json
// @created: 2026-10-29
// Usage: node scripts/journey-v2/generate-plates.mjs   (META_API_KEY from env or .env.local; run ONCE)
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import sharp from "sharp";

const STYLE = "Cinematic premium automotive advertising look, anamorphic lens, soft haze, photorealistic, no people, no text, no logos, no recognizable brands, no cars in the foreground, empty road lane or apron in the foreground where a car will drive, horizon at about 42 percent of frame height, eye-level camera at 1.5 metres, slight three-quarter view.";
const ASSETS = {
  "plate-seoul-bridge": `Night Seoul: a long illuminated bridge across a wide river, skyscraper lights on both banks, wet asphalt, one completely empty right traffic lane leading away into the distance in the foreground. ${STYLE}`,
  "plate-port-ramp": `Night container port: portal cranes, rows of shipping containers, wet asphalt with sodium lamp reflections. On the right, the stern of a huge ro-ro car carrier ship with a lowered loading ramp and a brightly lit open hold doorway, empty apron and ramp in the foreground. ${STYLE}`,
  "plate-vladivostok-quay": `Dawn in Vladivostok: rounded forested hills (sopki), Russian Far East, a cable-stayed bridge far away in haze, a quay with a ro-ro ship with a lowered ramp beside it, empty quay apron and ramp leading toward the camera in the foreground. ${STYLE}`,
  "plate-handover": `Golden hour: a modern client house with a garage, a paved tiled driveway, warm light in the windows, empty driveway in the foreground leading to the house. ${STYLE}`,
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
  let q = 82, out = await sharp(raw).jpeg({ quality: q }).toBuffer();
  while (out.length > 1_000_000 && q > 40) { q -= 10; out = await sharp(raw).jpeg({ quality: q }).toBuffer(); }
  writeFileSync(file, out);
  console.log(`${name}.jpg saved in ${ms}ms bytes=${out.length} q=${q}`);
  provenance = provenance.filter((p) => p.file !== `${name}.jpg`);
  provenance.push({ file: `${name}.jpg`, prompt, model: "muse-image-1.0", date: new Date().toISOString(), ms, bytes: out.length, quality: q });
}
writeFileSync(provPath, JSON.stringify(provenance, null, 2));
console.log("prompts.json saved", statSync(provPath).size);
