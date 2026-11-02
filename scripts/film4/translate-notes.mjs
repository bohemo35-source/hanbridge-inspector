// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Translate Muse Glimmer photo notes (photo-index.json of every demo car) to Russian with Meta Muse Spark; writes src/lib/garage/notes-ru.json {carId: {photoId: note_ru}}
// @created: 2026-11-02
// usage: NODE_USE_ENV_PROXY=1 node --env-file=.env.local scripts/film4/translate-notes.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const CARS = ["kia-sportage", "mini-cooper-s", "bmw-x3-8278", "bmw-530i-8053", "audi-a5-2005", "kia-morning"];
const OUT = new URL("../../src/lib/garage/notes-ru.json", import.meta.url);
const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const ask = async (notes) => {
  const r = await fetch("https://api.meta.ai/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.META_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "muse-spark-1.3", temperature: 0, response_format: { type: "json_object" }, messages: [
      { role: "system", content: "You translate short captions of used-car inspection photos from English to natural Russian used by car inspectors (крыло, порог, стойка, ЛКП, толщиномер, подкапотное пространство). Keep it short, no quotes, no explanations. Return JSON {\"t\": [..same order..]}." },
      { role: "user", content: JSON.stringify(notes) }] }),
  });
  const j = await r.json(); const t = JSON.parse(j.choices?.[0]?.message?.content ?? "{}").t;
  if (!Array.isArray(t) || t.length !== notes.length) throw new Error(`bad answer ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return t;
};
let calls = 0;
for (const car of CARS) {
  const idx = JSON.parse(readFileSync(new URL(`../../demo-data/${car}/out/photo-index.json`, import.meta.url), "utf8"));
  out[car] ??= {};
  const todo = idx.entries.filter((e) => e.note && !out[car][e.photoId]);
  for (let i = 0; i < todo.length; i += 40) {
    const part = todo.slice(i, i + 40);
    const t = await ask(part.map((e) => e.note)); calls++;
    part.forEach((e, k) => { out[car][e.photoId] = t[k]; });
    writeFileSync(OUT, JSON.stringify(out));
  }
  console.log(car, Object.keys(out[car]).length, "of", idx.entries.length);
}
console.log("muse-spark-1.3 calls:", calls);
