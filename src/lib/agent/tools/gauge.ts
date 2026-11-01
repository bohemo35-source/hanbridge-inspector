// @agent:   claude (TZ-03 part B)
// @project: hanbridge-inspector
// @purpose: read_gauge_video tool: paint-gauge video -> frames (ffmpeg) -> Spark vision (+ SAM screen crop re-read)
//           -> per-panel measurements with second-level evidence. Never invents microns: when the digits are not
//           readable, only the gauge display colour band is used, and the finding stays low-confidence/unverified.
// @created: 2026-10-28
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { z } from "zod";
import { classifyPaint } from "@/lib/domain/paint";
import { PANEL_VALUES, panelLabel, type Panel } from "@/lib/domain/panels";
import { samSegment } from "@/lib/meta/sam";
import { sparkJson, type ChatPart } from "@/lib/meta/spark";
import type { Finding } from "@/lib/schema";
import { ffmpegBin, mediaDuration } from "./ffbin";

const run = promisify(execFile);

// ---------- types ----------
export const DISPLAY_COLORS = ["green", "blue", "white", "orange", "red"] as const;
export type DisplayColor = (typeof DISPLAY_COLORS)[number];
/** colour band of the gauge screen; the meter switches background colour by thickness range */
export type Band = "normal" | "elevated" | "high";

export interface GaugeFrame {
  t: number; // seconds from video start
  gaugeVisible: boolean;
  microns: number | null;
  displayColor: DisplayColor | null;
  panel: Panel | null;
  panelConfidence: number; // 0..1
}

export interface GaugeMeasurement {
  panel: Panel;
  tStart: number;
  tEnd: number;
  frames: number;
  microns: number | null; // median of readable digits, null when no digits were readable
  band: Band | null;
  source: "digits" | "display_color";
  confidence: number;
}

// ---------- pure logic (tested) ----------
export function colorBand(c: DisplayColor | null): Band | null {
  if (c === "green" || c === "blue" || c === "white") return "normal";
  if (c === "orange") return "elevated";
  if (c === "red") return "high";
  return null;
}

