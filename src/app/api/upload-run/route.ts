// @agent:   claude
// @project: hanbridge-inspector
// @purpose: POST /api/upload-run — "check your own car": 3–10 photos (+ optional paint-gauge numbers) in one multipart request,
//           kept in this instance's /tmp only (not stored in Blob), then the same agent run streamed as SSE.
//           Only the report JSON and the plate-hidden listing photo are published.
// @created: 2026-11-02
// @updated: 2026-11-03 claude-code — optional walk-around video: uploaded by the browser straight to Vercel Blob (/api/blob-upload), fetched here by URL, audio kept (≤180 s) for the agent, the Blob file deleted after the run
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { revalidateTag } from "next/cache";
import { del } from "@vercel/blob";
import sharp from "sharp";
import { registerCar, type CarInfo } from "@/lib/agent/catalog";
import { registerLocalCar } from "@/lib/agent/media";
import { runInspection } from "@/lib/agent/orchestrator";
import { PANEL_IDS } from "@/lib/domain/panels";
import { checkLimit, clientIp } from "@/lib/runtime/rateLimit";
import { ffmpegBin } from "@/lib/agent/tools/ffbin";
export const runtime = "nodejs";
export const maxDuration = 300;

const json = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });
const BODY = new Set(["sedan", "suv", "hatchback"]);
const VIDEO_MAX_BYTES = 150 * 1024 * 1024;
/** our own store only (host from the read-write token), files the browser put under uploads/ */
function ownUploadUrl(raw: string): URL | null {
  const store = process.env.BLOB_READ_WRITE_TOKEN?.match(/^vercel_blob_rw_([A-Za-z0-9]+)_/)?.[1];
  try {
    const u = new URL(raw);
    return store && u.protocol === "https:" && u.hostname === `${store.toLowerCase()}.public.blob.vercel-storage.com` && u.pathname.startsWith("/uploads/") ? u : null;
  } catch { return null; }
}
/** download the visitor's video and keep only its sound (≤180 s, mono AAC): the agent transcribes the voice, frames are not used */
async function fetchVideoAudio(u: URL, dir: string): Promise<boolean> {
  const res = await fetch(u);
  if (!res.ok || !res.body) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > VIDEO_MAX_BYTES) return false;
  const src = path.join(dir, "upload-src"); await writeFile(src, buf);
  await mkdir(path.join(dir, "video"), { recursive: true });
  await promisify(execFile)(await ffmpegBin(), ["-hide_banner", "-loglevel", "error", "-y", "-i", src, "-t", "180", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "aac", "-b:a", "64k", path.join(dir, "video", "owner_video.mp4")], { timeout: 60_000 });
  return true;
}
const clean = (v: FormDataEntryValue | null, max = 40) => String(v ?? "").replace(/[^\p{L}\p{N} .\-/]/gu, "").trim().slice(0, max);

export async function POST(req: Request) {
  if (process.env.RUN_DISABLED === "1") return json(503, "live runs are paused");
  const limited = checkLimit("upload", clientIp(req), Number(process.env.UPLOAD_PER_IP_HOUR ?? 2), Number(process.env.UPLOAD_DAILY_CAP ?? 15));
  if (limited) return json(429, limited);

  let form: FormData;
  try { form = await req.formData(); } catch { return json(400, "expected multipart form data"); }
  const make = clean(form.get("make")); const model = clean(form.get("model"));
  const year = Number(form.get("year")); const bodyType = String(form.get("bodyType") ?? "sedan");
  if (!make || !model) return json(400, "make and model are required");
  if (!Number.isInteger(year) || year < 1990 || year > 2027) return json(400, "year must be 1990–2027");
  if (!BODY.has(bodyType)) return json(400, "bodyType must be sedan, suv or hatchback");
  const files = form.getAll("photos").filter((f): f is File => typeof f !== "string");
  if (files.length < 3 || files.length > 10) return json(400, "send 3 to 10 photos");
  if (files.some((f) => f.size > 3_000_000)) return json(400, "each photo must be under 3 MB");

  const carId = `u-${randomBytes(5).toString("hex")}`;
  const dir = path.join(tmpdir(), "hanbridge-uploads", carId);
  await mkdir(path.join(dir, "photos"), { recursive: true });
  let saved = 0;
  for (const [i, f] of files.entries()) {
    try {
      const jpg = await sharp(Buffer.from(await f.arrayBuffer())).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
      await writeFile(path.join(dir, "photos", `photo-${String(i + 1).padStart(2, "0")}.jpg`), jpg); saved++;
    } catch { /* not an image: skip */ }
  }
  if (saved < 3) return json(400, "at least 3 readable photos are needed");
  const videoField = String(form.get("videoUrl") ?? "");
  const videoUrl = videoField ? ownUploadUrl(videoField) : null;
  if (videoField && !videoUrl) return json(400, "video must be uploaded through this page");

  const initialPaint = PANEL_IDS.map((panel) => ({ panel, microns: Number(form.get(`paint_${panel}`)) }))
    .filter((r) => Number.isFinite(r.microns) && r.microns >= 20 && r.microns <= 3000);
  const car: CarInfo = { carId, make, model, year, bodyType: bodyType as CarInfo["bodyType"], doors: bodyType === "hatchback" ? 5 : 5 };
  registerCar(car); registerLocalCar(carId, dir);

  const enc = new TextEncoder();
  let open = true;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (!open) return;
        try { controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { open = false; }
      };
      let video = false;
      try {
        if (videoUrl) {
          try { video = await fetchVideoAudio(videoUrl, dir); } catch { video = false; }
          del(videoUrl.toString()).catch(() => undefined); // not kept: the sound is in this instance's /tmp only
        }
        send("car", { carId, make, model, year, photos: saved, paintReadings: initialPaint.length, video });
        const { report, ms } = await runInspection({ carId, onStep: (s) => send("step", s), initialPaint });
        try { revalidateTag("reports"); } catch { /* outside a Next request */ }
        send("done", { reportId: report.id, verdict: report.verdict, findings: report.findings.length, verified: report.findings.filter((f) => f.verified).length, ms, url: `/r/${report.id}` });
      } catch (e) {
        send("error", { error: e instanceof Error ? e.message : "run failed" });
      } finally { if (open) { open = false; try { controller.close(); } catch { /* closed */ } } }
    },
    cancel() { open = false; },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
