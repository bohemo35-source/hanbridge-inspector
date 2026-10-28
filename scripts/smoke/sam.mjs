// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Live smoke for sam-3.1: one "license plate" request on photo_243114_0.jpg, print count + main plate box
// @created: 2026-10-28
import { readFileSync, existsSync } from "node:fs";
import sharp from "sharp";

function loadKey() {
  if (process.env.META_API_KEY) return process.env.META_API_KEY;
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const i = line.indexOf("=");
      if (i > 0 && line.slice(0, i).trim() === "META_API_KEY") return line.slice(i + 1).trim();
    }
  }
  return "";
}

const KEY = loadKey();
if (!KEY) {
  console.error("META_API_KEY missing");
  process.exit(1);
}

const photoPath = "demo-data/mini-cooper-s/photos/photo_243114_0.jpg";
const prepared = await sharp(readFileSync(photoPath))
  .rotate()
  .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
  .jpeg({ quality: 85 })
  .toBuffer({ resolveWithObject: true });
console.log(`sent image: ${prepared.info.width}x${prepared.info.height}`);

const t0 = Date.now();
const res = await fetch("https://api.meta.ai/v1/responses", {
  method: "POST",
  headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "sam-3.1",
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: "license plate" },
          { type: "input_image", image_url: `data:image/jpeg;base64,${prepared.data.toString("base64")}` },
        ],
      },
    ],
  }),
});
const raw = await res.json();
console.log(`status=${res.status} ms=${Date.now() - t0}`);
const text = raw.output?.flatMap((o) => o.content ?? []).map((c) => c.text ?? "").join("") || raw.output_text || "";

const boxes = [];
for (const m of text.matchAll(/<\|box;([^|]*)\|>/g)) {
  const kv = Object.fromEntries(m[1].split(";").map((p) => {
    const i = p.indexOf("=");
    return [p.slice(0, i), Number(p.slice(i + 1))];
  }));
  boxes.push(kv);
}
console.log(`instances=${boxes.length}`);
const area = (b) => (b.x2 - b.x1) * (b.y2 - b.y1);
const main = boxes.length ? boxes.reduce((a, b) => (area(b) > area(a) ? b : a)) : null;
console.log(`main plate box: ${main ? JSON.stringify(main) : "none"}`);
