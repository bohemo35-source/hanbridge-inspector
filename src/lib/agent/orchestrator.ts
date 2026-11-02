// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Agent orchestrator: Spark tool-calling loop (max 16 steps) -> cross-source merge -> open-weight verifier -> deterministic verdict -> report
// @created: 2026-10-29
// @updated: 2026-11-03 claude-code — a finding backed only by the owner's typed gauge reading goes to Unconfirmed and the report is handed to a manager
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { z } from "zod";
import { findingsFromPaintReadings } from "@/lib/domain/paint";
import { guessBodyType } from "@/components/damage-map-3d/bodyTypeMap";
import { sparkChat, sparkJson, type ChatMessage, type ToolDef } from "@/lib/meta/spark";
import type { Finding, Report } from "@/lib/schema";
import { ReportSchema } from "@/lib/schema";
import { publishMedia, saveReportAsync } from "@/lib/store/reports";
import { carMedia, ensurePhotoPath, ensureVideoPath, getCar, spreadPhotos, type CarMedia } from "./catalog";
import { segmentImage, boxArea, type SegmentImageResult } from "./tools/segment";
import { findDefects } from "./tools/defects";
import { transcribeNote } from "./tools/voice";
import { readGaugeVideo } from "./tools/gauge";
import { makeListingPhoto, getOrCreateHeroImage, assertFindingsFreeOfListingEvidence } from "./tools/listing";
import { getShippingStatus } from "./tools/shipping";
import { indexPhotos, pickDefectPhotos, pickListingCandidates, type PhotoIndex } from "./tools/photoIndex";
import { glimmerConfigured } from "@/lib/meta/glimmer";
import { readDiagnosticReport } from "./tools/diagnostic";
import { readInspectorReport } from "./tools/inspector";
import { decideVerdict, detectConflict, ownerReadingOnly, verifyFinding } from "./verifier";

/** Vercel kills the run route at 300 s (maxDuration): past this point optional work is skipped instead of risking the whole report. */
const RUN_SOFT_DEADLINE_MS = 235_000;
async function mapPool<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (next < items.length) await fn(items[next++]); }));
}

export type AgentStep = Report["trace"][number];
const WHY: Record<string, string> = {
  index_photos: "Open-weight triage: Muse Glimmer on our own GPU indexes every photo (view, whole car, panels)",
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
  recheck_panel: "Agent decided to re-check one panel on a photo picked from the Glimmer index",
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
  fn("recheck_panel", "Re-check ONE panel on a new photo that shows it (picked from the photo index). Use when sources disagree about that panel or a finding rests on one weak source. State the reason.", { panel: { type: "string" }, reason: { type: "string" } }, ["panel", "reason"]),
  fn("finalize_report", "Finish: verifier runs, verdict is computed, report is saved", {}),
];

export interface RunResult { report: Report; ms: number; }

