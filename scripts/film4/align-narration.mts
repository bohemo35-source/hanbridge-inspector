// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Film v4 narration: split the ElevenLabs file into phrases by silence, transcribe each (Meta Muse Voice Transcribe), match phrases to scene lines in order, add silence for scenes without lines (maps, cards, end), write public/film3/audio/narration-<lang>.mp3 + .json (scene id → [start, end] s) for the watch mode
// @created: 2026-11-03
// usage: NODE_USE_ENV_PROXY=1 node --env-file=.env.local --import tsx scripts/film4/align-narration.mts <in.mp3> <en|ru>
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { transcribeWav } from "../../src/lib/meta/asr";
import { SCENES } from "../../src/components/film4/story";

const [inp, lang] = process.argv.slice(2) as [string, "en" | "ru"];
const dir = mkdtempSync(path.join(tmpdir(), "nar-"));
const sh = (cmd: string) => execFileSync("sh", ["-c", cmd]).toString();
const dur = Number(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${inp}"`));

// 1) phrases = speech between pauses ≥ 0.35 s
const log = sh(`ffmpeg -hide_banner -i "${inp}" -af silencedetect=noise=-38dB:d=0.35 -f null - 2>&1`);
const ss = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]), se = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
const phrases: { s: number; e: number; text: string }[] = []; let cur = 0;
for (let i = 0; i < ss.length; i++) { if (ss[i] - cur > 0.2) phrases.push({ s: cur, e: ss[i], text: "" }); cur = se[i] ?? dur; }
if (dur - cur > 0.2) phrases.push({ s: cur, e: dur, text: "" });
for (const [i, p] of phrases.entries()) {
  const w = path.join(dir, `${i}.wav`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(Math.max(0, p.s - 0.05)), "-to", String(p.e + 0.05), "-i", inp, "-ac", "1", "-ar", "16000", w]);
  p.text = (await transcribeWav(readFileSync(w))).transcript;
}

// 2) match phrases to scenes in order: each scene with text takes phrases while they overlap its words better than the next scene's
const words = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2);
const overlap = (a: string[], b: string[]) => { const B = new Set(b); return a.filter((w) => B.has(w)).length / Math.max(1, a.length); };
const spoken = SCENES.map((sc) => [sc.card?.sub?.[lang] ?? "", ...(sc.lines ?? []).map((l) => l[lang])].join(" ").trim());
const owner: number[] = []; let k = SCENES.findIndex((_, i) => spoken[i]);
for (const p of phrases) {
  const w = words(p.text);
  // look ahead up to 3 speaking scenes; move on when a later one matches clearly better
  let best = k, bestScore = overlap(w, words(spoken[k]));
  for (let j = k + 1, n = 0; j < SCENES.length && n < 3; j++) { if (!spoken[j]) continue; n++; const sc = overlap(w, words(spoken[j])); if (sc > bestScore + 0.15) { best = j; bestScore = sc; } }
  k = best; owner.push(k);
}

// 3) build the narration: scene by scene, its phrases + a tail pause; silent scenes get their own pause
const PAD: Record<string, number> = { open: 3.5, end: 6 };
const parts: string[] = []; const scenes: Record<string, [number, number]> = {}; let t = 0, n = 0;
const silence = (sec: number) => { const f = path.join(dir, `sil${n++}.wav`); execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `anullsrc=r=44100:cl=mono`, "-t", sec.toFixed(2), f]); parts.push(f); t += sec; };
for (const [i, sc] of SCENES.entries()) {
  const mine = phrases.filter((_, pi) => owner[pi] === i);
  const s0 = t;
  if (!mine.length) silence(PAD[sc.id] ?? Math.max(2.2, sc.sec * 0.7));
  else {
    silence(0.35);
    for (const p of mine) {
      const f = path.join(dir, `ph${n++}.wav`);
      execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(Math.max(0, p.s - 0.04)), "-to", String(p.e + 0.08), "-i", inp, "-ac", "1", "-ar", "44100", f]);
      parts.push(f); t += Number(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${f}"`));
      silence(0.45);
    }
    silence(0.5); // let the picture breathe before the cut
  }
  scenes[sc.id] = [+s0.toFixed(2), +t.toFixed(2)];
}
const list = path.join(dir, "list.txt");
writeFileSync(list, parts.map((f) => `file '${f}'`).join("\n"));
const outMp3 = path.join(process.cwd(), `public/film3/audio/narration-${lang}.mp3`);
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-af", "loudnorm=I=-16:TP=-1.5", "-c:a", "libmp3lame", "-b:a", "96k", outMp3]);
const total = Number(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${outMp3}"`));
writeFileSync(outMp3.replace(/\.mp3$/, ".json"), JSON.stringify({ file: `/film3/audio/narration-${lang}.mp3`, duration: +total.toFixed(2), source: path.basename(inp), asr: "muse-voice-transcribe-1.0", scenes }, null, 1));
for (const [i, p] of phrases.entries()) console.log(SCENES[owner[i]].id.padEnd(8), p.text);
console.log("total", total.toFixed(1), "s");
