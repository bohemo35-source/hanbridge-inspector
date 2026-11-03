// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: e2e of /inspect/new in a real browser: fills the form, adds photos and a video (browser → Vercel Blob client upload), presses Inspect, waits for the report link
// @created: 2026-11-03
// @updated: 2026-11-03 claude-code — prints the upload_video step and checks with HEAD that the video is gone from Blob after the run
// usage: node scripts/e2e/upload-page.mjs <baseUrl> <make> <model> <year> <body> <video|-> <photo…>
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
const { chromium } = createRequire(path.join(os.homedir(), "node_modules", "x.js"))("playwright");
const [base, make, model, year, body, video, ...photos] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: process.env.HEADLESS === "1" });
const page = await browser.newPage();
const net = [];
let videoUrl = null; // what the page sent to /api/upload-run (multipart field videoUrl)
page.on("request", (r) => { if (r.url().includes("/api/upload-run")) videoUrl = (r.postDataBuffer()?.toString("latin1") ?? "").match(/https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/uploads\/[^\s\r"]+/)?.[0] ?? null; });
page.on("response", (r) => { const u = r.url(); if (/blob-upload|upload-run|vercel-storage|blob\.vercel/.test(u)) net.push(`${r.request().method()} ${r.status()} ${u.replace(/\?.*/, "").slice(0, 110)}`); });
await page.goto(`${base}/inspect/new`, { waitUntil: "networkidle" });
await page.fill('input[name="make"]', make); await page.fill('input[name="model"]', model); await page.fill('input[name="year"]', year);
await page.selectOption('select[name="bodyType"]', body);
await page.locator('input[type="file"][accept="image/*"]').setInputFiles(photos);
if (video !== "-") await page.locator('input[name="video"]').setInputFiles(video);
const t0 = Date.now();
await page.getByRole("button", { name: /inspect|осмотреть/i }).click();
let last = "";
for (let i = 0; i < 330; i++) {
  await page.waitForTimeout(1000);
  const st = await page.evaluate(() => ({ btn: document.querySelector("form button")?.textContent, err: [...document.querySelectorAll("p")].find((p) => p.style.color === "rgb(229, 84, 75)")?.textContent, steps: [...document.querySelectorAll("main > div > div b")].map((b) => b.textContent), link: document.querySelector('a[href^="/r/"]')?.getAttribute("href") }));
  const line = `${st.btn} | steps=${st.steps.length}${st.err ? " | ERROR " + st.err : ""}`;
  if (line !== last) { console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`, line); last = line; }
  if (st.link || st.err) {
    console.log("steps:", st.steps.join(" · ")); console.log("report:", st.link ?? "none");
    console.log("upload_video:", await page.evaluate(() => [...document.querySelectorAll("main > div > div")].find((d) => d.textContent?.includes("upload_video"))?.textContent?.slice(0, 300) ?? "no step"));
    break;
  }
}
console.log(net.join("\n"));
if (videoUrl) { const h = await fetch(videoUrl, { method: "HEAD" }); console.log("video in Blob after the run:", h.status, h.status === 404 ? "(deleted)" : "(STILL THERE)", videoUrl.replace(/uploads\/.*/, "uploads/…")); }
await browser.close();
