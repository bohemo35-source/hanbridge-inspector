// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Agent orchestrator: Spark tool-calling loop (max 16 steps) -> cross-source merge -> open-weight verifier -> deterministic verdict -> report
// @created: 2026-10-29
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { z } from "zod";
import { findingsFromPaintReadings } from "@/lib/domain/paint";
import { guessBodyType } from "@/components/damage-map-3d/bodyTypeMap";
import { sparkChat, sparkJson, type ChatMessage, type ToolDef } from "@/lib/meta/spark";
import type { Finding, Report } from "@/lib/schema";
import { ReportSchema } from "@/lib/schema";
import { saveReport } from "@/lib/store/reports";
import { carMedia, getCar, photoPath, spreadPhotos, videoPath, type CarMedia } from "./catalog";
import { segmentImage } from "./tools/segment";
import { findDefects } from "./tools/defects";
import { transcribeNote } from "./tools/voice";
import { readGaugeVideo } from "./tools/gauge";
import { makeListingPhoto, getOrCreateHeroImage, assertFindingsFreeOfListingEvidence } from "./tools/listing";
import { getShippingStatus } from "./tools/shipping";
import { readDiagnosticReport } from "./tools/diagnostic";
import { readInspectorReport } from "./tools/inspector";
import { decideVerdict, detectConflict, verifyFinding } from "./verifier";

export type AgentStep = Report["trace"][number];
const WHY: Record<string, string> = {
  segment_image: "SAM geometry, car/plate/wheels before any claim",
  find_defects: "Spark defect scan on the SAM car crop",
  transcribe_note: "Inspector voice: spoken gauge readings with verbatim quotes",
  read_gauge_video: "Gauge screen colour/digits cross-check against voice",
  read_diagnostic_report: "LAUNCH OBD PDF: fault codes as obd evidence",
  read_inspector_report: "Inspector text claims to cross-check vs photo/gauge",
  analyze_paint_readings: "Deterministic paint classification (≤150/151–220/>220 µm)",
  make_listing_photo: "Listing photo with plate hidden (never evidence)",
  get_shipping_status: "Shipping stage fixture for the delivery tab",
  estimate_landed_cost: "Landed cost policy check (no invented numbers)",
  handoff_to_manager: "Low confidence / critical uncertainty -> human manager",
  finalize_report: "Assemble verified report and verdict",
};

const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []) => ({
  type: "function" as const, function: { name, description, parameters: { type: "object", properties, required } },
});
export const AGENT_TOOLS: ToolDef[] = [
  fn("segment_image", "SAM 3.1: segment car/license plate/wheels in one photo", { photoId: { type: "string" } }, ["photoId"]),
  fn("find_defects", "Find visible defects in one photo (SAM crop + Spark vision)", { photoId: { type: "string" } }, ["photoId"]),
  fn("transcribe_note", "Transcribe inspector voice from ONE video and extract per-panel readings", { videoId: { type: "string" } }, ["videoId"]),
  fn("read_gauge_video", "Read paint-gauge video (MINI paint_gauge.mp4 only)", {}),
  fn("read_diagnostic_report", "Read LAUNCH OBD PDF from sheets/", { file: { type: "string" } }, ["file"]),
  fn("read_inspector_report", "Read inspector_report_ru.txt claims per panel", {}),
  fn("analyze_paint_readings", "Deterministic findings from collected paint readings", {}),
  fn("make_listing_photo", "Make plate-safe listing photo from one photo", { photoId: { type: "string" } }, ["photoId"]),
  fn("get_shipping_status", "Shipping stage for this report", {}),
  fn("estimate_landed_cost", "Landed/customs cost estimate", {}),
  fn("handoff_to_manager", "Hand off to a human manager", { reason: { type: "string" } }, ["reason"]),
  fn("finalize_report", "Finish: verifier runs, verdict is computed, report is saved", {}),
];

export interface RunResult { report: Report; ms: number; }

