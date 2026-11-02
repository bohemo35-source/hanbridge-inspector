// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Split the ElevenLabs narration into phrases by silence (ffmpeg silencedetect) and transcribe each with Meta Muse Voice Transcribe → phrase list with start/end, to sync the voice to film v4 scenes
// @created: 2026-11-03
// usage: NODE_USE_ENV_PROXY=1 node --env-file=.env.local --import tsx scripts/film4/voice-phrases.mts <in.mp3> <out.json>
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { transcribeWav } from "../../src/lib/meta/asr";
const [inp, out] = process.argv.slice(2);
const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", inp]).toString());
const err = execFileSync("sh", ["-c", `ffmpeg -hide_banner -i "${inp}" -af silencedetect=noise=-38dB:d=${process.env.GAP ?? 0.45} -f null - 2>&1`]).toString();
const starts = [...err.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
const ends = [...err.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
// speech = gaps between silences
const segs: { s: number; e: number }[] = []; let cur = 0;
for (let i = 0; i < starts.length; i++) { if (starts[i] - cur > 0.25) segs.push({ s: cur, e: starts[i] }); cur = ends[i] ?? dur; }
if (dur - cur > 0.25) segs.push({ s: cur, e: dur });
const dir = mkdtempSync(path.join(tmpdir(), "vp-"));
const res = [];
for (const [i, g] of segs.entries()) {
  const w = path.join(dir, `${i}.wav`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(Math.max(0, g.s - 0.05)), "-to", String(g.e + 0.05), "-i", inp, "-ac", "1", "-ar", "16000", w]);
  const t = await transcribeWav(readFileSync(w));
  res.push({ i, start: +g.s.toFixed(2), end: +g.e.toFixed(2), text: t.transcript });
  console.log(i, g.s.toFixed(1), g.e.toFixed(1), t.transcript);
}
writeFileSync(out, JSON.stringify({ source: path.basename(inp), duration: dur, model: "muse-voice-transcribe-1.0", phrases: res }, null, 1));
