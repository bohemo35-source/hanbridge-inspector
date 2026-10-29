// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Independent verifier: open-weight muse-spark-open-1026 (Baseten), fallback muse-spark-1.3; deterministic verdict + handoff rules
// @created: 2026-10-29
import { z } from "zod";
import { classifyPaint } from "@/lib/domain/paint";
import { sparkJson, type ChatPart } from "@/lib/meta/spark";
import { sparkOpenJson, SPARK_OPEN_MODEL } from "@/lib/meta/sparkOpen";
import type { Finding, Verdict } from "@/lib/schema";

export const VerifierResultSchema = z.object({ supported: z.boolean(), confidence: z.number().min(0).max(1), note: z.string() });
export type VerifierResult = z.infer<typeof VerifierResultSchema>;
const SPEC = `Return ONE JSON object: {"supported":boolean,"confidence":number 0..1,"note":"short string"}
You verify ONE used-car finding against ONLY its evidence. Judge the CORE claim: the panel and the type of issue (paint work: repaint/putty; replacement; scratch; dent; rust; …).
- supported=true when the evidence shows that panel has that type of issue, even if severity, exact micron values or wording differ — then lower the confidence and say what differs in the note.
- Inspection jargon (RU): "окрас/перекрас/освежался" = repaint; "ремонтная работа / участок ремонта / шпаклевка" on a painted panel = filler (putty); "замена" = panel_replaced. Paint gauge >150 µm = paint work, >220 µm = likely filler.
- supported=false when the evidence is about a different panel/car part, says the opposite (e.g. "завод/заводское" for that panel), or does not mention the issue at all. A frame of a different panel does NOT support it.`;

/** Pure: gauge ≤150 µm contradicting a repaint/putty claim (or vice versa) marks a conflict. */
export function detectConflict(f: Finding, paint: Array<{ panel: string; microns: number }>): boolean {
  const reading = paint.find((p) => p.panel === f.panel);
  if (reading && (f.kind === "repaint" || f.kind === "putty") && classifyPaint(reading.microns) === "factory") return true;
  const gaugeEv = f.evidence.find((e) => e.gaugeMicrons !== undefined);
  if (gaugeEv?.gaugeMicrons !== undefined && (f.kind === "repaint" || f.kind === "putty") && classifyPaint(gaugeEv.gaugeMicrons) === "factory") return true;
  return false;
}

export async function verifyFinding(f: Finding, opts: { crop?: Buffer } = {}): Promise<{ result: VerifierResult; model: string }> {
  const evText = f.evidence.map((e) => JSON.stringify(e)).join("\n");
  const parts: ChatPart[] = [{ type: "text", text: `Finding: panel=${f.panel} kind=${f.kind} severity=${f.severity}\nEN: ${f.description_en}\nEvidence:\n${evText}\nDoes this evidence support the finding?` }];
  if (opts.crop) parts.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${opts.crop.toString("base64")}` } });
  const messages = [{ role: "user" as const, content: parts }];
  if (process.env.BASETEN_API_KEY) {
    try { return { result: await sparkOpenJson(VerifierResultSchema, messages, SPEC), model: SPARK_OPEN_MODEL }; }
    catch { /* fall through to closed Spark */ }
  }
  return { result: await sparkJson(VerifierResultSchema, messages, SPEC), model: "muse-spark-1.3 (fallback)" };
}

/** Deterministic verdict over VERIFIED findings only. Handoff: overall <0.6 or critical with confidence <0.7. */
export function decideVerdict(verified: Finding[], overallConfidence?: number): Verdict {
  const crit = verified.filter((f) => f.severity === "critical");
  const high = verified.filter((f) => f.severity === "high");
  const med = verified.filter((f) => f.severity === "medium");
  const decision = crit.length ? "WALK_AWAY" : high.length || med.length >= 3 ? "NEGOTIATE" : "BUY";
  const confidence = overallConfidence ?? (verified.length ? Math.round((verified.reduce((s, f) => s + f.confidence, 0) / verified.length) * 100) / 100 : 0.5);
  const handoff = confidence < 0.6 || verified.some((f) => f.severity === "critical" && f.confidence < 0.7);
  return {
    decision,
    reasons_en: verified.map((f) => f.description_en),
    reasons_ru: verified.map((f) => f.description_ru),
    confidence, handoff,
  };
}
export const shouldHandoff = (confidence: number, findings: Finding[]) =>
  confidence < 0.6 || findings.some((f) => f.severity === "critical" && f.confidence < 0.7);
