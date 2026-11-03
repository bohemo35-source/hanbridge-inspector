// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Watch mode: a stuck voice never freezes the picture, a resync happens once and not in a loop, small drift is left alone
// @created: 2026-11-04
import { describe, expect, it } from "vitest";
import { newVoiceClock, voiceDecision } from "../src/components/film4/voiceFollow";

const frames = (c: ReturnType<typeof newVoiceClock>, from: number, to: number, voice: (now: number) => { time: number; paused: boolean; readyState: number }, want: (now: number) => number | null) => {
  const out: { now: number; follow: boolean; seekTo: number | null }[] = [];
  for (let now = from; now <= to; now += 16) out.push({ now, ...voiceDecision(c, now, voice(now), want(now)) });
  return out;
};

describe("voiceDecision", () => {
  it("follows a voice whose clock advances", () => {
    const c = newVoiceClock();
    const r = frames(c, 0, 2000, (n) => ({ time: n / 1000, paused: false, readyState: 4 }), (n) => n / 1000);
    expect(r.slice(5).every((x) => x.follow)).toBe(true);
    expect(r.some((x) => x.seekTo !== null)).toBe(false); // in step: no seek
  });
  it("a voice that plays but whose clock is stuck lets the picture keep its pace (no freeze)", () => {
    const c = newVoiceClock();
    const r = frames(c, 0, 5000, (n) => ({ time: n < 1000 ? n / 1000 : 1, paused: false, readyState: 4 }), () => 1);
    expect(r.filter((x) => x.now > 1700).every((x) => !x.follow)).toBe(true);
  });
  it("paused or not ready → pace", () => {
    const c = newVoiceClock();
    expect(voiceDecision(c, 0, { time: 0, paused: true, readyState: 4 }, 0).follow).toBe(false);
    expect(voiceDecision(c, 16, { time: 0.1, paused: false, readyState: 2 }, 0).follow).toBe(false);
  });
  it("resyncs a voice that is >1 s off once, and not again in a loop while the seek keeps stalling", () => {
    const c = newVoiceClock();
    // the voice buffers 1.5 s after every seek: moving → seek → stall → moving …
    let seekAt = -1e9, base = 0;
    const voice = (n: number) => { const ready = n - seekAt > 1500; return { time: ready ? base + (n - seekAt - 1500) / 1000 : base, paused: false, readyState: ready ? 4 : 1 }; };
    let seeks = 0;
    for (let now = 0; now < 20000; now += 16) {
      const d = voiceDecision(c, now, voice(now), now / 1000 + 5); // the picture is always 5 s ahead
      if (d.seekTo !== null) { seeks++; seekAt = now; base = d.seekTo; }
    }
    expect(seeks).toBeLessThanOrEqual(7); // at most one per 3 s cooldown (was a seek every ~1.5 s, the voice never played)
    expect(seeks).toBeGreaterThanOrEqual(1);
  });
  it("small drift (≤1 s) is left alone", () => {
    const c = newVoiceClock();
    const r = frames(c, 0, 1000, (n) => ({ time: n / 1000, paused: false, readyState: 4 }), (n) => n / 1000 + 0.8);
    expect(r.every((x) => x.seekTo === null)).toBe(true);
  });
});
