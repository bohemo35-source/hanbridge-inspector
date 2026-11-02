// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Unit tests for the bridge hero geometry (counts, group sizes, pylon blocks on the deck, cable anchors on the deck)
// @created: 2026-11-02
import { describe, expect, it } from "vitest";
import { buildBridge } from "./bridge";

describe("buildBridge", () => {
  const { shards } = buildBridge();
  it("has 88 shards: 64 glass bodies and 24 glow strips", () => {
    expect(shards.length).toBe(88);
    expect(shards.filter((s) => !s.glow).length).toBe(64);
    expect(shards.filter((s) => s.glow).length).toBe(24);
  });
  it("splits into the six assembly groups 8/12/24/24/12/8", () => {
    const sizes = [0, 0, 0, 0, 0, 0];
    for (const s of shards) sizes[s.g]++;
    expect(sizes).toEqual([8, 12, 24, 24, 12, 8]);
  });
  it("stacks 8 touching-with-small-gap pylon blocks per pylon, the lowest on the deck", () => {
    const pylon = shards.filter((s) => s.a[1] === 1 && s.L > 0.3);
    expect(pylon.length).toBe(16);
    const left = pylon.filter((s) => s.p[0] < 0).sort((a, b) => a.p[1] - b.p[1]);
    expect(left.length).toBe(8);
    expect(left[0].p[1] - left[0].L / 2).toBeCloseTo(0.0, 2);
    for (let i = 1; i < left.length; i++) {
      const gap = left[i].p[1] - left[i - 1].p[1] - (left[i].L + left[i - 1].L) / 2;
      expect(gap).toBeGreaterThan(0);
      expect(gap).toBeLessThan(0.02);
    }
  });
  it("runs the stay cables from the pylon top down to the deck top, inside the span", () => {
    const cables = shards.filter((s) => s.t === 0.03);
    expect(cables.length).toBe(24);
    for (const c of cables) {
      expect(Math.abs(c.p[0])).toBeLessThan(3.2);
      expect(Math.hypot(...c.a)).toBeCloseTo(1, 5);
      expect(c.L).toBeGreaterThan(0.5);
    }
  });
});
