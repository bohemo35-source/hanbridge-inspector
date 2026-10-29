// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Generate journey-v2 panoramas, bridge stills and terrain textures via Muse Image (one sequential run)
// @created: 2026-10-29
// Usage: node scripts/journey-v2/generate-assets.mjs   (reads META_API_KEY from env or .env.local; run ONCE)
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import sharp from "sharp";

const STYLE = "Cinematic premium automotive advertising look, anamorphic, soft haze, no people, no text, no logos, no recognizable brands, photorealistic.";
const ASSETS = {
  "env-seoul-night": `2:1 equirectangular night panorama of Seoul across a wide river, a long lit suspension bridge, city lights on both banks, deep blue night sky. ${STYLE}`,
  "env-port-night": `2:1 equirectangular night panorama of a container port, rows of shipping containers, portal cranes with lights, wet asphalt reflections, dark sea beyond. ${STYLE}`,
  "env-vladivostok-dawn": `2:1 equirectangular dawn panorama of Vladivostok bay, rounded forested hills (sopki) of the Russian Far East, a cable-stayed bridge in the distance, soft pink and gold sunrise light over calm water. ${STYLE}`,
  "env-golden-hour": `2:1 equirectangular golden-hour panorama of a quiet residential yard with a private garage, warm low sun, long soft shadows, calm evening sky. ${STYLE}`,
  "bridge-sourcing": `Night highway leading toward a bright car inspection centre, wet asphalt, headlight trails, city glow ahead, a lone premium car silhouette driving away from camera. ${STYLE}`,
  "bridge-documents": `A car transporter truck leaving an inspection garage bay at night, warm light spilling from the open bay door, cool blue night outside, documents-ready departure mood. ${STYLE}`,
  "bridge-sea": `Night sea from the stern of a car carrier vessel, moonlight, glowing wake trailing behind, calm dark water to the horizon, distant ship lights. ${STYLE}`,
  "bridge-customs": `Customs checkpoint gates at dawn, barrier arms and glass booths without any text, soft sunrise light, a premium car waiting to pass, quiet and orderly. ${STYLE}`,
  "tex-asphalt-wet": `Seamless tileable texture of wet dark asphalt viewed directly from above, subtle puddle reflections and fine grain, no perspective, no objects, no markings, no text, photorealistic flat texture.`,
  "tex-terrain-coast": `Seamless tileable top-down terrain texture of a coastline edge: sandy shore meeting dark blue-green sea water, viewed directly from above, no perspective, no objects, no text, photorealistic flat texture.`,
  "tex-terrain-forest": `Seamless tileable top-down terrain texture of dense green coniferous forest canopy, viewed directly from above, no perspective, no objects, no text, photorealistic flat texture.`,
  "tex-terrain-steppe": `Seamless tileable top-down terrain texture of dry golden steppe grassland with faint patches of earth, viewed directly from above, no perspective, no objects, no text, photorealistic flat texture.`,
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

const outDir = new URL("../../public/journey-v2/", import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });
const provenance = [];
for (const [name, prompt] of Object.entries(ASSETS)) {
  const file = `${outDir}${name}.jpg`;
  const start = Date.now();
  if (existsSync(file)) {
    console.log(`skip existing ${name}.jpg`);
    provenance.push({ file: `${name}.jpg`, prompt, model: "muse-image-1.0", date: new Date().toISOString(), ms: 0, bytes: statSync(file).size, skipped: true });
    continue;
  }
  const res = await fetch("https://api.meta.ai/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "muse-image-1.0", prompt, n: 1 }),
  });
  const ms = Date.now() - start;
  if (!res.ok) { console.error(`${name}: HTTP ${res.status} in ${ms}ms`); process.exitCode = 1; continue; }
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) { console.error(`${name}: no b64_json (${ms}ms)`); process.exitCode = 1; continue; }
  const raw = Buffer.from(b64, "base64");
  let q = 82;
  let out = await sharp(raw).jpeg({ quality: q }).toBuffer();
  while (out.length > 1_000_000 && q > 40) { q -= 10; out = await sharp(raw).jpeg({ quality: q }).toBuffer(); }
  writeFileSync(file, out);
  console.log(`${name}.jpg saved in ${ms}ms bytes=${out.length} q=${q}`);
  provenance.push({ file: `${name}.jpg`, prompt, model: "muse-image-1.0", date: new Date().toISOString(), ms, bytes: out.length, quality: q });
}
writeFileSync(`${outDir}prompts.json`, JSON.stringify(provenance, null, 2));
console.log("prompts.json saved");
