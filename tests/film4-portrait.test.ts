// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Portrait film layout: a bigger band (4:3), equal gaps above and below, the line under the band and the card under the line — never over the picture
// @created: 2026-11-04
// @updated: 2026-11-04 claude-code — playTop: Play under the band, above the progress rail, equal gaps
import { describe, expect, it } from "vitest";
import { HEAD, MIN_GAP, PLAY_BLOCK, PROGRESS, RAIL, TEXT, playTop, portraitLayout } from "../src/components/film4/portrait";

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
    for (const [w, h] of screens) for (const card of [42, 84, 94, 120, 178, 210]) { // the real cards: chips, toasts, the Busan and customs receipts
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

describe("playTop (opening scene: Play / \"or scroll\" never over the picture)", () => {
  // 390×844 / 375×812 full screens, 375×667 (SE), 390×664 and 375×548 (Safari with both bars), 320×568
  const sizes = [[390, 844], [375, 812], [375, 667], [390, 664], [375, 548], [320, 568]] as const;
  it("under the band with a real gap, above the progress rail, gaps equal", () => {
    for (const [w, h] of sizes) {
      const L = portraitLayout(w, h, 0), top = playTop(L, h);
      const above = top - (L.bandTop + L.bandH), below = h - PROGRESS - (top + PLAY_BLOCK);
      expect(above).toBeGreaterThanOrEqual(16);
      expect(below).toBeGreaterThanOrEqual(16);
      expect(Math.abs(above - below)).toBeLessThan(0.5);
    }
  });
});
