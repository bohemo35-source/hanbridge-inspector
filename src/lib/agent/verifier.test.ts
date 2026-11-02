// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Verifier/verdict unit tests: handoff at 0.5, critical->WALK_AWAY, conflict detection
// @created: 2026-10-29
// @updated: 2026-11-03 claude-code — owner-typed reading alone is not proof
import { describe, expect, it } from "vitest";
import { applyOwnerOnlyRule, decideVerdict, detectConflict, ownerReadingOnly, shouldHandoff, withOwnerReasons } from "./verifier";
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

describe("ownerReadingOnly", () => {
  const typed = new Set(["front_left_door"]);
  const typedOnly = f({ panel: "front_left_door", kind: "putty", severity: "high", evidence: [{ type: "gauge", mediaId: "gauge", gaugeMicrons: 245 }] });
  it("a typed reading with no other source is not proof", () => {
    expect(ownerReadingOnly(typedOnly, typed, new Set())).toBe(true);
  });
  it("a photo frame on the same finding makes it a second source", () => {
    expect(ownerReadingOnly({ ...typedOnly, evidence: [...typedOnly.evidence, { type: "frame", mediaId: "p1" }] }, typed, new Set())).toBe(false);
  });
  it("the inspector measured that panel too (voice / gauge video) → not owner-only", () => {
    expect(ownerReadingOnly(typedOnly, typed, new Set(["front_left_door"]))).toBe(false);
  });
  it("catalog car (nothing typed) → rule does not apply", () => {
    expect(ownerReadingOnly(typedOnly, new Set(), new Set())).toBe(false);
  });
  it("applyOwnerOnlyRule unconfirms only owner-only findings and explains why", () => {
    const owner = { ...typedOnly, id: "paint-front_left_door" };
    const measured = f({ id: "paint-hood", panel: "hood", evidence: [{ type: "gauge", mediaId: "gauge", gaugeMicrons: 180 }] });
    const rule = applyOwnerOnlyRule([owner, measured], typed, new Set(["hood"]));
    expect(rule.ownerOnly.map((x) => x.id)).toEqual(["paint-front_left_door"]);
    expect(owner.verified).toBe(false);
    expect(measured.verified).toBe(true);
    expect(rule.handoffReason).toContain("front_left_door 245 µm");
    expect(rule.reasons_en[0]).toContain("245 µm points to filler");
  });
  it("withOwnerReasons: the typed reading leads, «no adverse findings» is replaced, handoff on", () => {
    const rule = applyOwnerOnlyRule([{ ...typedOnly }], typed, new Set());
    const v = withOwnerReasons({ ...decideVerdict([]), reasons_en: ["No adverse findings identified"], reasons_ru: ["Нет"] }, rule, false);
    expect(v.reasons_en[0]).toContain("owner's typed reading 245 µm");
    expect(v.reasons_en.join(" ")).not.toContain("No adverse");
    expect(v.handoff).toBe(true);
    expect(withOwnerReasons(decideVerdict([]), applyOwnerOnlyRule([], typed, new Set()), false).reasons_en).toEqual([]);
  });
});
