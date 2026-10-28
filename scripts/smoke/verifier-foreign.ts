// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Live verifier negative test: hood-dent finding with an unrelated ground crop must be rejected
// @created: 2026-10-29
import { existsSync, readFileSync } from "node:fs";
import sharp from "sharp";
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) { const i = line.indexOf("="); if (i > 0) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim(); }
}
async function main() {
  const { verifyFinding } = await import("../../src/lib/agent/verifier");
  const { carMedia, photoPath } = await import("../../src/lib/agent/catalog");
  const photo = carMedia("mini-cooper-s").photos[0];
  const img = await sharp(photoPath("mini-cooper-s", photo)).metadata();
  // bottom strip = ground/asphalt, definitely not a hood dent
  const crop = await sharp(photoPath("mini-cooper-s", photo)).extract({ left: 0, top: Math.floor((img.height ?? 1000) * 0.92), width: 400, height: Math.floor((img.height ?? 1000) * 0.08) }).jpeg().toBuffer();
  const { result, model } = await verifyFinding({
    id: "foreign-1", panel: "hood", kind: "dent", severity: "high",
    description_en: "Deep dent on the hood.", description_ru: "Глубокая вмятина на капоте.", confidence: 0.9,
    evidence: [{ type: "frame", mediaId: photo, box: { x1: 0, y1: 0, x2: 400, y2: 100 }, panel: "hood" }], verified: false,
  }, { crop });
  console.log(`foreign-crop verifier: supported=${result.supported} confidence=${result.confidence} model=${model} note=${result.note}`);
  if (result.supported) { console.log("FAIL: foreign crop was accepted"); process.exit(2); }
  console.log("PASS: foreign crop rejected (verified:false)");
}
main().catch((e) => { console.error(e); process.exit(1); });
