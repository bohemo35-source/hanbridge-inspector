# @agent:   muse-code
# @project: hanbridge-inspector
# @purpose: Report for TZ-10b (garage v2: new car model + live environment)
# @created: 2026-10-29

# TZ-10b Report — Garage v2

Branch `tz-10`, commit `cb5bf60` (+ a commit with this report). Not pushed.

## What was done

- **Model v2.** The scene loads both models from `public/models/`: the hero `car-v2.glb` (PBR, its own textures, `envMapIntensity 1.25`) for beats 0, 1 and the end of beat 5; `car-v2-parts.glb` (22 parts) for beats 2–4. Both are normalized by the same formula (length along X → 4.4 m, wheels on the floor, centered on X/Z), but each one by its own bbox: the GLBs have their own node scales (hero 1.90, parts 0.37/0.08…), so a single transform for the hero squeezed the parts about 3×. (Caught in screenshots, fixed.)
- **Crossfade.** `heroWeight(progress)` in `parts.ts`: hero in beats 0–1, fade into the parts over the first 12% of beat 2, parts in beats 3–4, reverse fade back to the hero at local 0.62–0.85 of beat 5 (after assembly). The paint color of the parts = the average color of the hero's base texture: drawn to a 16×16 canvas, averaged excluding very dark/light pixels (`samplePaint` in `GarageScene.tsx`), fallback — the `paint` prop.
- **Part map v2.** `PartDef.panel` → `panels: PanelId[]` per the TZ table (22/22 parts). Shared parts: `tripo_part_15` = both front fenders, `tripo_part_3` = both rear fenders + trunk, `21` with the bumper, `14` with the rear section, `19/20` with the rear bumper, `18/10` with the front doors, wheels `4/5/1/2`, underbody `6/8` down 0.3 m. Labels for shared parts are separate: `panelLabelOffset` (left one — at the left edge of the part, right one — at the right edge, trunk — at the rear end). All 13 panel ids are covered.
- **Environment (Muse Image, one run of `scripts/garage/generate-assets.mjs`).** `env-garage.jpg` → `scene.environment` via PMREM (`EquirectangularReflectionMapping`) + a muted sphere r=42 for the far background. `floor-epoxy.jpg` (repeat 6×4, roughness 0.62) over a weakened Reflector (opacity 0.94, dark color). `wall-panel.jpg` on 3 walls. Prompts, model, date, time and sizes — in `public/garage/prompts.json`.
- **Geometry in code.** Ceiling: beams + 6 linear lights in housings; back wall: 5 cabinets with drawers and handles, a 4-tire rack, a workbench, a compressor (red tank), an OBD stand with a chart screen without numbers (canvas); a glowing strip and 3 icons without text (arrow/checkmark/wrench, canvas); yellow markings for the lift zone, a drain grate, contact shadow (radial gradient); lift: yellow ends, rubber pads, hydraulic cylinder along the platform. Haze cones reduced to opacity 0.0035. Above the ceiling, LED/cones are hidden (as before).
- **Camera.** Radii of beats 0/1/5 reduced (6.6/6.1/6.3 m): the car covers ~40–55% of the frame width, 3/4 and low angles kept. The 404s in the capture console are the same as in TZ-10 (not the models: `data-parts=22`).

## Muse Image assets (raw generation output)

```
$ node --check scripts/garage/generate-assets.mjs && node scripts/garage/generate-assets.mjs
env-garage.jpg saved in 28977ms bytes=188080 q=82
floor-epoxy.jpg saved in 25256ms bytes=161076 q=82
wall-panel.jpg saved in 18744ms bytes=83371 q=82
prompts.json saved
```

| File | Bytes | Time |
|---|---|---|
| `env-garage.jpg` | 188 080 | 28 977 ms |
| `floor-epoxy.jpg` | 161 076 | 25 256 ms |
| `wall-panel.jpg` | 83 371 | 18 744 ms |

All ≤ 1 MB, JPEG q82.

## Raw check output

```
$ npx tsc --noEmit
TSC:0

$ npm run lint
✖ 4 problems (0 errors, 4 warnings)   # same old warnings in ReportView.tsx, not garage

$ npx vitest run
 Test Files  10 passed (10)
      Tests  93 passed (93)            # was 90; garage: 15 tests (map v2, panels[], crossfade, separate labels/readings)

$ node --check scripts/garage/generate-assets.mjs && node --check scripts/garage/capture.mjs
NODECHECK:ok

$ npm run build
 ✓ Compiled successfully in 2.2s
├ ƒ /lab/garage                          1.49 kB         104 kB

$ node scripts/garage/capture.mjs http://localhost:3100   (Mac, Chrome, GPU --use-angle=metal)
tz10b-beat0 triangles: 487598 parts: 22 fps: 60.0 eco: null
tz10b-beat1 … tz10b-beat5               fps: 60.0
tz10b-debug-parts                       fps: 60.0
tz10b-mobile-beat2 / -beat3 (390×844)   fps: 60.0
fallback cards: 6
page errors: 404 (as in TZ-10, not the models)
```

Triangles: 487 598 = hero + parts combined (only one model is visible in the frame at a time; both are present at the crossfade seam). FPS — scene `data-fps`, headless Chrome on M-series, as in TZ-10.

## Screenshots (reviewed)

`docs/reports/assets/tz10b-beat0..5.png`, `tz10b-debug-parts.png`, `tz10b-mobile-beat2.png`, `tz10b-mobile-beat3.png`, `tz10b-fallback.png`.

- Beats 0/1: hero without the v1 "waviness"; LED and warm light reflections on the body and glass; car 40–55% of the frame.
- Beat 2: parts fly apart per the v2 map; part paint matches the hero (light-grey texture sample).
- Beat 3 (top view): all labels are readable; the front fender has two separate labels (75/75 µm along the sides of part `15`); hood 332 µm "filler/repair · ✓ confirmed". For the rear section, the separate MINI report readings for the rear fenders/trunk did not make it into the frame as separate captions. Labels are placed only from actual `paintReadings` (none invented).
- Beat 5 (frame center): assembled parts; the hero returns via crossfade toward the end of the beat (local 0.62–0.85).
- Floor with texture and yellow markings; behind the box — a panorama sphere, not empty space.

## Files

```
src/components/garage-3d/parts.ts        (map v2, panels[], heroWeight, panelLabelOffset, readingsByPart -> arrays)
src/components/garage-3d/GarageScene.tsx (hero+parts, crossfade, paint sampling, env PMREM/sphere, environment details, camera)
scripts/garage/generate-assets.mjs       (new, Muse Image, single run)
scripts/garage/capture.mjs               (tz10b prefix)
public/garage/{env-garage,floor-epoxy,wall-panel}.jpg, prompts.json (new)
tests/garage-parts.test.ts               (updated for v2 + new cases)
docs/reports/assets/tz10b-*.png          (screenshots)
```

Old `hero-car*.glb` files were not deleted, and they are not used in the scene.

## Not achieved / limitations

- v2 parts have no textures: close-ups in beat 2 show the Tripo generation texture (paint is flat, sampled from the hero). This is a property of the source model, not the scene.
- Lift hydraulic cylinder: the first version rendered as a protruding diagonal "pipe" in front of the car — replaced with a short cylinder along the platform.
- Rear section (`tripo_part_3`): separate labels for fenders/trunk work, but the MINI demo report has no separate readings for all three panels, so only one caption is visible for it in the beat 3 screenshot.
