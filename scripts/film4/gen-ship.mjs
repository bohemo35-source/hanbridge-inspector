// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: film v4 sea shots with ONE ship: Muse Image edits the v3 first frames of s6-1 (open sea) and s7-1 (arrival under the Russky bridge) to close the stern ramp, then Wan 2.2 (Modal) animates them; replaces the static Muse Image stills sea-v4 / vlad-v4 that showed two different ships
// @created: 2026-11-03
// usage:
//   NODE_USE_ENV_PROXY=1 node --env-file=.env.local scripts/film4/gen-ship.mjs edit <workDir> [n=2]
//   NODE_USE_ENV_PROXY=1 node --env-file=.env.local scripts/film4/gen-ship.mjs wan <workDir> <shot> <frame.png> [seed]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const [mode, work] = process.argv.slice(2);
mkdirSync(work, { recursive: true });
const V3 = path.resolve("../film-v3/work/v3frames");
const KEEP = "Keep exactly this same frame: the same black-hulled car carrier ship with the white superstructure and warm deck lights, the same size, position, camera angle, water, wake, fog and colour grade.";
const RAMP = "Change only the stern: the big stern loading ramp is raised and closed flat against the transom, the stern opening is shut, no lit opening, no ramp touching the water.";
const STYLE = " Photorealistic cinematic film still, 16:9, no text, no logos.";
const SHOTS = {
  sea: { src: `${V3}/s6-1.png`, motion: "The car carrier ship sails steadily forward across the open sea, its white wake trailing behind and foam rolling on the swell; the drone camera slowly follows from above and behind. The stern ramp stays raised and closed the whole time. Calm realistic motion, no new ships, no text." },
  bay: { src: `${V3}/s7-1.png`, motion: "The car carrier ship glides slowly forward into the misty bay toward the cable-stayed bridge, gentle ripples spread from the hull, morning fog drifts over the water; the drone camera slowly pushes in. The stern ramp stays raised and closed the whole time. Calm realistic motion, no new ships, no text." },
};

if (mode === "edit") {
  const n = Number(process.argv[4] ?? 2);
  const log = [];
  await Promise.all(Object.entries(SHOTS).flatMap(([id, s]) => Array.from({ length: n }, async (_, i) => {
    const t0 = Date.now();
    const r = await fetch("https://api.meta.ai/v1/images/edits", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.META_API_KEY}` },
      body: JSON.stringify({ model: "muse-image-1.0", n: 1, prompt: `${KEEP} ${RAMP}${STYLE}`, images: [{ image_url: "data:image/png;base64," + readFileSync(s.src).toString("base64") }] }),
    });
    const t = await r.text(); const b64 = r.ok ? JSON.parse(t).data?.[0]?.b64_json : undefined;
    if (b64) writeFileSync(path.join(work, `${id}-edit${i}.png`), Buffer.from(b64, "base64"));
    log.push({ id, i, status: r.status, ms: Date.now() - t0, ok: !!b64, err: b64 ? undefined : t.slice(0, 200) });
    console.log(id, i, r.status, Date.now() - t0, "ms", !!b64);
  })));
  writeFileSync(path.join(work, "edit-log.json"), JSON.stringify({ model: "muse-image-1.0", prompt: `${KEEP} ${RAMP}${STYLE}`, log }, null, 1));
} else if (mode === "wan") {
  const [shot, frame, seed = "7"] = process.argv.slice(4);
  const WAN = process.env.WAN_URL ?? "https://bohemo35--hanbridge-wan-web.us-east.modal.run";
  const auth = { Authorization: `Bearer ${process.env.GLIMMER_API_KEY}` };
  const r = await fetch(`${WAN}/submit`, { method: "POST", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify({ image_b64: readFileSync(frame).toString("base64"), prompt: SHOTS[shot].motion, seed: Number(seed) }) });
  if (!r.ok) throw new Error(`submit ${r.status} ${await r.text()}`);
  const { id } = await r.json(); const t0 = Date.now(); console.log("submitted", shot, id);
  for (;;) {
    const q = await fetch(`${WAN}/result/${id}`, { headers: auth });
    if (q.status === 200) { const out = path.join(work, `${shot}-wan-s${seed}.mp4`); writeFileSync(out, Buffer.from(await q.arrayBuffer())); console.log("done", out, Math.round((Date.now() - t0) / 1000), "s"); break; }
    if (q.status === 500) throw new Error(`wan failed: ${await q.text()}`);
    if (Date.now() - t0 > 40 * 60 * 1000) throw new Error("wan timeout 40 min");
    await new Promise((s) => setTimeout(s, 20000));
  }
  writeFileSync(path.join(work, `${shot}-wan-s${seed}.json`), JSON.stringify({ model: "wan-2.2-i2v (Modal)", frame: path.basename(frame), seed: Number(seed), prompt: SHOTS[shot].motion }, null, 1));
}
