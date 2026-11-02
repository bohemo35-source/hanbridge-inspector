// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Structure each car's original inspector sheet (demo-data/<car>/inspector_report_ru.txt, free-form Russian) with Meta Muse Spark into RU+EN sections, facts and panel links; plate numbers removed. Writes src/lib/garage/inspector-sheets.json
// @created: 2026-11-02
// usage: NODE_USE_ENV_PROXY=1 node --env-file=.env.local scripts/film4/build-sheets.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const CARS = ["kia-sportage", "mini-cooper-s", "bmw-x3-8278", "bmw-530i-8053", "audi-a5-2005", "kia-morning"];
const PANELS = "front_bumper, hood, front_left_fender, front_right_fender, front_left_door, front_right_door, rear_left_door, rear_right_door, rear_left_fender, rear_right_fender, trunk, rear_bumper, roof";
const OUT = new URL("../../src/lib/garage/inspector-sheets.json", import.meta.url);
const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const SYS = `You structure a used-car inspector's original checklist (Russian, free form, emojis, markdown). Keep the inspector's meaning exactly, do not add or drop findings, do not invent. Remove licence plate numbers, VIN, names and phone numbers. Return JSON only:
{"facts":[{"ru":"Пробег","en":"Mileage","value_ru":"38 328 км","value_en":"38,328 km"}],
 "sections":[{"ru":"Кузов","en":"Body","state":"ok|note|issue","items":[{"ru":"…","en":"…","panels":["front_left_door"]}]}]}
facts: model, year, engine, drive, trim, mileage when present (no plate). state: issue if the section reports repair/replacement/damage, note for minor wear, ok otherwise. items: one per check line, short, ru = the inspector's words cleaned (no checkbox marks, no emojis), en = natural English. panels: only when an item names a body panel, using ids from: ${PANELS}; else [].`;
for (const car of CARS) {
  if (out[car]) { console.log(car, "cached"); continue; }
  const txt = readFileSync(new URL(`../../demo-data/${car}/inspector_report_ru.txt`, import.meta.url), "utf8");
  const t0 = Date.now();
  const r = await fetch("https://api.meta.ai/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${process.env.META_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "muse-spark-1.3", temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: SYS }, { role: "user", content: txt }] }) });
  const j = await r.json();
  const data = JSON.parse(j.choices?.[0]?.message?.content ?? "null");
  if (!data?.sections) { console.log(car, "FAILED", r.status, JSON.stringify(j).slice(0, 200)); continue; }
  out[car] = { ...data, source: "inspector_report_ru.txt", model: "muse-spark-1.3", ms: Date.now() - t0 };
  writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(car, r.status, Date.now() - t0, "ms", "sections", data.sections.length, "items", data.sections.reduce((a, s) => a + s.items.length, 0));
}
