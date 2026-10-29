import { describe, expect, it } from "vitest";
import { pickDefectPhotos, pickListingCandidates, type PhotoIndex } from "./photoIndex";
import { finalAnswer } from "@/lib/meta/glimmer";

const e = (photoId: string, view: string, whole_car: boolean, close_up = false, panels: string[] = []) => ({ photoId, view, whole_car, close_up, panels, note: "", ms: 1 });
const idx: PhotoIndex = { carId: "x", model: "muse-glimmer-30b", createdAt: "", failed: [], totalMs: 0, entries: [
  e("a", "detail", false, true), e("b", "front_left", true, false, ["hood", "front_bumper"]), e("c", "left", true), e("d", "interior", false),
  e("e", "rear_right", true), e("f", "rear", false, true), e("g", "front_left", true),
] };

describe("photo index picks", () => {
  it("defect picks: whole-car exterior views on different sides, no interior/close-ups first", () => {
    const p = pickDefectPhotos(idx, 3);
    expect(p).toHaveLength(3);
    expect(p).not.toContain("d");
    expect(new Set(p.map((id) => idx.entries.find((x) => x.photoId === id)!.view)).size).toBe(3);
  });
  it("listing candidates: whole-car 3/4 views first, never close-ups", () => {
    const l = pickListingCandidates(idx);
    expect(l.slice(0, 3)).toEqual(["b", "e", "g"]);
    expect(l).not.toContain("a");
    expect(l).not.toContain("f");
  });
});

describe("glimmer finalAnswer", () => {
  it("keeps only the text after the last to=user marker", () => {
    expect(finalAnswer(" to=selfthinking...\nassistant to=userОтвет.")).toBe("Ответ.");
    expect(finalAnswer('{"a":1}')).toBe('{"a":1}');
  });
});
