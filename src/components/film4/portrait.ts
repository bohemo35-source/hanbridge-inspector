// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Portrait (phone) layout of a film scene, top to bottom: header · picture band (4:3 crop of the 16:9 clip) · the scene's line ·
//           its card (receipt, toast, chips) if it has one · progress rail — with equal gaps, so the band never sits pressed under the
//           header over an empty bottom and no card covers the picture. Short screens shrink the band, never below the full 16:9 frame.
// @created: 2026-11-04
// @updated: 2026-11-04 claude-code — playTop: the opening Play / "or scroll" block under the band, centred between band and rail

export const HEAD = 56, RAIL = 72, MIN_GAP = 10; // RAIL: the progress rail and the Play / Stop button above it
export const TEXT = 92; // up to three lines of the scene's text at 28 px

export interface PortraitLayout { bandTop: number; bandH: number; textTop: number; cardTop: number; gap: number }

/** w × h = the film stage in CSS px; card = height of the scene's card in px (0 = none). */
export function portraitLayout(w: number, h: number, card: number): PortraitLayout {
  const n = card > 0 ? 4 : 3; // gaps: header|band, band|text, (text|card), last|rail
  const room = h - HEAD - RAIL - TEXT - Math.max(0, card);
  const bandH = Math.max((w * 9) / 16, Math.min((w * 3) / 4, room - n * MIN_GAP));
  const gap = Math.max(MIN_GAP, (room - bandH) / n);
  const bandTop = HEAD + gap, textTop = bandTop + bandH + gap;
  return { bandTop, bandH, textTop, cardTop: textTop + TEXT + gap, gap };
}

export const PROGRESS = 40, PLAY_BLOCK = 89; // the progress rail at the bottom; Play button 62 + gap 12 + "or scroll" 15

/** opening scene: top of the Play / "or scroll" block — under the band, centred between the band and the progress rail */
export function playTop(L: PortraitLayout, h: number): number {
  const bandBottom = L.bandTop + L.bandH;
  return bandBottom + Math.max(L.gap, (h - PROGRESS - bandBottom - PLAY_BLOCK) / 2);
}
