// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Demo-car catalog (docs/DEMO_CARS.md) + local media inventory from demo-data/<carId>
// @created: 2026-10-29
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

export interface CarInfo { carId: string; make: string; model: string; year: number; bodyType: "sedan" | "suv" | "hatchback"; doors: 3 | 5; }

export const CARS: CarInfo[] = [
  { carId: "mini-cooper-s", make: "MINI", model: "Cooper S", year: 2018, bodyType: "hatchback", doors: 3 },
  { carId: "bmw-x3-8278", make: "BMW", model: "X3 20i xDrive M Sport", year: 2023, bodyType: "suv", doors: 5 },
  { carId: "bmw-530i-8053", make: "BMW", model: "530i xDrive M Sport", year: 2023, bodyType: "sedan", doors: 5 },
  { carId: "audi-a5-2005", make: "Audi", model: "A5 40 TFSI quattro S line", year: 2025, bodyType: "sedan", doors: 5 },
  { carId: "kia-sportage", make: "Kia", model: "Sportage", year: 2022, bodyType: "suv", doors: 5 },
  { carId: "kia-morning", make: "Kia", model: "Morning (Picanto)", year: 2023, bodyType: "hatchback", doors: 5 },
];

export const getCar = (carId: string) => CARS.find((c) => c.carId === carId);

export interface CarMedia {
  carId: string; photos: string[]; videos: string[]; gaugeVideo: string | null;
  diagnosticPdfs: string[]; sheets: string[]; hasInspectorReport: boolean; hasAuctionSheet: boolean;
}

const list = (dir: string, exts: string[]) => {
  try { return readdirSync(dir).filter((f) => exts.some((e) => f.toLowerCase().endsWith(e))).sort(); } catch { return []; }
};

export function carMedia(carId: string): CarMedia {
  const base = path.join(process.cwd(), "demo-data", carId);
  const videos = list(path.join(base, "video"), [".mp4", ".mov"]);
  const sheets = list(path.join(base, "sheets"), [".jpg", ".jpeg", ".png", ".pdf"]);
  return {
    carId,
    photos: list(path.join(base, "photos"), [".jpg", ".jpeg", ".png"]),
    videos,
    gaugeVideo: videos.includes("paint_gauge.mp4") ? "paint_gauge.mp4" : null,
    diagnosticPdfs: sheets.filter((f) => f.toLowerCase().endsWith(".pdf")),
    sheets,
    hasInspectorReport: existsSync(path.join(base, "inspector_report_ru.txt")),
    hasAuctionSheet: false, // no car currently has an auction-sheet photo (TZ-05)
  };
}

export const photoPath = (carId: string, photoId: string) => path.join(process.cwd(), "demo-data", carId, "photos", photoId);
export const videoPath = (carId: string, videoId: string) => path.join(process.cwd(), "demo-data", carId, "video", videoId);
/** spread pick: first, middle, last etc. for a representative defect scan */
export function spreadPhotos(photos: string[], n: number): string[] {
  if (photos.length <= n) return [...photos];
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(photos[Math.floor((i * photos.length) / n)]);
  return [...new Set(out)];
}
