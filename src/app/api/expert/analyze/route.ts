// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: POST /api/expert/analyze — Spark expert + deterministic paint findings
// @created: 2026-10-27
import { NextResponse } from "next/server";
import { z } from "zod";
import { sparkJson } from "@/lib/meta/spark";
import { FindingsDraftSchema, ReportSchema, type Report } from "@/lib/schema";
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
  let draft = null;
  let sparkError: string | null = null;
  try {
    const parts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
      { type: "text", text: `Vehicle: ${JSON.stringify(vehicle)}. Paint readings (microns): ${JSON.stringify(paintReadings)}. Return JSON {findings, verdict}. Every finding needs >=1 evidence. Paint rule: <=150 factory, 151-220 repaint, >220 putty. No customs/landed-cost numbers; costEstimate is handled separately.` },
      ...photoUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
    ];
    draft = await sparkJson(FindingsDraftSchema, [{ role: "user", content: parts }]);
  } catch (e) {
    sparkError = e instanceof Error ? e.message : "spark failed";
  }
  const byId = new Map(gaugeFindings.map((f) => [f.id, f]));
  for (const f of draft?.findings ?? []) if (!byId.has(f.id)) byId.set(f.id, f);
  const findings = [...byId.values()].filter((f) => f.evidence.length >= 1);
  const hasCritical = findings.some((f) => f.severity === "critical" && f.confidence < 0.7);
  const draftConf = draft?.verdict.confidence ?? (findings.length ? 0.75 : 0.85);
  const verdict = draft?.verdict ?? {
    decision: (findings.some((f) => f.severity === "high") ? "NEGOTIATE" : "BUY") as "BUY" | "NEGOTIATE",
    reasons_en: findings.map((f) => f.description_en),
    reasons_ru: findings.map((f) => f.description_ru),
    confidence: draftConf,
    handoff: false,
  };
  verdict.handoff = verdict.handoff || draftConf < 0.6 || hasCritical;
  const report: Report = {
    id: `r-${Date.now().toString(36)}`,
    vehicle, findings, verdict, paintReadings,
    costEstimate: { status: "manager_quote_required", note_en: "Customs/landed cost is quoted by a manager.", note_ru: "Растаможку и итоговую стоимость считает менеджер." },
    trace: [{ tool: "expert.analyze", ms: 0, model: "muse-spark-1.3", output: sparkError ? { sparkError } : { findings: findings.length } }],
    createdAt: new Date().toISOString(),
  };
  const valid = ReportSchema.safeParse(report);
  if (!valid.success) return NextResponse.json({ error: valid.error.issues }, { status: 500 });
  saveReport(report);
  return NextResponse.json(report);
}
