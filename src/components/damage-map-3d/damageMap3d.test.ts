// @agent:   claude (TZ-06)
// @project: hanbridge-inspector
// @purpose: Tests for body templates, panel split, explode vectors, panel colouring, body-type guess, demo fixture
// @created: 2026-10-28
import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { ReportSchema, type Finding } from "@/lib/schema";
import { BODY_TYPES } from "./bodyTemplates";
import { guessBodyType } from "./bodyTypeMap";
import { buildCar, panelBoxes } from "./buildCar";
import { DEMO_REPORT } from "./fixtures/demoReport";
import { COLORS, PANEL_IDS, panelVisual } from "./panels";

describe("buildCar", () => {
  for (const type of BODY_TYPES) {
    it(`${type}: all 13 panels, each with real geometry`, () => {
      const m = buildCar(type);
      expect(m.missingPanels).toEqual([]);
      expect(m.panels.size).toBe(13);
      for (const id of PANEL_IDS) expect(m.panels.get(id)!.tris, id).toBeGreaterThanOrEqual(300);
      expect(m.trisTotal).toBeLessThan(120_000);
      m.dispose();
    });

    it(`${type}: sides and ends are where their names say`, () => {
      const m = buildCar(type);
      for (const [id, part] of m.panels) {
        if (id.includes("_left_")) expect(part.center.x, id).toBeGreaterThan(0.5);
        if (id.includes("_right_")) expect(part.center.x, id).toBeLessThan(-0.5);
        if (id.startsWith("front_")) expect(part.center.z, id).toBeGreaterThan(0);
        if (id === "rear_bumper" || id === "trunk" || id.startsWith("rear_")) expect(part.center.z, id).toBeLessThan(0);
      }
      expect(m.panels.get("roof")!.center.y).toBeGreaterThan(m.panels.get("hood")!.center.y);
      // nothing below the ground
      for (const part of m.parts) expect(new Box3().setFromObject(part.object).min.y, part.id).toBeGreaterThanOrEqual(-0.01);
      m.dispose();
    });

    it(`${type}: explode moves every panel clear of its assembled spot`, () => {
      const m = buildCar(type);
      const b0 = panelBoxes(m, 0), b1 = panelBoxes(m, 1);
      for (const id of PANEL_IDS) {
        const c0 = b0.get(id)!.getCenter(new Vector3());
        const c1 = b1.get(id)!.getCenter(new Vector3());
        expect(c1.distanceTo(c0), id).toBeGreaterThanOrEqual(0.5);
      }
      // left and right doors never collide when exploded
      expect(b1.get("front_left_door")!.intersectsBox(b1.get("front_right_door")!)).toBe(false);
      m.dispose();
    });
  }

  it("3-door hatchback has no rear doors", () => {
    const m = buildCar("hatchback", { doors: 3 });
    expect(m.missingPanels.sort()).toEqual(["rear_left_door", "rear_right_door"]);
    m.dispose();
  });
});

const f = (over: Partial<Finding>): Finding => ({
  id: "x",
  panel: "hood",
  kind: "dent",
  severity: "medium",
  description_en: "",
  description_ru: "",
  confidence: 0.8,
  evidence: [{ type: "gauge", mediaId: "gauge" }],
  verified: true,
  ...over,
});

describe("panelVisual", () => {
  it("gauge boundaries 150 / 151 / 220 / 221", () => {
    const at = (microns: number) => panelVisual("hood", [{ panel: "hood", microns }], []).color;
    expect(at(150)).toBe(COLORS.factory);
    expect(at(151)).toBe(COLORS.repaint);
    expect(at(220)).toBe(COLORS.repaint);
    expect(at(221)).toBe(COLORS.putty);
  });
  it("only unconfirmed findings → violet and '?' tag", () => {
    const v = panelVisual("hood", [{ panel: "hood", microns: 128 }], [f({ verified: false })]);
    expect(v.color).toBe(COLORS.unconfirmed);
    expect(v.tag).toBe("? 128 мкм");
  });
  it("verified finding keeps the gauge colour and a tag", () => {
    const v = panelVisual("hood", [{ panel: "hood", microns: 238 }], [f({ kind: "putty" })]);
    expect(v.color).toBe(COLORS.putty);
    expect(v.tag).toBe("238 мкм");
    expect(v.strength).toBeGreaterThan(0.8);
  });
  it("no reading and no findings → noData, no tag", () => {
    const v = panelVisual("roof", [], []);
    expect(v.state).toBe("noData");
    expect(v.tag).toBeUndefined();
  });
});

describe("guessBodyType", () => {
  it.each([
    ["MINI", "Cooper S", "hatchback"],
    ["BMW", "X3 xDrive20d", "suv"],
    ["BMW", "530i", "sedan"],
    ["Mercedes-Benz", "E-Class E220d", "sedan"],
    ["Hyundai", "Sonata DN8", "sedan"],
    ["Volvo", "XC60", "suv"],
  ])("%s %s → %s", (make, model, type) => {
    expect(guessBodyType(make, model)).toEqual({ type, guessed: false });
  });
  it("unknown → sedan, flagged as a guess", () => {
    expect(guessBodyType("Foo", "Bar")).toEqual({ type: "sedan", guessed: true });
  });
});

describe("demo fixture", () => {
  it("is a valid Report", () => {
    expect(ReportSchema.safeParse(DEMO_REPORT).success).toBe(true);
  });
});
