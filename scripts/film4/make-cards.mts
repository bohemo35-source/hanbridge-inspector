// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Clean catalog card photos: the original inspection photo the agent picked for the listing (no generative redraw), SAM 3.1 finds the car and the plate, the plate is covered by a flat Hanbridge plate, card cropped 16:10 around the car → public/cards/<carId>.jpg
// @created: 2026-11-02
// usage: NODE_USE_ENV_PROXY=1 node --env-file=.env.local --import tsx scripts/film4/make-cards.mts
import path from "node:path";
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { listReportsAsync } from "../../src/lib/store/reports";
import { segmentImage } from "../../src/lib/agent/tools/segment";
import { CARS } from "../../src/lib/agent/catalog";

const OUT = path.join(process.cwd(), "public/cards");
const log: Record<string, unknown> = {};
const reports = await listReportsAsync();
for (const car of CARS) {
  const r = reports.find((x) => x.carId === car.carId && x.listingUrl);
  const photoId = r?.listingUrl?.match(/\/([^/]+?)-listing\.jpg$/)?.[1]; // the original photo the agent made the listing from
  if (!photoId) { console.log(car.carId, "no listing source"); continue; }
  const imagePath = path.join(process.cwd(), "demo-data", car.carId, "photos", photoId);
  const seg = await segmentImage({ carId: car.carId, photoId, imagePath, concepts: ["car", "license plate"] });
  const img = sharp(imagePath).rotate();
  const { width: W, height: H } = { width: seg.width, height: seg.height };
  const layers: sharp.OverlayOptions[] = [];
  if (seg.licensePlate) {
    const b = seg.licensePlate.box, pw = b.x2 - b.x1, ph = b.y2 - b.y1;
    const x = Math.max(0, Math.round(b.x1 - pw * 0.06)), y = Math.max(0, Math.round(b.y1 - ph * 0.12));
    const w = Math.min(W - x, Math.round(pw * 1.12)), h = Math.min(H - y, Math.round(ph * 1.24));
    // the word must fit the plate: foreshortened plates get a smaller word, very narrow ones stay plain
    const fs = Math.round(Math.min(h * 0.36, w / 7.4)); const word = w / h >= 2.2 && fs >= 9 ? "HANBRIDGE" : "";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${Math.round(h * 0.14)}" fill="#0c0e10" stroke="#3a3f45" stroke-width="1"/><text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="600" font-size="${fs}" letter-spacing="${Math.round(fs * 0.12)}" fill="#c8c2b8">${word}</text></svg>`;
    layers.push({ input: Buffer.from(svg), left: x, top: y });
  }
  // 16:10 crop around the car, a little air on every side
  const c = seg.car?.box ?? { x1: 0, y1: 0, x2: W, y2: H };
  let cw = Math.min(W, (c.x2 - c.x1) * 1.18), ch = cw / 1.6;
  if (ch > H) { ch = H; cw = ch * 1.6; }
  if (ch < (c.y2 - c.y1) * 1.12) { ch = Math.min(H, (c.y2 - c.y1) * 1.12); cw = Math.min(W, ch * 1.6); ch = cw / 1.6; }
  const left = Math.round(Math.min(Math.max(0, (c.x1 + c.x2) / 2 - cw / 2), W - cw));
  const top = Math.round(Math.min(Math.max(0, (c.y1 + c.y2) / 2 - ch / 2), H - ch));
  const covered = await img.composite(layers).toBuffer();
  await sharp(covered).extract({ left, top, width: Math.round(cw), height: Math.round(ch) }).resize(1200).jpeg({ quality: 84 }).toFile(path.join(OUT, `${car.carId}.jpg`));
  log[car.carId] = { photoId, plate: seg.licensePlate?.box ?? null, car: seg.car?.box ?? null, ms: seg.ms, model: "sam-3.1" };
  console.log(car.carId, photoId, "plate", !!seg.licensePlate, "car", !!seg.car);
}
writeFileSync(path.join(OUT, "cards.json"), JSON.stringify(log, null, 1));
