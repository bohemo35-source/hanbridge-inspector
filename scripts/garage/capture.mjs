// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Playwright screenshots of /lab/garage — beats 0-5, debug=parts, mobile, fallback
// @created: 2026-10-29
// @updated: 2026-10-30 claude-code (PREFIX/SUFFIX/OUT_DIR env for tz13 before/after rounds)
// Usage: npm run dev -- -p 3100  &&  node scripts/garage/capture.mjs [baseUrl] [onlyPrefix]
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  const req = createRequire(path.join(os.homedir(), "node_modules", "x.js"));
  ({ chromium } = req("playwright"));
}

const BASE = process.argv[2] ?? "http://localhost:3100";
const ONLY = process.argv[3] ?? "";
const OUT = process.env.OUT_DIR ? process.env.OUT_DIR.replace(/\/?$/, "/") : new URL("../../docs/reports/assets/", import.meta.url).pathname;
// PREFIX=tz13-garage SUFFIX=-before -> tz10b-beat0 becomes tz13-garage-beat0-before (default keeps tz10b names)
const PREFIX = process.env.PREFIX ?? "", SUFFIX = process.env.SUFFIX ?? "";
const nm = (n) => (PREFIX ? n.replace(/^tz10b-/, `${PREFIX}-`) + SUFFIX : n);
const errors = [];
let browser = null;
async function launch() {
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" }),
    // real GPU on the Mac (60 fps, Reflector + bloom render in time); software GL only for a custom CHROMIUM_PATH (CI/container)
    args: process.env.CHROMIUM_PATH ? ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--enable-gpu", "--use-angle=metal"],
  });
  return browser;
}

async function open(width, height, query, waitMs = 9000) {
  if (!browser || !browser.isConnected()) await launch();
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  await page.goto(`${BASE}/lab/garage${query}${process.env.QUERY ? `&${process.env.QUERY}` : ""}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(waitMs);
  return page;
}

async function shot(name, width, height, query) {
  if (ONLY && !name.includes(ONLY)) return;
  const page = await open(width, height, query);
  const host = page.locator("[data-testid='garage-canvas-host']");
  if (await host.count()) {
    console.log(name, "triangles:", await host.getAttribute("data-triangles"), "parts:", await host.getAttribute("data-parts"), "fps:", await host.getAttribute("data-fps"), "eco:", await host.getAttribute("data-eco"));
  }
  await page.screenshot({ path: `${OUT}${nm(name)}.png`, timeout: 150000 });
  console.log("saved", nm(name));
  await page.close();
  await browser.close().catch(() => undefined);
  browser = null; // fresh browser per shot: swiftshader + Reflector is heavy
}

for (let b = 0; b <= 5; b++) await shot(`tz10b-beat${b}`, 1440, 900, `?beat=${b}&lang=ru&eco=off`);
await shot("tz10b-debug-parts", 1440, 900, "?debug=parts&lang=ru&eco=off");
await shot("tz10b-mobile-beat2", 390, 844, "?beat=2&lang=ru&eco=off");
await shot("tz10b-mobile-beat3", 390, 844, "?beat=3&lang=ru&eco=off");

if (!ONLY || "tz10b-fallback".includes(ONLY)) {
  const page = await open(1280, 800, "?no3d=1&lang=ru", 3000);
  console.log("fallback cards:", await page.locator(".garage-fallback article").count());
  await page.screenshot({ path: `${OUT}tz10b-fallback.png`, timeout: 150000 });
  console.log("saved tz10b-fallback");
  await page.close();
}
console.log("page errors:", JSON.stringify(errors.slice(0, 10)));
if (browser) await browser.close().catch(() => undefined);
