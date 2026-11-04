<!-- @agent: claude-code · @project: hanbridge-inspector · @purpose: plan for the 3D bridge on the first screen (a "disassembly" effect like trionn.com) · @created: 2026-11-02 -->
# Plan: 3D Hanbridge bridge on the first screen (a "disassembly" effect, like trionn.com)

## Is it feasible
Yes. three.js is already in the project, and the techniques (bloom, instances, detail explosion driven by progress) already work in the garage studio. Scope: 5–7 hours including the mobile version and testing. Simplified version: 2–3 hours.

## What the visitor sees
1. **Rest.** On a black background a minimalist cable-stayed bridge slowly rotates: two pylons, the deck, the stay cables. Details are graphite glass, the edges glow with sodium light. A golden line runs along the deck — the same motif as in the film. At the bottom a faint dotted grid horizon is visible (like our maps), and particles drift slowly in the air.
2. **Hover.** The stay cables vibrate slightly, and the part under the cursor lights up.
3. **Click or hold.** The bridge disassembles: 60–90 fragments (deck sections, pylon blocks, stay cables) fly apart along an arc while rotating. They gather into **6 groups**, each with a label:
   - **Inspection** — AI agent, live run → `/inspect/kia-sportage`;
   - **Evidence** — report → `/r/...`;
   - **Garage** — 3D garage of the car → `/garage/kia-sportage`;
   - **Route** — film → `#journey`;
   - **Your car** — photo upload → `/inspect/new`;
   - **Honest check** — one invoice and zero commission → the receipt scene in the film.

   A click on a group leads to the corresponding section. A repeated click or "Assemble" returns the bridge to its place.
4. **Scroll.** The bridge "drives into" the first frame of the film: the camera flies through the span, and the `open` scene (Seoul, bridge) begins.

## Constraint (Bolt lesson)
The first screen must immediately show a working tool and the pitch in one line. So the bridge is **the background or the right half**. The pitch, the buttons "Check your car" and "Open a report", and the car cards are visible right away, without a click. Disassembly is a bonus for the curious, not a gate in front of the product.

## Technical design
- `src/components/bridge-hero/BridgeHero.tsx` + `bridge.ts`, plain three.js, as in the studio.
- Geometry is procedural: the deck is 24 `BoxGeometry` segments, the pylons are 8 blocks each, the stay cables are 2×12 thin cylinders. Everything sits in one `InstancedMesh` per material, which means 2–3 draw calls.
- Each instance stores `home` (matrix in the assembled bridge) and `target` (position in the group + random rotation). In the frame — `lerp` or `slerp` by progress with a delay by index, like `partExplodeT` in the garage.
- Lighting: the edges are `MeshBasicMaterial` with colour ×3 and `toneMapped:false`, plus `UnrealBloomPass`. Glass is `MeshPhysicalMaterial` (`transmission` 0.3, `roughness` 0.2).
- Group labels are HTML over the canvas; positions are projected, like the part labels in the garage.
- Loading: the component is `dynamic(ssr:false)` and mounts after the first text render (LCP is not hurt). Without WebGL2 or with `prefers-reduced-motion`, a static SVG picture of the bridge is shown.
- Mobile version: 40 fragments, no bloom, disassembly on tap, groups as a list under the bridge.

## Meta models
- **Muse Image** — background: a dark, foggy panorama of Hangang with lights (one generation, ~1 MB).
- **Muse Wonder** — in our experience this is a text model with reasoning (`reasoning_effort: low`). It can be assigned the bridge geometry generator and the edge-glow shader, and this should be recorded in the report. I review the code.

## Steps and estimate
| Step | Time |
|---|---|
| Procedural bridge, materials, bloom, idle animation | 1.5 h |
| Disassembly/assembly into 6 groups, labels, clicks | 1.5 h |
| Embedding in `Hero` (right half and background), scroll transition into the film | 1 h |
| Mobile version, fallbacks, performance | 1 h |
| Visual check, screenshots, review | 0.5–1 h |

## Risks
- Weak phones: keep ≤ 90 instances, no shadows, DPR ≤ 1.5.
- Distracts from the tool. Decision: disassembly only on click; text and buttons always on top.
- Timing: do this **after** the video and the submission, or in a simplified form — bridge + disassembly without the transition into the film, 2–3 hours.
