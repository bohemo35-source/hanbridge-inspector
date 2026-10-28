// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Tests: route stage mapping, reachability, triangle budget, shipping fixture
// @created: 2026-10-28
import { describe, expect, it } from "vitest";
import { buildCar } from "../damage-map-3d/buildCar";
import { STAGE_IDS, progressCenterOf, progressOf, stageAt, stageIndex } from "./route";
import { buildScenery } from "./scenery";
import { DEMO_REPORT_IDS, getShippingStatus } from "@/lib/agent/tools/shipping";

describe("route stage mapping", () => {
  it("boundaries", () => {
    expect(stageAt(0)).toBe("inspection");
    expect(stageAt(1)).toBe("delivery");
    expect(stageAt(-0.5)).toBe("inspection");
    expect(stageAt(1.5)).toBe("delivery");
    expect(stageAt(Number.NaN)).toBe("inspection");
  });
  it("progressOf is monotonic and every stage is reachable", () => {
    let prev = -1;
    for (const s of STAGE_IDS) {
      const p = progressOf(s);
      expect(p).toBeGreaterThan(prev);
      expect(stageAt(p)).toBe(s);
      expect(stageAt(progressCenterOf(s))).toBe(s);
      expect(stageIndex(s)).toBe(STAGE_IDS.indexOf(s));
      prev = p;
    }
    const seen = new Set(Array.from({ length: 701 }, (_, i) => stageAt(i / 700)));
    expect(seen.size).toBe(7);
  });
});

describe("triangle budget", () => {
  it("scenery + journey car < 250_000 tris", () => {
    const scenery = buildScenery();
    const car = buildCar("hatchback", { stations: 80 });
    const total = scenery.tris + car.trisTotal;
    console.log(`scenery=${scenery.tris} car=${car.trisTotal} total=${total}`);
    expect(scenery.tris).toBeGreaterThan(0);
    expect(total).toBeLessThan(250_000);
    car.dispose();
    scenery.dispose();
  });
});

describe("getShippingStatus", () => {
  it("valid stage for every demo machine, stages differ", () => {
    expect(DEMO_REPORT_IDS.length).toBe(5);
    const stages = new Set<string>();
    for (const id of DEMO_REPORT_IDS) {
      const s = getShippingStatus(id);
      expect(STAGE_IDS).toContain(s.stage);
      expect(s.source).toBe("demo_fixture");
      stages.add(s.stage);
    }
    expect(stages.size).toBe(5);
  });
  it("unknown id falls back to inspection without invented eta", () => {
    const s = getShippingStatus("nope");
    expect(s.stage).toBe("inspection");
    expect(s.etaDays).toBeUndefined();
  });
});
