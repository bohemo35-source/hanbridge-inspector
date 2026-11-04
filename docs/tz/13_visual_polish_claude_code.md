# TZ-13 — Visual polish of the scenes to "commercial" level (for Claude Code)

## Context (read this first)
Project: **Hanbridge Inspector** — an entry for the Meta Global AI Developer Hackathon, submission 4.11 21:00 ET.

The main page `/` is a scroll story (~2:42) about the route of a car from Korea to the client:
- 3D blocks built on the scheme "Muse Image photo plate + our 3D car `public/models/car-v2.glb`": Seoul, Busan, Vladivostok, handover;
- "bridges" — Muse Image pictures with cards;
- the inspection garage — a separate 3D scene `src/components/garage-3d/`;
- the road seen from above;
- reviews and the finale.

What to read:
- `AGENTS.md` (project rules; you are not Muse, but the same rules apply);
- `docs/reports/tz-12.md` and `docs/reports/tz-10b.md`;
- the current screenshots `docs/reports/assets/tz12-*.png` and `tz10b-*.png`.

The branch `tz-13` is already created from `main`. It contains HDRIs in `public/hdri/` — free, CC0, Poly Haven.

## Goal
Raise the picture to the level of a car manufacturer's commercial. **Do not touch the logic, data or texts** — visuals only:
- the car looks fitted into the frame, not stuck on;
- the light and reflections are plausible;
- there are no empty, dark or "plastic" areas.

## Main method — iterations on screenshots
You work on a Mac with a GPU. The loop for each scene:
1. Take a screenshot of the block:
   - for `/`: `ONLY=<name> SKIP_EXTRA=1 node scripts/journey-v2/capture.mjs http://localhost:3100`;
   - for the garage: `node scripts/garage/capture.mjs http://localhost:3100`.

   Dev server: `npx next dev -p 3100`. If it is already running, use it. If it breaks — stop yours and restart it; do not delete `.next`.
2. Look at the picture yourself and compare it with the reference: the Muse Image frames in `public/journey-v2/bridge-*.jpg` — that is the level we need.
3. Fix, take the screenshot again. **At least 3 rounds per scene.**
4. Put the before/after pairs in `docs/reports/assets/tz13-<scene>-before.png` / `-after.png`.

## Assets you may use
- **HDRI CC0 (Poly Haven)** in `public/hdri/`. Use them for the lighting and the reflections of the car (`RGBELoader` → PMREM → `scene.environment`). The visible background stays the Muse Image plates.

  | File | Scene |
  |---|---|
  | `shanghai_bund_1k.hdr` | Seoul, night, neon and skyscrapers |
  | `golden_bay_1k.hdr` | Port, night, pier and lamps |
  | `dusseldorf_bridge_1k.hdr` | Vladivostok, dawn by the bridge |
  | `evening_road_01_1k.hdr` | Handover, sunset |
  | `autoshop_01_2k.hdr` | Garage: auto shop, reflections in the body |

  Choose the HDRI rotation (`scene.environmentRotation`) so that the main highlight matches the light on the plate.
- **Muse Image (Meta)** — you can generate new plates and textures. A script modeled on `scripts/journey-v2/generate-plates.mjs`, the key `META_API_KEY` in `.env.local`. Append the prompts to `public/journey-v2/prompts.json`. No people, text or logos.
- **Other third-party models and textures** — only CC0, and only if there is no other way. Record every asset in `ASSETS.md`: name, author, license, link.

## What to do
### 1. The car on the plates (Seoul, Busan, Vladivostok, handover) — `src/components/journey-v2/scenes/PlateScene.ts`, `useCar.ts`
- The environment comes from the HDRI of the scene instead of the PMREM from the plate. Choose `envMapIntensity` and the exposure so that the car matches the photo in brightness and contrast.
- **Wet asphalt at night (Seoul, Port):** a reflection of the car in the road. A mirrored copy of the car under the floor with falloff, blur and an opacity of ~0.25–0.35, or a `Reflector` with a mask.
- **Headlights at night:** instead of circles — light pools on the road in front of the car (`SpotLight` with a soft edge) and a light volumetric cone. Taillights — a red glow on the asphalt behind.
- **Ground contact:** a denser shadow under the wheels (an AO spot) and a soft long shadow in the direction of the main light.
- **Motion:** a light blur of the wheels/body (motion blur via a fading trail or an offset) and raindrops in Seoul (instanced streaks, few and thin).
- **Color grading to the plate:** a slight tint, a film grain over the whole frame (CSS noise), a vignette, so that the car and the background read as one picture.
- **Mobile:** in the port the car seems to hover above the containers — on a narrow screen the photo is cropped differently. Recalculate the camera and the path from the actual crop of the plate (`cover`), or fix the crop focus on the lane of motion. Check 390×844 on all 4 plates.

### 2. The garage — `src/components/garage-3d/GarageScene.tsx`
Do not touch the logic of the beats, the data or the labels.
- The reflection environment — `autoshop_01_2k.hdr`. Keep the visible background as it is.
- The frame is lighter and more cinematic:
  - rim light along the silhouette of the car;
  - a soft top softbox;
  - the highlights on the body are readable;
  - no dark dips on the body.
- Parts during disassembly: their own "metallic" material with correct reflections. The inner sides of the panels are dark and matte, so there are no "empty shells".
- The floor: the reflection of the car is readable, but not mirror-like (roughness reflection).

### 3. Road from above — `scenes/RoadScene.tsx`
This is currently the weakest block: an overexposed steppe and toy trees.
- Generate 3–4 **aerial photo plates** with Muse Image, strictly from above: a coastal road, a forest road, a steppe, a suburb. One asphalt lane crosses the frame diagonally, with no cars and no people.
- The camera glides over them, the transition between the zones is a crossfade. Our car drives along the lane from above, with a shadow. The route line is drawn as before.
- At the end — the same map with the routes, but done well: a dark map, glowing lines, city labels.

### 4. Transitions between blocks — `JourneyV2.tsx`, `Bridge.tsx`
Between a 3D block and a bridge — a soft crossfade and a fade to dark of 0.4–0.6 s by progress. Right now the boundaries are visible as an abrupt cut.

## Restrictions
- **Do not touch:**
  - `src/lib/**` (agent, data);
  - `src/app/r/**`, `src/app/cars/**`, `src/app/api/**`;
  - the texts and the timing figures in `stageContent.ts` and `copy.ts`;
  - the models `public/models/*`.
- **Performance:** desktop 60 fps on a Mac; eco modes and fallbacks as now. HDRIs for mobile — 1k only.
- Do not print or commit secrets.
- Small commits, to the branch `tz-13`. **Do not push, do not merge into main.**

## Acceptance criteria
1. Green:
   - `npx tsc --noEmit`;
   - `npm run lint` (0 errors);
   - `npx vitest run` (all tests, old ones unchanged);
   - `npm run build`;
   - `node --check` for the new and changed `.mjs` files.
2. Before/after pairs in `docs/reports/assets/tz13-*`:
   - Seoul, Port, Vladivostok, Handover, Garage (beats 0, 3, 5), Road;
   - mobile Seoul and Port.
3. In the "after" shots:
   - the car has environment reflections, not emptiness;
   - on the wet asphalt at night the reflection of the car and the headlight light on the road are visible;
   - nowhere does the car hover;
   - the road from above is a photo, not a texture with cones.
4. Report `docs/reports/tz-13.md`:
   - raw output of the checks;
   - fps per block;
   - the list of assets and licenses (and in `ASSETS.md`);
   - the time of the Muse Image generation;
   - `git diff --stat main`;
   - what did not work.
