// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Tests for listing photos: plate hiding, car-pixel diff guard, plate_not_found skip, listing-never-evidence, hero cache (Meta Image mocked, no network)
// @created: 2026-10-29
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SamInstance } from "@/lib/meta/sam";
import type { Finding } from "@/lib/schema";
import type { SegmentImageResult } from "./segment";

vi.mock("@/lib/meta/image", () => ({ generateImage: vi.fn(), editImage: vi.fn() }));
import { editImage, generateImage } from "@/lib/meta/image";
import {
  assertFindingsFreeOfListingEvidence,
  CAR_PIXEL_DIFF_THRESHOLD,
  expandPlateBox,
  getOrCreateHeroImage,
  hidePlate,
  makeListingPhoto,
  meanDiffInsideMask,
} from "./listing";

const editMock = vi.mocked(editImage);
const genMock = vi.mocked(generateImage);

const W = 200;
const H = 150;
const carBox = { x1: 20, y1: 20, x2: 180, y2: 130, w: W, h: H };
const plateBox = { x1: 80, y1: 100, x2: 140, y2: 120, w: W, h: H };

const instance = (box: typeof carBox, withMask: boolean): SamInstance => ({
  id: 0,
  box,
  mask: withMask ? new Uint8Array((box.x2 - box.x1) * (box.y2 - box.y1)).fill(1) : null,
  maskWidth: box.x2 - box.x1,
  maskHeight: box.y2 - box.y1,
  maskDecoded: withMask,
});

async function testPhoto(): Promise<Buffer> {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
      `<rect width="${W}" height="${H}" fill="#888888"/>` +
      `<rect x="20" y="20" width="160" height="110" fill="#204060"/>` +
      `<rect x="80" y="100" width="60" height="20" fill="#ffffff"/></svg>`,
  );
  return sharp(svg).jpeg().toBuffer();
}

function segmentWith(plate: SamInstance | null, car: SamInstance | null): SegmentImageResult {
  return {
    carId: "test-car",
    photoId: "photo_1",
    width: W,
    height: H,
    car,
    licensePlate: plate,
    wheels: [],
    byConcept: {},
    evidence: [],
    ms: {},
  };
}

async function pixelAt(buf: Buffer, x: number, y: number): Promise<{ r: number; g: number; b: number }> {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const o = (y * info.width + x) * info.channels;
  return { r: data[o], g: data[o + 1], b: data[o + 2] };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.BLOB_READ_WRITE_TOKEN;
});

describe("expandPlateBox", () => {
  it("expands by 8% of box size on every side", () => {
    const b = expandPlateBox({ x1: 100, y1: 100, x2: 200, y2: 150, w: 400, h: 300 }, { w: 400, h: 300 });
    expect(b).toMatchObject({ x1: 92, y1: 96, x2: 208, y2: 154 });
  });
  it("clamps to the frame", () => {
    const b = expandPlateBox({ x1: 0, y1: 0, x2: 50, y2: 25, w: 400, h: 300 }, { w: 400, h: 300 });
    expect(b.x1).toBe(0);
    expect(b.y1).toBe(0);
  });
});

describe("hidePlate", () => {
  it("covers the plate with the dark HANBRIDGE plate and leaves the rest untouched", async () => {
    const photo = await testPhoto();
    const out = await hidePlate(photo, plateBox);
    const centre = await pixelAt(out, 78, 101); // plate corner, off the text
    expect(centre.r).toBeLessThan(60); // #14181f plate, was white
    expect(centre.g).toBeLessThan(60);
    const corner = await pixelAt(out, 2, 2);
    const origCorner = await pixelAt(photo, 2, 2);
    expect(Math.abs(corner.r - origCorner.r)).toBeLessThanOrEqual(2);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(W);
    expect(meta.height).toBe(H);
  });
});

