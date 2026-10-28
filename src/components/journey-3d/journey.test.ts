// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Tests: route stage mapping, reachability, triangle budget, shipping fixture
// @created: 2026-10-28
import { describe, expect, it } from "vitest";
import { buildCar } from "../damage-map-3d/buildCar";
import { STAGE_IDS, beatAt, progressCenterOf, progressOf, stageAt, stageIndex } from "./route";
import { STAGE_CONTENT, TOTAL_TIME } from "./stageContent";
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

describe("beatAt", () => {
  it("boundaries and clamps", () => {
    expect(beatAt(0)).toEqual({ stage: "inspection", beat: 0, local: 0 });
    expect(beatAt(1).stage).toBe("delivery");
    expect(beatAt(1).beat).toBe(2);
    expect(beatAt(1).local).toBeCloseTo(1, 5);
    expect(beatAt(-1)).toEqual({ stage: "inspection", beat: 0, local: 0 });
    expect(beatAt(Number.NaN).stage).toBe("inspection");
    for (const s of STAGE_IDS) {
      const start = beatAt(progressOf(s));
      expect(start.stage).toBe(s);
      expect(start.beat).toBe(0);
      expect(start.local).toBeCloseTo(0, 9);
    }
  });
  it("all 21 beats reachable and monotonic", () => {
    const seen = new Set<string>();
    let prevKey = -1;
    for (let i = 0; i <= 2100; i++) {
      const b = beatAt(i / 2100);
      const key = STAGE_IDS.indexOf(b.stage) * 3 + b.beat;
      seen.add(`${b.stage}:${b.beat}`);
      expect(key).toBeGreaterThanOrEqual(prevKey);
      expect(b.local).toBeGreaterThanOrEqual(0);
      expect(b.local).toBeLessThanOrEqual(1);
      expect(b.stage).toBe(stageAt(i / 2100));
      prevKey = key;
    }
    expect(seen.size).toBe(21);
  });
  it("stage content: every stage fully localized, total-time line fixed", () => {
    for (const s of STAGE_IDS) {
      const c = STAGE_CONTENT[s];
      for (const field of ["what", "docs", "owner", "clientSees", "typical"] as const) {
        expect(c[field].ru.length).toBeGreaterThan(3);
        expect(c[field].en.length).toBeGreaterThan(3);
      }
      expect(`${c.what.ru}${c.docs.ru}`).not.toMatch(/\d+\s*(₽|руб|USD|\$)/);
    }
    expect(STAGE_CONTENT.inspection.typical.ru).toBe("в день выбора (если до 16:00), иначе на следующий день");
    expect(STAGE_CONTENT.port_busan.typical.ru).toBe("до 7 дней от выкупа до погрузки — суда уходят 2 раза в неделю");
    expect(STAGE_CONTENT.customs.typical.ru).toBe("выгрузка и таможня в среднем 10 дней");
    expect(STAGE_CONTENT.delivery.typical.ru).toBe("до Москвы ~9 000 км, 12–14 дней");
    expect(TOTAL_TIME.ru).toBe("После оплаты до Москвы — примерно 4–5 недель");
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
