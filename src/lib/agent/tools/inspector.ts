// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: read_inspector_report tool: inspector_report_ru.txt -> per-panel claims with verbatim quotes (evidence transcript)
// @created: 2026-10-29
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { PANEL_VALUES, type Panel } from "@/lib/domain/panels";
import { sparkJson } from "@/lib/meta/spark";
import type { Finding } from "@/lib/schema";
import { normalizeText, quoteInText } from "./voice";

export interface InspectorClaim { panel: Panel; kind: Finding["kind"] | null; quote: string; }
export interface InspectorReportResult { claims: InspectorClaim[]; findings: Finding[]; rejected: number; chars: number; }

const Draft = z.object({
  claims: z.array(z.object({
    panel: z.enum(PANEL_VALUES as unknown as [Panel, ...Panel[]]),
    kind: z.enum(["scratch", "dent", "rust", "repaint", "putty", "panel_replaced", "mechanical", "other"]).nullable(),
    quote: z.string(),
  })),
});
const SPEC = `Return ONE JSON object: {"claims":[{"panel":"hood","kind":"repaint"|null,"quote":"verbatim quote"}]}
One claim per body panel the inspector comments on. panel is one of: ${PANEL_VALUES.join(", ")}. kind=null when the inspector says the panel is fine/factory.
The report uses a fixed template ("✅" is just a bullet, NOT "ok"). Read the text after each heading:
- "Замены: <panels>" -> one claim per listed panel with kind "panel_replaced" ("отсутствуют" = none);
- "Лакокрасочное покрытие: окрас/перекрас <panel>" -> "repaint"; "косметический окрас ... с участком ремонтной работы" -> "putty"; "заводское" -> no claim;
- "Кузов: притертость/потертость/царапина <panel>" -> "scratch"; "вмятина" -> "dent"; sill (порог) -> panel "unknown";
- "Проверка на окрасы: <panel>: окрашивался" -> "repaint".
Panel words: задняя правая дверь=rear_right_door, передняя левая дверь=front_left_door, капот=hood, крыша=roof, задний/передний бампер=rear_bumper/front_bumper, крыло=fender (front/rear + side as written).
quote: 3-15 consecutive words copied EXACTLY from the text (may include the heading word). Ignore owner names, plates, phones.`;

export async function readInspectorReport(opts: { carId: string }): Promise<InspectorReportResult> {
  const text = await readFile(path.join(process.cwd(), "demo-data", opts.carId, "inspector_report_ru.txt"), "utf8");
  const draft = await sparkJson(Draft, [{ role: "user", content: `Inspector report (Russian):\n${text.slice(0, 12000)}` }], SPEC, { maxTokens: 4000 });
  const claims: InspectorClaim[] = []; let rejected = 0;
  for (const c of draft.claims) {
    if (!quoteInText(c.quote, text) && !normalizeText(text).includes(normalizeText(c.quote))) { rejected++; continue; }
    claims.push(c);
  }
  const findings: Finding[] = claims.filter((c) => c.kind && c.panel !== "unknown").map((c, i) => ({
    id: `inspector-${c.panel}-${i + 1}`, panel: c.panel, kind: c.kind!,
    severity: c.kind === "putty" || c.kind === "panel_replaced" ? "high" : "medium",
    description_en: `Inspector report: ${c.kind} on ${c.panel} — «${c.quote}»`,
    description_ru: `Отчёт инспектора: ${c.kind} — ${c.panel} — «${c.quote}»`,
    confidence: 0.75,
    evidence: [{ type: "transcript" as const, mediaId: "inspector_report_ru.txt", panel: c.panel, quote: c.quote }],
    verified: false,
  }));
  return { claims, findings, rejected, chars: text.length };
}
