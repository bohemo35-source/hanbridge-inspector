// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Muse Image stills for film v4 fixes: paint gauge on the door (no headlight in frame), ship arriving in Vladivostok with the stern ramp closed, two Encar-style listing photos for the "selection" insert
// @created: 2026-11-02
// usage: NODE_USE_ENV_PROXY=1 node --env-file=.env.local scripts/film4/gen-shots2.mjs <outDir>
import { writeFileSync, mkdirSync } from "node:fs";
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const SHOTS = {
  gauge: "cinematic close-up film still, a gloved hand in black nitrile glove pressing a small digital paint thickness gauge flat against the middle of the front door of a white SUV, the gauge screen glowing warm amber, raindrops on glossy white paint, door handle and side window edge visible, no headlights in frame, inspection garage at night with teal fluorescent light, shallow depth of field, photorealistic, 16:9, no text, no logos",
  vlad: "cinematic aerial drone photograph at misty dawn, a large dark car carrier ro-ro ship sailing into Vladivostok bay towards a long white cable-stayed bridge with two tall pylons in fog, hills and city lights on the shore, the ship's stern ramp fully closed and raised flush against the hull, calm water with soft reflections, pastel blue and pink sky, photorealistic, 16:9, no text",
  list1: "used car listing photo taken by a dealer, a white 2021 Kia Sportage SUV (fifth generation, boomerang LED daytime running lights, wide black grille) parked in a bright indoor underground parking lot in Seoul, front three-quarter view from the left at eye level, even fluorescent light, clean concrete floor, licence plate area covered by a plain dark rectangle, realistic smartphone photo, 4:3, no text, no watermark",
  list2: "used car listing photo, a white 2022 Kia Sportage SUV (fifth generation, boomerang LED daytime running lights) parked outdoors on a Korean used car dealer lot on an overcast day, other cars in the background, front three-quarter view from the right, licence plate area covered by a plain dark rectangle, realistic smartphone photo, 4:3, no text, no watermark",
};
const log = {};
await Promise.all(Object.entries(SHOTS).map(async ([k, prompt]) => {
  const t0 = Date.now();
  const r = await fetch("https://api.meta.ai/v1/images/generations", { method: "POST", headers: { Authorization: `Bearer ${process.env.META_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "muse-image-1.0", prompt, n: 1 }) });
  const j = await r.json(); const b64 = j.data?.[0]?.b64_json;
  if (b64) writeFileSync(`${out}/${k}.png`, Buffer.from(b64, "base64"));
  log[k] = { model: "muse-image-1.0", prompt, ms: Date.now() - t0, ok: !!b64 };
  console.log(k, r.status, Date.now() - t0, "ms", !!b64);
}));
writeFileSync(`${out}/prompts.json`, JSON.stringify(log, null, 2));
