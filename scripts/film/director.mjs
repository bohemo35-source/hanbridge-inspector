// Film pipeline for the journey: Muse Spark directs (shot prompt from the first frame), Wan 2.2 animates (Modal web service),
// Muse Spark reviews the take (3 frames) and asks for a re-take when the car morphs or motion is wrong.
// Usage: node scripts/film/director.mjs <framesDir> <outDir> [sceneId,...]
// Env: META_API_KEY, GLIMMER_API_KEY (bearer for the Modal service), WAN_URL (default below).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const [framesDir = "/home/claude/film/frames", outDir = "/home/claude/film/out", only = ""] = process.argv.slice(2);
const WAN = process.env.WAN_URL ?? "https://bohemo35--hanbridge-wan-web.us-east.modal.run";
const META = "https://api.meta.ai/v1/chat/completions";
mkdirSync(outDir, { recursive: true });
const logPath = join(outDir, "log.json");
const log = existsSync(logPath) ? JSON.parse(readFileSync(logPath, "utf8")) : {};
const save = () => writeFileSync(logPath, JSON.stringify(log, null, 2));

// Story order. intent = what must happen; the director turns it into a Wan prompt that fits the actual frame.
const SCENES = [
  { id: "seoul", intent: "Night, light rain, Seoul. The silver SUV drives forward along the wet riverside road toward the lit cable-stayed bridge. The camera stays close behind the car and travels with it at the same speed, the car stays large in frame. Taillights glow, reflections slide on wet asphalt." },
  { id: "sourcing", intent: "Night highway leading to the inspection center. Slow forward dolly along the road, light streaks, gentle haze. No new cars appear in the foreground." },
  { id: "port", intent: "Night container port, Busan. The silver SUV drives slowly forward and up the lowered ramp into the glowing hold of the ro-ro ship. The camera follows behind and slightly to the side. Cranes and container lights in the background stay still." },
  { id: "sea", intent: "Night sea. The ro-ro car carrier sails forward on calm water under the moon, gentle wake behind it, slow aerial camera drift alongside the ship." },
  { id: "vladivostok", intent: "Misty dawn, Vladivostok. The silver SUV drives down the ramp of the ship and rolls slowly onto the quay toward the camera, the camera slowly pulls back, morning haze over the bay and the distant cable-stayed bridge." },
  { id: "customs", intent: "Dawn at the customs gate. Slow push-in toward the gate, the barrier lifts, soft morning light, light fog." },
  { id: "road", intent: "Top-down aerial drone shot. The silver SUV drives along the forest road from lower left to upper right, the camera tracks it from above at the same speed, keeping the car centered. Trees and road texture scroll past." },
  // v2 story (bridge = trust): new shots
  { id: "bridge-a", intent: "Blue hour over the Han River. Very slow aerial dolly forward toward the cable-stayed bridge; the golden light line along the bridge deck gently pulses brighter, as if a path is lighting up. City lights twinkle, water calm. No cars in focus." },
  { id: "bridge-b", intent: "Low angle from the river under the bridge pylon. Slow upward tilt and drift along the bridge underside; the golden light line along the deck edge glows steadily, mist drifts over the water." },
  { id: "bridge-c", intent: "Top-down aerial over the bridge deck at night. Slow descent and gentle rotation; the golden light line runs straight through the frame and brightens from one end to the other like a path being drawn." },
  { id: "onbridge", intent: "Night, light rain, on the bridge. The silver SUV drives forward along the golden light line toward the lit pylon; the camera follows close behind at the same speed, car stays large in frame." },
  { id: "service", intent: "Night. The silver SUV drives slowly forward into the bright inspection bay and stops on the yellow lines; the camera holds and slowly pushes in. No people." },
  { id: "inspect", intent: "Inside the inspection bay. The technician (seen from behind) slowly moves the paint thickness gauge along the front fender of the silver SUV; the tablet screen glows; gentle slow camera orbit. The car does not move." },
  { id: "carrier", intent: "Morning highway in Korea. The car-carrier truck with the silver SUV on its upper deck drives steadily forward toward the port; camera tracks alongside at the same speed. The SUV stays fixed on the truck." },
  { id: "svh", intent: "Misty morning in the bonded storage yard. The camera slowly dollies along the row of parked imported cars toward the silver SUV in the foreground; the ship and cranes stay still. Cars do not move." },
  { id: "truck-ru", intent: "Aerial drone shot. The car-carrier truck carrying the silver SUV drives along the road through the autumn taiga forest; the camera tracks it from above at the same speed. Golden hour light." },
  { id: "handover", intent: "Golden hour at a modern house. The silver SUV rolls slowly forward on the paved driveway and comes to a gentle stop in front of the garage, the camera slowly pushes in. Warm light in the windows." },
];

