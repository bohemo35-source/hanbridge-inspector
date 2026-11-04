// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: re-mix the sound of an existing film recording (record-film.mjs) with the player's current balance, picture copied untouched:
//           the voice/drums timing comes from the recording's log.json; mix → −16 LUFS → muxed over the old video stream (-c:v copy)
// @created: 2026-11-04
// usage: node scripts/film4/remix-film-audio.mjs <log.json> <in.mp4> <out.mp4> [aac bitrate=160k]   (env VOICE=1 DRUMS=1 DRUMFILE=drums-mix.mp3)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
const [logFile, inMp4, outMp4, ab = "160k"] = process.argv.slice(2);
if (!logFile || !inMp4 || !outMp4) { console.error("usage: remix-film-audio.mjs <log.json> <in.mp4> <out.mp4> [ab]"); process.exit(1); }
const VOICE = Number(process.env.VOICE ?? 1), DRUMS = Number(process.env.DRUMS ?? 1); // as in Film4.tsx: the 0.35 is baked into drums-mix.mp3
const L = JSON.parse(fs.readFileSync(logFile, "utf8"));
const audio = path.join("public", "film3", "audio");
const narrFile = path.join(audio, L.narration.file), drumFile = path.join(audio, process.env.DRUMFILE ?? "drums-mix.mp3");
const nAt = L.narration.at, from = L.narration.from, endAt = L.narration.end, dAt = L.drumsAt, span = L.span;
// same mix as record-film.mjs: drums fade in 1.5 s, both stop when the voice ends (drums fade out 0.7 s); the drums loop by -stream_loop
// (with aloop and "apad,atrim" ffmpeg 8 hung at 100 % CPU in some runs — the same command line finished in 0.3 s in others; apad=whole_dur ends by itself)
const fc = [
  `[0:a]atrim=start=${from.toFixed(3)}:end=${(from + endAt - nAt).toFixed(3)},asetpts=PTS-STARTPTS,volume=${VOICE},adelay=${Math.round(nAt * 1000)}:all=1[v]`,
  `[1:a]atrim=0:${(endAt - dAt + 0.8).toFixed(3)},asetpts=PTS-STARTPTS,volume=${DRUMS},afade=t=in:d=1.5,afade=t=out:st=${(endAt - dAt).toFixed(3)}:d=0.7,adelay=${Math.round(dAt * 1000)}:all=1[d]`,
  `[v][d]amix=inputs=2:normalize=0:duration=longest,apad=whole_dur=${span.toFixed(3)}[a]`,
].join(";");
const mix = path.join(process.env.TMPDIR ?? os.tmpdir(), `remix-${process.pid}.wav`);
execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", narrFile, "-stream_loop", "-1", "-i", drumFile, "-filter_complex", fc, "-map", "[a]", "-ar", "48000", "-ac", "2", mix]);
const lufs = (f) => Number((spawnSync("ffmpeg", ["-nostdin", "-hide_banner", "-nostats", "-i", f, "-af", "ebur128", "-f", "null", "-"]).stderr.toString().match(/I:\s+(-?[\d.]+) LUFS/g) ?? []).at(-1)?.match(/-?[\d.]+/)[0]);
const I = lufs(mix), gain = (-16 - I).toFixed(2);
execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", inMp4, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
  "-af", `volume=${gain}dB,alimiter=limit=0.95`, "-c:a", "aac", "-b:a", ab, "-movflags", "+faststart", "-shortest", outMp4]);
fs.rmSync(mix, { force: true });
console.log("OK", outMp4, "voice", VOICE, "drums", path.basename(drumFile), DRUMS, "mix", I, "LUFS → gain", gain, "dB, out", lufs(outMp4), "LUFS");
