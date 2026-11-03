// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Photo defects: paint signs only for uploads (catalog cars never get a repaint from a photo); the upload prompt really differs from the catalog one
// @created: 2026-11-03
import { describe, expect, it } from "vitest";
import { DEFECTS_SPEC, PAINT_SIGNS_SPEC, keepPhotoKind } from "./defects";

describe("keepPhotoKind", () => {
  it("catalog car: visible damage only, no paint claims from a photo", () => {
    for (const k of ["scratch", "dent", "rust", "mechanical", "other"]) expect(keepPhotoKind(k, false)).toBe(true);
    for (const k of ["repaint", "putty", "panel_replaced"]) expect(keepPhotoKind(k, false)).toBe(false);
  });
  it("upload: a repaint sign is kept, putty and replacement still never come from a photo", () => {
    expect(keepPhotoKind("repaint", true)).toBe(true);
    expect(keepPhotoKind("putty", true)).toBe(false);
    expect(keepPhotoKind("panel_replaced", true)).toBe(false);
  });
});

describe("PAINT_SIGNS_SPEC", () => {
  it("is the catalog spec with the paint ban replaced by the signs to look for (the replace did not silently miss)", () => {
    expect(PAINT_SIGNS_SPEC).not.toBe(DEFECTS_SPEC);
    expect(DEFECTS_SPEC).toContain("Do NOT report repaint");
    expect(PAINT_SIGNS_SPEC).not.toContain("Do NOT report repaint");
    expect(PAINT_SIGNS_SPEC).toContain("SIGNS of paint work");
    expect(PAINT_SIGNS_SPEC).toContain("overspray");
  });
});
