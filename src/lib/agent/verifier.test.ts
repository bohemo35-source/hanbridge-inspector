// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Verifier/verdict unit tests: handoff at 0.5, critical->WALK_AWAY, conflict detection
// @created: 2026-10-29
// @updated: 2026-11-03 claude-code — owner-typed reading alone is not proof
// @updated: 2026-11-03 claude-code — uploads: only a readable gauge screen matching the voice confirms (owner decision 03.11)
// @updated: 2026-11-03 claude-code — photo signs of paint work alone (or with a typed number) are not proof
import { describe, expect, it } from "vitest";
import { applyOwnerOnlyRule, applyPhotoPaintRule, applyUploadVoiceRule, confirmedByScreen, decideVerdict, detectConflict, ownerReadingOnly, photoPaintOnly, shouldHandoff, withOwnerReasons } from "./verifier";
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
  it("withOwnerReasons: the typed reading leads, 'no adverse findings' is replaced, handoff on", () => {
    const rule = applyOwnerOnlyRule([{ ...typedOnly }], typed, new Set());
    const v = withOwnerReasons({ ...decideVerdict([]), reasons_en: ["No adverse findings identified"], reasons_ru: ["Нет"] }, rule, false);
    expect(v.reasons_en[0]).toContain("owner's typed reading 245 µm");
    expect(v.reasons_en.join(" ")).not.toContain("No adverse");
    expect(v.handoff).toBe(true);
    expect(withOwnerReasons(decideVerdict([]), applyOwnerOnlyRule([], typed, new Set()), false).reasons_en).toEqual([]);
  });
});

describe("photoPaintOnly / applyPhotoPaintRule", () => {
  const sign = f({ id: "photo-03-paintsign-1", panel: "front_left_fender", kind: "repaint", evidence: [{ type: "frame", mediaId: "photo-03.jpg" }] });
  it("a repaint seen on a photo only → photo-only", () => {
    expect(photoPaintOnly(sign, new Set())).toBe(true);
  });
  it("photo + the owner's typed number is still not a measurement", () => {
    expect(photoPaintOnly({ ...sign, evidence: [...sign.evidence, { type: "gauge", mediaId: "gauge", gaugeMicrons: 240 }] }, new Set())).toBe(true);
  });
  it("inspector voice or a measured panel makes it a real source", () => {
    expect(photoPaintOnly({ ...sign, evidence: [...sign.evidence, { type: "transcript", mediaId: "v.mp4", quote: "крыло 240" }] }, new Set())).toBe(false);
    expect(photoPaintOnly(sign, new Set(["front_left_fender"]))).toBe(false);
  });
  it("a scratch on a photo is not a paint claim", () => {
    expect(photoPaintOnly({ ...sign, kind: "scratch" }, new Set())).toBe(false);
  });
  it("applyPhotoPaintRule unconfirms, hands off and explains; BUY stays BUY", () => {
    const a = { ...sign }, b = { ...sign, id: "photo-05-paintsign-1", panel: "trunk" as const }, s = f({ id: "s", kind: "scratch", evidence: [{ type: "frame", mediaId: "p" }] });
    const rule = applyPhotoPaintRule([a, b, s], new Set());
    expect(rule.signs.map((x) => x.id)).toEqual(["photo-03-paintsign-1", "photo-05-paintsign-1"]);
    expect(a.verified).toBe(false);
    expect(s.verified).toBe(true);
    expect(rule.handoffReason).toContain("front_left_fender, trunk");
    expect(rule.reasons_en[0]).toContain("not confirmed");
    const v = withOwnerReasons(decideVerdict([]), rule, false);
    expect(v.decision).toBe("BUY");
    expect(v.handoff).toBe(true);
  });
});

describe("uploads: voice vs gauge screen (owner decision 03.11)", () => {
  it("confirmedByScreen: same paint class on voice and screen confirms; different class or no screen does not", () => {
    expect(confirmedByScreen({ front_left_fender: 240, trunk: 181, hood: 110 }, { front_left_fender: 236, trunk: 120 })).toEqual(["front_left_fender"]);
    expect(confirmedByScreen({ hood: 110 }, {})).toEqual([]);
    expect(confirmedByScreen({}, { hood: 300 })).toEqual([]);
  });
  it("applyUploadVoiceRule: voice-only paint work → unconfirmed + reason; a screen-confirmed panel and visible damage stay", () => {
    const voice = f({ id: "v-trunk", panel: "trunk", kind: "panel_replaced", evidence: [{ type: "transcript", mediaId: "owner_video.mp4", quote: "замена" }] });
    const screen = f({ id: "v-fender", panel: "front_left_fender", kind: "repaint", evidence: [{ type: "transcript", mediaId: "owner_video.mp4", quote: "крыло 240" }, { type: "gauge", mediaId: "owner_video.mp4", gaugeMicrons: 236 }] });
    const dent = f({ id: "d", panel: "rear_bumper", kind: "dent", evidence: [{ type: "frame", mediaId: "p1" }] });
    const rule = applyUploadVoiceRule([voice, screen, dent], new Set(["front_left_fender"]));
    expect(rule.claims.map((x) => x.id)).toEqual(["v-trunk"]);
    expect(voice.verified).toBe(false);
    expect(screen.verified).toBe(true);
    expect(dent.verified).toBe(true);
    expect(rule.reasons_en[0]).toContain("trunk");
    expect(applyUploadVoiceRule([], new Set()).reasons_en).toEqual([]);
  });
  it("a replacement is never confirmed by thickness, even on a screen-measured panel", () => {
    const repl = f({ id: "v-trunk-repl", panel: "trunk", kind: "panel_replaced", evidence: [{ type: "transcript", mediaId: "owner_video.mp4", quote: "была замена" }] });
    const paintOk = f({ id: "v-trunk-paint", panel: "trunk", kind: "repaint", evidence: [{ type: "gauge", mediaId: "owner_video.mp4", gaugeMicrons: 175 }] });
    const rule = applyUploadVoiceRule([repl, paintOk], new Set(["trunk"]));
    expect(rule.claims.map((x) => x.id)).toEqual(["v-trunk-repl"]);
    expect(repl.verified).toBe(false);
    expect(paintOk.verified).toBe(true);
    expect(repl.verifierNote).toContain("replacement");
  });
});
