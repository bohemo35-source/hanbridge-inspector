// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: per-scene stutter profile of the whole film in a visible system Chrome (GPU): Play mode or a steady wheel scroll; per scene — long rAF frames,
//           freezes of the current clip (requestVideoFrameCallback gaps), time to the clip's first frame, seek time, `waiting` events → JSON + table
// @created: 2026-11-03
// @updated: 2026-11-03 claude-code — blackMs / posterMs (phones); BROWSER=webkit = iPhone 14 in WebKit, MBPS throttles mp4 responses, noFrameMs; the clip layer is the video's parent since 03.11
// @updated: 2026-11-03 claude-code — frozenMs: a visible clip standing still in Play mode
// usage: [BROWSER=webkit] [MBPS=8] node scripts/film4/stutter-scenes.mjs <url> <play|scroll> <out.json> [scrollSeconds=150]
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
const pw = createRequire(path.join(os.homedir(), "node_modules", "x.js"))("playwright");
const [url, mode = "play", out = "stutter.json", scrollSec = "150"] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const webkit = process.env.BROWSER === "webkit";
let ctx, closeAll;
if (webkit) {
  // iPhone: Playwright WebKit with the iPhone 14 profile (390×844 @3, touch, mobile UA)
  const b = await pw.webkit.launch();
  ctx = await b.newContext({ ...pw.devices["iPhone 14"] });
  closeAll = () => b.close();
} else {
  const port = 9344, profile = path.join(os.tmpdir(), "hb-stutter-scenes");
  fs.rmSync(profile, { recursive: true, force: true });
  const proc = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
    `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, "--window-size=1600,987", "--no-first-run", "--no-default-browser-check",
    "--autoplay-policy=no-user-gesture-required", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
    "--disable-background-timer-throttling", "--disable-features=CalculateNativeWinOcclusion,Translate", "about:blank",
  ], { stdio: "ignore", env: { ...process.env, AGENT_ID: "claude-code", AGENT_PROJECT: "hanbridge-inspector" } });
  for (let i = 0; i < 60; i++) { try { await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch { await sleep(500); } }
  const cb = await pw.chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  ctx = cb.contexts()[0];
  closeAll = async () => { await cb.close().catch(() => {}); proc.kill("SIGTERM"); };
}
// MBPS: slow every mp4 response down to that many megabits per second (a phone on mobile data); range responses keep their status
const mbps = Number(process.env.MBPS ?? 0);
if (mbps) await ctx.route(/\.(mp4|mp3)(\?|$)/, async (route) => {
  const resp = await route.fetch(); const body = await resp.body();
  await sleep((body.length * 8) / (mbps * 1e6) * 1000);
  await route.fulfill({ response: resp, body });
});
await ctx.addInitScript(() => {
  const S = (window.__ss = { scenes: {}, order: [] });
  const scene = () => document.querySelector('[data-testid="film4"]')?.dataset.scene ?? "?";
  const sc = (id) => (S.scenes[id] ??= { ms: 0, raf: 0, long50: 0, long100: 0, maxRaf: 0, frozenMs: 0, blackMs: 0, posterMs: 0, noFrameMs: 0, vframes: 0, freezes: 0, maxFreeze: 0, firstFrameMs: null, seeks: 0, seekMs: 0, maxSeek: 0, waiting: 0, enteredAt: 0, clip: null });
  let cur = null, pp = 0;
  const raf = (n) => {
    const id = scene();
    if (id !== cur) { cur = id; const s = sc(id); if (!S.order.includes(id)) S.order.push(id); s.enteredAt = n; }
    if (pp) {
      const d = n - pp, s = sc(cur); s.ms += d; s.raf++; if (d > 50) s.long50++; if (d > 100) s.long100++; s.maxRaf = Math.max(s.maxRaf, d);
      // a clip on screen that does not move (Play mode: the incoming clip parked on frame 0 during the transition)
      const lay = (v) => (v.closest("[data-clip]") ?? v);
      if (S.play && [...document.querySelectorAll("video")].some((v) => lay(v).style.visibility !== "hidden" && Number(getComputedStyle(lay(v)).opacity) > 0.05 && v.paused && !v.ended)) s.frozenMs += d;
      // black: a clip layer on screen with neither a decoded frame (video shown) nor a loaded poster
      const blk = [...document.querySelectorAll("[data-clip]")].some((L) => L.style.visibility !== "hidden" && Number(getComputedStyle(L).opacity) > 0.3 && !(L.querySelector("img")?.complete && L.querySelector("img")?.naturalWidth) && Number(L.querySelector("video")?.style.opacity ?? 1) < 0.5);
      if (blk) s.blackMs += d;
      const nof = [...document.querySelectorAll("video")].some((v) => { const L = lay(v); return L.style.visibility !== "hidden" && Number(getComputedStyle(L).opacity) > 0.3 && v.readyState < 2; });
      if (nof) s.noFrameMs += d;
      const post = [...document.querySelectorAll("[data-clip]")].some((L) => L.style.visibility !== "hidden" && Number(getComputedStyle(L).opacity) > 0.3 && Number(L.querySelector("video")?.style.opacity ?? 1) < 0.5);
      if (post) s.posterMs += d;
    }
    pp = n; requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
  const hook = (v) => {
    if (v.__ss) return; v.__ss = 1; let last = 0, seekT = 0, lastPlaying = false;
    v.addEventListener("seeking", () => { seekT = performance.now(); });
    v.addEventListener("seeked", () => { if (!seekT) return; const d = performance.now() - seekT, s = sc(scene()); s.seeks++; s.seekMs += d; s.maxSeek = Math.max(s.maxSeek, d); seekT = 0; });
    v.addEventListener("waiting", () => { sc(scene()).waiting++; });
    const f = (now) => {
      const clip = (v.currentSrc || "").split("/").pop();
      const id = scene(), s = sc(id);
      // frames of the clip that belongs to the current scene (its <video> is visible and in front)
      const L = v.closest("[data-clip]") ?? v; // since 03.11 the clip sits in a layer with its poster
      if (L.style.visibility !== "hidden" && Number(L.style.zIndex || 0) >= 1) {
        s.clip ??= clip; s.vframes++;
        if (s.firstFrameMs === null && s.enteredAt) s.firstFrameMs = Math.round(now - s.enteredAt);
        // a freeze: the clip was playing at the previous frame and still is, yet no frame for >100 ms (pauses and preload waits are not freezes)
        if (last && lastPlaying && !v.paused && now - last > 100) { s.freezes++; s.maxFreeze = Math.max(s.maxFreeze, now - last); (s.gaps ??= []).push(Math.round(now - last)); }
      }
      last = now; lastPlaying = !v.paused; v.requestVideoFrameCallback(f);
    };
    v.requestVideoFrameCallback(f);
  };
  setInterval(() => document.querySelectorAll("video").forEach(hook), 50);
});
const page = await ctx.newPage();
for (const p of ctx.pages()) if (p !== page) await p.close().catch(() => {});
if (!webkit) await page.setViewportSize({ width: 1600, height: 900 });
await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
await sleep(2500);
const t0 = Date.now();
if (mode === "scroll") {
  // one wheel step per frame, sized so the whole film takes `scrollSec`
  // steady scroll driven by the page's own frames, so the whole film takes `scrollSec`
  await page.evaluate((sec) => new Promise((done) => {
    const el = document.querySelector('[data-testid="film4"]'); const y0 = el.getBoundingClientRect().top + scrollY, total = el.getBoundingClientRect().height - innerHeight;
    const t0 = performance.now(); const f = (n) => { const k = Math.min(1, (n - t0) / (sec * 1000)); scrollTo(0, y0 + k * total); if (k < 1) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f);
  }), +scrollSec);
  await sleep(1500);
} else {
  await page.evaluate(() => { window.__ss.play = true; });
  const y0 = await page.evaluate(() => scrollY);
  await page.getByRole("button", { name: /play the film|смотреть фильм/i }).first().click();
  const tc = Date.now(); let startMs = null;
  for (let i = 0; i < 200; i++) { if ((await page.evaluate(() => scrollY)) > y0 + 2) { startMs = Date.now() - tc; break; } await sleep(25); }
  console.log("play start: picture moved after", startMs, "ms");
  await page.evaluate((ms) => { window.__ss.startMs = ms; }, startMs);
  if (!webkit) await page.mouse.move(1590, 890);
  for (let i = 0; i < 260; i++) { await sleep(1000); const end = await page.evaluate(() => document.querySelector('[data-testid="film4"]')?.dataset.scene); if (i > 20 && /end/.test(end ?? "")) { await sleep(3000); break; } }
}
const r = await page.evaluate(() => window.__ss);
await closeAll();
const rows = r.order.map((id) => { const s = r.scenes[id]; return { id, clip: s.clip, sec: +(s.ms / 1000).toFixed(1), frozenMs: Math.round(s.frozenMs), blackMs: Math.round(s.blackMs), posterMs: Math.round(s.posterMs), noFrameMs: Math.round(s.noFrameMs), fps: s.ms ? +(s.raf / (s.ms / 1000)).toFixed(0) : 0, long50: s.long50, long100: s.long100, maxRaf: Math.round(s.maxRaf), vframes: s.vframes, freezes: s.freezes, maxFreeze: Math.round(s.maxFreeze), firstFrameMs: s.firstFrameMs, seeks: s.seeks, avgSeek: s.seeks ? Math.round(s.seekMs / s.seeks) : 0, maxSeek: Math.round(s.maxSeek), waiting: s.waiting, gaps: s.gaps ?? [] }; });
const tot = rows.reduce((a, x) => ({ long50: a.long50 + x.long50, long100: a.long100 + x.long100, freezes: a.freezes + x.freezes, waiting: a.waiting + x.waiting, frozenMs: a.frozenMs + x.frozenMs, blackMs: a.blackMs + x.blackMs, posterMs: a.posterMs + x.posterMs, noFrameMs: a.noFrameMs + x.noFrameMs, seeks: a.seeks + x.seeks, maxSeek: Math.max(a.maxSeek, x.maxSeek) }), { long50: 0, long100: 0, freezes: 0, waiting: 0, frozenMs: 0, blackMs: 0, posterMs: 0, noFrameMs: 0, seeks: 0, maxSeek: 0 });
fs.writeFileSync(out, JSON.stringify({ url, mode, wallSec: (Date.now() - t0) / 1000, startMs: r.startMs ?? null, totals: tot, scenes: rows }, null, 1));
console.log(mode, url, "totals", JSON.stringify(tot));
for (const x of rows) console.log(`${x.id.padEnd(10)} ${String(x.clip ?? "-").padEnd(13)} ${String(x.sec).padStart(5)}s frozen=${String(x.frozenMs).padStart(5)}ms noFrame=${String(x.noFrameMs).padStart(5)}ms black=${String(x.blackMs).padStart(5)}ms fps=${String(x.fps).padStart(3)} long50=${x.long50} long100=${x.long100} maxRaf=${x.maxRaf} vfr=${x.vframes} freezes=${x.freezes} maxFreeze=${x.maxFreeze} first=${x.firstFrameMs} seeks=${x.seeks} avgSeek=${x.avgSeek} maxSeek=${x.maxSeek} waiting=${x.waiting}`);
