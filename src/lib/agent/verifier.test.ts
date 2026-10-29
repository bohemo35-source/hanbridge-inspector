// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Verifier/verdict unit tests: handoff at 0.5, critical->WALK_AWAY, conflict detection
// @created: 2026-10-29
import { describe, expect, it } from "vitest";
import { decideVerdict, detectConflict, shouldHandoff } from "./verifier";
import type { Finding } from "@/lib/schema";

const f = (over: Partial<Finding>): Finding => ({
  id: "x", panel: "hood", kind: "repaint", severity: "medium",
  description_en: "x", description_ru: "x", confidence: 0.8,
  evidence: [{ type: "gauge", mediaId: "g", gaugeMicrons: 180 }], verified: true, ...over,
});

describe("decideVerdict / handoff", () => {
  it("confidence 0.5 -> handoff:true", () => {
    expect(decideVerdict([f({})], 0.5).handoff).toBe(true);
    expect(shouldHandoff(0.5, [])).toBe(true);
  });
  it("critical verified -> WALK_AWAY; >=3 medium -> NEGOTIATE; clean -> BUY", () => {
    expect(decideVerdict([f({ severity: "critical" })]).decision).toBe("WALK_AWAY");
    expect(decideVerdict([f({}), f({ id: "2" }), f({ id: "3" })]).decision).toBe("NEGOTIATE");
    expect(decideVerdict([f({ severity: "low", kind: "scratch" })]).decision).toBe("BUY");
  });
  it("critical with confidence <0.7 -> handoff even at high overall confidence", () => {
    expect(decideVerdict([f({ severity: "critical", confidence: 0.65 })], 0.9).handoff).toBe(true);
  });
});

describe("detectConflict", () => {
  it("gauge 130 µm vs repaint claim -> conflict", () => {
    expect(detectConflict(f({}), [{ panel: "hood", microns: 130 }])).toBe(true);
  });
  it("gauge 190 µm vs repaint claim -> no conflict", () => {
    expect(detectConflict(f({}), [{ panel: "hood", microns: 190 }])).toBe(false);
  });
});
