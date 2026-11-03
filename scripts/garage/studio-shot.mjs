// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Screenshots of the garage studio (/garage/:carId) in a visible system Chrome with GPU: assembled, a close-up, taken apart
// @created: 2026-11-03
// usage: node scripts/garage/studio-shot.mjs <baseUrl> <outDir> <carId…>
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
const { chromium } = createRequire(path.join(os.homedir(), "node_modules", "x.js"))("playwright");
const [base, out, ...cars] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9343, profile = path.join(os.tmpdir(), "hb-studio-shot");
fs.rmSync(profile, { recursive: true, force: true });
const proc = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, "--window-size=1600,987", "--no-first-run", "--no-default-browser-check", "--hide-scrollbars",
  "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling", "about:blank",
], { stdio: "ignore", env: { ...process.env, AGENT_ID: "claude-code", AGENT_PROJECT: "hanbridge-inspector" } });
for (let i = 0; i < 60; i++) { try { await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch { await sleep(500); } }
const cb = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const ctx = cb.contexts()[0];
const page = await ctx.newPage();
for (const p of ctx.pages()) if (p !== page) await p.close().catch(() => {});
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 860, deviceScaleFactor: 2, mobile: false });
const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
for (const id of cars) {
  await page.goto(`${base}/garage/${id}`, { waitUntil: "networkidle", timeout: 120000 });
  await sleep(9000);
  await page.mouse.move(1430, 850);
  await page.screenshot({ path: path.join(out, `${id}-1.png`) });
  // close-up: turn the camera a little and zoom in with the wheel over the car
  await page.mouse.move(720, 430); await page.mouse.wheel(0, -500); await sleep(2500);
  await page.screenshot({ path: path.join(out, `${id}-2-close.png`) });
  const btn = page.getByRole("button", { name: /take apart|разобрать/i }).first();
  if (await btn.count()) { await btn.click(); await sleep(3500); await page.mouse.move(1430, 850); await page.screenshot({ path: path.join(out, `${id}-3-apart.png`) }); }
  console.log("shot", id);
}
console.log(errs.length ? "page errors: " + errs.join(" | ").slice(0, 500) : "no page errors");
await cb.close().catch(() => {}); proc.kill("SIGTERM");
