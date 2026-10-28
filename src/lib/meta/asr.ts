// @agent:   claude (TZ-03 part A)
// @project: hanbridge-inspector
// @purpose: Muse Voice Transcribe client (POST /asr/transcribe, multipart WAV). The API returns no word timings,
//           so callers chunk audio and use chunk offsets as timestamps.
// @created: 2026-10-29
import { metaFetch } from "./client";

export interface AsrResult {
  transcript: string;
  audioDurationMs: number | null;
}

export async function transcribeWav(wav: Buffer, opts: { timeoutMs?: number } = {}): Promise<AsrResult> {
  const form = new FormData();
  form.append(
    "request",
    new Blob([JSON.stringify({ model: "muse-voice-transcribe-1.0", audioEncoding: "WAV", mode: "PUSH_TO_TALK" })], { type: "application/json" }),
  );
  form.append("audio", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "audio.wav");
  const res = await metaFetch("/asr/transcribe", { method: "POST", body: form, model: "muse-voice-transcribe-1.0", timeoutMs: opts.timeoutMs ?? 60000 });
  const j = (await res.json()) as { transcript?: string; audioDurationMs?: number };
  return { transcript: (j.transcript ?? "").trim(), audioDurationMs: j.audioDurationMs ?? null };
}
