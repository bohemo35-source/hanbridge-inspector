// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Unit tests for paint classification boundaries 150/151/220/221
// @created: 2026-10-27
import { describe, it, expect } from "vitest";
import { classifyPaint, paintStatusToFinding, findingsFromPaintReadings } from "./paint";

describe("classifyPaint", () => {
  it("150 -> factory", () => expect(classifyPaint(150)).toBe("factory"));
  it("151 -> repaint", () => expect(classifyPaint(151)).toBe("repaint"));
  it("220 -> repaint", () => expect(classifyPaint(220)).toBe("repaint"));
  it("221 -> putty", () => expect(classifyPaint(221)).toBe("putty"));
  it("120 -> factory", () => expect(classifyPaint(120)).toBe("factory"));
  it("300 -> putty", () => expect(classifyPaint(300)).toBe("putty"));
});

describe("paintStatusToFinding", () => {
  it("factory returns null", () => expect(paintStatusToFinding("hood", 120)).toBeNull());
  it("repaint finding has gauge evidence", () => {
    const f = paintStatusToFinding("door_fl", 180);
    expect(f?.kind).toBe("repaint");
    expect(f?.evidence[0].type).toBe("gauge");
    expect(f?.evidence[0].gaugeMicrons).toBe(180);
  });
  it("putty finding is high severity", () => {
    const f = paintStatusToFinding("roof", 260);
    expect(f?.kind).toBe("putty");
    expect(f?.severity).toBe("high");
  });
  it("findingsFromPaintReadings filters factory", () => {
    const out = findingsFromPaintReadings([
      { panel: "hood", microns: 120 },
      { panel: "door_fl", microns: 200 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].panel).toBe("door_fl");
  });
});
