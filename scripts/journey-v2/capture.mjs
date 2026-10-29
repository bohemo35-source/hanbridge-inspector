// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Playwright screenshots of / (journey v2): middle of every 3D block and bridge, mobile, fallback; FPS from data-fps
// @created: 2026-10-29
// Usage: npm run dev -- -p 3100  &&  node scripts/journey-v2/capture.mjs [baseUrl]
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

let chromium;
try { ({ chromium } = await import("playwright")); } catch {
  const req = createRequire(path.join(os.homedir(), "node_modules", "x.js"));
  ({ chromium } = req("playwright"));
}
const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = new URL("../../docs/reports/assets/", import.meta.url).pathname;
const errors = [];
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" }),
  args: process.env.CHROMIUM_PATH ? ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--enable-gpu", "--use-angle=metal"],
});

async function midShot(page, name, blockId) {
  await page.evaluate((id) => {
    const el = document.querySelector(`[data-journey-block="${id}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const y = window.scrollY + r.top + Math.max(0, (r.height - window.innerHeight) / 2);
    window.scrollTo(0, y);
  }, blockId);
  await page.waitForTimeout(7000);
  const info = await page.evaluate((id) => {
    const el = document.querySelector(`[data-journey-block="${id}"]`);
    const host = el?.querySelector("[data-testid^='scene-']");
    return { fps: host?.getAttribute("data-fps") ?? null, triangles: host?.getAttribute("data-triangles") ?? null, canvases: document.querySelectorAll("canvas").length };
  }, blockId);
  console.log(name, JSON.stringify(info));
  await page.screenshot({ path: `${OUT}${name}.png`, timeout: 150000 });
  console.log("saved", name);
}

const ONLY = process.env.ONLY ?? "";
const shots = [
  ["tz12-01-seoul", "seoul"], ["tz12-02-sourcing", "bridge-sourcing"], ["tz12-03-garage", "garage"],
  ["tz12-04-documents", "bridge-documents"], ["tz12-05-port", "port"], ["tz12-06-sea", "bridge-sea"],
  ["tz12-07-vladivostok", "vladivostok"], ["tz12-08-customs", "bridge-customs"], ["tz12-09-road", "road"],
  ["tz12-10-handover", "handover"], ["tz12-11-reviews", "reviews"], ["tz12-12-finale", "finale"],
];
for (const [name, id] of shots) {
  if (ONLY && !name.includes(ONLY)) continue;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  await page.goto(`${BASE}/?lang=ru`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  if (name === "tz12-01-seoul") console.log("pageHeight:", await page.evaluate(() => document.documentElement.scrollHeight), "vh:", await page.evaluate(() => document.documentElement.scrollHeight / window.innerHeight * 100));
  await midShot(page, name, id);
  await page.close().catch(() => undefined);
}

if (process.env.SKIP_EXTRA) { console.log("page errors:", JSON.stringify(errors.slice(0, 10))); await browser.close(); process.exit(0); }
// debug plate overlays (grid + path) for the 4 plates
for (const id of ["seoul", "port", "vladivostok", "handover"]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/?lang=ru&debug=plate`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.evaluate((bid) => { const el = document.querySelector(`[data-journey-block="${bid}"]`); if (!el) return; const r = el.getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top + Math.max(0, (r.height - window.innerHeight) / 2)); }, id);
  await page.waitForTimeout(7000);
  await page.screenshot({ path: `${OUT}tz12-debug-plate-${id}.png`, timeout: 150000 });
  console.log("saved", `tz12-debug-plate-${id}`);
  await page.close().catch(() => undefined);
}
// port end: car entering the hold
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/?lang=ru`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { const el = document.querySelector(`[data-journey-block="port"]`); if (!el) return; const r = el.getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top + Math.max(0, (r.height - window.innerHeight) * 0.92)); });
  await page.waitForTimeout(7000);
  await page.screenshot({ path: `${OUT}tz12-05b-port-end.png`, timeout: 150000 });
  console.log("saved tz12-05b-port-end");
  await page.close().catch(() => undefined);
}
const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
mob.on("pageerror", (e) => errors.push("mobile: " + e.message));
await mob.goto(`${BASE}/?lang=ru`, { waitUntil: "networkidle" });
await mob.waitForTimeout(3000);
for (const [name, id] of [["tz12-mobile-seoul", "seoul"], ["tz12-mobile-port", "port"], ["tz12-mobile-road", "road"]]) await midShot(mob, name, id);
await mob.close();

const fb = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await fb.goto(`${BASE}/?no3d=1&lang=ru`, { waitUntil: "networkidle" });
await fb.waitForTimeout(2500);
console.log("fallback blocks:", await fb.locator("[data-fallback-block]").count());
await fb.screenshot({ path: `${OUT}tz12-fallback.png`, timeout: 150000 });
console.log("saved tz12-fallback");
await fb.close();
console.log("page errors:", JSON.stringify(errors.slice(0, 10)));
await browser.close();
