// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Live smoke for muse-image-1.0: one /images/generations + one /images/edits attempt (mask = right half), prints status + ms each
// @created: 2026-10-29
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
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
const BASE = "https://api.meta.ai/v1";
const auth = { Authorization: `Bearer ${KEY}` };

// 1) generations
{
  const t0 = Date.now();
  const res = await fetch(`${BASE}/images/generations`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "muse-image-1.0",
      prompt: "Abstract soft studio backdrop, pale warm grey gradient, gentle vignette, no objects, no cars, no text",
      n: 1,
    }),
  });
  const ms = Date.now() - t0;
  const raw = await res.json().catch(() => ({}));
  const b64 = raw?.data?.[0]?.b64_json ?? "";
  console.log(`generations: status=${res.status} ms=${ms} b64_len=${b64.length}`);
  if (!res.ok || !b64) console.log(`generations body: ${JSON.stringify(raw).slice(0, 400)}`);
  if (b64) {
    mkdirSync("/tmp/tz04-smoke", { recursive: true });
    writeFileSync("/tmp/tz04-smoke/generated.png", Buffer.from(b64, "base64"));
    const meta = await sharp(Buffer.from(b64, "base64")).metadata();
    console.log(`generations image: ${meta.width}x${meta.height} ${meta.format} -> /tmp/tz04-smoke/generated.png`);
  }
}

// 2) edits: demo photo + mask (edit right half -> studio), multipart like OpenAI
{
  const photo = await sharp(readFileSync("demo-data/mini-cooper-s/photos/photo_243113_0.jpg"))
    .rotate()
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer({ resolveWithObject: true });
  const { width, height } = photo.info;
  // mask PNG: white = editable (right half), black = keep (left half)
  const rawMask = Buffer.alloc(width * height, 0);
  for (let y = 0; y < height; y++) for (let x = Math.floor(width / 2); x < width; x++) rawMask[y * width + x] = 255;
  const maskPng = await sharp(rawMask, { raw: { width, height, channels: 1 } }).png().toBuffer();

  const form = new FormData();
  form.append("model", "muse-image-1.0");
  form.append("prompt", "Neutral light studio background, soft shadow, no text");
  form.append("image", new Blob([new Uint8Array(photo.data)], { type: "image/jpeg" }), "photo.jpg");
  form.append("mask", new Blob([new Uint8Array(maskPng)], { type: "image/png" }), "mask.png");

  const t0 = Date.now();
  const res = await fetch(`${BASE}/images/edits`, { method: "POST", headers: { ...auth }, body: form });
  const ms = Date.now() - t0;
  const text = await res.text();
  let b64 = "";
  try {
    b64 = JSON.parse(text)?.data?.[0]?.b64_json ?? "";
  } catch { /* keep raw text */ }
  console.log(`edits(multipart): status=${res.status} ms=${ms} sent=${width}x${height} b64_len=${b64.length}`);
  if (b64) {
    writeFileSync("/tmp/tz04-smoke/edited.png", Buffer.from(b64, "base64"));
    const meta = await sharp(Buffer.from(b64, "base64")).metadata();
    console.log(`edits image: ${meta.width}x${meta.height} ${meta.format} -> /tmp/tz04-smoke/edited.png`);
  } else {
    console.log(`edits body: ${text.slice(0, 600)}`);
  }

  // 2b) edits without mask (API rejected the mask field above)
  const form2 = new FormData();
  form2.append("model", "muse-image-1.0");
  form2.append("prompt", "Replace the background with a neutral light studio, soft shadow. Keep the car exactly unchanged. No text.");
  form2.append("image", new Blob([new Uint8Array(photo.data)], { type: "image/jpeg" }), "photo.jpg");
  const t1 = Date.now();
  const res2 = await fetch(`${BASE}/images/edits`, { method: "POST", headers: { ...auth }, body: form2 });
  const text2 = await res2.text();
  let b64b = "";
  try {
    b64b = JSON.parse(text2)?.data?.[0]?.b64_json ?? "";
  } catch { /* keep raw */ }
  console.log(`edits(no-mask): status=${res2.status} ms=${Date.now() - t1} b64_len=${b64b.length}`);
  if (b64b) {
    writeFileSync("/tmp/tz04-smoke/edited-nomask.png", Buffer.from(b64b, "base64"));
    const meta = await sharp(Buffer.from(b64b, "base64")).metadata();
    console.log(`edits(no-mask) image: ${meta.width}x${meta.height} ${meta.format} -> /tmp/tz04-smoke/edited-nomask.png`);
  } else {
    console.log(`edits(no-mask) body: ${text2.slice(0, 600)}`);
  }
}
