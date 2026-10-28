// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: TZ-05 screenshots: /cars, /r/:id MINI (desktop+mobile), /inspect live-trace shell
// @created: 2026-10-29
import { chromium } from "playwright";
const BASE = process.argv[2] ?? "http://localhost:3100";
const REPORT = process.argv[3] ?? "r-mini-cooper-s-mvspia04";
const OUT = new URL("../../docs/reports/assets/", import.meta.url).pathname;
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const errors = [];
async function shot(name, url, w, h, wait = 5000) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${OUT}${name}.png`, timeout: 150000 });
  console.log("saved", name);
  await page.close();
}
await shot("tz05-cars", `${BASE}/cars`, 1440, 900);
await shot("tz05-report-mini-desktop", `${BASE}/r/${REPORT}`, 1440, 1000, 9000);
await shot("tz05-report-mini-mobile", `${BASE}/r/${REPORT}`, 390, 844, 9000);
await shot("tz05-inspect", `${BASE}/inspect/mini-cooper-s`, 1440, 900, 2000);
console.log("pageerrors:", errors.length ? errors.join(" | ") : "none");
await browser.close();
