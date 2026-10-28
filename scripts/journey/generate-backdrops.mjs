// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: One-off generation of 7 journey stage backdrops via Muse Image (muse-image-1.0), provenance in prompts.json
// @created: 2026-10-28
// Usage: node scripts/journey/generate-backdrops.mjs   (reads META_API_KEY from env or .env.local; run ONCE)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import sharp from "sharp";

const STYLE =
  "Cinematic wide establishing shot, twilight and dawn, soft haze, muted teal and warm amber palette, " +
  "photorealistic backdrop for a 3D scene, no people, no text, no logos, no recognizable brands, no licence plates";

const PROMPTS = {
  inspection:
    "Car inspection yard in South Korea at dusk, empty paved lot with a bright rectangular softbox light rig, distant low hills and city glow. " + STYLE,
  korea_road:
    "Night highway in South Korea curving toward a generic cable-stayed bridge over a dark bay, car light trails, city lights on the shore. " + STYLE,
  port_busan:
    "Generic container departure port at dusk, gantry cranes and stacked shipping containers, calm harbour water, a plain roll-on roll-off ship silhouette without markings. " + STYLE,
  sea: "Open sea at dawn, gentle waves, a plain unbranded roll-on roll-off cargo ship far away, pastel sky with soft haze, no land. " + STYLE,
  vladivostok:
    "Generic cable-stayed bridge and green sopka hills over a bay at sunrise, a far-eastern port city waking up, golden dawn light, soft haze. " + STYLE,
  customs:
    "Border customs checkpoint at dawn, plain inspection gates and a small booth, empty asphalt lanes, soft morning haze, mountains behind. " + STYLE,
  delivery:
    "Long empty highway stretching to the horizon across open steppe at dawn, distant low mountains, warm sunrise glow, a sense of a long journey home. " + STYLE,
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

const outDir = new URL("../../public/journey/", import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });
const provenance = [];
for (const [stage, prompt] of Object.entries(PROMPTS)) {
  const file = `${outDir}${stage}.jpg`;
  if (existsSync(file)) { console.log(`skip existing ${stage}.jpg`); provenance.push({ stage, prompt, model: "muse-image-1.0", date: new Date().toISOString(), skipped: true }); continue; }
  const start = Date.now();
  const res = await fetch("https://api.meta.ai/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "muse-image-1.0", prompt, n: 1 }),
  });
  const ms = Date.now() - start;
  if (!res.ok) { console.error(`${stage}: HTTP ${res.status} in ${ms}ms`); process.exitCode = 1; continue; }
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) { console.error(`${stage}: no b64_json in response (${ms}ms)`); process.exitCode = 1; continue; }
  await sharp(Buffer.from(b64, "base64")).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(file);
  console.log(`${stage}.jpg saved in ${ms}ms`);
  provenance.push({ stage, prompt, model: "muse-image-1.0", date: new Date().toISOString(), ms });
}
writeFileSync(`${outDir}prompts.json`, JSON.stringify(provenance, null, 2) + "\n");
console.log("prompts.json saved");
