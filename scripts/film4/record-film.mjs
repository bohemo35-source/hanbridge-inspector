// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: record the film from the site to mp4 with its sound: CDP screencast of a visible Chrome (no background throttling) after pressing Play; the page logs when narration/drums start and stop, the same mix (voice 0.8, drums 0.35, fades) is rebuilt with ffmpeg and muxed; outputs a 1080p and a small 720p file
// @created: 2026-11-03
// usage: node scripts/film4/record-film.mjs <url> <outBase> [W=1920] [H=1080]   → <outBase>-1080p.mp4, <outBase>-720p.mp4
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { spawn, spawnSync, execFileSync } from "node:child_process";
const { chromium } = createRequire(path.join(os.homedir(), "node_modules", "x.js"))("playwright");
const [url, outBase, W = "1920", H = "1080"] = process.argv.slice(2);
if (!url || !outBase) { console.error("usage: record-film.mjs <url> <outBase>"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9342, profile = path.join(os.tmpdir(), "hb-record-film");
fs.rmSync(profile, { recursive: true, force: true });
const proc = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, "--window-size=1600,987", "--no-first-run", "--no-default-browser-check", "--hide-scrollbars",
  "--autoplay-policy=no-user-gesture-required", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling", "--disable-features=CalculateNativeWinOcclusion,Translate", "about:blank",
], { stdio: "ignore", env: { ...process.env, AGENT_ID: "claude-code", AGENT_PROJECT: "hanbridge-inspector" } });
for (let i = 0; i < 60; i++) { try { await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch { await sleep(500); } }
const cb = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const ctx = cb.contexts()[0];
// every audio element the film creates reports its playing / pause / ended moments in wall-clock ms (same clock as screencast timestamps)
await ctx.addInitScript(() => {
  const log = (window.__aud = []);
  const Orig = window.Audio;
  window.Audio = function (src) {
    const a = new Orig(src);
    for (const ev of ["playing", "pause", "ended"]) a.addEventListener(ev, () => log.push({ ev, src: a.src.split("/").pop(), wall: Date.now(), pos: a.currentTime, vol: a.volume }));
    const pause = a.pause.bind(a);
    a.pause = () => { log.push({ ev: "pause-call", src: a.src.split("/").pop(), wall: Date.now(), stack: new Error().stack?.split("\n").slice(1, 6).join(" | ") }); pause(); };
    return a;
  };
  window.Audio.prototype = Orig.prototype;
});
const page = await ctx.newPage();
for (const p of ctx.pages()) if (p !== page) await p.close().catch(() => {});
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setDeviceMetricsOverride", { width: +W, height: +H, deviceScaleFactor: 1, mobile: false });
await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(4000);

const dir = path.join(os.tmpdir(), "hb-record-film-frames"); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const frames = [];
cdp.on("Page.screencastFrame", (f) => {
  const file = path.join(dir, `${String(frames.length).padStart(5, "0")}.jpg`);
  fs.writeFileSync(file, Buffer.from(f.data, "base64"));
  frames.push({ file, t: f.metadata.timestamp });
  cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: +W, maxHeight: +H, everyNthFrame: 1 });
await sleep(1500);
const btn = page.getByRole("button", { name: /play the film|смотреть фильм/i }).first();
const box = await btn.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down(); await page.mouse.up();
await page.mouse.move(+W - 2, +H - 2); // park the pointer (no hover states in frame)
console.log("play pressed");
// wait for the narration to end (the film stops itself), then keep the end card for a moment
for (let i = 0; i < +(process.env.MAX_SEC ?? 400); i++) {
  await sleep(1000);
  // the film stops itself when the voice ends or the scroll reaches the end card (then the voice is paused)
  const done = await page.evaluate(() => window.__aud.some((x) => (x.ev === "ended" || x.ev === "pause") && /narration/.test(x.src)));
  if (done) break;
}
await sleep(4000);
await cdp.send("Page.stopScreencast");
await sleep(400);
const aud = await page.evaluate(() => window.__aud);
await cb.close().catch(() => {}); proc.kill("SIGTERM");

// frames arrive unevenly: concat with real durations → 30 fps CFR
const t0 = frames[0].t, span = frames.at(-1).t - t0;
const list = frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? f.t + 1 / 30) - f.t).toFixed(4)}`).join("\n") + `\nfile '${frames.at(-1).file}'\n`;
fs.writeFileSync(path.join(dir, "list.txt"), list);
const rel = (wall) => wall / 1000 - t0;
const narrOn = aud.find((x) => x.ev === "playing" && /narration/.test(x.src));
const narrEnd = aud.find((x) => (x.ev === "ended" || x.ev === "pause") && /narration/.test(x.src));
const drumOn = aud.find((x) => x.ev === "playing" && /drums/.test(x.src));
if (!narrOn || !drumOn) throw new Error("no audio events: " + JSON.stringify(aud));
const narrFile = path.join("public", "film3", "audio", narrOn.src), drumFile = path.join("public", "film3", "audio", "drums.mp3");
const nAt = rel(narrOn.wall), dAt = rel(drumOn.wall), endAt = narrEnd ? rel(narrEnd.wall) : span;
// the player: drums fade 0 → 0.35 over 1.5 s, voice 0.8; when the voice ends the drums fade out over 0.7 s
const fc = [
  `[0:a]atrim=start=${narrOn.pos.toFixed(3)}:end=${(narrOn.pos + endAt - nAt).toFixed(3)},asetpts=PTS-STARTPTS,volume=0.8,adelay=${Math.round(nAt * 1000)}:all=1[v]`,
  `[1:a]aloop=loop=-1:size=2e9,atrim=0:${(endAt - dAt + 0.8).toFixed(3)},asetpts=PTS-STARTPTS,volume=0.35,afade=t=in:d=1.5,afade=t=out:st=${(endAt - dAt).toFixed(3)}:d=0.7,adelay=${Math.round(dAt * 1000)}:all=1[d]`,
  `[v][d]amix=inputs=2:normalize=0:duration=longest,apad,atrim=0:${span.toFixed(3)}[a]`,
].join(";");
const mix = path.join(dir, "mix.wav");
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", narrFile, "-i", drumFile, "-filter_complex", fc, "-map", "[a]", "-ar", "48000", "-ac", "2", mix]);
// bring the whole mix to about −16 LUFS (relative levels untouched)
const lufsOut = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", mix, "-af", "ebur128", "-f", "null", "-"]).stderr.toString();
const I = Number((lufsOut.match(/I:\s+(-?[\d.]+) LUFS/g) ?? []).at(-1)?.match(/-?[\d.]+/)[0] ?? -16);
const gain = (-16 - I).toFixed(2);
const enc = (h, crf, ab, out) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"), "-i", mix,
  "-vf", `fps=30,scale=-2:${h}:flags=lanczos,format=yuv420p`, "-af", `volume=${gain}dB,alimiter=limit=0.95`, "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-c:a", "aac", "-b:a", ab, "-movflags", "+faststart", "-shortest", out]);
enc(1080, 20, "160k", `${outBase}-1080p.mp4`);
enc(720, 27, "96k", `${outBase}-720p.mp4`);
fs.writeFileSync(`${outBase}.log.json`, JSON.stringify({ url, frames: frames.length, span: +span.toFixed(2), fpsAvg: +(frames.length / span).toFixed(1), narration: { file: narrOn.src, at: +nAt.toFixed(3), from: narrOn.pos, end: +endAt.toFixed(3) }, drumsAt: +dAt.toFixed(3), mixLUFS: I, gainDb: +gain, audioEvents: aud }, null, 1));
console.log("OK", `${outBase}-1080p.mp4`, `${outBase}-720p.mp4`, "frames", frames.length, "span", span.toFixed(1), "s, mix", I, "LUFS → gain", gain, "dB");
