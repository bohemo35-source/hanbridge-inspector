// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Film v4 contact sheets: scroll to scene/progress points, screenshot each, montage with ffmpeg
// @created: 2026-11-02
// usage: node scripts/film4/capture.mjs <url> <outDir> [id@t,id@t…|all] [WxH]
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const { chromium } = createRequire(path.join(os.homedir(), "node_modules", "x.js"))("playwright");
const [url, out, list = "all", size = "1440x810"] = process.argv.slice(2);
const [W, H] = size.split("x").map(Number);
mkdirSync(out, { recursive: true });
const launch = () => chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: (process.env.GPU ? ["--enable-gpu", "--use-angle=metal"] : ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]).concat("--autoplay-policy=no-user-gesture-required") });
const errs = [];
let browser, page;
// the software-GL GPU process dies now and then (garage WebGL below the film): reopen and go on
const open = async () => {
  await browser?.close().catch(() => undefined);
  browser = await launch();
  page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForFunction(() => window.__film4, null, { timeout: 30000 });
};
await open();
const tl = await page.evaluate(() => window.__film4);
const pts = list === "all" ? tl.ids.map((id) => `${id}@0.45`) : list.split(",");
const files = [];
for (const [n, p] of pts.entries()) {
  const [id, tt] = p.split("@"); const t = Number(tt ?? 0.45);
  const i = tl.ids.indexOf(id); if (i < 0) { console.log("no scene", id); continue; }
  const f = path.join(out, `${String(n).padStart(2, "0")}-${id}-${Math.round(t * 100)}.jpg`);
  for (let a = 0; a < 3; a++) {
    try {
      await page.evaluate(({ i, t, tl }) => {
        const el = document.querySelector('[data-testid="film4"]');
        const top = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo(0, top + (tl.starts[i] + t * tl.vhs[i]) * window.innerHeight / 100);
      }, { i, t, tl });
      await page.waitForTimeout(1600);
      await page.screenshot({ path: f, type: "jpeg", quality: 82 });
      files.push(f); break;
    } catch (e) { console.log("retry", id, String(e).slice(0, 80)); await open(); }
  }
}
await browser.close().catch(() => undefined);
console.log("shots", files.length, "errors", errs.length, errs.slice(0, 3).join(" | "));
// montage: 4 columns
const cols = Math.min(4, files.length);
const args = ["-v", "error", "-y"];
files.forEach((f) => args.push("-i", f));
const layout = files.map((_, k) => `${(k % cols) ? Array.from({ length: k % cols }, () => "w0").join("+") : "0"}_${Math.floor(k / cols) ? Array.from({ length: Math.floor(k / cols) }, () => "h0").join("+") : "0"}`).join("|");
if (files.length > 1) {
  args.push("-filter_complex", `${files.map((_, k) => `[${k}]scale=480:-2[s${k}]`).join(";")};${files.map((_, k) => `[s${k}]`).join("")}xstack=inputs=${files.length}:layout=${layout}:fill=black`, path.join(out, "sheet.jpg"));
  execFileSync("ffmpeg", args);
  console.log(path.join(out, "sheet.jpg"));
}
