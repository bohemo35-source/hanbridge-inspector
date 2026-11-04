// @agent:   claude (TZ-03 part A)
// @project: hanbridge-inspector
// @purpose: transcribe_note tool: inspector's voice in the walk-around / paint-gauge video -> Muse Voice Transcribe
//           (15 s chunks = timestamps) -> Spark extracts per-panel gauge readings and the inspector's own verdict,
//           every item tied to a verbatim quote that must exist in the transcript chunk (else rejected).
// @created: 2026-10-29
// @updated: 2026-11-03 claude-code — 90 s timeout for the readings extraction
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { classifyPaint } from "@/lib/domain/paint";
import { PANEL_VALUES, panelLabel, type Panel } from "@/lib/domain/panels";
import { transcribeWav } from "@/lib/meta/asr";
import { sparkJson } from "@/lib/meta/spark";
import { ffmpegBin } from "./ffbin";
import type { Finding } from "@/lib/schema";

const run = promisify(execFile);

// ---------- types ----------
export interface TranscriptChunk {
  i: number;
  tStart: number; // seconds
  tEnd: number;
  text: string;
}

export type InspectorVerdict = "factory" | "repaint" | "repair" | "replaced" | "unknown";

export interface VoiceReading {
  panel: Panel;
  microns: number[];
  inspectorVerdict: InspectorVerdict;
  quote: string;
  chunk: number;
  tStart: number;
  tEnd: number;
}

export interface VoiceNote {
  panel: Panel | null;
  text_en: string;
  text_ru: string;
  quote: string;
  chunk: number;
  tStart: number;
  tEnd: number;
}

export interface VoiceRejected {
  reason: "quote_not_found" | "bad_chunk";
  quote: string;
  chunk: number;
}

