// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Run segmentImage + findDefects over demo-data/<carId>/photos, write photos.json + overlays
// @created: 2026-10-28
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { findDefects } from "../src/lib/agent/tools/defects";
import { segmentImage } from "../src/lib/agent/tools/segment";
import type { SamInstance } from "../src/lib/meta/sam";

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const key = line.slice(0, i).trim();
    if (!process.env[key]) process.env[key] = line.slice(i + 1).trim();
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function maskOverlayPng(instance: SamInstance): Promise<{ input: Buffer; left: number; top: number }> {
  const boxW = Math.max(1, instance.box.x2 - instance.box.x1);
  const boxH = Math.max(1, instance.box.y2 - instance.box.y1);
  const rgba = Buffer.alloc(instance.maskWidth * instance.maskHeight * 4);
  instance.mask!.forEach((v, i) => {
    if (v) {
      rgba[i * 4] = 59;
      rgba[i * 4 + 1] = 130;
      rgba[i * 4 + 2] = 246;
      rgba[i * 4 + 3] = 96;
    }
  });
  const input = await sharp(rgba, { raw: { width: instance.maskWidth, height: instance.maskHeight, channels: 4 } })
    .resize(boxW, boxH, { kernel: "nearest" })
    .png()
    .toBuffer();
  return { input, left: instance.box.x1, top: instance.box.y1 };
}

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const carId = args.find((a) => !a.startsWith("--"));
  if (!carId) {
    console.error("usage: npx tsx scripts/inspect-photos.ts <carId> [--limit N]");
    process.exit(1);
  }
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 8;

  const photosDir = path.join(process.cwd(), "demo-data", carId, "photos");
  const outDir = path.join(process.cwd(), "demo-data", carId, "out");
  const overlayDir = path.join(outDir, "overlay");
  await mkdir(overlayDir, { recursive: true });

  const files = (await readdir(photosDir))
    .filter((f) => /\.jpe?g$/i.test(f))
    .sort()
    .slice(0, limit);
  console.log(`car=${carId} photos=${files.length} limit=${limit}`);

  const results: unknown[] = [];
  for (const file of files) {
    const photoId = file.replace(/\.jpe?g$/i, "");
    const imagePath = path.join(photosDir, file);
    const entry: Record<string, unknown> = { photoId, file };
    try {
      const tSeg = Date.now();
      const seg = await segmentImage({ carId, photoId, imagePath });
      const segmentMs = Date.now() - tSeg;

      const image = await readFile(imagePath);
      const tDef = Date.now();
      const def = await findDefects({ carId, photoId, image });
      const findDefectsMs = Date.now() - tDef;

      // overlay: mask fill (if decoded) + SVG boxes/labels via sharp composite
      const fontSize = Math.max(26, Math.round(seg.width / 55));
      const rects: string[] = [];
      if (seg.car) {
        const b = seg.car.box;
        rects.push(`<rect x="${b.x1}" y="${b.y1}" width="${b.x2 - b.x1}" height="${b.y2 - b.y1}" fill="none" stroke="#ffffff" stroke-width="3"/>`);
      }
      if (seg.licensePlate) {
        const b = seg.licensePlate.box;
        rects.push(`<rect x="${b.x1}" y="${b.y1}" width="${b.x2 - b.x1}" height="${b.y2 - b.y1}" fill="none" stroke="#ffd400" stroke-width="5"/>`);
      }
      for (const f of def.findings) {
        const b = f.evidence[0]?.box;
        if (!b) continue;
        const label = esc(`${f.kind}/${f.severity}`);
        rects.push(
          `<rect x="${b.x1}" y="${b.y1}" width="${b.x2 - b.x1}" height="${b.y2 - b.y1}" fill="none" stroke="#e5544b" stroke-width="4"/>` +
            `<text x="${b.x1}" y="${Math.max(fontSize, b.y1 - 8)}" font-family="sans-serif" font-size="${fontSize}" fill="#e5544b">${label}</text>`,
        );
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${seg.width}" height="${seg.height}">${rects.join("")}</svg>`;
      const composites: sharp.OverlayOptions[] = [];
      if (seg.car?.maskDecoded && seg.car.mask) composites.push(await maskOverlayPng(seg.car));
      composites.push({ input: Buffer.from(svg) });
      const overlayPath = path.join(overlayDir, `${photoId}.jpg`);
      await sharp(image).rotate().composite(composites).jpeg({ quality: 88 }).toFile(overlayPath);

      entry.view = def.view;
      entry.panels_visible = def.panels_visible;
      entry.detections = {
        width: seg.width,
        height: seg.height,
        car: seg.car?.box ?? null,
        carMaskDecoded: seg.car?.maskDecoded ?? false,
        licensePlate: seg.licensePlate?.box ?? null,
        wheels: seg.wheels.map((w) => w.box),
        counts: Object.fromEntries(Object.entries(seg.byConcept).map(([k, v]) => [k, v?.length ?? 0])),
      };
      entry.defects = def.findings;
      entry.timings = { segmentMsByConcept: seg.ms, segmentMs, findDefectsMs };
      entry.overlay = path.relative(process.cwd(), overlayPath);
      console.log(
        `${photoId}: view=${def.view} car=${seg.car ? "yes" : "no"} plate=${seg.licensePlate ? "yes" : "no"} wheels=${seg.wheels.length} defects=${def.findings.length} segmentMs=${segmentMs} findDefectsMs=${findDefectsMs} overlay=${entry.overlay}`,
      );
    } catch (e) {
      entry.error = e instanceof Error ? e.message : String(e);
      console.log(`${photoId}: ERROR ${entry.error}`);
    }
    results.push(entry);
  }

  const jsonPath = path.join(outDir, "photos.json");
  await writeFile(jsonPath, JSON.stringify({ carId, generatedAt: new Date().toISOString(), photos: results }, null, 2));
  console.log(`wrote ${path.relative(process.cwd(), jsonPath)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
