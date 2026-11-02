// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Clean catalog card photos: the original inspection photo the agent picked for the listing (no generative redraw), SAM 3.1 finds the car and every license plate, each plate is covered by a Hanbridge plate warped onto the plate's own quadrilateral (from the SAM mask, so it follows the perspective), card cropped 16:10 around the car → public/cards/<carId>.jpg
// @created: 2026-11-02
// @updated: 2026-11-03 claude-code — perspective plate cover from the mask instead of an axis-aligned box; all plates in the frame (neighbouring cars too)
// usage: NODE_USE_ENV_PROXY=1 node --env-file=.env.local --import tsx scripts/film4/make-cards.mts [carId…]
import path from "node:path";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import sharp from "sharp";
import { listReportsAsync } from "../../src/lib/store/reports";
import { segmentImage } from "../../src/lib/agent/tools/segment";
import type { SamInstance } from "../../src/lib/meta/sam";
import { CARS } from "../../src/lib/agent/catalog";

type P = [number, number];
const OUT = path.join(process.cwd(), "public/cards");
const only = process.argv.slice(2);
const logFile = path.join(OUT, "cards.json");
const log: Record<string, unknown> = existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : {};

/** Plate corners (TL, TR, BR, BL) in photo pixels: extremes of the mask along the box diagonals, grown a little to cover the frame. */
function plateQuad(i: SamInstance): P[] {
  const b = i.box, bw = b.x2 - b.x1, bh = b.y2 - b.y1;
  const rect: P[] = [[b.x1, b.y1], [b.x2, b.y1], [b.x2, b.y2], [b.x1, b.y2]];
  if (!i.mask || !i.maskWidth || !i.maskHeight) return rect;
  const best = [[Infinity, 0, 0], [-Infinity, 0, 0], [-Infinity, 0, 0], [Infinity, 0, 0]]; // min u+v, max u−v, max u+v, min u−v
  for (let y = 0; y < i.maskHeight; y++) for (let x = 0; x < i.maskWidth; x++) {
    if (!i.mask[y * i.maskWidth + x]) continue;
    const u = (x + 0.5) / i.maskWidth, v = (y + 0.5) / i.maskHeight;
    if (u + v < best[0][0]) best[0] = [u + v, u, v];
    if (u - v > best[1][0]) best[1] = [u - v, u, v];
    if (u + v > best[2][0]) best[2] = [u + v, u, v];
    if (u - v < best[3][0]) best[3] = [u - v, u, v];
  }
  if (!Number.isFinite(best[0][0])) return rect;
  const q = best.map(([, u, v]) => [b.x1 + u * bw, b.y1 + v * bh] as P);
  const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
  return q.map(([x, y]) => [cx + (x - cx) * 1.1, cy + (y - cy) * 1.16] as P);
}

/** Homography mapping the unit square (0,0),(1,0),(1,1),(0,1) onto quad q; returns its inverse as a function photo → (s,t). */
function inverseHomography(q: P[]) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den, h = (dx1 * dy3 - dx3 * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
  // inverse of [[a b c][d e f][g h 1]]
  const A = e - f * h, B = c * h - b, C = b * f - c * e, D = f * g - d, E = a - c * g, F = c * d - a * f, G = d * h - e * g, H = b * g - a * h, I = a * e - b * d;
  return (x: number, y: number): P => { const w = G * x + H * y + I; return [(A * x + B * y + C) / w, (D * x + E * y + F) / w]; };
}

