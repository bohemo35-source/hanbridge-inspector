// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Portrait film layout: a bigger band (4:3), equal gaps above and below, the line under the band and the card under the line — never over the picture
// @created: 2026-11-04
import { describe, expect, it } from "vitest";
import { HEAD, MIN_GAP, RAIL, TEXT, portraitLayout } from "../src/components/film4/portrait";

const screens = [[390, 664], [390, 725], [390, 844], [430, 932]] as const; // Safari with bars, Arthur's iPhone, full 390×844, 430×932

describe("portraitLayout", () => {
  it("no card: a full 4:3 band, gaps equal top, middle and bottom", () => {
    for (const [w, h] of screens) {
      const L = portraitLayout(w, h, 0);
      expect(L.bandH).toBeCloseTo((w * 3) / 4);
      const top = L.bandTop - HEAD, mid = L.textTop - (L.bandTop + L.bandH), bottom = h - RAIL - (L.textTop + TEXT);
      expect(Math.abs(top - mid)).toBeLessThan(0.5); expect(Math.abs(top - bottom)).toBeLessThan(0.5);
    }
  });
  it("the band is bigger than the old full-width 16:9 strip", () => {
    expect(portraitLayout(390, 725, 0).bandH / ((390 * 9) / 16)).toBeGreaterThan(1.3);
  });
  it("a card sits under the line, below the band, and inside the screen", () => {
    for (const [w, h] of screens) for (const card of [74, 132, 228, 272]) {
      const L = portraitLayout(w, h, card);
      expect(L.textTop).toBeGreaterThanOrEqual(L.bandTop + L.bandH + MIN_GAP - 0.01);
      expect(L.cardTop).toBeGreaterThanOrEqual(L.textTop + TEXT);
      if (h >= 725) expect(L.cardTop + card).toBeLessThanOrEqual(h - RAIL);
    }
  });
  it("short screens shrink the band, never below the whole 16:9 frame", () => {
    const L = portraitLayout(390, 600, 272);
    expect(L.bandH).toBeCloseTo((390 * 9) / 16); expect(L.gap).toBe(MIN_GAP);
  });
});
