// @agent:   claude (TZ-03 part B)
// @project: hanbridge-inspector
// @purpose: Tests for paint-gauge video merge logic (no network, no ffmpeg)
// @created: 2026-10-28
import { describe, expect, it } from "vitest";
import { colorBand, gaugeFindings, mergeGaugeFrames, micronsBand, toPaintJson, type GaugeFrame } from "./gauge";
import { FindingSchema } from "@/lib/schema";

const f = (t: number, panel: GaugeFrame["panel"], displayColor: GaugeFrame["displayColor"], microns: number | null = null, gaugeVisible = true, panelConfidence = 0.8): GaugeFrame => ({
  t, panel, displayColor, microns, gaugeVisible, panelConfidence,
});

// 10 "frames" like the MINI video: hood measured (orange/red, digits unreadable), fender normal with one readable value,
// a frame without the gauge, a low-confidence panel guess, and a door with readable digits.
const FIXTURE: GaugeFrame[] = [
  f(0, null, null, null, false, 0),
  f(3, "hood", "orange"),
  f(6, "hood", "red"),
  f(9, "hood", "red"),
  f(12, "front_left_fender", "blue", 112),
  f(15, "front_left_fender", "blue"),
  f(18, "front_right_door", "green", null, true, 0.3), // low panel confidence -> ignored
  f(30, "front_right_door", "orange", 190),
  f(33, "front_right_door", "orange", 186),
  f(36, "unknown", "blue"),
];

describe("gauge video merge", () => {
  it("colour and micron bands follow the paint rule", () => {
    expect(colorBand("green")).toBe("normal");
    expect(colorBand("orange")).toBe("elevated");
    expect(colorBand("red")).toBe("high");
    expect(colorBand(null)).toBeNull();
    expect(micronsBand(150)).toBe("normal");
    expect(micronsBand(151)).toBe("elevated");
    expect(micronsBand(221)).toBe("high");
  });

  it("groups consecutive frames per panel and never invents microns", () => {
    const ms = mergeGaugeFrames(FIXTURE);
    expect(ms.map((m) => m.panel)).toEqual(["hood", "front_left_fender", "front_right_door"]);
    const hood = ms[0];
    expect(hood).toMatchObject({ tStart: 3, tEnd: 9, frames: 3, microns: null, band: "high", source: "display_color" });
    expect(ms[1]).toMatchObject({ microns: 112, band: "normal", source: "digits" });
    expect(ms[2]).toMatchObject({ tStart: 30, tEnd: 33, microns: 188, band: "elevated" });
  });

  it("splits the same panel when the gap is too long", () => {
    const ms = mergeGaugeFrames([f(0, "roof", "blue"), f(20, "roof", "blue")]);
    expect(ms).toHaveLength(2);
  });

  it("findings only for non-normal bands, valid schema, second-level evidence", () => {
    const fs = gaugeFindings(mergeGaugeFrames(FIXTURE), "paint_gauge.mp4");
    expect(fs.map((x) => x.panel)).toEqual(["hood", "front_right_door"]);
    for (const x of fs) {
      expect(FindingSchema.safeParse(x).success).toBe(true);
      expect(x.verified).toBe(false);
      expect(x.evidence[0]).toMatchObject({ type: "gauge", mediaId: "paint_gauge.mp4" });
      expect(typeof x.evidence[0].tStart).toBe("number");
    }
    expect(fs[0].evidence[0].gaugeMicrons).toBeUndefined(); // colour-only: no fake number
    expect(fs[0].description_ru).toContain("красный");
    expect(fs[1].evidence[0].gaugeMicrons).toBe(188);
  });

  it("paint.json contains only readable digits", () => {
    expect(toPaintJson(mergeGaugeFrames(FIXTURE))).toEqual({ front_left_fender: 112, front_right_door: 188 });
  });
});

describe("digitFrames", () => {
  it("counts only the frames where the digits were read", () => {
    const fr = (t: number, microns: number | null): GaugeFrame => ({ t, gaugeVisible: true, microns, displayColor: null, panel: "hood", panelConfidence: 0.9 });
    const [m] = mergeGaugeFrames([fr(10, 200), fr(11, null)]);
    expect(m.frames).toBe(2);
    expect(m.digitFrames).toBe(1);
  });
});
