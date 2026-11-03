// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Pure watch-mode rule: the picture follows the narration only while the voice's clock really advances, otherwise it keeps the scene's pace;
//           the voice is brought to the picture only when it is more than 1 s off, and not again within 3 s (a stuck seek must not loop)
// @created: 2026-11-04

export interface VoiceClock { lastT: number; lastMove: number; following: boolean; lastResync: number }
export const newVoiceClock = (): VoiceClock => ({ lastT: -1, lastMove: 0, following: false, lastResync: -Infinity });
export const STALL_MS = 600, RESYNC_GAP_S = 1, RESYNC_COOLDOWN_MS = 3000;

/** One frame. `want` = where the voice should be for the picture's position (s), null without narration timing. Mutates `c`. */
export function voiceDecision(c: VoiceClock, now: number, a: { time: number; paused: boolean; readyState: number }, want: number | null): { follow: boolean; seekTo: number | null } {
  if (a.paused) { c.following = false; return { follow: false, seekTo: null }; }
  if (a.time !== c.lastT) { c.lastT = a.time; c.lastMove = now; }
  const moving = now - c.lastMove < STALL_MS && a.readyState >= 3;
  let seekTo: number | null = null;
  if (moving && !c.following) {
    c.following = true;
    if (want !== null && Math.abs(want - a.time) > RESYNC_GAP_S && now - c.lastResync > RESYNC_COOLDOWN_MS) { seekTo = want; c.lastResync = now; c.lastT = want; }
  } else if (!moving) c.following = false;
  return { follow: c.following, seekTo };
}
