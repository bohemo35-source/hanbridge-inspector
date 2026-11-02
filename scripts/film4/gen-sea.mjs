// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Muse Image candidates for the film v4 "at sea" shot: ro-ro ship with the stern ramp CLOSED (the Wan clip s6-1 sails with the ramp open); writes film-v4 work files + prompts.json
// @created: 2026-11-02
// usage: NODE_USE_ENV_PROXY=1 node --env-file=.env.local scripts/film4/gen-sea.mjs <outDir>
import { writeFileSync, mkdirSync } from "node:fs";
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const PROMPTS = [
  "cinematic aerial drone photograph at blue hour, a large dark car carrier ro-ro vessel sailing across a deep blue open sea, seen from high above and behind at three-quarter angle, the stern ramp is fully closed and folded flat against the hull, no open doors, warm deck lights and lit bridge windows, long white foamy wake, light mist, moody teal and sodium orange color grade, photorealistic, 16:9, no text, no logos",
  "photorealistic aerial view at dusk of a big roll-on roll-off car transport ship crossing the Sea of Japan, open water to the horizon, ship hull closed with stern ramp raised and sealed shut, warm lights on deck and superstructure, white wake trailing behind, dark navy sea with gentle swell, cinematic film still, 16:9, no text",
  "film still, high wide aerial shot, night sea, a car carrier ship moving forward leaving a bright wake, the ship's rear loading ramp closed and raised vertical, sodium deck lights, wisps of fog over the water, deep blue and amber palette, anamorphic, photorealistic, no text",
];
const log = [];
for (const [i, prompt] of PROMPTS.entries()) {
  const t0 = Date.now();
  const r = await fetch("https://api.meta.ai/v1/images/generations", { method: "POST", headers: { Authorization: `Bearer ${process.env.META_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "muse-image-1.0", prompt, n: 1 }) });
  const j = await r.json(); const b64 = j.data?.[0]?.b64_json;
  if (b64) writeFileSync(`${out}/sea-${i}.png`, Buffer.from(b64, "base64"));
  log.push({ i, status: r.status, ms: Date.now() - t0, prompt, ok: !!b64, err: b64 ? undefined : JSON.stringify(j).slice(0, 200) });
  console.log(i, r.status, Date.now() - t0, "ms", !!b64);
}
writeFileSync(`${out}/prompts.json`, JSON.stringify({ model: "muse-image-1.0", created: new Date().toISOString(), shots: log }, null, 2));
