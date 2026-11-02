// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Image-to-3D for the body-type templates: Muse Image concept → Tripo API (paid credits) → GLB; logs task ids for public/models/provenance-bodies.json
// @created: 2026-11-02
// usage: NODE_USE_ENV_PROXY=1 node --env-file=.env.local scripts/bodies/tripo.mjs <dir with sedan.png …>
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const dir = process.argv[2]; const API = "https://api.tripo3d.ai/v2/openapi";
const H = { Authorization: `Bearer ${process.env.TRIPO_API_KEY}` };
const LOG = `${dir}/tripo.json`; const log = existsSync(LOG) ? JSON.parse(readFileSync(LOG, "utf8")) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function run(body) {
  if (log[body]?.glb) return;
  if (!log[body]?.task) {
    const fd = new FormData(); fd.append("file", new Blob([readFileSync(`${dir}/${body}.png`)], { type: "image/png" }), `${body}.png`);
    const up = await (await fetch(`${API}/upload`, { method: "POST", headers: H, body: fd })).json();
    const token = up.data?.image_token; if (!token) throw new Error(`${body} upload ${JSON.stringify(up).slice(0, 200)}`);
    const t = await (await fetch(`${API}/task`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ type: "image_to_model", file: { type: "png", file_token: token }, model_version: "v3.1-20260211", texture: true, pbr: true, texture_quality: "detailed", geometry_quality: "detailed", model_seed: 20261102 }) })).json();
    if (!t.data?.task_id) throw new Error(`${body} task ${JSON.stringify(t).slice(0, 300)}`);
    log[body] = { task: t.data.task_id, created: new Date().toISOString() }; writeFileSync(LOG, JSON.stringify(log, null, 1));
    console.log(body, "task", t.data.task_id);
  }
  for (let i = 0; i < 90; i++) {
    const s = await (await fetch(`${API}/task/${log[body].task}`, { headers: H })).json();
    const st = s.data?.status;
    if (st === "success") {
      const url = s.data.output?.pbr_model ?? s.data.output?.model ?? s.data.result?.pbr_model?.url ?? s.data.result?.model?.url;
      const glb = Buffer.from(await (await fetch(url)).arrayBuffer());
      writeFileSync(`${dir}/${body}.glb`, glb); log[body].glb = `${body}.glb`; log[body].bytes = glb.length; writeFileSync(LOG, JSON.stringify(log, null, 1));
      console.log(body, "done", glb.length); return;
    }
    if (["failed", "cancelled", "unknown", "banned", "expired"].includes(st)) throw new Error(`${body} ${st}`);
    if (i % 6 === 0) console.log(body, st, s.data?.progress ?? "");
    await sleep(10000);
  }
  throw new Error(`${body} timeout`);
}
const res = await Promise.allSettled(["sedan", "hatchback", "compact", "city"].map(run));
res.forEach((r, i) => r.status === "rejected" && console.log("ERR", i, String(r.reason).slice(0, 300)));