describe("meanDiffInsideMask", () => {
  const mask = new Uint8Array(W * H);
  for (let y = 20; y < 130; y++) for (let x = 20; x < 180; x++) mask[y * W + x] = 1;

  it("identical images -> 0", async () => {
    const photo = await testPhoto();
    expect(await meanDiffInsideMask(photo, photo, mask, { w: W, h: H })).toBe(0);
  });
  it("changes outside the mask are ignored, inside are measured", async () => {
    const photo = await testPhoto();
    const outsideOnly = await sharp(photo)
      .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#ffffff"/></svg>`), left: 0, top: 0 }])
      .jpeg()
      .toBuffer();
    expect(await meanDiffInsideMask(photo, outsideOnly, mask, { w: W, h: H })).toBeLessThan(1);
    const black = await sharp({ create: { width: W, height: H, channels: 3, background: "#000000" } }).jpeg().toBuffer();
    expect(await meanDiffInsideMask(photo, black, mask, { w: W, h: H })).toBeGreaterThan(CAR_PIXEL_DIFF_THRESHOLD);
  });
  it("empty mask -> Infinity (unverifiable = reject)", async () => {
    const photo = await testPhoto();
    expect(await meanDiffInsideMask(photo, photo, new Uint8Array(W * H), { w: W, h: H })).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("makeListingPhoto", () => {
  it("no plate -> skipped: plate_not_found, no file", async () => {
    const photo = await testPhoto();
    const outDir = mkdtempSync(path.join(tmpdir(), "listing-"));
    const r = await makeListingPhoto({
      carId: "test-car",
      photoId: "photo_1",
      image: photo,
      segment: segmentWith(null, instance(carBox, true)),
      outDir,
      urlPrefix: "/x",
    });
    expect(r.url).toBeNull();
    expect(r.plateHidden).toBe(false);
    expect(r.rejectedReason).toBe("plate_not_found");
    expect(r.trace.join(" ")).toContain("skipped: plate_not_found");
    expect(existsSync(path.join(outDir, "photo_1-listing.jpg"))).toBe(false);
  });

  it("edited background accepted when car pixels are unchanged", async () => {
    const photo = await testPhoto();
    editMock.mockImplementation(async ({ image }) => {
      // change only the corner outside the car box
      const changed = await sharp(image)
        .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#eeeeee"/></svg>`), left: 0, top: 0 }])
        .jpeg()
        .toBuffer();
      return { image: changed, format: "jpeg", ms: 1, maskUsed: false };
    });
    const outDir = mkdtempSync(path.join(tmpdir(), "listing-"));
    const r = await makeListingPhoto({
      carId: "test-car",
      photoId: "photo_1",
      image: photo,
      segment: segmentWith(instance(plateBox, false), instance(carBox, true)),
      outDir,
      urlPrefix: "/x",
    });
    expect(r.backgroundEdited).toBe(true);
    expect(r.carMaskDiff).not.toBeNull();
    expect(r.carMaskDiff!).toBeLessThanOrEqual(CAR_PIXEL_DIFF_THRESHOLD);
    expect(r.plateHidden).toBe(true);
    expect(r.url).toBe("/x/photo_1-listing.jpg");
    expect(existsSync(path.join(outDir, "photo_1-listing.jpg"))).toBe(true);
    const saved = readFileSync(path.join(outDir, "photo_1-listing.jpg"));
    const platePixel = await pixelAt(saved, 78, 101); // plate corner, off the text
    expect(platePixel.r).toBeLessThan(60);
  });

  it("edited background rejected when the car is redrawn; fallback keeps original background with hidden plate", async () => {
    const photo = await testPhoto();
    editMock.mockImplementation(async () => {
      const black = await sharp({ create: { width: W, height: H, channels: 3, background: "#000000" } }).jpeg().toBuffer();
      return { image: black, format: "jpeg", ms: 1, maskUsed: false };
    });
    const outDir = mkdtempSync(path.join(tmpdir(), "listing-"));
    const r = await makeListingPhoto({
      carId: "test-car",
      photoId: "photo_1",
      image: photo,
      segment: segmentWith(instance(plateBox, false), instance(carBox, true)),
      outDir,
      urlPrefix: "/x",
    });
    expect(r.backgroundEdited).toBe(false);
    expect(r.rejectedReason).toContain("vehicle_pixels_changed");
    expect(r.carMaskDiff!).toBeGreaterThan(CAR_PIXEL_DIFF_THRESHOLD);
    const saved = readFileSync(path.join(outDir, "photo_1-listing.jpg"));
    const body = await pixelAt(saved, 50, 50); // original car colour #204060 survives
    expect(body.b).toBeGreaterThan(60);
    const platePixel = await pixelAt(saved, 78, 101); // plate corner, off the text
    expect(platePixel.r).toBeLessThan(60);
  });

  it("edit failure -> fallback with rejectedReason, file still written", async () => {
    const photo = await testPhoto();
    editMock.mockRejectedValue(new Error("boom"));
    const outDir = mkdtempSync(path.join(tmpdir(), "listing-"));
    const r = await makeListingPhoto({
      carId: "test-car",
      photoId: "photo_1",
      image: photo,
      segment: segmentWith(instance(plateBox, false), instance(carBox, true)),
      outDir,
      urlPrefix: "/x",
    });
    expect(r.backgroundEdited).toBe(false);
    expect(r.rejectedReason).toContain("image_edit_failed");
    expect(existsSync(path.join(outDir, "photo_1-listing.jpg"))).toBe(true);
  });
});

describe("listing images are never evidence", () => {
  const finding = (mediaId: string, maskRef?: string): Finding => ({
    id: "f1",
    panel: "trunk",
    kind: "scratch",
    severity: "low",
    description_en: "x",
    description_ru: "x",
    confidence: 0.9,
    verified: true,
    evidence: [{ type: "mask", mediaId, ...(maskRef ? { maskRef } : {}) }],
  });

  it("clean findings pass", () => {
    expect(() => assertFindingsFreeOfListingEvidence([finding("photo_1")], ["photo_1-listing"])).not.toThrow();
  });
  it("listing mediaId in evidence throws", () => {
    expect(() => assertFindingsFreeOfListingEvidence([finding("photo_1-listing")], ["photo_1-listing"])).toThrow(/never|listing/);
  });
  it("a -listing maskRef throws even without the id list", () => {
    expect(() => assertFindingsFreeOfListingEvidence([finding("photo_1", "/generated/c/photo_1-listing.jpg")], [])).toThrow();
  });
});

describe("getOrCreateHeroImage (no Blob token -> local cache)", () => {
  it("generates once, then serves the cached file", async () => {
    const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#20242c" } }).png().toBuffer();
    genMock.mockResolvedValue({ image: png, format: "png", ms: 1 });
    const id = `tz04-test-${Date.now()}`;
    const first = await getOrCreateHeroImage(id);
    const second = await getOrCreateHeroImage(id);
    expect(first.generated).toBe(true);
    expect(second.generated).toBe(false);
    expect(second.url).toBe(first.url);
    expect(genMock).toHaveBeenCalledTimes(1);
    expect(existsSync(path.join(process.cwd(), "public", "generated", "heroes", `${id}.png`))).toBe(true);
  });
});
