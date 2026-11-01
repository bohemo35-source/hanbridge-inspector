// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Demo-car catalog (docs/DEMO_CARS.md) + media inventory: local demo-data/<carId> in dev, Vercel Blob (blob-manifest.json) on Vercel
// @created: 2026-10-29
// @updated: 2026-11-01 claude: media listing/reading goes through ./media (Blob on Vercel)
import path from "node:path";
import { ensureMediaFile, hasMedia, listMedia } from "./media";

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

export function carMedia(carId: string): CarMedia {
  const videos = listMedia(carId, "video", [".mp4", ".mov"]);
  const sheets = listMedia(carId, "sheets", [".jpg", ".jpeg", ".png", ".pdf"]);
  return {
    carId,
    photos: listMedia(carId, "photos", [".jpg", ".jpeg", ".png"]),
    videos,
    gaugeVideo: videos.includes("paint_gauge.mp4") ? "paint_gauge.mp4" : null,
    diagnosticPdfs: sheets.filter((f) => f.toLowerCase().endsWith(".pdf")),
    sheets,
    hasInspectorReport: hasMedia(carId, "root", "inspector_report_ru.txt"),
    hasAuctionSheet: false, // no car currently has an auction-sheet photo (TZ-05)
  };
}

/** Local paths only (scripts, tests). The agent uses ensurePhotoPath/ensureVideoPath, which also work from Blob. */
export const photoPath = (carId: string, photoId: string) => path.join(process.cwd(), "demo-data", carId, "photos", photoId);
export const videoPath = (carId: string, videoId: string) => path.join(process.cwd(), "demo-data", carId, "video", videoId);
export const ensurePhotoPath = (carId: string, photoId: string) => ensureMediaFile(carId, "photos", photoId);
export const ensureVideoPath = (carId: string, videoId: string) => ensureMediaFile(carId, "video", videoId);
/** spread pick: first, middle, last etc. for a representative defect scan */
export function spreadPhotos(photos: string[], n: number): string[] {
  if (photos.length <= n) return [...photos];
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(photos[Math.floor((i * photos.length) / n)]);
  return [...new Set(out)];
}
