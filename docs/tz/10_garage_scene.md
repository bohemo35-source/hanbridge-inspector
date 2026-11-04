# TZ-10 — 3D "Inspection bay" scene on the real car model (the main scene of the journey)

First read `AGENTS.md`. Then read `public/models/provenance.json` and look at the references `public/models/ref-garage-lift.jpg` and `public/models/ref-garage-exploded.jpg` (these show the mood and quality we are aiming for).

Complete it in full, without questions. What does not work within 2 attempts — record in the report and move on.

Branch `tz-10` (already created, the assets are already in it). Make commits along the way, do not push: the reviewer pushes.

## Goal
A cinematic premium-level scroll scene. Our car drives into a clean modern inspection bay, is raised on a lift, and **is taken apart into parts**. On each part the **real paint-gauge readings from the agent's report** appear; then the diagnostics are shown, the car is **reassembled**, and the verdict is displayed.

This is block 2 of the overall journey script (2:45, 8 blocks); the beats of this scene are in the table below.

The level is a car manufacturer's commercial, not a game. Bad: grey cubes, "plasticine", objects floating in the air, jerky camera moves.

## Assets (ready, do not generate new ones)
- **`public/models/hero-car-parts.glb`** — the main model: 32 separate parts (nodes `tripo_part_0`…`tripo_part_31`), no textures. Compressed with meshopt: `GLTFLoader().setMeshoptDecoder(MeshoptDecoder)` from `three/examples/jsm/libs/meshopt_decoder.module.js`.
- **`public/models/hero-car.glb`** — the same car as one mesh with PBR textures (meshopt + webp). Use it only for the wide shots, if it looks better. The main one is the parts model.

Model axes for the parts: +X — the front of the car, +Y — up. Left side = −Z, right side = +Z. Size ~0.98 × 0.40 × 0.53; scale it to a length of 4.4 m and put the wheels on the floor.

### Parts map (verified by a reviewer render)
| Node | What it is | Panel id (`src/lib/domain/panels.ts`) | Disassembly direction |
|---|---|---|---|
| `tripo_part_0` | main body (it also contains the **front left fender**; there is no separate part for it) | — (`front_left_fender` = a label on the body) | does not move |
| `tripo_part_19` | hood | `hood` | up and slightly forward |
| `tripo_part_18` | front bumper | `front_bumper` | forward (+X) |
| `tripo_part_12` | front right fender | `front_right_fender` | to the right (+Z) |
| `tripo_part_7` | front left door | `front_left_door` | to the left (−Z) |
| `tripo_part_9` | rear left door | `rear_left_door` | to the left (−Z) |
| `tripo_part_20` | front right door | `front_right_door` | to the right (+Z) |
| `tripo_part_21` | rear right door | `rear_right_door` | to the right (+Z) |
| `tripo_part_6` | rear left fender | `rear_left_fender` | left and back |
| `tripo_part_10` | rear right fender | `rear_right_fender` | right and back |
| `tripo_part_5` | rear bumper | `rear_bumper` | back (−X) |
| `tripo_part_16` | top of the tailgate / spoiler | `trunk` | back and up |
| `tripo_part_8` | roof with glass (cabin) | `roof` | up |
| `tripo_part_1..4` | wheels: 1 rear left, 2 rear right, 3 front right, 4 front left | — | outward along Z |
| `tripo_part_13`, `_25` | headlights | — | together with the bumper |
| `tripo_part_14`, `_24` | mirrors | — | together with the front doors |
| `tripo_part_11`, `_15` | underbody | — | down by 0.3 m |
| the rest (`17`, `22`, `23`, `26–31`) | small parts, rails, trim | — | stay on the body |

First of all, make a debug mode `?debug=parts`: each part in its own color, with a label showing its node number. Check the map against the screenshot and put the screenshot in the report. If something does not match, fix the map in the code and describe it in the report.

### Materials (our own, in code)
- **Body and panels:** `MeshPhysicalMaterial` "metallic with lacquer" (clearcoat 1, clearcoatRoughness ~0.05, metalness ~0.6, roughness ~0.35). The color is one parameter (`paint` in props).
- **Cabin (`part_8`):** black gloss with tinted glass and a physically based environment reflection.
- **Wheels:** dark rubber/metal (one part, not split).
- **Headlights:** emission + bloom.
- **Underbody:** dark matte.
- **Environment:** `PMREMGenerator` from `RoomEnvironment` or our own HDR scene built in code. Do not download ready-made HDRIs.

## "Inspection bay" environment (in code, no third-party assets)
- **Floor:** dark epoxy gloss with reflections (`Reflector`, or roughness 0.15–0.25 + env). The reflection of the car must be readable.
- **Lighting:** long linear LED panels under the ceiling (emissive strips + `RectAreaLight`) and warm rim light from behind. Light haze: fog + semi-transparent light cones. Soft shadows: a contact shadow under the wheels.
- **Lift:** a two-post lift, with arms under the sills. Simple but neat: chamfers, metal, yellow warning stripes.
- **Background:** tool cabinets and the wall — only as silhouettes in the dimness, no detail. Less is better, but clean.

