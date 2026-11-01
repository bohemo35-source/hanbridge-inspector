import { afterEach, describe, expect, it, vi } from "vitest";
import { blobUrl, hasMedia, listMedia, mediaSource, tmpMediaPath } from "./media";
import { carMedia } from "./catalog";

afterEach(() => vi.unstubAllEnvs());

describe("media source", () => {
  it("MEDIA_SOURCE=blob serves the manifest (every demo car has photos, report and photo index)", () => {
    vi.stubEnv("MEDIA_SOURCE", "blob");
    for (const id of ["kia-morning", "mini-cooper-s", "bmw-x3-8278", "bmw-530i-8053", "audi-a5-2005"]) {
      expect(mediaSource(id)).toBe("blob");
      const m = carMedia(id);
      expect(m.photos.length, id).toBeGreaterThan(50);
      expect(m.hasInspectorReport, id).toBe(true);
      expect(hasMedia(id, "out", "photo-index.json"), id).toBe(true);
      expect(blobUrl(id, "out", "photo-index.json")).toMatch(/^https:\/\/.+\.public\.blob\.vercel-storage\.com\/demo\//);
    }
  });
  it("MINI keeps the gauge video and the OBD/VIN sheet; Kia has its OBD pdf", () => {
    vi.stubEnv("MEDIA_SOURCE", "blob");
    expect(carMedia("mini-cooper-s").gaugeVideo).toBe("paint_gauge.mp4");
    expect(carMedia("kia-morning").diagnosticPdfs.length).toBe(1);
  });
  it("unknown car falls back to local (no manifest entry)", () => {
    vi.stubEnv("MEDIA_SOURCE", "blob");
    expect(mediaSource("kia-sportage")).toBe("local");
    expect(listMedia("kia-sportage", "photos", [".jpg"])).toEqual([]);
  });
  it("tmp cache path is stable and filesystem-safe", () => {
    const a = tmpMediaPath("kia-morning", "sheets", "Отчёт (VTR).pdf");
    expect(a).toBe(tmpMediaPath("kia-morning", "sheets", "Отчёт (VTR).pdf"));
    expect(a).toMatch(/^[\x20-\x7e]+$/);
  });
});
