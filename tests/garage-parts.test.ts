// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Garage scene pure-logic tests: beats, explode offsets, paint classes, panel->part map
// @created: 2026-10-29
import { describe, expect, it } from "vitest";
import {
  BEAT_BOUNDS, PART_MAP, PANEL_TO_PART, beatAt, explodeAmount, explodeOffset,
  findingsByPanel, obdInfo, paintClass, partExplodeT, progressCenterOfBeat, readingsByPart,
} from "../src/components/garage-3d/parts";
import { PANEL_IDS } from "../src/lib/domain/panels";
import type { Report } from "../src/lib/schema";

const report = (over: Partial<Report>): Report => ({
  id: "r-test",
  vehicle: { make: "MINI", model: "Cooper S" },
  findings: [],
  verdict: { decision: "NEGOTIATE", reasons_en: [], reasons_ru: [], confidence: 0.8, handoff: false },
  paintReadings: [],
  costEstimate: { status: "manager_quote_required" },
  trace: [],
  createdAt: "2026-10-29T00:00:00.000Z",
  ...over,
} as Report);

describe("beatAt", () => {
  it("boundaries land on the next beat", () => {
    expect(beatAt(0).beat).toBe(0);
    expect(beatAt(0.149).beat).toBe(0);
    expect(beatAt(0.15).beat).toBe(1);
    expect(beatAt(0.3).beat).toBe(2);
    expect(beatAt(0.55).beat).toBe(3);
    expect(beatAt(0.75).beat).toBe(4);
    expect(beatAt(0.88).beat).toBe(5);
    expect(beatAt(1).beat).toBe(5);
    expect(beatAt(1).local).toBeCloseTo(1);
  });
  it("clamps out-of-range and NaN", () => {
    expect(beatAt(-1).beat).toBe(0);
    expect(beatAt(2).beat).toBe(5);
    expect(beatAt(Number.NaN).beat).toBe(0);
  });
  it("beat and local are monotone over a sweep", () => {
    let prevBeat = -1; let prevKey = -1;
    for (let p = 0; p <= 1.0001; p += 0.005) {
      const { beat, local } = beatAt(Math.min(1, p));
      expect(beat).toBeGreaterThanOrEqual(prevBeat);
      const key = beat * 10 + local;
      expect(key).toBeGreaterThanOrEqual(prevKey - 1e-9);
      prevBeat = beat; prevKey = key;
      expect(local).toBeGreaterThanOrEqual(0);
      expect(local).toBeLessThanOrEqual(1);
    }
  });
  it("beat bounds are strictly increasing and cover 0..1", () => {
    for (let i = 1; i < BEAT_BOUNDS.length; i++) expect(BEAT_BOUNDS[i]).toBeGreaterThan(BEAT_BOUNDS[i - 1]);
    expect(BEAT_BOUNDS[0]).toBe(0);
    expect(progressCenterOfBeat(0)).toBeCloseTo(0.075);
    expect(progressCenterOfBeat(5)).toBeCloseTo(0.94);
  });
});

