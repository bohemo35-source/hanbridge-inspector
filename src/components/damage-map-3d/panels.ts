// @agent:   claude (TZ-06)
// @project: hanbridge-inspector
// @purpose: 13 body panels for the 3D damage map + panel colouring by paint gauge / findings
// @created: 2026-10-28
import { classifyPaint } from "@/lib/domain/paint";
import type { Finding, PaintReading } from "@/lib/schema";

// Ids match FINDINGS_DRAFT_SPEC in src/lib/schema/prompt.ts. When TZ-02 adds src/lib/domain/panels.ts,
// switch this list to import from there (same ids).
export const PANELS = [
  { id: "front_bumper", en: "Front bumper", ru: "Передний бампер" },
  { id: "hood", en: "Hood", ru: "Капот" },
  { id: "front_left_fender", en: "Front left fender", ru: "Крыло переднее левое" },
  { id: "front_right_fender", en: "Front right fender", ru: "Крыло переднее правое" },
  { id: "front_left_door", en: "Front left door", ru: "Дверь передняя левая" },
  { id: "front_right_door", en: "Front right door", ru: "Дверь передняя правая" },
  { id: "rear_left_door", en: "Rear left door", ru: "Дверь задняя левая" },
  { id: "rear_right_door", en: "Rear right door", ru: "Дверь задняя правая" },
  { id: "rear_left_fender", en: "Rear left fender", ru: "Крыло заднее левое" },
  { id: "rear_right_fender", en: "Rear right fender", ru: "Крыло заднее правое" },
  { id: "trunk", en: "Trunk / tailgate", ru: "Багажник / дверь багажника" },
  { id: "rear_bumper", en: "Rear bumper", ru: "Задний бампер" },
  { id: "roof", en: "Roof", ru: "Крыша" },
] as const;

export type PanelId = (typeof PANELS)[number]["id"];
export const PANEL_IDS: readonly PanelId[] = PANELS.map((p) => p.id);
export const isPanelId = (s: string): s is PanelId => (PANEL_IDS as readonly string[]).includes(s);
export const panelLabel = (id: string, lang: "en" | "ru" = "ru") => {
  const p = PANELS.find((x) => x.id === id);
  return p ? p[lang] : id;
};

export const COLORS = {
  factory: "#4fb38a",
  repaint: "#e3a33b",
  putty: "#e5544b",
  unconfirmed: "#9a8cf0",
  noData: "#7c8592",
} as const;

export type PanelState = "factory" | "repaint" | "putty" | "unconfirmed" | "noData";

export interface PanelVisual {
  panel: PanelId;
  state: PanelState;
  color: string;
  /** 0..1 how strongly the colour replaces the base paint */
  strength: number;
  microns?: number;
  findings: Finding[];
  /** short label for the 3D tag, e.g. "238 мкм" or "? 128 мкм" */
  tag?: string;
}

const SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 } as const;

export function panelVisual(panel: PanelId, readings: PaintReading[], findings: Finding[]): PanelVisual {
  const microns = readings.find((r) => r.panel === panel)?.microns;
  const own = findings
    .filter((f) => f.panel === panel)
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  const verified = own.filter((f) => f.verified);
  const unit = "мкм";

  let state: PanelState;
  if (microns !== undefined) state = classifyPaint(microns);
  else state = "noData";
  // verified putty / repaint findings without a gauge value still colour the panel
  if (microns === undefined && verified.some((f) => f.kind === "putty")) state = "putty";
  else if (microns === undefined && verified.some((f) => f.kind === "repaint")) state = "repaint";
  // only unconfirmed findings on a panel → violet
  if (own.length > 0 && verified.length === 0) state = "unconfirmed";

  const color = COLORS[state];
  const strength = own.length > 0 ? 0.85 : state === "noData" ? 0.12 : state === "factory" ? 0.38 : 0.6;
  const tag =
    own.length > 0
      ? `${verified.length === 0 ? "? " : ""}${microns !== undefined ? `${microns} ${unit}` : own[0].kind}`
      : undefined;
  return { panel, state, color, strength, microns, findings: own, tag };
}

export function allPanelVisuals(readings: PaintReading[], findings: Finding[]): PanelVisual[] {
  return PANEL_IDS.map((p) => panelVisual(p, readings, findings));
}
