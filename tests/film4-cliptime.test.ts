// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Film clip timing: the incoming clip moves through the transition and continues without a jump; the first clip has no lead-in
// @created: 2026-11-03
// @updated: 2026-11-04 claude-code — clipSync: small drift by rate, seek only past 1 s
import { describe, expect, it } from "vitest";
import { SEEK_GAP_S, TW, clipProgress, clipSpan, clipSync } from "../src/components/film4/clipTime";
import { SCENES } from "../src/components/film4/story";

const vh = (k: number) => SCENES[k].vh;
const sec = (k: number) => SCENES[k].sec;

describe("clipProgress", () => {
  it("first clip: no lead-in, runs 0 → 1 over its own scene", () => {
    expect(clipProgress(0, 0, 0, vh)).toBe(0);
    expect(clipProgress(0, 0, 1, vh)).toBeCloseTo(1, 9);
    expect(clipSpan(0, vh)).toBe(SCENES[0].vh);
  });
  it("the incoming clip is parked only before the transition, then moves", () => {
    expect(clipProgress(1, 0, 1 - TW - 0.01, vh)).toBeNull();
    const a = clipProgress(1, 0, 1 - TW / 2, vh)!, b = clipProgress(1, 0, 1 - 0.01, vh)!;
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
  });
  it("no jump at any scene boundary, scroll and watch units alike", () => {
    for (const len of [vh, sec]) for (let i = 0; i + 1 < SCENES.length; i++) {
      const incomingAtEnd = clipProgress(i + 1, i, 1, len)!;
      const currentAtStart = clipProgress(i + 1, i + 1, 0, len)!;
      expect(incomingAtEnd).toBeCloseTo(currentAtStart, 9);
      expect(clipProgress(i + 1, i + 1, 1, len)).toBeCloseTo(1, 9);
    }
  });
  it("monotonic through a scene and its transition", () => {
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.01) { const p = clipProgress(3, 3, Math.min(1, t), vh)!; expect(p).toBeGreaterThanOrEqual(prev); prev = p; }
  });
  it("clips that are neither current nor incoming are not driven", () => {
    expect(clipProgress(5, 2, 0.99, vh)).toBeNull();
    expect(clipProgress(1, 2, 0.5, vh)).toBeNull();
  });
});

describe("clipSync", () => {
  it("in step: the scene's own rate, no seek", () => {
    expect(clipSync(2, 2.05, 1.2)).toEqual({ seekTo: null, rate: 1.2 });
  });
  it("a clip that started 0.5 s late catches up by rate, not by a seek", () => {
    const r = clipSync(0, 0.55, 1);
    expect(r.seekTo).toBeNull(); expect(r.rate).toBeGreaterThan(1);
    // a simulated start: 0.5 s late, then it keeps up within ~2 s without ever seeking
    let cur = 0, t = 0.5, seeks = 0;
    for (let i = 0; i < 120; i++) { const s = clipSync(cur, t, 1); if (s.seekTo !== null) { seeks++; cur = s.seekTo; } cur += s.rate / 60; t += 1 / 60; }
    expect(seeks).toBe(0); expect(Math.abs(t - cur)).toBeLessThan(0.16);
  });
  it("ahead of the picture it slows down", () => {
    expect(clipSync(3, 2.5, 1).rate).toBeLessThan(1);
  });
  it("real drift is sought", () => {
    expect(clipSync(0, SEEK_GAP_S + 0.2, 1).seekTo).toBeCloseTo(SEEK_GAP_S + 0.2);
    expect(clipSync(5, 3, 1).seekTo).toBe(3);
  });
  it("rate stays within what browsers play", () => {
    expect(clipSync(0, 0.5, 4).rate).toBe(4); expect(clipSync(1, 0.5, 0.25).rate).toBe(0.25);
  });
});
