// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Garage studio data per inspection: status, gauge spread, findings (with inspector quotes) and real photos of every one of the 13 panels (photos picked from the Muse Glimmer photo index)
// @created: 2026-11-02
import type { Report } from "@/lib/schema";
import { PANELS, type PanelId } from "@/lib/domain/panels";
import { classifyPaint } from "@/lib/domain/paint";
import { blobUrl, readMediaText } from "@/lib/agent/media";
import { getCar } from "@/lib/agent/catalog";
import NOTES_RU from "./notes-ru.json";
import SHEETS from "./inspector-sheets.json";
import GAUGE from "./gauge-videos.json";

export type PanelStatus = "factory" | "repaint" | "putty" | "replaced" | "damage" | "unconfirmed" | "clean";
export interface PanelPhoto { id: string; url: string; note: string; noteRu?: string; closeUp: boolean; view: string }
export interface PanelFinding { kind: string; severity: string; verified: boolean; en: string; ru: string; quotes: { quote: string; t?: number }[]; microns?: number; frames: { id: string; url: string }[] }
export interface PanelState {
  panel: PanelId;
  status: PanelStatus;
  reading?: { microns: number; min?: number; max?: number; points?: number };
  findings: PanelFinding[];
  photos: PanelPhoto[];
}
export interface SheetItem { ru: string; en: string; panels?: string[] }
/** the inspector's original checklist, structured by Muse Spark (scripts/film4/build-sheets.mjs) */
export interface InspectorSheet { facts: { ru: string; en: string; value_ru: string; value_en: string }[]; sections: { ru: string; en: string; state: string; items: SheetItem[] }[] }
/** neutral template the garage shows for this car (one shape per body type, never the exact model) */
export type BodyKind = "suv" | "sedan" | "hatchback" | "compact" | "city";
const BODY_OF: Record<string, BodyKind> = { "mini-cooper-s": "compact", "kia-morning": "city" };
export function bodyKind(carId: string, report?: Report): BodyKind {
  if (BODY_OF[carId]) return BODY_OF[carId];
  const t = getCar(carId)?.bodyType ?? report?.vehicle.bodyType;
  return t === "sedan" ? "sedan" : t === "hatchback" ? ((getCar(carId)?.doors ?? report?.vehicle.doors) === 3 ? "compact" : "hatchback") : "suv";
}
export interface GarageData {
  carId: string;
  title: string;
  reportId?: string;
  decision?: Report["verdict"]["decision"];
  reasons?: { en: string[]; ru: string[] };
  panels: PanelState[];
  photoTotal: number;
  body: BodyKind;
  sheet?: InspectorSheet;
  gaugeVideo?: { url: string; poster: string };
}

interface IndexEntry { photoId: string; view?: string; whole_car?: boolean; close_up?: boolean; panels?: string[]; note?: string }

const KIND_STATUS: Record<string, PanelStatus> = { panel_replaced: "replaced", putty: "putty", repaint: "repaint", dent: "damage", scratch: "damage", rust: "damage", mechanical: "damage", other: "damage" };
const RANK: PanelStatus[] = ["clean", "factory", "unconfirmed", "damage", "repaint", "putty", "replaced"];

const SYN: Record<string, string[]> = { fender: ["fender", "wing", "quarter"], trunk: ["trunk", "tailgate", "liftgate", "boot", "hatch"], hood: ["hood", "bonnet"], bumper: ["bumper"], door: ["door"], roof: ["roof", "sunroof"] };
/** how well a photo note names the panel: part word (with synonyms) + side + front/rear */
export function noteScore(panel: PanelId, note: string): number {
  const n = note.toLowerCase(), w = panel.split("_");
  const part = w[w.length - 1];
  if (!(SYN[part] ?? [part]).some((x) => n.includes(x))) return 0;
  return 1 + w.slice(0, -1).filter((x) => n.includes(x)).length * 0.5;
}

/** Panel status: gauge class, raised by findings (verified → by kind, unverified → "unconfirmed"); the loudest wins. */
export function panelStatus(report: Report | undefined, panel: PanelId): PanelStatus {
  const r = report?.paintReadings.find((x) => x.panel === panel);
  let status: PanelStatus = r ? classifyPaint(r.microns) : "clean";
  for (const f of report?.findings ?? []) {
    if (f.panel !== panel) continue;
    const s = f.verified ? KIND_STATUS[f.kind] ?? "damage" : "unconfirmed";
    if (RANK.indexOf(s) > RANK.indexOf(status)) status = s;
  }
  return status;
}

export async function garageData(carId: string, report?: Report, title?: string): Promise<GarageData> {
  let entries: IndexEntry[] = [];
  try { entries = (JSON.parse(await readMediaText(carId, "out", "photo-index.json")) as { entries: IndexEntry[] }).entries ?? []; } catch { /* no index: panels without photos */ }

  const panels: PanelState[] = PANELS.map(({ id }) => {
    const r = report?.paintReadings.find((x) => x.panel === id);
    const fs = (report?.findings ?? []).filter((f) => f.panel === id);
    const status = panelStatus(report, id);
    // photos whose Glimmer note names this panel first, then its close-ups, then frames with few panels in them
    const photos = entries
      .filter((e) => e.panels?.includes(id))
      .map((e) => ({ e, s: noteScore(id, e.note ?? "") * 3 + Number(!!e.close_up) * 2 - (e.panels?.length ?? 9) * 0.3 }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.e)
      .slice(0, 8)
      .map((e) => ({ id: e.photoId, url: blobUrl(carId, "photos", e.photoId) ?? "", note: e.note ?? "", noteRu: (NOTES_RU as Record<string, Record<string, string>>)[carId]?.[e.photoId], closeUp: !!e.close_up, view: e.view ?? "" }))
      .filter((p) => p.url);
    return {
      panel: id,
      status,
      reading: r ? { microns: r.microns, min: r.min, max: r.max, points: r.points } : undefined,
      findings: fs.map((f) => ({
        kind: f.kind, severity: f.severity, verified: f.verified, en: f.description_en, ru: f.description_ru,
        quotes: f.evidence.filter((e) => e.quote && e.type === "transcript").map((e) => ({ quote: e.quote!, t: e.tStart })),
        microns: f.evidence.find((e) => e.gaugeMicrons)?.gaugeMicrons,
        // evidence frames the agent linked (plate-safe copies from the report)
        frames: f.evidence.filter((e) => (e.type === "frame" || e.type === "mask") && report?.mediaUrls?.[e.mediaId]).map((e) => ({ id: e.mediaId, url: report!.mediaUrls![e.mediaId] })),
      })),
      photos,
    };
  });
  return {
    carId,
    title: title ?? (report ? `${report.vehicle.year ?? ""} ${report.vehicle.make} ${report.vehicle.model}`.trim() : carId),
    reportId: report?.id,
    decision: report?.verdict.decision,
    reasons: report ? { en: report.verdict.reasons_en, ru: report.verdict.reasons_ru } : undefined,
    panels,
    photoTotal: entries.length,
    body: bodyKind(carId, report),
    sheet: (SHEETS as unknown as Record<string, InspectorSheet>)[carId],
    gaugeVideo: (GAUGE as Record<string, { url: string }>)[carId] ? { url: (GAUGE as Record<string, { url: string }>)[carId].url, poster: `/garage/gauge/${carId}.jpg` } : undefined,
  };
}
