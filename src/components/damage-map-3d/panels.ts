// @agent:   claude (TZ-06)
// @project: hanbridge-inspector
// @purpose: Panel colouring by paint gauge / findings for the 3D damage map; panel dictionary re-exported from domain
// @created: 2026-10-28
// @updated: 2026-10-28 muse-code
import { classifyPaint } from "@/lib/domain/paint";
import { PANEL_IDS, type PanelId } from "@/lib/domain/panels";
import type { Finding, PaintReading } from "@/lib/schema";

// Panel dictionary moved to src/lib/domain/panels.ts (TZ-02); re-exported here so
// existing 3D imports keep working with the same ids and order.
export { PANELS, PANEL_IDS, isPanelId, panelLabel, type PanelId } from "@/lib/domain/panels";

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
  /** spread of all measured points on the panel (several zones), when more than one */
  range?: { min: number; max: number; points: number };
  findings: Finding[];
  /** short label for the 3D tag (Russian UI unit), e.g. "238 мкм" or "? 128 мкм" */
  tag?: string;
}

const SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 } as const;

export function panelVisual(panel: PanelId, readings: PaintReading[], findings: Finding[]): PanelVisual {
  const reading = readings.find((r) => r.panel === panel);
  const microns = reading?.microns;
  const range = reading && reading.min !== undefined && reading.max !== undefined && (reading.points ?? 0) > 1 ? { min: reading.min, max: reading.max, points: reading.points ?? 0 } : undefined;
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
  return { panel, state, color, strength, microns, ...(range ? { range } : {}), findings: own, tag };
}

export function allPanelVisuals(readings: PaintReading[], findings: Finding[]): PanelVisual[] {
  return PANEL_IDS.map((p) => panelVisual(p, readings, findings));
}
