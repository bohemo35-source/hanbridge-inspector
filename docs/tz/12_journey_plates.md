# TZ-12 — Journey v3: Muse Image photo plates + our 3D car instead of boxes

First read:
- `AGENTS.md` (paid API — save tokens);
- `docs/reports/tz-11.md`;
- the screenshots `docs/reports/assets/tz11-*.png`;
- `src/components/journey-v2/SceneBlock.tsx`, `sceneKit.ts`, `scenes/helpers.ts`.

Complete it in full, without questions. Branch `tz-11`, commits along the way, do not push.

You may only touch:
- `src/components/journey-v2/*`;
- `scripts/journey-v2/*`;
- `public/journey-v2/*`;
- `tests/journey-v2-*.test.ts`;
- `docs/reports/tz-12.md` and `docs/reports/assets/tz12-*`.

## Why
Review of the TZ-11 screenshots:
- **the bridges, as Muse Image pictures, look cinematic**;
- **the 3D blocks built in code look cheap**:
  - the ships in Busan and Vladivostok are grey boxes;
  - Vladivostok is a brown plane;
  - the client's garage at the handover is an orange box;
  - Seoul is a flat white road.

We will not have time to build the world in code and get it up to photo quality.

**Decision — compositing, as in film: a photo plate + a real 3D car.** The background of a block is a Muse Image picture at the level of the bridges. On top of it — our `car-v2.glb` (the same one as in the garage) in 3D. The camera is matched to the plate's perspective, there is an invisible ground plane that catches shadows (`ShadowMaterial`), and the light and color match the plate. The car drives with the scroll progress. The result is photo quality and a real 3D car in one frame.

## What to do

### 1. Plates
Generate new Muse Image plates for the 3D blocks. The script `scripts/journey-v2/generate-plates.mjs` appends to `public/journey-v2/prompts.json`.

General requirements for each plate:
- a frame **with no cars in the foreground**, with an empty strip/area along which our car will drive;
- the horizon at about 40–45% of the frame height;
- the camera at eye height 1.4–1.7 m, a light 3/4 angle;
- the same style as the bridges: cinematic, anamorphic, haze; no people, text or logos.

| Block | Plate | What is in the frame | How the car moves |
|---|---|---|---|
| Seoul | `plate-seoul-bridge.jpg` | Night Seoul: a long lit bridge over a wide river, skyscraper lights on both banks, wet asphalt; the empty right lane runs into the distance | From the near plane deeper, along the lane |
| Port | `plate-port-ramp.jpg` | A night container port: gantry cranes, rows of containers, wet asphalt with sodium-lamp reflections. On the right — the stern of a huge ro-ro ship with its ramp lowered, a glowing hold inside | Drives up and in along the ramp into the hold, disappears inside (scale-down + darkening + a mask on the hold opening) |
| Vladivostok | `plate-vladivostok-quay.jpg` | Dawn, "rounded forested hills (sopki), Russian Far East", a cable-stayed bridge in the distance in haze. A quay with a ro-ro ship with its ramp lowered | Drives off the ramp onto the quay toward the camera |
| Handover | `plate-handover.jpg` | Golden hour, the client's modern house with a garage, a tiled driveway, warm light in the windows | Drives up and stops, the headlights go out, the taillights blink once |

### 2. Compositing in `SceneBlock`
Make a shared `plate` mode:
1. **Background.** The plate is a full-screen plane in camera space (cover, no stretching). Light parallax from progress: a ±2% shift and a 3–5% push-in.
2. **Camera.** `PerspectiveCamera` (FOV ~35–40) positioned so the ground plane `y=0` coincides with the strip in the photo. For each plate, the parameters are in `blocks.ts`: camera height, tilt, FOV, and the car's path — 3–5 points on the ground `x/z`, CatmullRom. Tune them by hand against the screenshot; make a debug mode `?debug=plate` with a grid on the ground and check against it.
3. **Shadow.** `PlaneGeometry` + `ShadowMaterial` (opacity 0.35–0.5) under the car. A soft contact shadow (a radial gradient) is mandatory.
4. **Light matched to the plate:**
   - `environment` = this same plate through PMREM (the reflections will match the background);
   - a directional light from the main light source in the photo;
   - the color tone/tint of the car matched to the plate (night is cold; dawn and golden hour are warm).
5. **Car:**
   - at night the headlights and taillights are on (emission + bloom);
   - a light body vibration while moving;
   - scale — by the width of the strip (the car ≈ 1/3 of the strip's width at the near plane).
6. **Depth.** Where the car goes behind an object (driving into the hold), make a mask. The simplest option: a second copy of the plate with the near edge of the opening cut out, placed over the car — a PNG mask from SAM 3.1 (`segmentImage` with the concept `ship ramp` / `doorway`). If SAM does not produce it — the car darkens and shrinks to 0 at the opening.

### 3. What to keep and what to remove
- **The "road from above" block** stays 3D: it works. But add a top-down view like the photo-maps:
  - ground tiles larger and more varied (coast → forest → steppe → suburbs);
  - the car's shadow;
  - at the finale — a map with the routes.
- **The garage** — unchanged.
- **The bridges** — unchanged.
- Do not delete the old code-built scenes of the Port, Vladivostok and Handover: switch those blocks to the `plate` mode, and keep the code scene as a fallback if the plate fails to load.

### 4. Fixes from the TZ-11 review
- **Caption at the bottom.** Do not show text on the bridges (the bridge cards are on the right). Check on the screenshots that the caption "Purchase in Korea" (RU copy lives in src/components/journey-v2/copy.ts) does not hang over the bridges "Report and documents", "Sea" and "Customs".
- **HUD.** The active stage matches the block. On the reviews and the finale — "Delivery", not "Purchase".
- **Duration.** Increase the block heights so that the full story is ≈ 2:45 at "100vh ≈ 3 s". Right now 4150vh ≈ 2:05; we need ≈ 5500vh. Add the most to the bridges "Sea" and "Selection" and to the "road" block: those have calm frames.

## Acceptance criteria
1. Green:
   - `npx tsc --noEmit`;
   - `npm run lint`;
   - `npx vitest run`;
   - `npm run build`;
   - `node --check` for the new `.mjs` files.
2. Screenshots on a Mac (GPU): the middle of each block and bridge in `tz12-*`, separately `tz12-debug-plate-*` for the 4 plates, and the mobile Seoul and Port shots.
3. On the screenshots:
   - the car stands on the ground/ramp, not floating;
   - the car's perspective matches the strip in the photo;
   - there is a shadow;
   - at night the headlights are on;
   - there are no more boxes instead of ships;
   - in the port the car "drives" into the hold.
4. Report `docs/reports/tz-12.md`:
   - raw output;
   - the generation time of the plates and of SAM;
   - the camera parameters;
   - fps;
   - the total page height;
   - `git diff --stat`;
   - what did not work.
