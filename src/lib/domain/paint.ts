// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Deterministic paint-gauge classification (<=150 factory, 151-220 repaint, >220 putty)
// @created: 2026-10-27
import type { Finding } from "@/lib/schema";

export type PaintStatus = "factory" | "repaint" | "putty";

export function classifyPaint(microns: number): PaintStatus {
  if (microns <= 150) return "factory";
  if (microns <= 220) return "repaint";
  return "putty";
}

export function paintStatusToFinding(panel: string, microns: number, mediaId = "gauge"): Finding | null {
  const status = classifyPaint(microns);
  if (status === "factory") return null;
  const isPutty = status === "putty";
  return {
    id: `paint-${panel}`,
    panel,
    kind: isPutty ? "putty" : "repaint",
    severity: isPutty ? "high" : "medium",
    description_en: isPutty
      ? `Paint thickness ${microns} µm on ${panel} indicates filler / body repair.`
      : `Paint thickness ${microns} µm on ${panel} indicates repaint.`,
    description_ru: isPutty
      ? `Толщина ЛКП ${microns} мкм на панели ${panel} указывает на шпатлёвку / кузовной ремонт.`
      : `Толщина ЛКП ${microns} мкм на панели ${panel} указывает на перекрас.`,
    confidence: 0.95,
    evidence: [{ type: "gauge", mediaId, gaugeMicrons: microns, panel }],
    verified: true,
    verifierNote: "Deterministic gauge rule (<=150 factory, 151-220 repaint, >220 putty).",
  };
}

export function findingsFromPaintReadings(
  readings: Array<{ panel: string; microns: number }>,
): Finding[] {
  return readings
    .map((r) => paintStatusToFinding(r.panel, r.microns))
    .filter((f): f is Finding => f !== null);
}