// ---------- pure logic (tested) ----------
/** lowercase, Cyrillic "yo" → "ye", drop punctuation, collapse spaces — for quote matching across ASR/LLM punctuation differences */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function quoteInText(quote: string, text: string): boolean {
  const q = normalizeText(quote);
  return q.length >= 4 && normalizeText(text).includes(q);
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/**
 * Readings -> findings. The inspector's explicit verdict wins over the numeric rule:
 * - verdict repaint/repair/replaced -> finding (kind from the verdict);
 * - verdict unknown -> numeric rule on the median (<=150 factory, 151-220 repaint, >220 putty);
 * - verdict factory but median > 150 -> no finding, recorded as a conflict for the verifier
 *   (e.g. MINI contrast roof: "the roof always reads ~2x on MINI").
 */
const VERDICT_RANK: Record<InspectorVerdict, number> = { factory: 0, unknown: 1, repaint: 2, repair: 3, replaced: 4 };

/** All readings of one panel become one reading: numbers joined, strongest verdict, earliest/ latest time, all quotes kept. */
export function mergeVoiceReadings(readings: VoiceReading[]): (VoiceReading & { quotes: { quote: string; tStart: number; tEnd: number }[] })[] {
  const by = new Map<string, VoiceReading & { quotes: { quote: string; tStart: number; tEnd: number }[] }>();
  for (const r of readings) {
    if (r.panel === "unknown") continue;
    const m = by.get(r.panel);
    if (!m) {
      by.set(r.panel, { ...r, microns: [...r.microns], quotes: [{ quote: r.quote, tStart: r.tStart, tEnd: r.tEnd }] });
      continue;
    }
    m.microns.push(...r.microns);
    if (VERDICT_RANK[r.inspectorVerdict] > VERDICT_RANK[m.inspectorVerdict]) m.inspectorVerdict = r.inspectorVerdict;
    m.tStart = Math.min(m.tStart, r.tStart);
    m.tEnd = Math.max(m.tEnd, r.tEnd);
    m.quotes.push({ quote: r.quote, tStart: r.tStart, tEnd: r.tEnd });
  }
  return [...by.values()];
}

export function voiceFindings(
  readings: VoiceReading[],
  mediaId: string,
): { findings: Finding[]; conflicts: { panel: Panel; median: number; quote: string; tStart: number }[] } {
  const findings: Finding[] = [];
  const conflicts: { panel: Panel; median: number; quote: string; tStart: number }[] = [];
  mergeVoiceReadings(readings).forEach((r, idx) => {
    const valid = r.microns.filter((m) => m > 0 && m < 3000);
    const med = valid.length ? median(valid) : null;
    const peak = valid.length ? Math.max(...valid) : null;
    let kind: Finding["kind"] | null = null;
    if (r.inspectorVerdict === "repair") kind = "putty";
    else if (r.inspectorVerdict === "repaint") kind = "repaint";
    else if (r.inspectorVerdict === "replaced") kind = "panel_replaced";
    else if (r.inspectorVerdict === "unknown" && med !== null) {
      const s = classifyPaint(med);
      kind = s === "factory" ? null : s === "repaint" ? "repaint" : "putty";
    } else if (r.inspectorVerdict === "factory" && med !== null && med > 150) {
      conflicts.push({ panel: r.panel, median: med, quote: r.quote, tStart: r.tStart });
    }
    if (!kind || r.panel === "unknown") return;
    const high = kind === "putty" || kind === "panel_replaced" || (peak !== null && peak > 220);
    const nums = valid.length ? ` (${med} µm median${peak !== null && peak !== med ? `, peak ${peak}` : ""})` : "";
    const numsRu = valid.length ? ` (медиана ${med} мкм${peak !== null && peak !== med ? `, пик ${peak}` : ""})` : "";
    const what = { repaint: "repaint", putty: "filler / body repair", panel_replaced: "panel replaced" } as Record<string, string>;
    const whatRu = { repaint: "перекрас", putty: "шпатлёвка / кузовной ремонт", panel_replaced: "замена элемента" } as Record<string, string>;
    findings.push({
      id: `voice-${r.panel}-${idx + 1}`,
      panel: r.panel,
      kind,
      severity: high ? "high" : "medium",
      description_en: `${panelLabel(r.panel, "en")}: inspector reports ${what[kind] ?? kind}${nums} at ${r.tStart}s of the video.`,
      description_ru: `${panelLabel(r.panel, "ru")}: инспектор фиксирует ${whatRu[kind] ?? kind}${numsRu} на ${r.tStart} с видео.`,
      confidence: r.inspectorVerdict === "unknown" ? 0.6 : 0.8,
      evidence: r.quotes.map((q, k) => ({
        type: "transcript" as const,
        mediaId,
        panel: r.panel,
        quote: q.quote,
        tStart: q.tStart,
        tEnd: q.tEnd,
        ...(k === 0 && med !== null ? { gaugeMicrons: med } : {}),
      })),
      verified: false,
    });
  });
  return { findings, conflicts };
}

/** paint.json from voice readings: max median per panel (only panels with numbers) */
export function voicePaintJson(readings: VoiceReading[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of mergeVoiceReadings(readings)) {
    const v = r.microns.filter((m) => m > 0 && m < 3000);
    if (!v.length || r.panel === "unknown") continue;
    // inspector explicitly said "factory" despite >150 µm (e.g. MINI contrast roof): context wins, the numeric rule must not fire
    if (r.inspectorVerdict === "factory" && median(v) > 150) continue;
    out[r.panel] = median(v);
  }
  return out;
}

/** Spread of all points per panel (same panels as voicePaintJson): min, max and how many points were spoken. */
export function voicePaintStats(readings: VoiceReading[]): Record<string, { min: number; max: number; points: number }> {
  const out: Record<string, { min: number; max: number; points: number }> = {};
  for (const r of mergeVoiceReadings(readings)) {
    const v = r.microns.filter((m) => m > 0 && m < 3000);
    if (!v.length || r.panel === "unknown") continue;
    if (r.inspectorVerdict === "factory" && median(v) > 150) continue;
    out[r.panel] = { min: Math.min(...v), max: Math.max(...v), points: v.length };
  }
  return out;
}

// ---------- IO ----------
export async function audioChunks(video: string, chunkSec = 15): Promise<{ i: number; tStart: number; tEnd: number; wav: Buffer }[]> {
  const dir = await mkdtemp(path.join(tmpdir(), "voice-"));
  try {
    await run(await ffmpegBin(), ["-v", "error", "-i", video, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-f", "segment", "-segment_time", String(chunkSec), path.join(dir, "c%04d.wav")]);
    const files = (await readdir(dir)).filter((f) => f.endsWith(".wav")).sort();
    return await Promise.all(
      files.map(async (f, i) => {
        const wav = await readFile(path.join(dir, f));
        const seconds = Math.max(0, (wav.length - 44) / (16000 * 2));
        return { i, tStart: i * chunkSec, tEnd: Math.round((i * chunkSec + seconds) * 10) / 10, wav };
      }),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const k = next++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

const PanelEnum = z.enum(PANEL_VALUES as unknown as [Panel, ...Panel[]]);
const VoiceDraftSchema = z.object({
  readings: z.array(
    z.object({
      chunk: z.number().int(),
      panel: PanelEnum,
      microns: z.array(z.number()),
      inspectorVerdict: z.enum(["factory", "repaint", "repair", "replaced", "unknown"]),
      quote: z.string(),
    }),
  ),
  notes: z.array(
    z.object({ chunk: z.number().int(), panel: PanelEnum.nullable(), text_en: z.string(), text_ru: z.string(), quote: z.string() }),
  ),
});

const VOICE_SPEC = `Return ONE JSON object:
{"readings":[{"chunk":3,"panel":"hood","microns":[181,197,225,230],"inspectorVerdict":"repaint","quote":"сто восемьдесят один, сто девяносто семь"}],
 "notes":[{"chunk":7,"panel":"roof","text_en":"Inspector: MINI roof always reads about 2x the body panels (contrast roof)","text_ru":"Инспектор: у MINI крыша всегда показывает примерно в 2 раза больше (контрастная крыша)","quote":"крыша бьет в два раза больше"}]}
Rules:
- One reading per panel the inspector measures in a chunk. "panel" is one of: ${PANEL_VALUES.join(", ")}. Map Russian words: капот=hood, крыша=roof, крышка багажника/багажник=trunk, передний бампер=front_bumper, задний бампер=rear_bumper; водительская = left, пассажирская = right (left-hand drive); справа = right, слева = left. The inspector walks AROUND the car in order (e.g. hood -> front fenders -> roof -> one side doors -> rear fender -> trunk -> other side), so infer front/rear and side of "крыло"/"дверь" from the walk order and neighbouring panels ("крыло" right after the hood = front fender; "заднее крыло"/next to trunk = rear fender). Use "unknown" only when there is no clue at all. Порог (sill) and проём (door opening) are not panels: "unknown".
- "microns": the numbers the inspector says for that panel, as integers (Russian number words -> digits; "один миллиметр восемьсот девяносто шесть" = 1896 is likely ASR noise: keep only plausible values 20..2000).
- "inspectorVerdict": what the inspector SAYS about the panel: завод/заводской=factory, окрас/перекрас=repaint, ремонт/шпаклевка/ремонтная работа=repair, замена=replaced, else unknown. Never infer from numbers.
- "quote": 3–12 consecutive words copied EXACTLY from that chunk's text (verbatim, no paraphrase).
- "notes": important remarks that are not numbers (dust under lacquer, colour match, door not removed, roof explanation), each with an exact quote.`;

export interface TranscribeNoteResult {
  mediaId: string;
  chunks: TranscriptChunk[];
  readings: VoiceReading[];
  notes: VoiceNote[];
  rejected: VoiceRejected[];
  findings: Finding[];
  conflicts: { panel: Panel; median: number; quote: string; tStart: number }[];
  paint: Record<string, number>;
  paintStats: Record<string, { min: number; max: number; points: number }>;
  stats: { chunks: number; asrMs: number; sparkMs: number; ms: number };
}

export async function transcribeNote(opts: { video: string; mediaId?: string; chunkSec?: number; parallel?: number }): Promise<TranscribeNoteResult> {
  const t0 = Date.now();
  const mediaId = opts.mediaId ?? path.basename(opts.video);
  const raw = await audioChunks(opts.video, opts.chunkSec ?? 15);
  const tAsr = Date.now();
  const texts = await pool(raw, opts.parallel ?? 3, async (c) => {
    try {
      return (await transcribeWav(c.wav)).transcript;
    } catch {
      return "";
    }
  });
  const chunks: TranscriptChunk[] = raw.map((c, k) => ({ i: c.i, tStart: c.tStart, tEnd: c.tEnd, text: texts[k] }));
  const asrMs = Date.now() - tAsr;

  const tSpark = Date.now();
  const body = chunks.filter((c) => c.text).map((c) => `[chunk ${c.i} | ${c.tStart}-${c.tEnd}s] ${c.text}`).join("\n");
  const draft = body
    ? await sparkJson(VoiceDraftSchema, [
        { role: "system", content: "You extract structured paint-gauge readings from a used-car inspector's spoken commentary (Russian). Be literal; never invent numbers or quotes." },
        { role: "user", content: `Transcript in 15-second chunks:\n${body}` },
      ], VOICE_SPEC, { maxTokens: 8000, timeoutMs: 90_000 }) // a gauge walk-around has dozens of readings: 30 s was not enough (aborted twice on a visitor's 3-min video)
    : { readings: [], notes: [] };
  const sparkMs = Date.now() - tSpark;

  const byI = new Map(chunks.map((c) => [c.i, c]));
  const rejected: VoiceRejected[] = [];
  // quotes may straddle a chunk boundary: accept a match in the stated chunk or its neighbours
  const locate = (quote: string, i: number) => [i, i - 1, i + 1].map((k) => byI.get(k)).find((c) => c && quoteInText(quote, c.text));
  const readings: VoiceReading[] = [];
  for (const r of draft.readings) {
    if (!byI.has(r.chunk)) { rejected.push({ reason: "bad_chunk", quote: r.quote, chunk: r.chunk }); continue; }
    const c = locate(r.quote, r.chunk);
    if (!c) { rejected.push({ reason: "quote_not_found", quote: r.quote, chunk: r.chunk }); continue; }
    readings.push({ panel: r.panel, microns: r.microns.filter((m) => m >= 20 && m <= 2000).map(Math.round), inspectorVerdict: r.inspectorVerdict, quote: r.quote, chunk: c.i, tStart: c.tStart, tEnd: c.tEnd });
  }
  const notes: VoiceNote[] = [];
  for (const n of draft.notes) {
    const c = byI.has(n.chunk) ? locate(n.quote, n.chunk) : undefined;
    if (!c) { rejected.push({ reason: "quote_not_found", quote: n.quote, chunk: n.chunk }); continue; }
    notes.push({ panel: n.panel, text_en: n.text_en, text_ru: n.text_ru, quote: n.quote, chunk: c.i, tStart: c.tStart, tEnd: c.tEnd });
  }
  const { findings, conflicts } = voiceFindings(readings, mediaId);
  return {
    mediaId,
    chunks,
    readings,
    notes,
    rejected,
    findings,
    conflicts,
    paint: voicePaintJson(readings),
    paintStats: voicePaintStats(readings),
    stats: { chunks: chunks.length, asrMs, sparkMs, ms: Date.now() - t0 },
  };
}
