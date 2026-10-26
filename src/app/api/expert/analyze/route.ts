// @agent:   muse-code (+ claude reviewer fix: schema contract, dedupe, verified=false)
// @project: hanbridge-inspector
// @purpose: POST /api/expert/analyze — Spark expert + deterministic paint findings
// @created: 2026-10-27
import { NextResponse } from "next/server";
import { z } from "zod";
import { sparkJson } from "@/lib/meta/spark";
import { FindingsDraftSchema, ReportSchema, type Finding, type Report } from "@/lib/schema";
import { FINDINGS_DRAFT_SPEC } from "@/lib/schema/prompt";
import { findingsFromPaintReadings } from "@/lib/domain/paint";
import { saveReport } from "@/lib/store/reports";
export const runtime = "nodejs";
export const maxDuration = 60;

const InputSchema = z.object({
  vehicle: z.object({ make: z.string(), model: z.string(), year: z.number().optional(), mileageKm: z.number().optional(), vin: z.string().optional() }),
  paintReadings: z.array(z.object({ panel: z.string(), microns: z.number() })).default([]),
  photoUrls: z.array(z.string()).max(6).default([]),
});

export async function POST(req: Request) {
  const parsed = InputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  const { vehicle, paintReadings, photoUrls } = parsed.data;
  const gaugeFindings = findingsFromPaintReadings(paintReadings);
  const photoIds = photoUrls.map((_, i) => `photo-${i}`);

  const t0 = Date.now();
  let draft: z.infer<typeof FindingsDraftSchema> | null = null;
  let sparkError: string | null = null;
  try {
    const prompt =
      `You are a used-car inspection expert. Vehicle: ${JSON.stringify(vehicle)}. ` +
      `Paint-gauge readings (microns): ${JSON.stringify(paintReadings)}. ` +
      `Paint-gauge findings are ALREADY computed deterministically (<=150 factory, 151-220 repaint, >220 putty): ` +
      `${JSON.stringify(gaugeFindings.map((f) => ({ panel: f.panel, kind: f.kind, severity: f.severity })))}. Do NOT repeat them as findings. ` +
      `Add findings ONLY for defects visible in the attached photos (photo ids in order: ${photoIds.join(", ") || "none"}), ` +
      `each with evidence type "frame" and the photo id as mediaId. If there are no photos, return "findings": []. ` +
      `Then give the overall verdict considering both gauge findings and photo findings. Never output customs/landed-cost numbers.`;
    const parts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
      { type: "text", text: prompt },
      ...photoUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
    ];
    draft = await sparkJson(FindingsDraftSchema, [{ role: "user", content: parts }], FINDINGS_DRAFT_SPEC);
  } catch (e) {
    sparkError = e instanceof Error ? e.message : "spark failed";
  }
  const sparkMs = Date.now() - t0;

  // merge: deterministic gauge findings win; Spark findings stay unverified until the verifier (TZ-05)
  const byId = new Map<string, Finding>(gaugeFindings.map((f) => [f.id, f]));
  const gaugeKeys = new Set(gaugeFindings.map((f) => `${f.panel}:${f.kind}`));
  let droppedNoMedia = 0;
  for (const f of draft?.findings ?? []) {
    if (byId.has(f.id) || gaugeKeys.has(`${f.panel}:${f.kind}`)) continue;
    const ev = f.evidence.filter((e) => e.mediaId === "gauge" || photoIds.includes(e.mediaId));
    if (ev.length === 0) { droppedNoMedia++; continue; } // evidence must point to real media
    byId.set(f.id, { ...f, evidence: ev, verified: false });
  }
  const findings = [...byId.values()].filter((f) => f.evidence.length >= 1);

  const hasUncertainCritical = findings.some((f) => f.severity === "critical" && f.confidence < 0.7);
  const conf = draft?.verdict.confidence ?? (findings.length ? 0.75 : 0.85);
  const verdict = draft?.verdict ?? {
    decision: (findings.some((f) => f.severity === "critical") ? "WALK_AWAY" : findings.some((f) => f.severity === "high") ? "NEGOTIATE" : "BUY") as "BUY" | "NEGOTIATE" | "WALK_AWAY",
    reasons_en: findings.map((f) => f.description_en),
    reasons_ru: findings.map((f) => f.description_ru),
    confidence: conf,
    handoff: false,
  };
  verdict.handoff = verdict.handoff || conf < 0.6 || hasUncertainCritical;

  const report: Report = {
    id: `r-${Date.now().toString(36)}`,
    vehicle, findings, verdict, paintReadings,
    costEstimate: { status: "manager_quote_required", note_en: "Customs/landed cost is quoted by a manager.", note_ru: "Растаможку и итоговую стоимость считает менеджер." },
    trace: [
      { tool: "analyze_paint_readings", ms: 0, output: { findings: gaugeFindings.length } },
      { tool: "expert.analyze", ms: sparkMs, model: "muse-spark-1.3", output: sparkError ? { sparkError } : { findings: draft?.findings.length ?? 0, droppedNoMedia, decision: draft?.verdict.decision } },
    ],
    createdAt: new Date().toISOString(),
  };
  const valid = ReportSchema.safeParse(report);
  if (!valid.success) return NextResponse.json({ error: valid.error.issues }, { status: 500 });
  saveReport(report);
  return NextResponse.json(report);
}
