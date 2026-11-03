// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Pure timing of the film clips: a clip's time spans the previous scene's transition tail (TW) plus its own scene,
//           so the incoming clip already moves while it fades in and carries on without a jump into its scene
// @created: 2026-11-03

/** share of a scene (its tail) used for the transition into the next one */
export const TW = 0.26;
const cl = (v: number) => Math.max(0, Math.min(1, v));

/** Seconds (watch mode) or vh (scroll) of clip k's span: lead-in over scene k−1's tail + its own scene. */
export const clipSpan = (k: number, len: (k: number) => number, tw = TW) => (k > 0 ? tw * len(k - 1) : 0) + len(k);

/**
 * Where clip k stands, 0..1 of its duration, when scene i is at progress t (0..1); null when clip k is neither the current one
 * nor the one fading in. `len(k)` is the length of scene k in any unit (watch-mode seconds or scroll vh).
 */
export function clipProgress(k: number, i: number, t: number, len: (k: number) => number, tw = TW): number | null {
  const lead = (n: number) => (n > 0 ? tw * len(n - 1) : 0);
  if (k === i) return (lead(k) + t * len(k)) / clipSpan(k, len, tw);
  const into = cl((t - (1 - tw)) / tw); // linear time through the transition into scene i+1
  if (k === i + 1 && into > 0) return (into * lead(k)) / clipSpan(k, len, tw);
  return null;
}
