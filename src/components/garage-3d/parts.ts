// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Garage scene pure logic: part map for hero-car-parts.glb, scroll beats, explode offsets, paint classes
// @created: 2026-10-29
import { classifyPaint, type PaintStatus } from "../../lib/domain/paint";
import { PANEL_IDS, type PanelId } from "../../lib/domain/panels";
import type { Report } from "../../lib/schema";

export type PartKind = "body" | "panel" | "cabin" | "wheel" | "light" | "mirror" | "underbody" | "detail";

export interface PartDef {
  /** panel this part carries a gauge reading for; front_left_fender lives on the body shell */
  panel?: PanelId;
  kind: PartKind;
  /** explode direction (not normalised) and distance in metres at t=1 */
  dir: readonly [number, number, number];
  dist: number;
  /** stagger order inside the explode beat (0 = first) */
  order: number;
}

/**
 * Map verified against the GLB node positions (x front, y up, -z left):
 * wheels 1 rear-left, 2 rear-right, 3 front-right, 4 front-left;
 * mirrors 14 left / 24 right; headlights 13 left / 25 right.
 */
export const PART_MAP: Record<string, PartDef> = {
  tripo_part_0: { panel: "front_left_fender", kind: "body", dir: [0, 0, 0], dist: 0, order: 0 },
  tripo_part_19: { panel: "hood", kind: "panel", dir: [0.25, 1, 0], dist: 0.95, order: 2 },
  tripo_part_18: { panel: "front_bumper", kind: "panel", dir: [1, 0.05, 0], dist: 1.05, order: 1 },
  tripo_part_12: { panel: "front_right_fender", kind: "panel", dir: [0.15, 0.1, 1], dist: 0.85, order: 3 },
  tripo_part_7: { panel: "front_left_door", kind: "panel", dir: [0, 0.08, -1], dist: 0.95, order: 4 },
  tripo_part_9: { panel: "rear_left_door", kind: "panel", dir: [0, 0.08, -1], dist: 0.95, order: 5 },
  tripo_part_20: { panel: "front_right_door", kind: "panel", dir: [0, 0.08, 1], dist: 0.95, order: 4 },
  tripo_part_21: { panel: "rear_right_door", kind: "panel", dir: [0, 0.08, 1], dist: 0.95, order: 5 },
  tripo_part_6: { panel: "rear_left_fender", kind: "panel", dir: [-0.45, 0.08, -1], dist: 0.9, order: 6 },
  tripo_part_10: { panel: "rear_right_fender", kind: "panel", dir: [-0.45, 0.08, 1], dist: 0.9, order: 6 },
  tripo_part_5: { panel: "rear_bumper", kind: "panel", dir: [-1, 0.05, 0], dist: 1.05, order: 1 },
  tripo_part_16: { panel: "trunk", kind: "panel", dir: [-0.55, 0.75, 0], dist: 0.95, order: 3 },
  tripo_part_8: { panel: "roof", kind: "cabin", dir: [0, 1, 0], dist: 1.15, order: 7 },
  tripo_part_1: { kind: "wheel", dir: [0, -0.05, -1], dist: 0.75, order: 8 },
  tripo_part_2: { kind: "wheel", dir: [0, -0.05, 1], dist: 0.75, order: 8 },
  tripo_part_3: { kind: "wheel", dir: [0, -0.05, 1], dist: 0.75, order: 8 },
  tripo_part_4: { kind: "wheel", dir: [0, -0.05, -1], dist: 0.75, order: 8 },
  tripo_part_13: { kind: "light", dir: [1, 0.05, -0.15], dist: 1.12, order: 1 },
  tripo_part_25: { kind: "light", dir: [1, 0.05, 0.15], dist: 1.12, order: 1 },
  tripo_part_14: { kind: "mirror", dir: [0, 0.1, -1], dist: 1.0, order: 4 },
  tripo_part_24: { kind: "mirror", dir: [0, 0.1, 1], dist: 1.0, order: 4 },
  tripo_part_11: { kind: "underbody", dir: [0, -1, 0], dist: 0.3, order: 0 },
  tripo_part_15: { kind: "underbody", dir: [0, -1, 0], dist: 0.3, order: 0 },
};

const DETAIL_PARTS = ["tripo_part_17", "tripo_part_22", "tripo_part_23", "tripo_part_26", "tripo_part_27", "tripo_part_28", "tripo_part_29", "tripo_part_30", "tripo_part_31"];
for (const name of DETAIL_PARTS) PART_MAP[name] = { kind: "detail", dir: [0, 0, 0], dist: 0, order: 0 };

export const PART_NAMES = Object.keys(PART_MAP).sort((a, b) => partIndex(a) - partIndex(b));

export function partIndex(name: string): number {
  const n = Number(name.replace("tripo_part_", ""));
  return Number.isFinite(n) ? n : 999;
}

/** panel -> GLB node name (front_left_fender is part of the body shell tripo_part_0). */
export const PANEL_TO_PART: Record<PanelId, string> = Object.fromEntries(
  Object.entries(PART_MAP).filter(([, d]) => d.panel).map(([name, d]) => [d.panel as PanelId, name]),
) as Record<PanelId, string>;

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

/** report.paintReadings mapped panel -> GLB part. Readings for unknown panels are dropped. */
export function readingsByPart(report?: Report | null): Map<string, PartReading> {
  const out = new Map<string, PartReading>();
  if (!report) return out;
  for (const r of report.paintReadings ?? []) {
    if (!(PANEL_IDS as readonly string[]).includes(r.panel)) continue;
    const panel = r.panel as PanelId;
    const part = PANEL_TO_PART[panel];
    if (part) out.set(part, { part, panel, microns: r.microns, cls: paintClass(r.microns) });
  }
  return out;
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

/** Explode amount 0..1 across beats: in during beat 2, held 3-4, reversed during beat 5. */
export function explodeAmount(progress: number): number {
  const { beat, local } = beatAt(progress);
  if (beat < 2) return 0;
  if (beat === 2) return easeInOut(local);
  if (beat < 5) return 1;
  return 1 - easeInOut(Math.min(1, local * 1.6));
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
