# TZ-06 — 3D body map: body templates, 13 panels, highlighting by findings, exploded view

Status: **done by Claude on branch `tz-06`** (28.10). This file describes what was done and how to embed it. Report: `docs/reports/tz-06.md`.

## Goal
In the `/r/:id` report — a live 3D car in the style of a studio showroom: dark scene, warm key light, cool rim light, mirror floor, a golden arc-"bridge". Each of the 13 panels is colored by the paint-gauge reading and by the agent's findings; clicking a panel opens its evidence (the original frame with the SAM mask, the voice quote with its timecode, the measurement, the auction-sheet line, the verifier decision). "Disassemble" spreads the panels into an exploded view, "Assemble" brings them back.

The 3D model is a **body diagram built from a body-type template**, not a copy of a specific car. The evidence is always real (original inspection frames).

## Asset decision (changed from the first version of the TZ)
Instead of models from Rodin, the car is **built in code** (`buildCar.ts`): a parametric body loft, immediately cut into 13 panels with seams, separate glass, pillars, wheels, light strips. Pros: no external assets or licenses, brand-neutral by construction, exact panels (no slicing in Blender needed), three body types = three parameter sets, ~62k triangles, 0 bytes of model download.

## What was done (files)
- `src/components/damage-map-3d/bodyTemplates.ts` — parameters for `sedan`, `suv`, `hatchback` (+ a 3-door hatchback variant without rear doors).
- `src/components/damage-map-3d/buildCar.ts` — generator: body and greenhouse loft, quad layout by panel (bumper/hood/fenders/doors/trunk/roof), seams (`LineSegments` along panel borders), an inner dark "frame", wheels, lights, explosion vectors, `panelBoxes()` for checks.
- `src/components/damage-map-3d/panels.ts` — 13 panel ids (as in `FINDINGS_DRAFT_SPEC`), RU/EN labels, `panelVisual()` — color/strength/label by gauge reading and findings (≤150 `#4fb38a`, 151–220 `#e3a33b`, >220 `#e5544b`, only unconfirmed findings `#9a8cf0`).
- `src/components/damage-map-3d/DamageMap3D.tsx` — three.js scene (no R3F): OrbitControls, RoomEnvironment, Reflector, click on a panel (threshold 6 px), labels above panels with findings, camera orbit on a sphere (not through the car), buttons "Gauge", "Disassemble", "Reset view" (RU labels live in the component's RU dictionary), `prefers-reduced-motion`, fallback without WebGL2 or with `?no3d=1` — a grid of 13 panels.
- `src/components/damage-map-3d/PanelEvidence.tsx` — panel header "Panel NN / 13" (RU label in the component's RU dictionary): scale 0–150–220–300, value, evidence by type, Verifier badge. Accepts `mediaUrl(mediaId)` — the original frame URL from Blob is substituted here.
- `src/components/damage-map-3d/InspectionMap.tsx` — the ready-made block for `/r/:id`: 3D + evidence panel + list of findings with shared highlighting. Connected via `next/dynamic` (`ssr:false`), so three loads as a separate chunk.
- `src/components/damage-map-3d/bodyTypeMap.ts` — `guessBodyType(make, model)`: MINI → hatchback, X3/XC60 → suv, 530i/E-Class/Sonata → sedan, unknown → sedan with a `guessed` flag.
- `src/lib/schema/index.ts` — optional `bodyType` and `doors` added to `vehicle` (the only change outside the new folder).
- `src/app/lab/3d/` — demo page on the fixture `fixtures/demoReport.ts` (demo data, marked as such), switcher sedan / SUV / hatchback and RU/EN. Available in dev and on Vercel Preview; 404 in production.
- `src/components/damage-map-3d/damageMap3d.test.ts` — 22 tests.
- `scripts/3d/capture.mjs` — playwright screenshots into `docs/reports/assets/`.

## How to embed in `/r/:id` (TZ-05)
```tsx
import { InspectionMap } from "@/components/damage-map-3d/InspectionMap";
// report: Report from Blob; mediaUrl — URL of the original frame by mediaId
<InspectionMap report={report} lang={lang} mediaUrl={(id) => mediaById[id]?.url} />
```
`report.vehicle.bodyType` is set by the `/inspect/new` form or by the agent via `guessBodyType`. If 3D fails to start, the component itself shows the grid of panels; the SVG `DamageMap` from TZ-04 can be substituted there as well.

## Acceptance criteria (verified, raw output in the report)
- `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build` — green.
- `node --check scripts/3d/capture.mjs` — OK.
- Screenshots: assembled, selected panel with evidence, exploded, SUV, hatchback, mobile, fallback.
- No third-party models and no code from old projects.

## What remains (not in this TZ)
- Embedding in `/r/:id` after TZ-05 and real frames instead of the stubs in `PanelEvidence` (via `mediaUrl`).
- FPS measurement on a real GPU (headless SwiftShader is not representative).
- When TZ-02 adds `src/lib/domain/panels.ts` — switch `panels.ts` to the shared list (the ids match).
