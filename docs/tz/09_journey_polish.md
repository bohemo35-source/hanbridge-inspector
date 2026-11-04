# TZ-09 — Polishing the "Vehicle journey" scene to video quality

First read AGENTS.md, `docs/tz/08_journey_scene.md`, `docs/reports/tz-08.md`, and look at the screenshots `docs/reports/assets/tz08-*.png`. Complete it in full, without questions; what does not work within 2 attempts — into the report, and move on. Branch `tz-09` from `main` → commits; do not push (the reviewer pushes).

## Problem (TZ-08 review, from the screenshots)
The Muse Image backdrops are cinematic, but the homemade low-poly geometry next to them looks cheap and in places broken:
1. The canvas takes ~70% of the height (at 1440×900 the scene is 630 px, with an empty strip below) — `/lab/journey` and the hero on `/` must fill the whole viewport.
2. "Sea": the car sits on a grey plane, next to a white cube and a red cylinder; the water and the ship are not visible.
3. "Road & bridge": containers hang in the sky as semi-transparent colored rectangles.
4. "Inspection in Korea": the bridge cables cut through the car, the sky is white, it does not look like an inspection site.
5. The geometry horizon does not match the photo horizon — a visible "seam".

## Goal
A frame that is not embarrassing to show large: **the stage photo (Muse Image) is the hero, full screen**, with the car and a minimum of geometry in front of it, merged into one picture by fog and light. 2.5D principle: a background plate + foreground, not an attempt to build the world in code.

## What to do (only `src/components/journey-3d/*`, `src/app/lab/journey/*`, `scripts/journey/capture.mjs`)
1. **Layout:** non-compact mode — a sticky container of exactly `100svh`, the canvas fills it; `compact` (for the TZ-05 report) — as before. Check that `/lab/journey` renders the non-compact mode.
2. **Background plate instead of the dome:** the stage photo is a full-screen plane in camera space (or `scene.background` as a texture) with a light parallax from progress (±2–3%), and a 0.6 s cross-fade between stages. The photo horizon sits at ≈ 40% of the frame height — the camera and ground are set up so the geometry horizon coincides with it; the seam is covered by a fog strip in the same color as the bottom edge of the photo — take the average color of the bottom 10% of the picture on load.
3. **Foreground per stage** (hide the rest of the stage geometry, do not delete the generators):
   - `inspection`: dark glossy floor (MeshStandardMaterial roughness 0.35) + two softboxes (RectAreaLight or emissive panels) above the car, no cables; a "Report ready" badge.
   - `korea_road`: only the road surface with markings, receding to the photo horizon; the bridge — only in the photo. Remove the containers.
   - `port_busan`: road/pier up to the edge, 1–2 rows of containers **on the ground** next to the road (opaque, with shadow), nothing in the air.
   - `sea`: water (shader) to the horizon, the ro-ro hull under the car — a readable dark hull with a white superstructure behind the car, the car on the deck; light camera sway. Remove the white cube and the red cylinder, unless they are parts of the ship.
   - `vladivostok`, `customs`, `delivery`: road + fog; hills only as dark silhouettes at the horizon (or remove them if they conflict with the photo); the "Cleared" gate — on `customs`.
4. **Car:** rim light matching the sky color of the stage, a soft contact shadow under the wheels (a plane with a radial-gradient texture), headlights/taillights with bloom (UnrealBloomPass is already allowed by TZ-07; eco mode turns it off).
5. **Captions:** the right-hand list of stages must be readable on a light sky (semi-transparent backing); the left stage title must not overlap the car.
6. Do not touch: stage ids, the `route.ts` API (`stageAt`/`progressOf`), `getShippingStatus`, `JourneyScene` props, the backgrounds in `public/journey/` (do not regenerate them).

## Acceptance criteria
- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (all 47+ with the old tests unchanged), `npm run build` — green; raw output in `docs/reports/tz-09.md`.
- New screenshots `docs/reports/assets/tz09-<stage>.png` (7 stages, 1440×900) + `tz09-mobile.png`; on each: the canvas fills the frame, no objects hanging in the air, no visible horizon seam. In the report — a before/after pair for `sea` and `korea_road`.
- Scene triangles ≤ 250 000; the size of `public/journey/` unchanged.
- `git diff --stat` — only the allowed files (+ `public/journey/proof/`, `stageContent.ts`).

