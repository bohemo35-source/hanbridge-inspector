// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Ask Meta Muse Wonder to write the procedural geometry generator for the 3D bridge hero (84 shards, 6 groups); saves the raw API response to docs/bridge/
// @created: 2026-11-02
// usage: NODE_USE_ENV_PROXY=1 node --env-file=.env.local scripts/bridge/wonder-bridge.mjs
import { writeFileSync } from "node:fs";

const SYSTEM = `You are a geometry engineer. You write small, deterministic JavaScript for a three.js scene. No prose, only code.`;

const ASK = `Write an ES module that exports \`buildBridge()\` and returns \`{ shards }\`: the parts of a minimalist cable-stayed bridge, for an "exploding assembly" hero animation (the bridge comes apart into groups).

Coordinates: Y is up, the deck lies along X, everything is in the XY plane with z = 0 except where stated. Units are arbitrary (about metres / 1.2). Span is x from -3.2 to +3.2, deck top at y = 0.

Each shard is an object:
  { p: [x, y, z],        // centre of the box
    a: [ax, ay, az],     // unit vector of the long axis
    L: number,           // length along a
    t: number,           // square cross-section side
    glow: 0 | 1,         // 1 = thin glowing edge strip, 0 = graphite body
    g: 0 | 1 | 2 | 3 | 4 | 5 }   // assembly group

Required structure (exact counts, total 84 shards):
1. Deck: 24 body segments, a = [1,0,0], L = 0.26, t = 0.14, tiling x from -3.07 to +3.07 with no gaps. Each segment glow = 0.
2. Deck glow edges: one glow strip per deck segment, placed on the segment's top edge (p.y + 0.075), a = [1,0,0], L = 0.24, t = 0.02, glow = 1, same g as its deck segment.
3. Pylons at x = -1.6 and x = +1.6. Each pylon is 6 stacked body blocks, a = [0,1,0], L = 0.34, t = 0.2, glow = 0, centres from y = 0.35 up to about y = 2.2 (step about 0.36). Left pylon blocks g = 0, right pylon blocks g = 5.
4. Stay cables: for each pylon, 12 thin cables from the pylon top (xp, 2.4, 0) to deck anchors (xa, 0.07, za). Anchor x offsets from the pylon: -1.35, -1.1, -0.85, -0.6, -0.35, -0.1, 0.1, 0.35, 0.6, 0.85, 1.1, 1.35 (keep xa inside [-3.1, 3.1]). za alternates +0.28 and -0.28. Each cable: p = midpoint, a = unit vector from the anchor to the pylon top, L = full length, t = 0.03, glow = 0. Left pylon cables g = 1, right pylon cables g = 4.
5. Deck groups: deck segments with centre x < 0 get g = 2, the others g = 3 (their glow strips follow).

Style: minimalist and elegant. You may add a tiny deterministic jitter (seeded PRNG, e.g. mulberry32 with seed 7, amplitude <= 0.01) to positions so it does not look like a CAD grid, but keep all counts and groups exactly as above.

Rules: no imports, no Math.random, no DOM, no top-level side effects. Only arithmetic, Math.hypot, Math.sqrt, Math.round. Keep the code under 80 lines. Output only one fenced \`\`\`js code block.`;

const t0 = Date.now();
const r = await fetch("https://api.meta.ai/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.META_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "muse-wonder-1.0",
    max_tokens: 12000,
    reasoning_effort: process.env.EFFORT ?? "low",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: ASK },
    ],
  }),
});
const j = await r.json();
const content = j.choices?.[0]?.message?.content ?? null;
const out = {
  model: "muse-wonder-1.0",
  task: "procedural bridge geometry for docs/bridge hero (scripts/bridge/wonder-bridge.mjs)",
  status: r.status,
  ms: Date.now() - t0,
  usage: j.usage,
  finish: j.choices?.[0]?.finish_reason ?? null,
  content,
  raw: j,
};
writeFileSync("docs/bridge/wonder-bridge.json", JSON.stringify(out, null, 2));
console.log("status", r.status, "ms", out.ms, "finish", out.finish, "usage", JSON.stringify(j.usage), "content_chars", content?.length ?? 0);
