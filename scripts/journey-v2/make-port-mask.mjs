// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: SAM 3.1 mask for the ro-ro hold doorway on plate-port-ramp.jpg -> plate-port-mask.png (fallback: fade/shrink in scene)
// @created: 2026-10-29
// Usage: node scripts/journey-v2/make-port-mask.mjs
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
let decode = null;
try { ({ decodeMaskToRaster: decode } = await import("@meta-sam/parser")); } catch { console.log("parser unavailable"); }
function key() { if (process.env.META_API_KEY) return process.env.META_API_KEY; const m = readFileSync(new URL("../../.env.local", import.meta.url), "utf8").match(/^META_API_KEY=(.+)$/m); return m?.[1].trim().replace(/^["']|["']$/g, ""); }
const imgPath = new URL("../../public/journey-v2/plate-port-ramp.jpg", import.meta.url).pathname;
const prepared = await sharp(readFileSync(imgPath)).resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
const t0 = Date.now();
const res = await fetch("https://api.meta.ai/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "sam-3.1", input: [{ role: "user", content: [{ type: "input_text", text: "ship ramp doorway" }, { type: "input_image", image_url: `data:image/jpeg;base64,${prepared.data.toString("base64")}` }] }] }) });
console.log("sam http", res.status, Date.now() - t0, "ms size", prepared.info.width, prepared.info.height);
const raw = await res.json();
const text = raw.output?.flatMap((o) => o.content ?? []).map((c) => c.text ?? "").join("") || raw.output_text || "";
console.log("sam text head:", text.slice(0, 220).replace(/\n/g, " "));
const m = text.match(/<\|box;([^|]*)\|>(?:<\|mask;([^|]*)\|>)?/);
if (!m) { console.log("SAM: 0 instances -> scene uses fade/shrink fallback"); process.exit(0); }
const kv = Object.fromEntries(m[1].split(";").map((s) => { const i = s.indexOf("="); return [s.slice(0, i).trim(), s.slice(i + 1).trim()]; }));
console.log("box", kv);
let maskPng = null;
const data = m[2]?.split(";").map((s) => s.trim()).find((s) => s.startsWith("data="))?.slice(5);
if (data && decode) {
  const [h, w, payload] = [Number(data.split(",")[0]), Number(data.split(",")[1]), data.slice(data.indexOf(",", data.indexOf(",") + 1) + 1)];
  try {
    const raster = decode({ encoding: payload.startsWith("!") ? "one_bit" : "lossless", payload, width: w, height: h });
    const rgba = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) { rgba[i * 4 + 3] = raster[i] ? 255 : 0; rgba[i * 4] = 255; rgba[i * 4 + 1] = 255; rgba[i * 4 + 2] = 255; }
    maskPng = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
    console.log("mask decoded", w, h);
  } catch (e) { console.log("mask decode failed", String(e).slice(0, 120)); }
}
if (maskPng) { const out = new URL("../../public/journey-v2/plate-port-mask.png", import.meta.url).pathname; writeFileSync(out, maskPng); console.log("saved", out, maskPng.length); }
else console.log("SAM box only, no usable mask -> fade/shrink fallback");