export function micronsBand(m: number): Band {
  const s = classifyPaint(m);
  return s === "factory" ? "normal" : s === "repaint" ? "elevated" : "high";
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

const BAND_RANK: Record<Band, number> = { normal: 0, elevated: 1, high: 2 };

/**
 * Consecutive frames where the gauge is visible on the same panel form one measurement.
 * A gap of more than `maxGapSec` or a panel change closes the group. Frames without a panel
 * (or with panelConfidence < 0.5) are ignored. Unknown-panel groups are dropped.
 */
export function mergeGaugeFrames(frames: GaugeFrame[], opts: { maxGapSec?: number } = {}): GaugeMeasurement[] {
  const maxGap = opts.maxGapSec ?? 6;
  const usable = frames
    .filter((f) => f.gaugeVisible && f.panel && f.panel !== "unknown" && f.panelConfidence >= 0.5)
    .sort((a, b) => a.t - b.t);
  const groups: GaugeFrame[][] = [];
  for (const f of usable) {
    const g = groups[groups.length - 1];
    const last = g?.[g.length - 1];
    if (g && last && last.panel === f.panel && f.t - last.t <= maxGap) g.push(f);
    else groups.push([f]);
  }
  return groups.map((g) => {
    const digits = g.map((f) => f.microns).filter((m): m is number => typeof m === "number" && m > 0 && m < 3000);
    const colorBands = g.map((f) => colorBand(f.displayColor)).filter((b): b is Band => b !== null);
    // colour band: the highest band seen at least twice, else the highest seen once
    const counts = { normal: 0, elevated: 0, high: 0 } as Record<Band, number>;
    colorBands.forEach((b) => counts[b]++);
    const ranked = (Object.keys(counts) as Band[]).filter((b) => counts[b] > 0).sort((a, b) => BAND_RANK[b] - BAND_RANK[a]);
    const colorBandValue = ranked.find((b) => counts[b] >= 2) ?? ranked[0] ?? null;
    const microns = digits.length ? median(digits) : null;
    const band = microns !== null ? micronsBand(microns) : colorBandValue;
    const avgPanelConf = g.reduce((s, f) => s + f.panelConfidence, 0) / g.length;
    const confidence = Math.round(Math.min(0.95, (microns !== null ? 0.6 : 0.4) + 0.1 * Math.min(g.length, 3) + 0.1 * (avgPanelConf - 0.5)) * 100) / 100;
    return {
      panel: g[0].panel as Panel,
      tStart: g[0].t,
      tEnd: g[g.length - 1].t,
      frames: g.length,
      microns,
      band,
      source: microns !== null ? "digits" : "display_color",
      confidence,
    };
  });
}

/** Measurements -> findings (non-normal bands only). Spark-derived, so verified=false until the verifier. */
export function gaugeFindings(ms: GaugeMeasurement[], mediaId: string): Finding[] {
  return ms
    .filter((m) => m.band === "elevated" || m.band === "high")
    .map((m, i) => {
      const where = `${m.tStart}–${m.tEnd}s`;
      const value = m.microns !== null ? `${m.microns} µm` : `gauge display ${m.band === "high" ? "red" : "orange"}`;
      const valueRu = m.microns !== null ? `${m.microns} мкм` : `экран толщиномера ${m.band === "high" ? "красный" : "оранжевый"}`;
      const high = m.band === "high";
      return {
        id: `gauge-video-${m.panel}-${i + 1}`,
        panel: m.panel,
        kind: m.microns !== null ? (high ? "putty" : "repaint") : "repaint",
        severity: high ? "high" : "medium",
        description_en: `${panelLabel(m.panel, "en")}: ${value} on the paint-gauge video (${where}) — paint thicker than factory${high ? ", likely filler/body repair" : ", likely repaint"}.`,
        description_ru: `${panelLabel(m.panel, "ru")}: ${valueRu} на видео толщиномера (${where}) — слой толще заводского${high ? ", вероятна шпатлёвка/кузовной ремонт" : ", вероятен перекрас"}.`,
        confidence: m.confidence,
        evidence: [
          {
            type: "gauge" as const,
            mediaId,
            panel: m.panel,
            tStart: m.tStart,
            tEnd: m.tEnd,
            ...(m.microns !== null ? { gaugeMicrons: m.microns } : {}),
            quote: m.source === "digits" ? `digits read: ${m.microns} µm` : `display colour band: ${m.band}`,
          },
        ],
        verified: false,
      } satisfies Finding;
    });
}

/** paint.json for analyze_paint_readings — only measurements with readable digits */
export function toPaintJson(ms: GaugeMeasurement[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of ms) if (m.microns !== null && m.panel !== "unknown") out[m.panel] = Math.max(out[m.panel] ?? 0, m.microns);
  return out;
}

// ---------- IO ----------
const PanelOrNull = z.enum(PANEL_VALUES as unknown as [Panel, ...Panel[]]).nullable();
const FramesDraftSchema = z.object({
  frames: z.array(
    z.object({
      i: z.number().int(),
      gaugeVisible: z.boolean(),
      microns: z.number().nullable(),
      displayColor: z.enum(DISPLAY_COLORS).nullable(),
      panel: PanelOrNull,
      panelConfidence: z.number().min(0).max(1),
    }),
  ),
});

const FRAMES_SPEC = `Return ONE JSON object: {"frames":[{"i":0,"gaugeVisible":true,"microns":null,"displayColor":"orange","panel":"hood","panelConfidence":0.8}]}
- one entry per attached image, "i" = its 0-based order;
- gaugeVisible: a handheld paint thickness gauge is pressed against or held at the car body;
- microns: the number on the gauge screen ONLY if the digits are clearly readable, else null (never guess);
- displayColor: background colour of the gauge screen: one of green, blue, white, orange, red, or null;
- panel: where the gauge touches, one of: ${PANEL_VALUES.join(", ")}, or null when no gauge. Use cues: headlight + bonnet edge -> hood or front fender; door handle -> door; fuel flap / tail light -> rear fender; side mirror for left/right; the camera holder stands next to the panel;
- panelConfidence 0..1.`;

const probeDuration = (video: string): Promise<number> => mediaDuration(video); // ffmpeg-based: no ffprobe on Vercel

/** frames every `step` seconds (step chosen so that count <= maxFrames), width <= 960 */
export async function extractFrames(video: string, maxFrames = 60): Promise<{ t: number; jpg: Buffer }[]> {
  const duration = await probeDuration(video);
  const step = Math.max(1, Math.ceil(duration / maxFrames));
  const dir = await mkdtemp(path.join(tmpdir(), "gauge-"));
  try {
    await run(await ffmpegBin(), ["-v", "error", "-i", video, "-vf", `fps=1/${step},scale='min(960,iw)':-2`, "-q:v", "2", path.join(dir, "f%04d.jpg")]);
    const files = (await readdir(dir)).filter((f) => f.endsWith(".jpg")).sort();
    return Promise.all(files.slice(0, maxFrames).map(async (f, i) => ({ t: i * step, jpg: await readFile(path.join(dir, f)) })));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const dataUrl = (b: Buffer) => `data:image/jpeg;base64,${b.toString("base64")}`;

/** second pass for one frame: SAM finds the gauge screen, crop x3 + sharpen, Spark reads digits only */
async function rereadDigits(jpg: Buffer): Promise<number | null> {
  const seg = await samSegment(jpg, "paint thickness gauge screen");
  const meta = await sharp(jpg).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  const best = seg.instances
    .map((i) => i.box)
    .sort((a, b) => (b.x2 - b.x1) * (b.y2 - b.y1) - (a.x2 - a.x1) * (a.y2 - a.y1))[0];
  if (!best || !W || !H) return null;
  const sx = W / seg.width;
  const sy = H / seg.height;
  const pad = 6;
  const left = Math.max(0, Math.floor(best.x1 * sx) - pad);
  const top = Math.max(0, Math.floor(best.y1 * sy) - pad);
  const width = Math.min(W - left, Math.ceil((best.x2 - best.x1) * sx) + 2 * pad);
  const height = Math.min(H - top, Math.ceil((best.y2 - best.y1) * sy) + 2 * pad);
  if (width < 8 || height < 8) return null;
  const crop = await sharp(jpg).extract({ left, top, width, height }).resize({ width: Math.min(720, width * 3) }).sharpen().jpeg({ quality: 92 }).toBuffer();
  const r = await sparkJson(
    z.object({ microns: z.number().nullable() }),
    [
      {
        role: "user",
        content: [
          { type: "text", text: "Close-up of a paint thickness gauge screen. Return the displayed number in microns only if every digit is clearly readable, else null. Never guess." },
          { type: "image_url", image_url: { url: dataUrl(crop) } },
        ],
      },
    ],
    `Return ONE JSON object: {"microns": number | null}`,
  );
  return r.microns;
}

export interface ReadGaugeVideoResult {
  mediaId: string;
  frames: GaugeFrame[];
  measurements: GaugeMeasurement[];
  findings: Finding[];
  paint: Record<string, number>;
  stats: { frames: number; gaugeFrames: number; digitsRead: number; sparkCalls: number; samCalls: number; ms: number };
}

export async function readGaugeVideo(opts: { video: string; mediaId?: string; maxFrames?: number; batch?: number; reread?: number }): Promise<ReadGaugeVideoResult> {
  const t0 = Date.now();
  const mediaId = opts.mediaId ?? path.basename(opts.video);
  const raw = await extractFrames(opts.video, opts.maxFrames ?? 60);
  const batch = opts.batch ?? 6;
  const frames: GaugeFrame[] = [];
  let sparkCalls = 0;
  let samCalls = 0;
  for (let s = 0; s < raw.length; s += batch) {
    const chunk = raw.slice(s, s + batch);
    const parts: ChatPart[] = [
      { type: "text", text: `Frames ${s}..${s + chunk.length - 1} of a used-car paint-gauge inspection video, in time order.` },
      ...chunk.map((f) => ({ type: "image_url" as const, image_url: { url: dataUrl(f.jpg) } })),
    ];
    sparkCalls++;
    const draft = await sparkJson(FramesDraftSchema, [{ role: "user", content: parts }], FRAMES_SPEC, { maxTokens: 4000 });
    for (const d of draft.frames) {
      const src = chunk[d.i];
      if (!src) continue;
      frames.push({ t: src.t, gaugeVisible: d.gaugeVisible, microns: d.microns, displayColor: d.displayColor, panel: d.panel, panelConfidence: d.panelConfidence });
    }
  }
  // second pass: try to read digits on a few gauge frames (cost-capped)
  const candidates = frames.filter((f) => f.gaugeVisible && f.microns === null && f.panel && f.panel !== "unknown").slice(0, opts.reread ?? 8);
  for (const f of candidates) {
    const jpg = raw.find((r) => r.t === f.t)?.jpg;
    if (!jpg) continue;
    try {
      samCalls++;
      sparkCalls++;
      f.microns = await rereadDigits(jpg);
    } catch {
      /* keep null — colour band still applies */
    }
  }
  const measurements = mergeGaugeFrames(frames);
  return {
    mediaId,
    frames,
    measurements,
    findings: gaugeFindings(measurements, mediaId),
    paint: toPaintJson(measurements),
    stats: {
      frames: raw.length,
      gaugeFrames: frames.filter((f) => f.gaugeVisible).length,
      digitsRead: frames.filter((f) => f.microns !== null).length,
      sparkCalls,
      samCalls,
      ms: Date.now() - t0,
    },
  };
}
