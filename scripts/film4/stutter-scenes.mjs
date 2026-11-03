// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: per-scene stutter profile of the whole film in a visible system Chrome (GPU): Play mode or a steady wheel scroll; per scene — long rAF frames,
//           freezes of the current clip (requestVideoFrameCallback gaps), time to the clip's first frame, seek time, `waiting` events → JSON + table
// @created: 2026-11-03
// @updated: 2026-11-03 claude-code — frozenMs: a visible clip standing still in Play mode
// usage: node scripts/film4/stutter-scenes.mjs <url> <play|scroll> <out.json> [scrollSeconds=150]
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
const { chromium } = createRequire(path.join(os.homedir(), "node_modules", "x.js"))("playwright");
const [url, mode = "play", out = "stutter.json", scrollSec = "150"] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9344, profile = path.join(os.tmpdir(), "hb-stutter-scenes");
fs.rmSync(profile, { recursive: true, force: true });
const proc = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, "--window-size=1600,987", "--no-first-run", "--no-default-browser-check",
  "--autoplay-policy=no-user-gesture-required", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling", "--disable-features=CalculateNativeWinOcclusion,Translate", "about:blank",
], { stdio: "ignore", env: { ...process.env, AGENT_ID: "claude-code", AGENT_PROJECT: "hanbridge-inspector" } });
for (let i = 0; i < 60; i++) { try { await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch { await sleep(500); } }
const cb = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const ctx = cb.contexts()[0];
await ctx.addInitScript(() => {
  const S = (window.__ss = { scenes: {}, order: [] });
  const scene = () => document.querySelector('[data-testid="film4"]')?.dataset.scene ?? "?";
  const sc = (id) => (S.scenes[id] ??= { ms: 0, raf: 0, long50: 0, long100: 0, maxRaf: 0, frozenMs: 0, vframes: 0, freezes: 0, maxFreeze: 0, firstFrameMs: null, seeks: 0, seekMs: 0, maxSeek: 0, waiting: 0, enteredAt: 0, clip: null });
  let cur = null, pp = 0;
  const raf = (n) => {
    const id = scene();
    if (id !== cur) { cur = id; const s = sc(id); if (!S.order.includes(id)) S.order.push(id); s.enteredAt = n; }
    if (pp) {
      const d = n - pp, s = sc(cur); s.ms += d; s.raf++; if (d > 50) s.long50++; if (d > 100) s.long100++; s.maxRaf = Math.max(s.maxRaf, d);
      // a clip on screen that does not move (Play mode: the incoming clip parked on frame 0 during the transition)
      if (S.play && [...document.querySelectorAll("video")].some((v) => v.style.visibility !== "hidden" && Number(getComputedStyle(v).opacity) > 0.05 && v.paused && !v.ended)) s.frozenMs += d;
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
      if (v.style.visibility !== "hidden" && Number(v.style.zIndex || 0) >= 1) {
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
await page.setViewportSize({ width: 1600, height: 900 });
await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
await sleep(2500);
const t0 = Date.now();
if (mode === "scroll") {
  // one wheel step per frame, sized so the whole film takes `scrollSec`
  const total = await page.evaluate(() => { const el = document.querySelector('[data-testid="film4"]'); return el.getBoundingClientRect().height - innerHeight; });
  const steps = +scrollSec * 60, dy = total / steps;
  await page.mouse.move(800, 450);
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy); await sleep(16); }
  await sleep(1500);
} else {
  await page.evaluate(() => { window.__ss.play = true; });
  await page.getByRole("button", { name: /play the film|смотреть фильм/i }).first().click();
  await page.mouse.move(1590, 890);
  for (let i = 0; i < 260; i++) { await sleep(1000); const end = await page.evaluate(() => document.querySelector('[data-testid="film4"]')?.dataset.scene); if (i > 20 && /end/.test(end ?? "")) { await sleep(3000); break; } }
}
const r = await page.evaluate(() => window.__ss);
await cb.close().catch(() => {}); proc.kill("SIGTERM");
const rows = r.order.map((id) => { const s = r.scenes[id]; return { id, clip: s.clip, sec: +(s.ms / 1000).toFixed(1), frozenMs: Math.round(s.frozenMs), fps: s.ms ? +(s.raf / (s.ms / 1000)).toFixed(0) : 0, long50: s.long50, long100: s.long100, maxRaf: Math.round(s.maxRaf), vframes: s.vframes, freezes: s.freezes, maxFreeze: Math.round(s.maxFreeze), firstFrameMs: s.firstFrameMs, seeks: s.seeks, avgSeek: s.seeks ? Math.round(s.seekMs / s.seeks) : 0, maxSeek: Math.round(s.maxSeek), waiting: s.waiting, gaps: s.gaps ?? [] }; });
const tot = rows.reduce((a, x) => ({ long50: a.long50 + x.long50, long100: a.long100 + x.long100, freezes: a.freezes + x.freezes, waiting: a.waiting + x.waiting, frozenMs: a.frozenMs + x.frozenMs, seeks: a.seeks + x.seeks, maxSeek: Math.max(a.maxSeek, x.maxSeek) }), { long50: 0, long100: 0, freezes: 0, waiting: 0, frozenMs: 0, seeks: 0, maxSeek: 0 });
fs.writeFileSync(out, JSON.stringify({ url, mode, wallSec: (Date.now() - t0) / 1000, totals: tot, scenes: rows }, null, 1));
console.log(mode, url, "totals", JSON.stringify(tot));
for (const x of rows) console.log(`${x.id.padEnd(10)} ${String(x.clip ?? "-").padEnd(13)} ${String(x.sec).padStart(5)}s frozen=${String(x.frozenMs).padStart(5)}ms fps=${String(x.fps).padStart(3)} long50=${x.long50} long100=${x.long100} maxRaf=${x.maxRaf} vfr=${x.vframes} freezes=${x.freezes} maxFreeze=${x.maxFreeze} first=${x.firstFrameMs} seeks=${x.seeks} avgSeek=${x.avgSeek} maxSeek=${x.maxSeek} waiting=${x.waiting}`);
