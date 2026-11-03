// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Portrait film frames for every scene (iPhone WebKit): a contact sheet per screen size + a DOM check that no card (receipt,
//           toast, chips) overlaps the picture band or the scene's line, and the band/line/card gaps; measures the cards' real heights
// @created: 2026-11-04
// usage: node scripts/film4/portrait-shots.mjs <url> <out dir> [390x664,390x844,430x932]
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const pw = createRequire(path.join(os.homedir(), "node_modules", "x.js"))("playwright");
const [url, out, sizes = "390x664,390x844,430x932"] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await pw.webkit.launch();
const report = {};
for (const size of sizes.split(",")) {
  const [w, h] = size.split("x").map(Number);
  const ctx = await b.newContext({ ...pw.devices["iPhone 14"], viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  await p.goto(url + (url.includes("?") ? "&" : "?") + "capture", { waitUntil: "networkidle", timeout: 120000 });
  await p.waitForFunction(() => window.__film4, null, { timeout: 30000 });
  const tl = await p.evaluate(() => window.__film4);
  const dir = path.join(out, size); fs.mkdirSync(dir, { recursive: true });
  const rows = [];
  for (let i = 0; i < tl.ids.length; i++) {
    const id = tl.ids[i];
    // mid-scene, where lines and cards are on screen (toast 0.26–0.78, receipt from 0.18)
    await p.evaluate(({ s, v }) => { const el = document.querySelector('[data-testid="film4"]'); scrollTo(0, el.getBoundingClientRect().top + scrollY + (s + v * 0.55) * innerHeight / 100); }, { s: tl.starts[i], v: tl.vhs[i] });
    await p.waitForTimeout(900);
    const m = await p.evaluate(() => {
      const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }; };
      const stage = document.querySelector('[data-testid="film4"] > div');
      const band = [...document.querySelectorAll("[data-clip]")].filter((L) => L.style.visibility !== "hidden" && Number(getComputedStyle(L).opacity) > 0.5).map((L) => L.querySelector("video")?.parentElement).find(Boolean);
      const cards = [...stage.querySelectorAll(".backdrop-blur-xl, .backdrop-blur-md")].filter((e) => Number(getComputedStyle(e).opacity) > 0.05 && e.getBoundingClientRect().height > 0);
      const line = [...stage.querySelectorAll("p.font-display")].find((e) => Number(getComputedStyle(e).opacity) > 0.05);
      return { band: r(band), line: r(line), cards: cards.map(r) };
    });
    const over = (a, c) => a && c && c.top < a.bottom - 1 && c.bottom > a.top + 1;
    const bad = m.cards.filter((c) => over(m.band, c) || over(m.line, c)).length;
    rows.push({ id, ...m, bad });
    await p.screenshot({ path: path.join(dir, `${String(i).padStart(2, "0")}-${id}.png`) });
  }
  report[size] = rows;
  await ctx.close();
  // contact sheet: 11 per row, labelled
  execFileSync("ffmpeg", ["-v", "error", "-y", "-pattern_type", "glob", "-i", path.join(dir, "*.png"), "-vf", `scale=${Math.round(w * 0.6)}:-1,tile=11x3:padding=6:color=0x222222`, "-frames:v", "1", path.join(out, `sheet-${size}.jpg`)]);
  console.log(size, "cards over band or line:", rows.reduce((a, x) => a + x.bad, 0), "| card heights:", JSON.stringify(rows.filter((x) => x.cards.length).map((x) => [x.id, x.cards.map((c) => c.h)])));
}
fs.writeFileSync(path.join(out, "layout.json"), JSON.stringify(report, null, 1));
await b.close();
