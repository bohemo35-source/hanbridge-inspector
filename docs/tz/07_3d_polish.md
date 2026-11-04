# TZ-07 — Polishing the 3D body map (visuals for the video)

First read AGENTS.md and `docs/tz/06_3d_damage_map.md`. Complete the task in full, without intermediate questions; if something does not work after 2 attempts — record it in the report and move on. Branch `tz-07` from `tz-06` (or from `main` if tz-06 is already merged) → PR. Do not push to main, and do not deploy to prod without Arthur's "go".

## Goal
The 3D map from TZ-06 works, but it looks schematic. Make it a frame that is not embarrassing to show large in the video (1:55–2:25 of the script): a livelier body shape, a dramatic car entrance, clear hover highlighting, and labels in the exploded view. Do not change the data logic.

## Boundaries (strict)
- Touch only `src/components/damage-map-3d/buildCar.ts`, `bodyTemplates.ts`, `DamageMap3D.tsx`, and, if needed, a new file in the same folder. Do not touch `panels.ts`, `PanelEvidence.tsx`, `InspectionMap.tsx`, schemas, `/lab/3d`.
- Do not change: panel ids, component props, `panelVisual()`, status colors, the `CarModel` / `CarPart` contract.
- No external 3D models, textures, HDR or assets: everything is built in code. No logos and no recognizable brand grilles.
- Budget: `trisTotal < 120 000` per template; first frame on a laptop ≤ 1.5 s after page load.

## What to do
1. **Body shape** (all three templates):
   - softer nose and tail: rounded corners in plan view, no "clumsy" ends;
   - flares over the wheel arches (a slight fender bulge around each arch, 2–3 cm);
   - a character line on the side panel (a small section break at about 0.7 of the height from the sill to the shoulder);
   - windshield and rear pillar — a smooth slope, no "hump" where the greenhouse meets the hood;
   - side mirrors (part of `trim`, not a panel; they fly off together with the front doors) and a thin dark slot grille in the front bumper, without a logo.
   After the edits all 13 panels must stay in their places — the existing tests in `damageMap3d.test.ts` must pass unchanged.
2. **Car entrance** (once, on load): the scene starts in darkness, a light strip runs across the floor, the key light ramps up smoothly, the headlight strips flash on, and the camera slowly approaches the home angle — 1.5–2 s. With `prefers-reduced-motion` — straight to the final frame.
3. **Hover**: hovering over a panel (desktop) — a light glow on the panel's edges in its color + a cursor hint "Front right fender · 238 µm". Touch devices do not need hover.
4. **Exploded view**: each flying panel gets a short label with its name (RU/EN per `lang`) and a thin leader line to the panel; labels overlap each other by no more than 30% (simple spreading on screen).
5. **Light and post-processing**: soft bloom only for the light strips and the selected panel (`UnrealBloomPass` from three/examples), a light vignette. Eco mode: if the average FPS over the first 2 s is < 40 — turn off bloom and the Reflector (floor without reflection).
6. **Mobile**: pixelRatio ≤ 1.5, Reflector 512×512, labels in the exploded view — only for panels with findings.

## Acceptance criteria
- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (all TZ-06 tests without edits), `npm run build` — green; raw output in `docs/reports/tz-07.md`.
- `node --check scripts/3d/capture.mjs` (if touched — otherwise just run it) and new screenshots in `docs/reports/assets/tz07-*.png`: assembled sedan, exploded with labels, SUV, hatchback, mobile, and a frame from the middle of the entrance animation.
- In the report: `trisTotal` for the three templates (from `buildCar(type).trisTotal`), FPS on Arthur's laptop (if he opens the Preview) or honestly "not measured".
- `git diff --stat` in the report — only the allowed files.
- Screen recording for X: car entrance → click on the red marker → "Disassemble" → "Assemble" (Arthur records it himself from the Preview link).
