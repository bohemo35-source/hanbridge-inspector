// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Muse Image concept frames for neutral body-type templates (sedan, hatchback, compact, city) — input for image-to-3D; same prompt recipe as public/models/provenance.json
// @created: 2026-11-02
// usage: NODE_USE_ENV_PROXY=1 node --env-file=.env.local scripts/bodies/concepts.mjs <outDir>
import { writeFileSync, mkdirSync } from "node:fs";
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const TAIL = "neutral light silver-grey paint, smooth generic design, no badges, no logos, no licence plate, closed doors, standard five-spoke alloy wheels, dark tinted windows, three-quarter front view from the front left at eye level, isolated product shot on a plain light grey seamless studio background, soft even diffuse lighting, no harsh reflections, whole car fully in frame with margin, sharp focus, photorealistic, orthographic-like long lens, no text, no people";
const BODIES = {
  sedan: "a modern mid-size four-door saloon sedan with a separate trunk",
  hatchback: "a modern five-door C-segment hatchback with a sloping rear hatch",
  compact: "a modern small three-door compact premium hatchback with short overhangs and a round-ish friendly face",
  city: "a modern tiny five-door A-segment city car, tall and narrow, very short",
};
const log = {};
for (const [k, body] of Object.entries(BODIES)) {
  const prompt = `${body}, ${TAIL}`; const t0 = Date.now();
  const r = await fetch("https://api.meta.ai/v1/images/generations", { method: "POST", headers: { Authorization: `Bearer ${process.env.META_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "muse-image-1.0", prompt, n: 1 }) });
  const j = await r.json(); const b64 = j.data?.[0]?.b64_json;
  if (b64) writeFileSync(`${out}/${k}.png`, Buffer.from(b64, "base64"));
  log[k] = { model: "muse-image-1.0", prompt, ms: Date.now() - t0, ok: !!b64 };
  console.log(k, r.status, Date.now() - t0, "ms", !!b64);
}
writeFileSync(`${out}/concepts.json`, JSON.stringify(log, null, 2));
