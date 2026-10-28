// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Playwright screenshots of /lab/journey per stage + mobile + no-WebGL fallback
// @created: 2026-10-28
// Usage: npx next dev -p 3100  &&  node scripts/journey/capture.mjs [baseUrl]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = new URL("../../docs/reports/assets/", import.meta.url).pathname;
const STAGES = ["inspection", "korea_road", "port_busan", "sea", "vladivostok", "customs", "delivery"];
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const errors = [];

async function open(width, height, query) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  await page.goto(`${BASE}/lab/journey${query}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(4500);
  return page;
}

for (const stage of STAGES) {
  const page = await open(1440, 900, `?stage=${stage}&body=hatchback&lang=ru`);
  await page.screenshot({ path: `${OUT}tz08-${stage}.png`, timeout: 150000 });
  console.log("saved", `tz08-${stage}`);
  await page.close();
}
let page = await open(390, 844, "?stage=sea&body=hatchback&lang=ru");
await page.screenshot({ path: `${OUT}tz08-mobile.png`, timeout: 150000 });
console.log("saved tz08-mobile");
await page.close();
page = await open(1280, 800, "?stage=sea&no3d=1");
console.log("fallback cards:", await page.locator(".journey-fallback article").count());
await page.screenshot({ path: `${OUT}tz08-fallback.png`, timeout: 150000 });
console.log("saved tz08-fallback");
console.log("page errors:", JSON.stringify(errors));
await browser.close();
