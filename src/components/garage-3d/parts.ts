// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Garage scene pure logic: part map for hero-car-parts.glb, scroll beats, explode offsets, paint classes
// @created: 2026-10-29
import { classifyPaint, type PaintStatus } from "../../lib/domain/paint";
import { PANEL_IDS, type PanelId } from "../../lib/domain/panels";
import type { Report } from "../../lib/schema";

export type PartKind = "body" | "panel" | "cabin" | "wheel" | "light" | "mirror" | "underbody" | "detail";

export interface PartDef {
  /** panels this part carries gauge readings for (one part may carry several) */
  panels: PanelId[];
  kind: PartKind;
  /** explode direction (not normalised) and distance in metres at t=1 */
  dir: readonly [number, number, number];
  dist: number;
  /** stagger order inside the explode beat (0 = first) */
  order: number;
}

/**
 * v2 map (car-v2-parts.glb, 22 parts), verified by reviewer render:
 * +X front, +Y up, left side -Z. One part may carry several panels (15, 3).
 */
export const PART_MAP: Record<string, PartDef> = {
  tripo_part_0: { panels: ["roof"], kind: "cabin", dir: [0, 1, 0], dist: 1.15, order: 7 },
  tripo_part_1: { panels: [], kind: "wheel", dir: [0, -0.05, 1], dist: 0.75, order: 8 },
  tripo_part_2: { panels: [], kind: "wheel", dir: [0, -0.05, 1], dist: 0.75, order: 8 },
  tripo_part_3: { panels: ["rear_left_fender", "rear_right_fender", "trunk"], kind: "panel", dir: [-1, 0.08, 0], dist: 1.15, order: 6 },
  tripo_part_4: { panels: [], kind: "wheel", dir: [0, -0.05, -1], dist: 0.75, order: 8 },
  tripo_part_5: { panels: [], kind: "wheel", dir: [0, -0.05, -1], dist: 0.75, order: 8 },
  tripo_part_6: { panels: [], kind: "underbody", dir: [0, -1, 0], dist: 0.3, order: 0 },
  tripo_part_7: { panels: ["rear_left_door"], kind: "panel", dir: [-0.2, 0.08, -1], dist: 1.35, order: 5 },
  tripo_part_8: { panels: [], kind: "underbody", dir: [0, -1, 0], dist: 0.3, order: 0 },
  tripo_part_9: { panels: ["hood"], kind: "panel", dir: [0.35, 1, 0], dist: 1.25, order: 2 },
  tripo_part_10: { panels: [], kind: "mirror", dir: [0.2, 0.1, 1], dist: 1.42, order: 4 },
  tripo_part_11: { panels: ["front_right_door"], kind: "panel", dir: [0.2, 0.08, 1], dist: 1.35, order: 4 },
  tripo_part_12: { panels: ["front_left_door"], kind: "panel", dir: [0.2, 0.08, -1], dist: 1.35, order: 4 },
  tripo_part_13: { panels: ["rear_bumper"], kind: "panel", dir: [-1, 0.05, 0], dist: 1.5, order: 1 },
  tripo_part_14: { panels: [], kind: "panel", dir: [-1, 0.28, 0], dist: 1.25, order: 6 },
  tripo_part_15: { panels: ["front_left_fender", "front_right_fender"], kind: "panel", dir: [1, 0.05, 0], dist: 1.0, order: 3 },
  tripo_part_16: { panels: ["front_bumper"], kind: "panel", dir: [1, 0.05, 0], dist: 1.35, order: 1 },
  tripo_part_17: { panels: ["rear_right_door"], kind: "panel", dir: [-0.2, 0.08, 1], dist: 1.35, order: 5 },
  tripo_part_18: { panels: [], kind: "mirror", dir: [0.2, 0.1, -1], dist: 1.42, order: 4 },
  tripo_part_19: { panels: [], kind: "detail", dir: [-1, 0.05, 0], dist: 1.5, order: 1 },
  tripo_part_20: { panels: [], kind: "detail", dir: [-1, 0.05, 0], dist: 1.5, order: 1 },
  tripo_part_21: { panels: [], kind: "detail", dir: [1, 0.05, 0], dist: 1.35, order: 1 },
};

export const PART_NAMES = Object.keys(PART_MAP).sort((a, b) => partIndex(a) - partIndex(b));

export function partIndex(name: string): number {
  const n = Number(name.replace("tripo_part_", ""));
  return Number.isFinite(n) ? n : 999;
}