async function spark(content, maxTokens = 2500) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(META, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.META_API_KEY}` },
      body: JSON.stringify({ model: "muse-spark-1.3", reasoning_effort: "low", max_tokens: maxTokens, messages: [{ role: "user", content }] }),
    });
    const j = await res.json();
    const text = j?.choices?.[0]?.message?.content;
    if (text) {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) try { return JSON.parse(m[0]); } catch { /* retry */ }
    }
  }
  throw new Error("spark: no JSON");
}
const img = (path) => ({ type: "image_url", image_url: { url: `data:image/${path.endsWith(".png") ? "png" : "jpeg"};base64,${readFileSync(path).toString("base64")}` } });

async function direct(scene, frame, feedback) {
  const text = `You are the director of a premium car-commercial style film about exporting a used car from Korea to Russia.
The attached image is the exact FIRST FRAME of the next shot. An image-to-video model (Wan 2.2) will animate it for 5 seconds.
Shot intent: ${scene.intent}
${feedback ? `The previous take was rejected: ${feedback}. Fix that.` : ""}
Write the prompt for the video model: one paragraph, present tense, concrete motion of the car (speed: calm, realistic), camera move, light and weather that match THIS frame; the car must keep its exact shape, colour and size; no new vehicles in the foreground, no people unless the intent names them, no text.
Reply ONLY JSON: {"prompt": "...", "camera": "short camera note"}`;
  return spark([{ type: "text", text }, img(frame)]);
}

async function review(scene, mp4, take) {
  const frames = [0.1, 0.5, 0.95].map((f, i) => {
    const p = join(outDir, `${scene.id}-t${take}-qa${i}.jpg`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", mp4, "-vf", `select='eq(n\\,${Math.round(f * 80)})',scale=640:-1`, "-frames:v", "1", p]);
    return p;
  });
  const text = `You review a 5-second generated shot for a car commercial. Intent: ${scene.intent}
The 3 images are frames at the start, middle and end. Check: does the car keep the same shape and colour (no morphing, no melting wheels, no extra cars appearing in the foreground)? Does the motion match the intent? Any ugly artifacts?
Reply ONLY JSON: {"score": 0-10, "accept": true|false, "issues": "short"}. Accept when score >= 7.`;
  return spark([{ type: "text", text }, ...frames.map(img)], 2000);
}

async function wan(frame, prompt, seed) {
  const r = await fetch(`${WAN}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GLIMMER_API_KEY}` },
    body: JSON.stringify({ image_b64: readFileSync(frame).toString("base64"), prompt, seed }),
  });
  if (!r.ok) throw new Error(`submit ${r.status} ${await r.text()}`);
  return (await r.json()).id;
}
async function waitFor(id, out) {
  const t0 = Date.now();
  for (;;) {
    const r = await fetch(`${WAN}/result/${id}`, { headers: { Authorization: `Bearer ${process.env.GLIMMER_API_KEY}` } });
    if (r.status === 200) { writeFileSync(out, Buffer.from(await r.arrayBuffer())); return Math.round((Date.now() - t0) / 1000); }
    if (r.status === 500) throw new Error(`wan failed: ${await r.text()}`);
    if (Date.now() - t0 > 180 * 60 * 1000) throw new Error("wan timeout");
    await new Promise((s) => setTimeout(s, 20000));
  }
}

async function runScene(scene) {
  const frame = join(framesDir, `${scene.id}.png`);
  const L = (log[scene.id] ??= { takes: [] });
  if (L.accepted) return;
  let feedback = "";
  for (let take = L.takes.length + 1; take <= 2; take++) {
    const seed = 20261030 + take * 7;
    let d, id;
    if (L.pending?.take === take) {
      // resume a take that was already submitted before the runner stopped
      ({ id, prompt: d } = { id: L.pending.id, prompt: { prompt: L.pending.prompt, camera: L.pending.camera } });
      console.log(`[${scene.id}] take ${take} resumed ${id}`);
    } else {
      d = await direct(scene, frame, feedback);
      id = await wan(frame, d.prompt, seed);
      L.pending = { take, id, prompt: d.prompt, camera: d.camera }; save();
      console.log(`[${scene.id}] take ${take} submitted ${id}: ${d.prompt.slice(0, 120)}…`);
    }
    const mp4 = join(outDir, `${scene.id}-t${take}.mp4`);
    const sec = await waitFor(id, mp4);
    const q = await review(scene, mp4, take);
    L.takes.push({ take, id, seed, prompt: d.prompt, camera: d.camera, wanSec: sec, review: q });
    delete L.pending;
    console.log(`[${scene.id}] take ${take} done in ${sec}s, review ${JSON.stringify(q)}`);
    save();
    if (q.accept) { L.accepted = take; save(); return; }
    feedback = q.issues;
  }
  // keep the better take when both were rejected
  const best = [...L.takes].sort((a, b) => (b.review?.score ?? 0) - (a.review?.score ?? 0))[0];
  L.accepted = best?.take ?? 1; L.forced = true; save();
}

const list = SCENES.filter((s) => !only || only.split(",").includes(s.id));
await Promise.all(list.map((s) => runScene(s).catch((e) => { console.log(`[${s.id}] ERROR ${e.message}`); (log[s.id] ??= { takes: [] }).error = e.message; save(); })));
console.log("ALL DONE");
