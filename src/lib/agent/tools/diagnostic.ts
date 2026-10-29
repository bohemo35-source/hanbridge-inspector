// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: read_diagnostic_report tool: LAUNCH OBD PDF -> pdftotext (fallback: inflated PDF text streams) -> Spark structure; workshop PII never leaves, VIN masked
// @created: 2026-10-29
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { inflateSync } from "node:zlib";
import { z } from "zod";
import { sparkJson } from "@/lib/meta/spark";
import type { Finding } from "@/lib/schema";

const run = promisify(execFile);

export interface FaultCode { code: string; system: string; description: string; }
export interface DiagnosticResult {
  systemsChecked: number; faultCodes: FaultCode[]; mileageKm?: number; vinMasked?: string; scanTime?: string;
  textChars: number; source: "pdftotext" | "pdf-streams" | "empty"; findings: Finding[];
}

/** Never expose workshop names/phones/addresses or a full VIN downstream. */
export function redactDiagnosticText(text: string): string {
  return text
    .replace(/\+?\d[\d\s()\-]{8,}\d/g, "[phone]")
    .replace(/\b[A-HJ-NPR-Z0-9]{17}\b/g, (v) => maskVin(v));
}
export const maskVin = (vin: string) => (vin.length > 6 ? `${vin.slice(0, vin.length - 6)}******` : "******");

async function pdfTextViaStreams(file: string): Promise<string> {
  const buf = await readFile(file);
  const chunks: string[] = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(buf.toString("latin1")))) {
    try {
      const data = inflateSync(Buffer.from(m[1], "latin1")).toString("utf8");
      const texts = [...data.matchAll(/\((?:\\.|[^\\()])*\)\s*Tj|\[(?:[^\]])*\]\s*TJ/g)].map((x) => x[0]);
      if (texts.length) chunks.push(texts.join(" ").replace(/\\[()]/g, "").replace(/[()]/g, " "));
      else if (/[A-Za-zА-Яа-я]/.test(data)) chunks.push(data.slice(0, 4000));
    } catch { /* not a flate stream */ }
  }
  return chunks.join("\n");
}

const Draft = z.object({
  systemsChecked: z.number().int().min(0), faultCodes: z.array(z.object({ code: z.string(), system: z.string(), description: z.string() })),
  mileageKm: z.number().optional(), vin: z.string().optional(), scanTime: z.string().optional(),
});
const SPEC = `Return ONE JSON object: {"systemsChecked":number,"faultCodes":[{"code":"string","system":"string","description":"string"}],"mileageKm":number?,"vin":"string?","scanTime":"string?"}
Extract only OBD diagnostic facts from this LAUNCH report text. Never output workshop names, phones or addresses. If no fault codes are present, faultCodes=[].`;

export async function readDiagnosticReport(opts: { carId: string; file: string }): Promise<DiagnosticResult> {
  const filePath = path.join(process.cwd(), "demo-data", opts.carId, "sheets", opts.file);
  let text = ""; let source: DiagnosticResult["source"] = "empty";
  try { text = (await run("pdftotext", ["-layout", filePath, "-"])).stdout; if (text.trim()) source = "pdftotext"; } catch { /* poppler absent */ }
  if (!text.trim()) { text = await pdfTextViaStreams(filePath); if (text.trim()) source = "pdf-streams"; }
  const clean = redactDiagnosticText(text).slice(0, 24000);
  const draft = clean.trim()
    ? await sparkJson(Draft, [{ role: "user", content: `LAUNCH diagnostic report text (PII redacted):\n${clean}` }], SPEC, { maxTokens: 4000 })
    : { systemsChecked: 0, faultCodes: [] as FaultCode[] };
  const findings: Finding[] = draft.faultCodes.length
    ? draft.faultCodes.map((f, i) => ({
        id: `obd-${opts.carId}-${i + 1}`, panel: "unknown", kind: "mechanical" as const, severity: "high" as const,
        description_en: `OBD fault ${f.code} (${f.system}): ${f.description}`,
        description_ru: `Ошибка OBD ${f.code} (${f.system}): ${f.description}`,
        confidence: 0.85,
        evidence: [{ type: "obd" as const, mediaId: opts.file, quote: `${f.code} — ${f.description}` }],
        verified: false,
      }))
    : [{
        id: `obd-${opts.carId}-clean`, panel: "unknown", kind: "other" as const, severity: "low" as const,
        description_en: `Electronic diagnostic: ${draft.systemsChecked} systems checked, no fault codes.`,
        description_ru: `Электронная диагностика: проверено систем — ${draft.systemsChecked}, ошибок нет.`,
        confidence: 0.85,
        evidence: [{ type: "obd" as const, mediaId: opts.file, quote: "0 fault codes" }],
        verified: false,
      }];
  return {
    systemsChecked: draft.systemsChecked, faultCodes: draft.faultCodes,
    ...(draft.mileageKm ? { mileageKm: draft.mileageKm } : {}),
    ...(draft.vin ? { vinMasked: maskVin(draft.vin) } : {}),
    ...(draft.scanTime ? { scanTime: draft.scanTime } : {}),
    textChars: text.length, source, findings,
  };
}