/** panel -> GLB node name (several panels may share one part, e.g. both front fenders on tripo_part_15). */
export const PANEL_TO_PART: Record<PanelId, string> = Object.fromEntries(
  Object.entries(PART_MAP).flatMap(([name, d]) => d.panels.map((panel) => [panel, name] as const)),
) as Record<PanelId, string>;

/** part -> panels it carries. */
export const PART_PANELS: Record<string, PanelId[]> = Object.fromEntries(
  Object.entries(PART_MAP).map(([name, d]) => [name, d.panels]),
);

/**
 * Label anchor offset (metres, car space) for one panel on a shared part:
 * left panels sit at the left edge of the part, right at the right edge,
 * trunk at the rear face. size = part bbox size in car space.
 */
export function panelLabelOffset(panel: PanelId, size: { x: number; z: number }): { x: number; z: number } {
  let x = 0; let z = 0;
  if (panel.includes("left")) z = -size.z * 0.32;
  else if (panel.includes("right")) z = size.z * 0.32;
  if (panel === "trunk") x = -size.x * 0.32;
  return { x, z };
}

// ---------------------------------------------------------------- beats
export const BEAT_BOUNDS = [0, 0.15, 0.3, 0.55, 0.75, 0.88, 1] as const;
export type Beat = 0 | 1 | 2 | 3 | 4 | 5;

export interface BeatInfo { beat: Beat; local: number }

export function beatAt(progress: number): BeatInfo {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  for (let b = 0; b < 5; b++) {
    if (p < BEAT_BOUNDS[b + 1]) return { beat: b as Beat, local: (p - BEAT_BOUNDS[b]) / (BEAT_BOUNDS[b + 1] - BEAT_BOUNDS[b]) };
  }
  return { beat: 5, local: (p - BEAT_BOUNDS[5]) / (1 - BEAT_BOUNDS[5]) };
}

/** Mid-beat progress (capture / pinned views). */
export function progressCenterOfBeat(beat: Beat): number {
  return (BEAT_BOUNDS[beat] + (beat < 5 ? BEAT_BOUNDS[beat + 1] : 1)) / 2;
}

export const REASSEMBLE_CAPTION = { ru: "Собираем обратно — каждая деталь проверена", en: "Back together — every panel checked" };

export const BEAT_CAPTIONS: Record<Beat, { ru: string; en: string }> = {
  0: { ru: "Осмотр в Корее", en: "Inspection in Korea" },
  1: { ru: "Фото каждой зоны — перед, борта, салон, днище", en: "Photos of every zone — front, sides, cabin, underbody" },
  2: { ru: "Разбираем по деталям", en: "Taken apart, panel by panel" },
  3: { ru: "Толщиномер по каждой детали — перекрас виден цифрой", en: "Paint gauge on every panel — repaint shows in numbers" },
  4: { ru: "Двигатель и диагностика", en: "Engine and diagnostics" },
  5: { ru: "Решение — после отчёта", en: "The decision comes after the report" },
};

// ---------------------------------------------------------------- explode
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const easeInOut = (t: number) => { const x = clamp01(t); return x * x * (3 - 2 * x); };

/** Per-part staggered explode factor: parts move one after another inside the explode window. */
export function partExplodeT(def: PartDef, t: number): number {
  const span = 0.45;
  const start = (def.order / 8) * (1 - span);
  return easeInOut((clamp01(t) - start) / span);
}

/** Offset in metres for a part at exploded factor t (already staggered/eased). 0 at t=0, dir*dist at t=1. */
export function explodeOffset(partName: string, t: number): { x: number; y: number; z: number } {
  const def = PART_MAP[partName];
  if (!def) return { x: 0, y: 0, z: 0 };
  const k = clamp01(t);
  const len = Math.hypot(def.dir[0], def.dir[1], def.dir[2]) || 1;
  const s = (def.dist * k) / len;
  const nz = (v: number) => (v === 0 ? 0 : v); // avoid -0
  return { x: nz(def.dir[0] * s), y: nz(def.dir[1] * s), z: nz(def.dir[2] * s) };
}

// ---------------------------------------------------------------- paint / report data
export type PaintClass = PaintStatus;
export function paintClass(microns: number): PaintClass {
  return classifyPaint(microns);
}

export interface PartReading { part: string; panel: PanelId; microns: number; cls: PaintClass }