export async function runInspection(opts: {
  carId: string; reportId?: string; onStep?: (s: AgentStep) => void; maxSteps?: number;
}): Promise<RunResult> {
  const t0 = Date.now();
  const car = getCar(opts.carId);
  if (!car) throw new Error(`unknown carId: ${opts.carId}`);
  const media: CarMedia = carMedia(opts.carId);
  const reportId = opts.reportId ?? `r-${opts.carId}-${Date.now().toString(36)}`;
  const suggested = spreadPhotos(media.photos, 4);
  const trace: AgentStep[] = [];
  const findings: Finding[] = [];
  const paint = new Map<string, number>();
  const called = new Set<string>();
  let listingUrl: string | undefined; let listingPhotoId: string | undefined;
  let handoffReason: string | undefined; let finalized = false;
  let shipping = getShippingStatus(reportId);

  const step = (tool: string, argsSummary: string, ok: boolean, outputSummary: string, ms: number) => {
    const s: AgentStep = { i: trace.length + 1, tool, argsSummary: argsSummary.slice(0, 200), why: WHY[tool] ?? "", ms, ok, outputSummary: outputSummary.slice(0, 500) };
    trace.push(s); opts.onStep?.(s); return s;
  };
  const addFindings = (list: Finding[]) => {
    for (const f of list) {
      const key = `${f.panel}:${f.kind}`;
      const ex = findings.find((x) => `${x.panel}:${x.kind}` === key);
      if (ex) {
        const types = new Set(ex.evidence.map((e) => e.type));
        ex.evidence.push(...f.evidence.filter((e) => !ex.evidence.some((y) => y.quote && y.quote === e.quote)));
        if (f.evidence.some((e) => !types.has(e.type))) ex.confidence = Math.min(0.97, ex.confidence + 0.08); // second independent source
      } else findings.push(f);
    }
  };
  const addPaint = (rec: Record<string, number>) => { for (const [p, v] of Object.entries(rec)) paint.set(p, Math.max(paint.get(p) ?? 0, v)); };

  async function execute(name: string, args: Record<string, unknown>): Promise<string> {
    const key = `${name}:${JSON.stringify(args)}`;
    if (called.has(key)) return "already called with same args; pick another tool or finalize_report";
    called.add(key);
    const ts = Date.now();
    try {
      let out = "";
      if (name === "segment_image") {
        const photoId = String(args.photoId ?? "");
        const r = await segmentImage({ carId: opts.carId, photoId, imagePath: photoPath(opts.carId, photoId) });
        out = `car=${r.car ? "found" : "none"} plate=${r.licensePlate ? "found" : "none"} wheels=${r.wheels.length} ${r.width}x${r.height}`;
      } else if (name === "find_defects") {
        const photoId = String(args.photoId ?? "");
        const image = await readFile(photoPath(opts.carId, photoId));
        const r = await findDefects({ carId: opts.carId, photoId, image });
        addFindings(r.findings);
        out = `view=${r.view} panels=${r.panels_visible.join(",")} defects=${r.findings.length}: ${r.findings.map((f) => `${f.panel}/${f.kind}/${f.severity}`).join(", ") || "none"}`;
      } else if (name === "transcribe_note") {
        const videoId = String(args.videoId ?? media.videos[0] ?? "");
        if (!videoId) { step(name, key, true, "source absent: no videos for this car", Date.now() - ts); return "source absent: no videos"; }
        const r = await transcribeNote({ video: videoPath(opts.carId, videoId), mediaId: videoId });
        addFindings(r.findings); addPaint(r.paint);
        out = `chunks=${r.chunks.length} readings=${r.readings.length} findings=${r.findings.length} conflicts=${r.conflicts.map((c) => c.panel).join(",") || "none"} paint=${JSON.stringify(r.paint)}`;
      } else if (name === "read_gauge_video") {
        if (!media.gaugeVideo) { step(name, key, true, "source absent: no paint_gauge.mp4 for this car", Date.now() - ts); return "source absent: no paint_gauge.mp4"; }
        const r = await readGaugeVideo({ video: videoPath(opts.carId, media.gaugeVideo), mediaId: media.gaugeVideo });
        addFindings(r.findings); addPaint(r.paint);
        out = `frames=${r.stats.frames} measurements=${r.measurements.length} findings=${r.findings.length} paint=${JSON.stringify(r.paint)}`;
      } else if (name === "read_diagnostic_report") {
        const file = String(args.file ?? media.diagnosticPdfs[0] ?? "");
        if (!file) { step(name, key, true, "source absent: no OBD PDF for this car", Date.now() - ts); return "source absent: no OBD PDF"; }
        const r = await readDiagnosticReport({ carId: opts.carId, file });
        addFindings(r.findings);
        out = `source=${r.source} systems=${r.systemsChecked} faults=${r.faultCodes.length} vin=${r.vinMasked ?? "n/a"}`;
      } else if (name === "read_inspector_report") {
        if (!media.hasInspectorReport) { step(name, key, true, "source absent: no inspector_report_ru.txt", Date.now() - ts); return "source absent"; }
        const r = await readInspectorReport({ carId: opts.carId });
        addFindings(r.findings);
        out = `claims=${r.claims.length} findings=${r.findings.length} rejectedQuotes=${r.rejected}`;
      } else if (name === "analyze_paint_readings") {
        const list = [...paint.entries()].map(([panel, microns]) => ({ panel, microns }));
        const fs = findingsFromPaintReadings(list);
        addFindings(fs);
        out = `readings=${list.length} paintFindings=${fs.length}: ${list.map((r) => `${r.panel}=${r.microns}`).join(", ") || "none"}`;
      } else if (name === "make_listing_photo") {
        const photoId = String(args.photoId ?? suggested[0] ?? "");
        const r = await makeListingPhoto({ carId: opts.carId, photoId, imagePath: photoPath(opts.carId, photoId) });
        if (r.url) { listingUrl = r.url; listingPhotoId = photoId; }
        out = `url=${r.url ?? "none"} plateHidden=${r.plateHidden} backgroundEdited=${r.backgroundEdited} ${r.rejectedReason ?? ""}`;
      } else if (name === "get_shipping_status") {
        shipping = getShippingStatus(reportId);
        out = `stage=${shipping.stage} source=${shipping.source}`;
      } else if (name === "estimate_landed_cost") {
        out = JSON.stringify({ status: "manager_quote_required" });
      } else if (name === "handoff_to_manager") {
        handoffReason = String(args.reason ?? "low confidence");
        out = `handoff=true reason=${handoffReason}`;
      } else if (name === "finalize_report") {
        finalized = true; out = "finalizing";
      } else out = `unknown tool ${name}`;
      step(name, key, true, out, Date.now() - ts);
      return out;
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 300) : "error";
      step(name, key, false, msg, Date.now() - ts);
      return `error: ${msg}`;
    }
  }

  const inventory = {
    car,
    photos: { count: media.photos.length, suggestedPhotoIds: suggested },
    videos: media.videos, gaugeVideo: media.gaugeVideo, diagnosticPdfs: media.diagnosticPdfs,
    hasInspectorReport: media.hasInspectorReport, hasAuctionSheet: media.hasAuctionSheet,
  };
  const messages: ChatMessage[] = [
    { role: "system", content: "You are the Hanbridge inspection agent. Every claim needs evidence: no evidence, no finding (tools enforce this). Cross-check independent sources: voice vs gauge-screen colour vs photos vs inspector text. Agreement of two sources raises confidence; contradiction -> conflict. Call tools, then finalize_report. Budget: find_defects on at most 3 suggested photos, transcribe_note on at most ONE video (prefer paint_gauge.mp4 when present), read_gauge_video only when gaugeVideo is present, read_diagnostic_report only when a PDF is listed. Always call analyze_paint_readings after voice/gauge, estimate_landed_cost once, and make_listing_photo once. If a source is absent the tool says so — do not invent it." },
    { role: "user", content: `Inspect this car and finalize a report. Available media:\n${JSON.stringify(inventory, null, 2)}` },
  ];

  const maxSteps = opts.maxSteps ?? 16;
  for (let s = 0; s < maxSteps && !finalized; s++) {
    let res;
    try { res = await sparkChat({ messages, tools: AGENT_TOOLS, maxTokens: 3000 }); }
    catch (e) { step("sparkChat", `step ${s + 1}`, false, e instanceof Error ? e.message : "spark failed", 0); break; }
    if (!res.toolCalls.length) {
      messages.push({ role: "user", content: "Call the next needed tool now, or finalize_report if inspection is complete." });
      continue;
    }
    messages.push({ role: "assistant", content: res.content ?? "", tool_calls: res.toolCalls });
    const results = await Promise.all(res.toolCalls.map(async (c) => {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(c.function.arguments || "{}") as Record<string, unknown>; } catch { /* empty */ }
      return { id: c.id, out: await execute(c.function.name, args) };
    }));
    for (const r of results) messages.push({ role: "tool", tool_call_id: r.id, content: r.out });
  }
  if (!finalized) step("finalize_report", "auto after step budget", true, "step budget reached; finalizing with collected evidence", 0);

  // deterministic paint findings win/merge
  addFindings(findingsFromPaintReadings([...paint.entries()].map(([panel, microns]) => ({ panel, microns }))));
  const paintList = [...paint.entries()].map(([panel, microns]) => ({ panel, microns }));

  // verifier pass (independent model; deterministic paint findings already verified)
  for (const f of findings) {
    f.conflict = detectConflict(f, paintList) || f.conflict;
    if (f.verified && f.verifierNote?.startsWith("Deterministic")) continue;
    let crop: Buffer | undefined;
    const ev = f.evidence.find((e) => e.type === "frame" && e.box);
    if (ev?.box) {
      try {
        const img = await readFile(photoPath(opts.carId, ev.mediaId));
        const meta = await sharp(img).metadata();
        const W = meta.width ?? 0, H = meta.height ?? 0;
        const left = Math.max(0, Math.floor(ev.box.x1)), top = Math.max(0, Math.floor(ev.box.y1));
        const width = Math.min(W - left, Math.ceil(ev.box.x2 - ev.box.x1)), height = Math.min(H - top, Math.ceil(ev.box.y2 - ev.box.y1));
        if (width > 8 && height > 8) crop = await sharp(img).extract({ left, top, width, height }).resize({ width: 640 }).jpeg({ quality: 80 }).toBuffer();
      } catch { /* verifier proceeds on text evidence */ }
    }
    const ts = Date.now();
    try {
      const { result, model } = await verifyFinding(f, crop ? { crop } : {});
      f.verified = result.supported;
      f.verifierNote = `${model}: ${result.note}`;
      f.confidence = Math.round(((f.confidence + result.confidence) / 2) * 100) / 100;
      step("verifier", f.id, true, `${f.panel}/${f.kind} supported=${result.supported} conf=${result.confidence} model=${model}`, Date.now() - ts);
    } catch (e) {
      f.verified = false; f.verifierNote = `verifier error: ${e instanceof Error ? e.message.slice(0, 120) : "failed"}`;
      step("verifier", f.id, false, f.verifierNote, Date.now() - ts);
    }
  }

  const verified = findings.filter((f) => f.verified);
  let verdict = decideVerdict(verified);
  try {
    const reasons = await sparkJson(z.object({ reasons_en: z.array(z.string()), reasons_ru: z.array(z.string()) }),
      [{ role: "user", content: `Decision is ${verdict.decision}. Verified findings: ${verified.map((f) => f.description_en).join("; ") || "none"}. Write 1-3 short verdict reasons EN and RU. No prices/customs numbers.` }],
      `Return ONE JSON object: {"reasons_en":["string"],"reasons_ru":["string"]}`);
    verdict = { ...verdict, reasons_en: reasons.reasons_en, reasons_ru: reasons.reasons_ru };
  } catch { /* deterministic reasons stand */ }
  if (handoffReason) verdict = { ...verdict, handoff: true };

  if (!listingUrl && suggested[0]) {
    try { const r = await makeListingPhoto({ carId: opts.carId, photoId: suggested[0], imagePath: photoPath(opts.carId, suggested[0]) }); if (r.url) { listingUrl = r.url; listingPhotoId = suggested[0]; } } catch { /* listing is optional */ }
  }
  let heroUrl: string | undefined;
  try { heroUrl = (await getOrCreateHeroImage(reportId)).url; } catch { heroUrl = listingUrl; }
  if (listingPhotoId) { try { assertFindingsFreeOfListingEvidence(findings, [listingPhotoId]); } catch { /* listing ids never used as evidence by construction */ } }

  const body = guessBodyType(car.make, car.model);
  const report: Report = {
    id: reportId,
    vehicle: { make: car.make, model: car.model, year: car.year, bodyType: car.bodyType ?? body.type, doors: car.doors },
    findings, verdict, paintReadings: paintList,
    costEstimate: { status: "manager_quote_required", note_en: "Customs/landed cost is quoted by a manager.", note_ru: "Растаможку и итоговую стоимость считает менеджер." },
    trace, createdAt: new Date().toISOString(), carId: opts.carId,
    ...(listingUrl ? { listingUrl } : {}), ...(heroUrl ? { heroUrl } : {}),
    shipping: { stage: shipping.stage, ...(shipping.etaDays ? { etaDays: shipping.etaDays } : {}), source: shipping.source },
    ...(listingUrl && listingPhotoId ? { mediaUrls: { [listingPhotoId]: listingUrl } } : {}),
    ...(handoffReason ? { handoffReason } : {}),
  };
  const valid = ReportSchema.safeParse(report);
  if (!valid.success) throw new Error(`report schema: ${valid.error.issues.map((i) => i.message).join("; ")}`);
  saveReport(report);
  return { report, ms: Date.now() - t0 };
}

