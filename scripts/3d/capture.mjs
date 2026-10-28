// @agent:   claude (TZ-06)
// @project: hanbridge-inspector
// @purpose: Playwright screenshots of /lab/3d (assembled, selected, exploded, 3 templates, mobile, no-WebGL fallback)
// @created: 2026-10-28
// Usage: npx next dev -p 3100  &&  node scripts/3d/capture.mjs [baseUrl]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = new URL("../../docs/reports/assets/", import.meta.url).pathname;
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errors = [];

async function open(width, height, query = "") {
  // reducedMotion → camera flights and explode are instant, so headless frames show final states
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  await page.goto(`${BASE}/lab/3d${query}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);
  return page;
}
async function shot(page, name, fullPage = false) {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}${name}.png`, timeout: 150000, fullPage });
  console.log("saved", name);
}

let page = await open(1440, 900);
await shot(page, "tz06-sedan-selected");
await page.click('button:has-text("Сброс вида")');
await shot(page, "tz06-sedan-assembled");
await page.click('button:has-text("Разобрать")');
await shot(page, "tz06-sedan-exploded");
await page.click('button:has-text("Собрать")');
for (const [label, name] of [["SUV", "suv"], ["Хэтчбек", "hatchback"]]) {
  await page.click(`button:has-text("${label}")`);
  await page.waitForTimeout(3000);
  await page.click('button:has-text("Сброс вида")');
  await shot(page, `tz06-${name}-assembled`);
}
await page.close();
page = await open(390, 844);
await shot(page, "tz06-mobile", true);
await page.close();
page = await open(1280, 800, "?no3d=1");
console.log("fallback panel buttons:", await page.locator(".dm3d-grid button").count());
await shot(page, "tz06-fallback");
console.log("page errors:", JSON.stringify(errors));
await browser.close();