async function plateTexture(word: boolean) {
  const W = 520, H = 112;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="#0d0f11"/><rect x="5" y="5" width="${W - 10}" height="${H - 10}" rx="9" fill="none" stroke="#3b4046" stroke-width="3"/>${word ? `<text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="600" font-size="52" letter-spacing="7" fill="#cfc8bd">HANBRIDGE</text>` : ""}</svg>`;
  const { data, info } = await sharp(Buffer.from(svg)).raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height, ch: info.channels };
}

/** Paint the plate texture into the RGB(A) photo buffer inside quad q, 4×4 supersampled edges. */
function warpInto(img: Buffer, iw: number, ih: number, ich: number, q: P[], tex: Awaited<ReturnType<typeof plateTexture>>) {
  const inv = inverseHomography(q);
  const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
  const X0 = Math.max(0, Math.floor(Math.min(...xs))), X1 = Math.min(iw - 1, Math.ceil(Math.max(...xs)));
  const Y0 = Math.max(0, Math.floor(Math.min(...ys))), Y1 = Math.min(ih - 1, Math.ceil(Math.max(...ys)));
  const N = 4;
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    let cov = 0, r = 0, g = 0, b = 0;
    for (let sy = 0; sy < N; sy++) for (let sx = 0; sx < N; sx++) {
      const [s, t] = inv(x + (sx + 0.5) / N, y + (sy + 0.5) / N);
      if (s < 0 || s > 1 || t < 0 || t > 1) continue;
      const k = (Math.min(tex.H - 1, Math.floor(t * tex.H)) * tex.W + Math.min(tex.W - 1, Math.floor(s * tex.W))) * tex.ch;
      r += tex.data[k]; g += tex.data[k + 1]; b += tex.data[k + 2]; cov++;
    }
    if (!cov) continue;
    const a = cov / (N * N), o = (y * iw + x) * ich;
    img[o] = Math.round(img[o] * (1 - a) + (r / cov) * a);
    img[o + 1] = Math.round(img[o + 1] * (1 - a) + (g / cov) * a);
    img[o + 2] = Math.round(img[o + 2] * (1 - a) + (b / cov) * a);
  }
}

const reports = await listReportsAsync();
const texWord = await plateTexture(true), texPlain = await plateTexture(false);
for (const car of CARS) {
  if (only.length && !only.includes(car.carId)) continue;
  const r = reports.find((x) => x.carId === car.carId && x.listingUrl);
  const photoId = r?.listingUrl?.match(/\/([^/]+?)-listing\.jpg$/)?.[1]; // the original photo the agent made the listing from
  if (!photoId) { console.log(car.carId, "no listing source"); continue; }
  const imagePath = path.join(process.cwd(), "demo-data", car.carId, "photos", photoId);
  const seg = await segmentImage({ carId: car.carId, photoId, imagePath, concepts: ["car", "license plate"] });
  const { data, info } = await sharp(imagePath).rotate().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const plates = seg.byConcept["license plate"] ?? [];
  const quads: P[][] = [];
  for (const p of plates) {
    const q = plateQuad(p);
    const top = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), side = Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]);
    // the word only where it can be read: plate seen from the front and big enough
    warpInto(data, W, H, info.channels, q, top / side >= 2.6 && top >= 140 ? texWord : texPlain);
    quads.push(q.map(([x, y]) => [Math.round(x), Math.round(y)] as P));
  }
  // 16:10 crop around the car, a little air on every side
  const c = seg.car?.box ?? { x1: 0, y1: 0, x2: W, y2: H };
  let cw = Math.min(W, (c.x2 - c.x1) * 1.18), ch = cw / 1.6;
  if (ch > H) { ch = H; cw = ch * 1.6; }
  if (ch < (c.y2 - c.y1) * 1.12) { ch = Math.min(H, (c.y2 - c.y1) * 1.12); cw = Math.min(W, ch * 1.6); ch = cw / 1.6; }
  const left = Math.round(Math.min(Math.max(0, (c.x1 + c.x2) / 2 - cw / 2), W - cw));
  const top = Math.round(Math.min(Math.max(0, (c.y1 + c.y2) / 2 - ch / 2), H - ch));
  await sharp(data, { raw: { width: W, height: H, channels: info.channels } })
    .extract({ left, top, width: Math.round(cw), height: Math.round(ch) }).resize(1200).jpeg({ quality: 86 }).toFile(path.join(OUT, `${car.carId}.jpg`));
  log[car.carId] = { photoId, plates: quads, car: seg.car?.box ?? null, ms: seg.ms, model: "sam-3.1" };
  console.log(car.carId, photoId, "plates", quads.length, JSON.stringify(quads), "car", !!seg.car);
}
writeFileSync(logFile, JSON.stringify(log, null, 1));
