// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: findDefects wiring with SAM and Spark mocked: the catalog prompt and filter drop a photo repaint, the upload (paintSigns) prompt and filter keep it as an unverified photo sign
// @created: 2026-11-03
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const spark = vi.hoisted(() => ({ spec: "" }));
vi.mock("@/lib/meta/sam", async (orig) => ({ ...(await orig<typeof import("@/lib/meta/sam")>()), samSegment: vi.fn(async () => ({ instances: [], width: 200, height: 100 })) }));
vi.mock("@/lib/meta/spark", () => ({
  sparkJson: vi.fn(async (_schema: unknown, _messages: unknown, spec: string) => {
    spark.spec = spec;
    return { view: "left", panels_visible: ["front_left_fender"], defects: [
      { panel: "front_left_fender", kind: "repaint", severity: "high", box: { x1: 10, y1: 10, x2: 60, y2: 40 }, description_en: "Shade differs from the door.", description_ru: "Оттенок отличается от двери.", confidence: 0.9 },
      { panel: "front_left_door", kind: "scratch", severity: "low", box: { x1: 80, y1: 20, x2: 120, y2: 30 }, description_en: "Light scratch.", description_ru: "Царапина.", confidence: 0.7 },
    ] };
  }),
}));
import { DEFECTS_SPEC, PAINT_SIGNS_SPEC, findDefects } from "./defects";

let image: Buffer;
beforeEach(async () => { image = await sharp({ create: { width: 200, height: 100, channels: 3, background: "#888" } }).jpeg().toBuffer(); });

describe("findDefects wiring", () => {
  it("catalog car: catalog prompt, the photo repaint is dropped, the scratch stays", async () => {
    const r = await findDefects({ carId: "kia-sportage", photoId: "p1.jpg", image });
    expect(spark.spec).toBe(DEFECTS_SPEC);
    expect(r.findings.map((f) => f.kind)).toEqual(["scratch"]);
  });
  it("upload: paint-signs prompt, the repaint is kept as a photo sign (capped, unverified)", async () => {
    const r = await findDefects({ carId: "u-1", photoId: "p1.jpg", image, paintSigns: true });
    expect(spark.spec).toBe(PAINT_SIGNS_SPEC);
    const sign = r.findings.find((f) => f.kind === "repaint")!;
    expect(sign.id).toContain("paintsign");
    expect(sign.verified).toBe(false);
    expect(sign.confidence).toBeLessThanOrEqual(0.6);
    expect(sign.severity).toBe("medium");
    expect(sign.description_en).toContain("photo sign only");
  });
});
