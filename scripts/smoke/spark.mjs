// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Live smoke for muse-spark-1.3: (a) text (b) JSON schema (c) tool calling check
// @created: 2026-10-27
import { readFileSync, existsSync } from "node:fs";

function loadEnv() {
  if (process.env.META_API_KEY) return process.env.META_API_KEY;
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const i = line.indexOf("=");
      if (i > 0 && line.slice(0, i).trim() === "META_API_KEY") return line.slice(i + 1).trim();
    }
  }
  return "";
}

const KEY = loadEnv();
const BASE = "https://api.meta.ai/v1";
if (!KEY) { console.error("META_API_KEY missing"); process.exit(1); }

async function chat(body) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "muse-spark-1.3", reasoning_effort: "low", max_tokens: 2000, ...body }),
  });
  const text = await res.text();
  console.log(`status=${res.status} ms=${Date.now() - t0}`);
  let json;
  try { json = JSON.parse(text); } catch { console.log(text.slice(0, 800)); throw new Error("non-JSON response"); }
  return json;
}

console.log("=== (a) text ===");
const a = await chat({ messages: [{ role: "user", content: "In one short sentence, what does a paint thickness gauge measure on a car?" }] });
console.log(JSON.stringify(a.choices?.[0]?.message ?? a, null, 2).slice(0, 2000));

console.log("\n=== (b) JSON by schema ===");
const b = await chat({
  response_format: { type: "json_object" },
  messages: [
    { role: "system", content: "Reply with strictly valid JSON only." },
    { role: "user", content: 'Return JSON {"panel":"hood","microns":180,"status":"repaint"} with exactly those keys for a hood reading of 180 microns (rule: <=150 factory, 151-220 repaint, >220 putty).' },
  ],
});
const bContent = b.choices?.[0]?.message?.content ?? "";
console.log(bContent.slice(0, 2000));
try {
  const parsed = JSON.parse(bContent.replace(/```json|```/g, "").trim());
  console.log("JSON parsed OK:", JSON.stringify(parsed));
} catch (e) { console.log("JSON parse FAILED:", e.message); }

console.log("\n=== (c) tool calling ===");
const c = await chat({
  messages: [{ role: "user", content: "Use the get_paint_status tool for panel hood with 180 microns." }],
  tools: [{
    type: "function",
    function: {
      name: "get_paint_status",
      description: "Classify a paint-gauge reading",
      parameters: { type: "object", properties: { panel: { type: "string" }, microns: { type: "number" } }, required: ["panel", "microns"] },
    },
  }],
});
const cMsg = c.choices?.[0]?.message ?? {};
console.log(JSON.stringify(cMsg, null, 2).slice(0, 3000));
const hasTools = Array.isArray(cMsg.tool_calls) && cMsg.tool_calls.length > 0;
console.log(hasTools ? "tool calling: YES" : "tool calling: NO");