## Part B — longer and more informative (at Arthur's request)
Right now the 7 stages ≈ 7 scroll screens (~25 s) and only a title. We need ≈ 2 screens per stage (~50–60 s of full scroll), and in each stage — what happens to the client's car.

1. Section height: desktop `1400vh`, mobile `1000vh`. Inside each stage — 3 "beats" by progress (`route.ts`: add a pure function `beatAt(progress) → { stage, beat: 0|1|2, local: 0..1 }`, with tests; do not change `stageAt`/`progressOf`):
   - beat 0 — cinematic entrance (camera and car, as now), the stage title;
   - beat 1 — an information card (left side, glass/blur, must not overlap the car) with the headings "What happens", "Documents", "Who is responsible", "What the client sees", "Usually takes" (RU copy lives in src/components/journey-3d/stageContent.ts);
   - beat 2 — the "proof" of the stage (see item 3), then the transition to the next stage.
2. Texts — in a separate file `src/components/journey-3d/stageContent.ts` (RU/EN, typed by `StageId`), field `typical: { ru: string; en: string }` — the timings **exactly as below** (these are the company's real timings from Arthur — do not change or round them). **No prices, duties or amounts** — only the process. Stage card: "What happens", "Documents", "Who is responsible", "What the client sees", "Usually" (= `typical`); the RU headings are as in item 1.
   - `inspection` — `typical`: "Usually: on the day of choice if before 16:00, otherwise the next day". Process: the manager selects and sends options; the client chooses; inspection by checklist (body, paint gauge, OBD diagnostics, interior, running gear), photos/video; the report with the verdict goes to the client the same day; after the client's decision — booking, 10 days to pay (the earlier the payment, the earlier the car arrives at the site).
   - `korea_road` — `typical`: "Usually: 1–2 working days". Export documents, deregistration (말소), preparing the car for shipping, transfer to the port.
   - `port_busan` — `typical`: "Usually: up to 7 days from purchase to loading — ships depart twice a week". Acceptance at the terminal, photo record of the condition, loading, bill of lading (B/L).
   - `sea` — `typical`: "Usually: 1–2 days". The sea crossing to Vladivostok; the client sees this stage.
   - `vladivostok` — `typical`: "Usually: unloading and customs take about 10 days on average" — the overall timing shared with the `customs` stage; repeat it there too. Unloading, inspection after delivery, arrival photos.
   - `customs` — `typical`: same as above. The broker submits the documents (SBKTS/EPTS — Russian vehicle documents — and the customs declaration); release — "Cleared".
   - `delivery` — `typical`: "Usually: about 9,000 km to Moscow, 12–14 days". Car carrier / rail to the client's city, or self-pickup; handover of keys and documents.
   - Summary under the progress bar — "About 4–5 weeks from payment to Moscow". The wording is fixed; the basis is up to 7 + 1–2 + ~10 + 12–14 days.
3. "Proof" of the stage (beat 2), the data — only real data or from props:
   - `inspection`: 3–4 thumbnails of real photos from `public/journey/proof/inspection-*.jpg` (copy 4 MINI photos from `demo-data/mini-cooper-s/photos/` with the **plate blurred** via sharp blur over the box from `segmentImage`; if no plate is found — do not use that photo) + a counter "N findings, M confirmed" from the prop `reportSummary?` (if it is absent — the block is hidden);
   - `port_busan`, `vladivostok`: a check icon "Photo record of condition", without photos if there are none;
   - `customs`: an animated document checklist;
   - the others — no block.
4. The stage progress bar on the right shows the beats too (three dots under the active stage); clicking a stage smoothly scrolls to its start.
5. `prefers-reduced-motion` / no WebGL: the fallback card strip shows the same texts from `stageContent.ts`.

Part B acceptance criteria: tests for `beatAt` (boundaries, monotonicity, all 21 beats reachable); screenshots `tz09-<stage>-info.png` (beat 1) for the 7 stages; a full scroll ≈ 50–60 s at 1440×900 (estimate from the section height — state it in the report); `public/journey/proof/` contains no photo with a readable plate (verify by eye, state it in the report).
