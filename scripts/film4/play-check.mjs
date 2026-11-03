// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: stutter check of the film: open the page in a visible system Chrome (GPU, no background throttling), press Play, count long frames, video frames shown and seeks per scene
// @created: 2026-11-03
// @updated: 2026-11-04 claude-code — Chrome muted (--mute-audio): the page still plays its audio, nothing comes out of the speakers
// usage: node scripts/film4/play-check.mjs <url> [seconds] [scroll]   ("scroll" = steady wheel scroll instead of Play)
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import fs from "node:fs";
const { chromium } = createRequire(path.join(os.homedir(), "node_modules", "x.js"))("playwright");
const [url, secs = "40", mode = "play"] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9341, profile = path.join(os.tmpdir(), "hb-play-check");
fs.rmSync(profile, { recursive: true, force: true });
const proc = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, "--window-size=1600,987", "--no-first-run", "--no-default-browser-check",
  "--autoplay-policy=no-user-gesture-required", "--mute-audio", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling", "--disable-features=CalculateNativeWinOcclusion,Translate", "about:blank",
], { stdio: "ignore", env: { ...process.env, AGENT_ID: "claude-code", AGENT_PROJECT: "hanbridge-inspector" } });
for (let i = 0; i < 60; i++) { try { await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch { await sleep(500); } }
const cb = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const ctx = cb.contexts()[0];
const page = await ctx.newPage();
for (const p of ctx.pages()) if (p !== page) await p.close().catch(() => {});
await page.setViewportSize({ width: 1600, height: 900 });
await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
await sleep(2500);
await page.evaluate(() => {
  const st = (window.__pc = { long: [], seeks: {}, shown: {}, fr: 0, gaps: {} });
  const scene = () => document.querySelector('[data-testid="film4"]')?.dataset.scene ?? "?";
  let pp = performance.now();
  const g = (n) => { st.fr++; const d = n - pp; if (d > 50) st.long.push([scene(), Math.round(d)]); pp = n; requestAnimationFrame(g); };
  requestAnimationFrame(g);
  const hook = (v) => {
    if (v.__pc) return; v.__pc = 1;
    v.addEventListener("seeking", () => { const s = scene(); st.seeks[s] = (st.seeks[s] ?? 0) + 1; });
    let last = 0;
    const cbf = (now) => { const k = v.currentSrc.split("/").pop(); st.shown[k] = (st.shown[k] ?? 0) + 1; if (last && now - last > 150) (st.gaps[k] ??= []).push(Math.round(now - last)); last = now; v.requestVideoFrameCallback(cbf); };
    v.requestVideoFrameCallback(cbf);
  };
  setInterval(() => document.querySelectorAll("video").forEach(hook), 100);
});
if (mode === "scroll") {
  await page.mouse.move(800, 450);
  const t0 = Date.now();
  while (Date.now() - t0 < +secs * 1000) { await page.mouse.wheel(0, 18); await sleep(16); }
} else {
  await page.getByRole("button", { name: /play the film|смотреть фильм/i }).first().click();
  await sleep(+secs * 1000);
}
const r = await page.evaluate(() => ({ ...window.__pc, scene: document.querySelector('[data-testid="film4"]')?.dataset.scene }));
const longBy = {}; for (const [s, d] of r.long) (longBy[s] ??= []).push(d);
console.log(JSON.stringify({ url, mode, secs: +secs, rafFrames: r.fr, endScene: r.scene, longFrames: r.long.length, longBy, seeks: r.seeks, videoFramesShown: r.shown, videoGaps: r.gaps }, null, 1));
await cb.close().catch(() => {}); proc.kill("SIGTERM");