export async function runInspection(opts: {
  carId: string; reportId?: string; onStep?: (s: AgentStep) => void; maxSteps?: number;
  /** paint-gauge readings typed by the visitor (uploaded car) */ initialPaint?: Array<{ panel: string; microns: number }>;
}): Promise<RunResult> {
  const t0 = Date.now();
  const car = getCar(opts.carId);
  if (!car) throw new Error(`unknown carId: ${opts.carId}`);
  const media: CarMedia = carMedia(opts.carId);
  const reportId = opts.reportId ?? `r-${opts.carId}-${Date.now().toString(36)}`;
  let suggested = spreadPhotos(media.photos, 4);
  let listingFromIndex: string[] = [];
  const trace: AgentStep[] = [];
  const findings: Finding[] = [];
  const paint = new Map<string, number>();
  const photoViews = new Map<string, string>();
  const segCache = new Map<string, SegmentImageResult>();
  /** whole car in frame (not a close-up) with a plate SAM can hide */
  const isWholeCar = (sg: SegmentImageResult) => {
    const b = sg.car?.box; if (!b || !sg.licensePlate) return false;
    const frac = boxArea(b) / (sg.width * sg.height);
    return b.x1 > sg.width * 0.02 && b.x2 < sg.width * 0.98 && frac >= 0.15 && frac <= 0.85;
  };
  const contextOverrides: { panel: string; median: number; quote: string; tStart: number }[] = [];
  const called = new Set<string>();
  let listingUrl: string | undefined; let listingPhotoId: string | undefined; let listingDropped = false;
  let handoffReason: string | undefined; let finalized = false;
  let shipping = getShippingStatus(reportId);
  // hero background does not depend on findings: generate it in parallel with the inspection (~16 s saved on the critical path)
  const isUpload = opts.carId.startsWith("u-");
  const heroPromise = getOrCreateHeroImage(isUpload ? "hero-upload" : `hero-${opts.carId}`); // one generated hero per car, not per run (saves a Muse Image call + a Blob put)
  heroPromise.catch(() => undefined);

  let photoIdx: PhotoIndex | null = null;
  let rechecks = 0;
  const step = (tool: string, argsSummary: string, ok: boolean, outputSummary: string, ms: number, why?: string) => {
    const s: AgentStep = { i: trace.length + 1, tool, argsSummary: argsSummary.slice(0, 200), why: (why ?? WHY[tool] ?? "").slice(0, 300), ms, ok, outputSummary: outputSummary.slice(0, 500) };
    trace.push(s); try { opts.onStep?.(s); } catch { /* client gone: keep working, report is still saved */ } return s;
  };
  // Open-weight triage first: Muse Glimmer (our Modal GPU) indexes every photo, so Spark/SAM only see the right ones.
  if (glimmerConfigured() && media.photos.length) {
    const ts = Date.now();
    try {
      const idx = await indexPhotos({ carId: opts.carId, photos: media.photos, ...(isUpload ? { firstTimeoutMs: 45_000, abortIfFirstFails: true } : {}) });
      photoIdx = idx;
      const picks = pickDefectPhotos(idx, 3);
      if (picks.length) suggested = [...picks, ...suggested.filter((p) => !picks.includes(p))].slice(0, 4);
      listingFromIndex = pickListingCandidates(idx);
      const views = idx.entries.reduce<Record<string, number>>((m, e) => { m[e.view] = (m[e.view] ?? 0) + 1; return m; }, {});
      step("index_photos", `${media.photos.length} photos`, idx.entries.length > 0, `${Date.now() - ts < 5000 ? "reused index built earlier by " : "live index by "}model=${idx.model} indexed=${idx.entries.length} failed=${idx.failed.length} wholeCar=${idx.entries.filter((e) => e.whole_car).length} views=${JSON.stringify(views)} picks=${picks.join(",")} listingCandidates=${listingFromIndex.slice(0, 3).join(",")}`, Date.now() - ts);
    } catch (e) { step("index_photos", `${media.photos.length} photos`, false, `skipped: ${(e as Error).message}`, Date.now() - ts); }
  }
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
  // panels measured by the inspector (voice / gauge video) vs readings the visitor typed into the upload form
  const measuredPanels = new Set<string>(), typedPanels = new Set((opts.initialPaint ?? []).map((r) => r.panel));
  const addPaint = (rec: Record<string, number>, measured = true) => { for (const [p, v] of Object.entries(rec)) { paint.set(p, Math.max(paint.get(p) ?? 0, v)); if (measured) measuredPanels.add(p); } };
  const paintStats = new Map<string, { min: number; max: number; points: number }>();
  const addStats = (rec: Record<string, { min: number; max: number; points: number }>) => {
    for (const [p, s] of Object.entries(rec)) { const e = paintStats.get(p); paintStats.set(p, e ? { min: Math.min(e.min, s.min), max: Math.max(e.max, s.max), points: e.points + s.points } : s); }
  };
  if (opts.initialPaint?.length) addStats(Object.fromEntries(opts.initialPaint.map((r) => [r.panel, { min: r.microns, max: r.microns, points: 1 }])));
  if (opts.initialPaint?.length) addPaint(Object.fromEntries(opts.initialPaint.map((r) => [r.panel, r.microns])), false);

  async function execute(name: string, args: Record<string, unknown>): Promise<string> {
    const key = `${name}:${JSON.stringify(args)}`;
    if (called.has(key)) return "already called with same args; pick another tool or finalize_report";
    called.add(key);
    const ts = Date.now();
    try {
      let out = "";
      if (name === "segment_image") {
        const photoId = String(args.photoId ?? "");
        const r = await segmentImage({ carId: opts.carId, photoId, imagePath: await ensurePhotoPath(opts.carId, photoId) });
        segCache.set(photoId, r);
        out = `car=${r.car ? "found" : "none"} plate=${r.licensePlate ? "found" : "none"} wheels=${r.wheels.length} ${r.width}x${r.height}`;
      } else if (name === "find_defects") {
        const photoId = String(args.photoId ?? "");
        const image = await readFile(await ensurePhotoPath(opts.carId, photoId));
        const r = await findDefects({ carId: opts.carId, photoId, image });
        addFindings(r.findings); photoViews.set(photoId, r.view);
        out = `view=${r.view} panels=${r.panels_visible.join(",")} defects=${r.findings.length}: ${r.findings.map((f) => `${f.panel}/${f.kind}/${f.severity}`).join(", ") || "none"}`;
      } else if (name === "transcribe_note") {
        const videoId = String(args.videoId ?? media.videos[0] ?? "");
        if (!videoId) { step(name, key, true, "source absent: no videos for this car", Date.now() - ts); return "source absent: no videos"; }
        const r = await transcribeNote({ video: await ensureVideoPath(opts.carId, videoId), mediaId: videoId });
        addFindings(r.findings); addPaint(r.paint); addStats(r.paintStats); contextOverrides.push(...r.conflicts);
        out = `chunks=${r.chunks.length} readings=${r.readings.length} findings=${r.findings.length} conflicts=${r.conflicts.map((c) => c.panel).join(",") || "none"} paint=${JSON.stringify(r.paint)}`;
      } else if (name === "read_gauge_video") {
        if (!media.gaugeVideo) { step(name, key, true, "source absent: no paint_gauge.mp4 for this car", Date.now() - ts); return "source absent: no paint_gauge.mp4"; }
        const r = await readGaugeVideo({ video: await ensureVideoPath(opts.carId, media.gaugeVideo), mediaId: media.gaugeVideo });
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
        // listing = whole car in a 3/4 view when one was seen; close-ups/details make poor listing photos
        const QUARTER = new Set(["front_left", "front_right", "rear_left", "rear_right"]);
        const asked = String(args.photoId ?? suggested[0] ?? "");
        const quarter = [...photoViews.entries()].find(([, v]) => QUARTER.has(v))?.[0];
        const photoId = QUARTER.has(photoViews.get(asked) ?? "") || !quarter ? asked : quarter;
        const r = await makeListingPhoto({ carId: opts.carId, photoId, imagePath: await ensurePhotoPath(opts.carId, photoId) });
        if (r.url) { listingUrl = r.url; listingPhotoId = photoId; }
        out = `url=${r.url ?? "none"} plateHidden=${r.plateHidden} backgroundEdited=${r.backgroundEdited} ${r.rejectedReason ?? ""}`;
      } else if (name === "recheck_panel") {
        const panel = String(args.panel ?? ""); const reason = String(args.reason ?? "").slice(0, 200);
        if (rechecks >= 2) { step(name, key, true, "recheck budget used (2 per run)", Date.now() - ts); return "recheck budget used; finalize_report"; }
        rechecks++;
        const seen = new Set(photoViews.keys());
        const EXTERIOR = (v: string) => !["interior", "engine", "document", "underbody", "other"].includes(v);
        const byIndex = (photoIdx?.entries ?? []).filter((e) => e.panels.includes(panel) && EXTERIOR(e.view) && !seen.has(e.photoId))
          .sort((a, b) => a.panels.length - b.panels.length); // the most focused shot of that panel first
        const photoId = byIndex[0]?.photoId ?? spreadPhotos(media.photos, 12).find((p) => !seen.has(p));
        if (!photoId) { step(name, key, true, `no unseen photo of ${panel}`, Date.now() - ts, `Re-check decided by the agent: ${reason}`); return "no photo for that panel"; }
        const r = await findDefects({ carId: opts.carId, photoId, image: await readFile(await ensurePhotoPath(opts.carId, photoId)) });
        addFindings(r.findings); photoViews.set(photoId, r.view);
        const onPanel = r.findings.filter((f) => f.panel === panel);
        out = `panel=${panel} photo=${photoId} (${byIndex.length ? "picked from Glimmer index" : "fallback spread"}) view=${r.view} panelVisible=${r.panels_visible.includes(panel as never)} onPanel=${onPanel.map((f) => `${f.kind}/${f.severity}`).join(",") || "nothing visible"}`;
        step(name, key, true, out, Date.now() - ts, `Re-check decided by the agent: ${reason}`);
        return out;
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
    ...(opts.initialPaint?.length ? { paintReadingsTypedByOwner: opts.initialPaint } : {}),
  };
  const messages: ChatMessage[] = [
    { role: "system", content: "You are the Hanbridge inspection agent. Every claim needs evidence: no evidence, no finding (tools enforce this). Cross-check independent sources: voice vs gauge-screen colour vs photos vs inspector text. Agreement of two sources raises confidence; contradiction -> conflict. Call tools, then finalize_report. Budget: find_defects on at most 3 suggested photos, transcribe_note on at most ONE video (prefer paint_gauge.mp4 when present), read_gauge_video only when gaugeVideo is present, read_diagnostic_report only when a PDF is listed. Always call analyze_paint_readings after voice/gauge, estimate_landed_cost once, and make_listing_photo once. When sources disagree about a panel (voice numbers vs gauge-screen colour vs inspector text vs photos), or a finding rests on a single source, call recheck_panel(panel, reason) for that panel (at most 2 times) BEFORE finalize_report, and say in reason which sources disagree. If a source is absent the tool says so — do not invent it." },
    { role: "user", content: `Inspect this car and finalize a report. Available media:\n${JSON.stringify(inventory, null, 2)}` },
  ];

  const maxSteps = opts.maxSteps ?? 16;
  for (let s = 0; s < maxSteps && !finalized; s++) {
    if (Date.now() - t0 > 170_000) { step("finalize_report", "time budget", true, "time budget for tool calls reached; finalizing with collected evidence", 0); finalized = true; break; }
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

  // agent rule: a panel claim backed by one source only gets one photo re-check if the agent did not ask for it itself
  if (!rechecks && Date.now() - t0 < 150_000) {
    const weak = findings.find((f) => f.panel !== "unknown" && new Set(f.evidence.map((e) => e.type)).size === 1 && f.evidence.every((e) => e.type === "gauge" || e.type === "transcript"));
    if (weak) await execute("recheck_panel", { panel: weak.panel, reason: `${weak.panel}/${weak.kind} rests on one source (${weak.evidence[0]?.type}) — looking for photo evidence` });
  }

  // deterministic paint findings win/merge
  addFindings(findingsFromPaintReadings([...paint.entries()].map(([panel, microns]) => ({ panel, microns }))));
  const paintList = [...paint.entries()].map(([panel, microns]) => { const st = paintStats.get(panel); return st && st.points > 1 ? { panel, microns, ...st } : { panel, microns }; });

  // inspector context beats the numeric rule (e.g. MINI contrast roof): drop numeric-only findings on those panels
  for (const c of contextOverrides) {
    for (let k = findings.length - 1; k >= 0; k--) {
      const f = findings[k];
      if (f.panel === c.panel && f.evidence.every((e) => e.type === "gauge" && e.mediaId === "gauge")) findings.splice(k, 1);
    }
    step("context_check", c.panel, true, `${c.panel}: ${c.median} µm but inspector says factory («${c.quote}», ${c.tStart}s) — numeric rule overridden, no finding`, 0);
  }

  // verifier pass (independent model; deterministic paint findings already verified)
  await mapPool(findings, 4, async (f) => {
    f.conflict = detectConflict(f, paintList) || f.conflict;
    if (f.verified && f.verifierNote?.startsWith("Deterministic")) return;
    if (Date.now() - t0 > 250_000) { f.verified = false; f.verifierNote = "not verified: time budget reached"; step("verifier", f.id, false, f.verifierNote, 0); return; }
    let crop: Buffer | undefined;
    const ev = f.evidence.find((e) => e.type === "frame" && e.box);
    if (ev?.box) {
      try {
        const img = await readFile(await ensurePhotoPath(opts.carId, ev.mediaId));
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
  });

  // gauge-screen colour alone (panel guessed from a frame, no digits) is corroboration, not proof
  for (const f of findings) {
    const onlyScreen = f.evidence.length > 0 && f.evidence.every((e) => e.type === "gauge" && (e.quote ?? "").startsWith("display colour band"));
    if (onlyScreen && f.verified) {
      f.verified = false;
      f.verifierNote = `${f.verifierNote ?? ""} · single weak source (gauge screen colour, panel guessed from the frame) → needs voice/photo/inspector confirmation`.trim();
      step("conflict_check", f.id, true, `${f.panel}/${f.kind}: screen colour only → unconfirmed`, 0);
    }
  }

  // sources disagree -> never verified (goes to Unconfirmed), whatever the verifier said
  for (const f of findings) {
    if (f.conflict && f.verified) {
      f.verified = false;
      f.verifierNote = `${f.verifierNote ?? ""} · sources conflict (e.g. gauge numbers vs screen colour/voice) → unconfirmed`.trim();
      step("conflict_check", f.id, true, `${f.panel}/${f.kind}: conflicting sources → unconfirmed`, 0);
    }
  }

  // a number typed by the visitor is a claim, not proof: alone it never confirms a finding
  const ownerOnly: Finding[] = [];
  for (const f of findings) {
    if (f.verified && ownerReadingOnly(f, typedPanels, measuredPanels)) {
      f.verified = false;
      f.verifierNote = `${f.verifierNote ?? ""} · only the owner's typed gauge reading — no photo, inspector voice or sheet confirms it → unconfirmed`.trim();
      step("conflict_check", f.id, true, `${f.panel}/${f.kind}: owner-typed reading only → unconfirmed`, 0);
      ownerOnly.push(f);
    }
  }
  if (ownerOnly.length && !handoffReason) handoffReason = `typed gauge reading not confirmed by photos (${ownerOnly.map((f) => `${f.panel} ${f.evidence[0]?.gaugeMicrons ?? "?"} µm`).join(", ")}) — a manager checks it`;

  const verified = findings.filter((f) => f.verified);
  let verdict = decideVerdict(verified);
  try {
    const reasons = await sparkJson(z.object({ reasons_en: z.array(z.string()), reasons_ru: z.array(z.string()) }),
      [{ role: "user", content: `Decision is ${verdict.decision}. Verified findings: ${verified.map((f) => f.description_en).join("; ") || "none"}. Write 1-3 short verdict reasons EN and RU. No prices/customs numbers.` }],
      `Return ONE JSON object: {"reasons_en":["string"],"reasons_ru":["string"]}`);
    verdict = { ...verdict, reasons_en: reasons.reasons_en, reasons_ru: reasons.reasons_ru };
  } catch { /* deterministic reasons stand */ }
  if (handoffReason) verdict = { ...verdict, handoff: true };

  // listing must show the whole car: Spark's view label is not enough (a tail-light close-up came back as "rear_left").
  // Check the chosen photo with SAM; if the car box is cropped/too small, scan analysed views first, then spread photos.
  {
    const segOf = async (pid: string) => segCache.get(pid) ?? segCache.set(pid, await segmentImage({ carId: opts.carId, photoId: pid, imagePath: await ensurePhotoPath(opts.carId, pid) })).get(pid)!;
    let ok = false;
    if (listingPhotoId) { try { ok = isWholeCar(await segOf(listingPhotoId)); } catch { ok = false; } }
    if (!ok && Date.now() - t0 > RUN_SOFT_DEADLINE_MS) {
      step("make_listing_photo", listingPhotoId ?? "none", false, "time budget reached: listing dropped (unchecked photo is never published); report uses the generated hero", 0);
      listingUrl = undefined; listingPhotoId = undefined; listingDropped = true;
    } else if (!ok) {
      const QUARTER = new Set(["front_left", "front_right", "rear_left", "rear_right"]);
      const views = [...photoViews.entries()].sort(([, a], [, b]) => Number(QUARTER.has(b)) - Number(QUARTER.has(a))).map(([pid]) => pid);
      const candidates = [...new Set([...listingFromIndex.slice(0, 6), ...views, ...spreadPhotos(media.photos, 24)])].filter((pid) => pid !== listingPhotoId).slice(0, 24);
      const t0 = Date.now();
      let picked: string | undefined;
      for (let i = 0; i < candidates.length && !picked; i += 6) {
        const batch = candidates.slice(i, i + 6);
        const ok4 = await Promise.all(batch.map(async (pid) => { try { return isWholeCar(await segOf(pid)); } catch { return false; } }));
        picked = batch.find((_, j) => ok4[j]);
      }
      if (picked) {
        try {
          const r = await makeListingPhoto({ carId: opts.carId, photoId: picked, imagePath: await ensurePhotoPath(opts.carId, picked), segment: segCache.get(picked) });
          step("make_listing_photo", picked, Boolean(r.url), r.url ? `re-picked whole-car photo (${photoViews.get(picked) ?? "unlabelled"}): url=${r.url} plateHidden=${r.plateHidden}` : `skipped: ${r.rejectedReason}`, Date.now() - t0);
          if (r.url) { listingUrl = r.url; listingPhotoId = picked; }
        } catch (e) { step("make_listing_photo", picked, false, `re-pick failed: ${(e as Error).message}`, Date.now() - t0); }
      } else {
        // a cab/dashboard/close-up shot is a bad public listing (it can even show the inspector) — drop it, the report uses the generated hero
        step("make_listing_photo", candidates.join(","), false, `no whole-car photo with a hideable plate among ${candidates.length} candidates; listing dropped (was ${listingPhotoId ?? "none"})`, Date.now() - t0);
        listingUrl = undefined; listingPhotoId = undefined; listingDropped = true;
      }
    }
  }
  if (!listingUrl && !listingDropped && suggested[0]) {
    try { const r = await makeListingPhoto({ carId: opts.carId, photoId: suggested[0], imagePath: await ensurePhotoPath(opts.carId, suggested[0]) }); if (r.url) { listingUrl = r.url; listingPhotoId = suggested[0]; } } catch { /* listing is optional */ }
  }
  if (listingUrl) listingUrl = await publishMedia(listingUrl, `media/${opts.carId}/${listingUrl.split("/").pop()}`);
  let heroUrl: string | undefined;
  try { heroUrl = (await heroPromise).url; } catch { heroUrl = listingUrl; }
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
  await saveReportAsync(report);
  return { report, ms: Date.now() - t0 };
}