/** report.paintReadings mapped panel -> GLB part; a shared part keeps one reading per panel. Unknown panels dropped. */
export function readingsByPart(report?: Report | null): Map<string, PartReading[]> {
  const out = new Map<string, PartReading[]>();
  if (!report) return out;
  for (const r of report.paintReadings ?? []) {
    if (!(PANEL_IDS as readonly string[]).includes(r.panel)) continue;
    const panel = r.panel as PanelId;
    const part = PANEL_TO_PART[panel];
    if (!part) continue;
    const arr = out.get(part) ?? [];
    arr.push({ part, panel, microns: r.microns, cls: paintClass(r.microns) });
    out.set(part, arr);
  }
  return out;
}

/** Flat list of all readings (fallback cards). */
export function allReadings(report?: Report | null): PartReading[] {
  return [...readingsByPart(report).values()].flat();
}

/**
 * Hero <-> parts crossfade: hero at beats 0-1 and at the end of beat 5;
 * parts fade in over the first 12% of beat 2 and back out once reassembly
 * finishes in beat 5 (explode reaches 0 at local~0.625). Returns hero weight 0..1.
 */
export function heroWeight(progress: number): number {
  const { beat, local } = beatAt(progress);
  if (beat < 2) return 1;
  if (beat === 2) return 1 - easeInOut(local / 0.12);
  if (beat < 5) return 0;
  return easeInOut((local - 0.62) / 0.23);
}

export interface PanelFindingInfo { verified: boolean; unverified: boolean }

/** Panels carrying findings; only verified findings highlight, unverified get a violet note. */
export function findingsByPanel(report?: Report | null): Map<PanelId, PanelFindingInfo> {
  const out = new Map<PanelId, PanelFindingInfo>();
  if (!report) return out;
  for (const f of report.findings ?? []) {
    if (!(PANEL_IDS as readonly string[]).includes(f.panel)) continue;
    const panel = f.panel as PanelId;
    const cur = out.get(panel) ?? { verified: false, unverified: false };
    if (f.verified) cur.verified = true; else cur.unverified = true;
    out.set(panel, cur);
  }
  return out;
}

export interface ObdInfo { systems: number | null; errors: number | null; clean: boolean }

/** OBD summary strictly from report text; null when the report has no obd evidence (beat 4 is skipped, never invented). */
export function obdInfo(report?: Report | null): ObdInfo | null {
  if (!report) return null;
  let found = false;
  let systems: number | null = null;
  let clean = false;
  for (const f of report.findings ?? []) {
    for (const e of f.evidence ?? []) {
      if (e.type !== "obd") continue;
      found = true;
      const text = `${f.description_en} ${f.description_ru} ${e.quote ?? ""}`;
      const m = text.match(/(\d+)\s*(систем|systems)/i);
      if (m) systems = Number(m[1]);
      if (/ошибок 0|no fault|без (кодов )?ошибок|no errors|0 ошибок/i.test(text)) clean = true;
    }
  }
  return found ? { systems, errors: clean ? 0 : null, clean } : null;
}

export function verdictCounts(report?: Report | null): { total: number; confirmed: number } {
  const findings = report?.findings ?? [];
  return { total: findings.length, confirmed: findings.filter((f) => f.verified).length };
}

/**
 * Explode amount 0..1 across beats: in during beat 2, held in 3 (and 4 when the report has OBD), reversed in 5.
 * Without OBD data beat 4 is the reassembly beat (no invented diagnostics on screen).
 */
export function explodeAmount(progress: number, hasObd = true): number {
  const { beat, local } = beatAt(progress);
  if (beat < 2) return 0;
  if (beat === 2) return easeInOut(local);
  if (beat === 3) return 1;
  if (beat === 4) return hasObd ? 1 : 1 - easeInOut(local);
  return hasObd ? 1 - easeInOut(Math.min(1, local * 1.6)) : 0;
}

/** Lift height in metres: rises in beat 1, holds, lowers at the end of beat 5. */
export function liftAmount(progress: number): number {
  const { beat, local } = beatAt(progress);
  if (beat < 1) return 0;
  if (beat === 1) return easeInOut(local) * 0.85;
  if (beat < 5) return 0.85;
  return 0.85 * (1 - easeInOut(Math.max(0, (local - 0.45) / 0.55)));
}

/** Entry drive offset (metres along -x) during beat 0. */
export function entryOffset(progress: number): number {
  const { beat, local } = beatAt(progress);
  if (beat > 0) return 0;
  return -6.5 * (1 - easeInOut(local));
}