describe("explodeOffset", () => {
  it("is zero at t=0 and dir*dist at t=1 for every mapped part", () => {
    for (const [name, def] of Object.entries(PART_MAP)) {
      expect(explodeOffset(name, 0)).toEqual({ x: 0, y: 0, z: 0 });
      const at1 = explodeOffset(name, 1);
      const len = Math.hypot(def.dir[0], def.dir[1], def.dir[2]) || 1;
      expect(Math.hypot(at1.x, at1.y, at1.z)).toBeCloseTo(def.dist, 6);
      if (def.dist > 0) {
        expect(at1.x).toBeCloseTo((def.dir[0] / len) * def.dist, 6);
        expect(at1.z).toBeCloseTo((def.dir[2] / len) * def.dist, 6);
      }
    }
  });
  it("directions match the TZ card: hood up, bumpers along x, doors along z", () => {
    expect(explodeOffset("tripo_part_19", 1).y).toBeGreaterThan(0.8); // hood up
    expect(explodeOffset("tripo_part_18", 1).x).toBeGreaterThan(0.9); // front bumper +x
    expect(explodeOffset("tripo_part_5", 1).x).toBeLessThan(-0.9); // rear bumper -x
    expect(explodeOffset("tripo_part_7", 1).z).toBeLessThan(-0.8); // left door -z
    expect(explodeOffset("tripo_part_20", 1).z).toBeGreaterThan(0.8); // right door +z
    expect(explodeOffset("tripo_part_8", 1).y).toBeGreaterThan(1); // cabin up
    expect(explodeOffset("tripo_part_11", 1).y).toBeCloseTo(-0.3); // underbody down 0.3
    expect(explodeOffset("tripo_part_0", 1)).toEqual({ x: 0, y: 0, z: 0 }); // body stays
  });
  it("unknown part and clamped t are safe; stagger starts at 0 and ends at 1", () => {
    expect(explodeOffset("tripo_part_99", 1)).toEqual({ x: 0, y: 0, z: 0 });
    expect(explodeOffset("tripo_part_19", 5)).toEqual(explodeOffset("tripo_part_19", 1));
    for (const def of Object.values(PART_MAP)) {
      expect(partExplodeT(def, 0)).toBe(0);
      expect(partExplodeT(def, 1)).toBe(1);
    }
    expect(explodeAmount(0.2)).toBe(0);
    expect(explodeAmount(0.65)).toBe(1);
    expect(explodeAmount(0.999)).toBeLessThan(0.05);
  });
});

describe("paintClass", () => {
  it("150 factory, 151-220 repaint, 221 putty", () => {
    expect(paintClass(90)).toBe("factory");
    expect(paintClass(150)).toBe("factory");
    expect(paintClass(151)).toBe("repaint");
    expect(paintClass(220)).toBe("repaint");
    expect(paintClass(221)).toBe("putty");
    expect(paintClass(332)).toBe("putty");
  });
});

describe("readingsByPart / findings / obd", () => {
  it("maps all 13 panel ids to parts and covers the full panel list", () => {
    expect(PANEL_IDS).toHaveLength(13);
    for (const id of PANEL_IDS) expect(PANEL_TO_PART[id], id).toMatch(/^tripo_part_\d+$/);
    expect(PANEL_TO_PART.front_left_fender).toBe("tripo_part_0"); // on the body shell
    expect(PANEL_TO_PART.hood).toBe("tripo_part_19");
    expect(new Set(Object.values(PANEL_TO_PART)).size).toBe(13);
  });
  it("maps readings panel -> part with class; unknown panels dropped", () => {
    const m = readingsByPart(report({ paintReadings: [
      { panel: "hood", microns: 332 }, { panel: "front_left_door", microns: 75 }, { panel: "nope", microns: 10 },
    ] }));
    expect(m.get("tripo_part_19")).toMatchObject({ panel: "hood", microns: 332, cls: "putty" });
    expect(m.get("tripo_part_7")).toMatchObject({ panel: "front_left_door", cls: "factory" });
    expect(m.size).toBe(2);
    expect(readingsByPart(null).size).toBe(0);
    expect(readingsByPart(undefined).size).toBe(0);
  });
  it("separates verified and unverified findings per panel", () => {
    const f = (panel: string, verified: boolean) => ({
      id: panel + verified, panel, kind: "repaint" as const, severity: "medium" as const,
      description_en: "", description_ru: "", confidence: 0.9,
      evidence: [{ type: "gauge" as const, mediaId: "g" }], verified,
    });
    const m = findingsByPanel(report({ findings: [f("hood", true), f("hood", false), f("roof", false), f("unknown", true)] }));
    expect(m.get("hood")).toEqual({ verified: true, unverified: true });
    expect(m.get("roof")).toEqual({ verified: false, unverified: true });
    expect(m.has("unknown" as never)).toBe(false);
  });
  it("obdInfo is null without obd evidence and parses counts from report text", () => {
    expect(obdInfo(report({}))).toBeNull();
    const r = report({ findings: [{
      id: "obd", panel: "unknown", kind: "other", severity: "low",
      description_en: "29 systems checked with no fault codes", description_ru: "Проверено 29 систем, ошибок нет",
      confidence: 0.9, evidence: [{ type: "obd", mediaId: "obd" }], verified: true,
    }] });
    expect(obdInfo(r)).toMatchObject({ systems: 29, errors: 0, clean: true });
  });
});