## Beats by scroll (section `500vh`, sticky canvas `100svh`)
| Beat | Share of scroll | What happens | Caption (RU / EN) |
|---|---|---|---|
| 0 | 0–0.15 | The car drives into the bay, the headlights are on, the camera is low at the side and slowly turns to 3/4 | "Inspection in Korea" |
| 1 | 0.15–0.30 | The lift raises the car, the camera passes under the underbody | "Photos of every zone — front, sides, interior, underbody" |
| 2 | 0.30–0.55 | Disassembly: the parts gradually move apart in their directions (staggered one after another, with easing), the camera slowly orbits | "Taking it apart, part by part" |
| 3 | 0.55–0.75 | Measurements: above each part a label "NNN µm" (CSS2DRenderer or a sprite). The part's color and the labels follow the rule: ≤150 normal, 151–220 repaint, >220 filler. A part with a finding is highlighted | "Paint gauge on every part — a repaint shows up in the numbers" |
| 4 | 0.75–0.88 | Diagnostics: if the report has evidence of type `obd`, show "OBD: N systems, faults 0" from the data. If not — the beat is skipped, with no invented figures | "Engine and diagnostics" |
| 5 | 0.88–1.00 | The car is reassembled, lowered, and the verdict card appears: BUY / NEGOTIATE / WALK AWAY, "N findings, M confirmed", a link "Open report" → `/r/:id` | "Decision — after the report" |

Scrolling down plays the scene, scrolling up rewinds it exactly. The camera and the parts are interpolated from the progress without jerks (damping); no timer-based work.

## Data — from the report only
- The `GarageScene` component takes `{ report?: Report, lang: "ru" | "en", paint?: string, compact?: boolean }`.
- **Readings:** `report.paintReadings` (panel → microns).
- **Findings:** `report.findings`, only those with `verified === true`. Unconfirmed ones are purple with the label "not confirmed".
- **Verdict:** `report.verdict`.
- Parts without a reading stay without a label. Do not invent anything.
- The page `/lab/garage?car=<carId>&lang=ru|en&debug=parts` takes the car's latest report via `listReportsAsync()` (as `/cars` does). Default `mini-cooper-s`. This page is for recording the video.
- The body model is one for all cars (a template). The scene caption does not show the car's make, only the data.

## Performance
- Scene triangles ≤ 400 000.
- **Desktop:** 60 fps on an M-series MacBook. **Mobile:** pixelRatio ≤ 1.5, no Reflector (fallback to a roughness floor), bloom off.
- **Eco mode:** if the average FPS over 2 s is < 40 — turn off the Reflector, bloom and haze.
- **Lazy:** the model and the scene load when the section approaches the screen and are fully released (`dispose`) when it moves far away.
- `prefers-reduced-motion` / no WebGL: a strip of 6 cards with the same captions and the paint-gauge data.

## Files
Only these may be touched:
- `src/components/garage-3d/*` (new);
- `src/app/lab/garage/*` (new);
- `scripts/garage/capture.mjs` (new);
- tests `tests/garage-*.test.ts`;
- `docs/reports/tz-10.md`, `docs/reports/assets/tz10-*`.

Do not change `journey-3d/*`, `damage-map-3d/*` or anything else. Integration into the journey will be a separate TZ. New npm packages: only if there is no other way, and explain it in the report (`three` is already there).

## Tests (vitest, no WebGL and no network)
- Pure functions:
  - `beatAt(progress)` — boundaries and monotonicity;
  - `explodeOffset(partId, t)` — 0 at t=0, maximum at t=1;
  - `paintClass(microns)` — 150/151/220/221;
  - `readingsByPart(report)` — mapping panel → node via the map.
- The parts map covers all 13 panel ids (for `front_left_fender` binding to the body is acceptable).

## Acceptance criteria
1. Checks are green:
   - `npx tsc --noEmit`;
   - `npm run lint`;
   - `npx vitest run` (all old tests unchanged + the new ones);
   - `npm run build`;
   - `node --check scripts/garage/capture.mjs`.
2. `scripts/garage/capture.mjs` (playwright, local `npm run dev`) takes screenshots at 1440×900:
   - `docs/reports/assets/tz10-beat0..5.png`;
   - `tz10-debug-parts.png`;
   - `tz10-mobile-beat2.png` and `tz10-mobile-beat3.png` (390×844);
   - `tz10-fallback.png`.
3. On the screenshots:
   - the car reads as a real car;
   - there is a reflection on the floor;
   - in beat 2 the parts are spread apart and do not intersect;
   - in beat 3 the labels show the real µm values of the MINI, and the hood is highlighted as a repair.
4. Report `docs/reports/tz-10.md`, raw output:
   - of all checks;
   - the number of triangles;
   - FPS (how it was measured, if it was; otherwise "not measured");
   - the size of the assets;
   - the list of files (`git diff --stat main`);
   - what did not work.

## Recording for the video
Arthur records a full scroll of `/lab/garage` (~35 s). These are frames 0:25–1:00 of the script and the main frame for X.
