# TZ-11 — Vehicle journey v2: 2:45 of scroll, short 3D scenes + "bridges", the garage inside

First read:
- `AGENTS.md`, section "Muse quota saving": you work through a paid API;
- this file;
- `docs/reports/tz-10b.md`;
- `src/components/garage-3d/GarageScene.tsx` (only its props and how it loads the model);
- `src/components/journey-3d/stageContent.ts` (the stage texts with the company's timings — reuse them, do not change the numbers).

Complete it in full, without questions. What does not work within 2 attempts — record in the report and move on.

Branch `tz-11` (created from `main`; the garage is already merged). Commits along the way, do not push.

## Goal
The main page `/` — one cinematic story of about 2:45 of calm scrolling: **our car** (the same 3D model `public/models/car-v2.glb` as in the garage) travels the route from Korea to the client. Every stage is verified and visible.

The level is a car manufacturer's commercial. Right now the main page uses the old `journey-3d` scene, which Arthur rejected ("this is not 3D"). Do not delete it; just stop using it on `/`.

## Architecture
**Not one huge world, but a chain of blocks.** Each 3D block is a separate component with its own `WebGLRenderer`. It is mounted only when the block is within 1 screen of the viewport, and fully released (`dispose`, `forceContextLoss`) when it has moved more than 2 screens away. At most 2 canvases live at the same time.

Between the 3D blocks — a **bridge**: a sticky section with a full-screen Muse Image picture. On it, a slow push-in and parallax (CSS/2D, no WebGL) and glass cards with text. The bridge must feel like a continuation of the scene: the same light, the same direction of motion.

New folder `src/components/journey-v2/`:
- `JourneyV2.tsx` — the orchestrator: the list of blocks, each block's height in `vh`, the scroll progress inside a block is passed into the block, the overall progress goes to the indicator;
- `blocks.ts` — pure functions and data: the order of blocks, heights, `blockAt(progress)`, `stageForBlock`;
- `useCar.ts` — a shared loader for `car-v2.glb` (a cache of one `GLTF` per page; each block clones the scene);
- `scenes/*.tsx` — the 3D blocks;
- `Bridge.tsx`, `Hud.tsx`, `Reviews.tsx`.

The blocks use a shared helper: renderer, ACES, the PMREM environment, bloom only on desktop, eco mode as in the garage.

## Blocks and timing
Desktop: 100vh of scroll ≈ 3 s of calm scrolling.

| # | Block | Type | Height | What is in the frame |
|---|---|---|---|---|
| 1 | Seoul, night bridge | 3D | 500vh | Night, a long bridge over a wide river. City lights on both banks (Points + a Muse Image panorama in the distance), a stream of headlights. Our car drives across the bridge, the camera moves alongside, low, then rises. Caption: "Purchase in Korea — we find the car at auctions and with dealers" (RU copy lives in src/components/journey-v2/copy.ts) |
| — | Bridge "Selection" | bridge | 300vh | Cards of the `inspection` stage (what happens, who is responsible, timings) |
| 2 | Inspection garage | 3D | as in `GarageScene` | `<GarageScene report={…} lang={…} />` with no changes to the component. The report is the MINI's latest report (as in `/cars`), passed from the server |
| — | Bridge "Report and documents" | bridge | 300vh | Cards of `korea_road` (documents, 말소, 1–2 working days) |
| 3 | Port of Busan, loading | 3D | 450vh | Night. Rows of containers (InstancedMesh), 2–3 gantry cranes, wet asphalt with light reflections. A ro-ro ship with its stern ramp lowered. The car drives up the ramp into the hold, the ramp rises and closes. Caption `port_busan` (up to 7 days, ships twice a week) |
| — | Bridge "Sea" | bridge | 450vh | The calmest one. The night sea, the moon, the wake; cards for `sea` (1–2 days), "documents one step ahead" |
| 4 | Vladivostok | 3D | 400vh | Dawn, rounded forested hills (silhouettes + Muse Image in the distance), a cable-stayed bridge in the background. The ship is at the quay, the ramp lowers, the car drives off onto the quay. Caption `vladivostok` |
| — | Bridge "Customs" | bridge | 300vh | The customs gate, a "Cleared" stamp (animation); cards for `customs` (SBKTS/EPTS, ~10 days). No amounts |
| 5 | Long road | 3D | 450vh | **Camera from above.** The car drives along a long road; the landscape changes (coast → forest → steppe) — ground tiles with Muse Image color/texture, instanced trees. Ahead of the car a thin route line is "drawn" on the ground. At the end the camera rises to a simplified map: lines from Vladivostok to Moscow (~9,000 km, 12–14 days), Novosibirsk, Almaty, Tashkent |
| 6 | Handover | 3D | 300vh | Golden hour, the client's yard/garage. The car stops, the headlights go out. Warm light. A card "Keys and documents handed over" (do not model hands or faces). The route line closes into a loop |
| 7 | Reviews | section | 200vh | `Reviews.tsx` — see below |
| 8 | Finale | section | 100vh | A calm camera pull-back from the car (a static frame or light 3D). "One link for the car — from Korea to your garage". Buttons "Find a car" (→ `/cars`) and "Demo inspection report" (→ the latest `/r/:id`) |

The total under the indicator: "About 4–5 weeks from payment to Moscow" (fixed wording; RU copy lives in the copy file).

## Muse Image assets
You generate them yourself, in one run: `scripts/journey-v2/generate-assets.mjs`, sequentially. Save into `public/journey-v2/` + `prompts.json` (prompt, model, date, ms). JPEG q82, ≤ 1 MB each.

One style for all frames: cinematic, premium automotive, anamorphic, soft haze; no people, no text, no logos and no recognizable brands.

Assets:
- **environment panoramas** for the 3D blocks (reflections + the far background): `env-seoul-night`, `env-port-night`, `env-vladivostok-dawn`, `env-golden-hour`;
- **bridge pictures**: `bridge-sourcing` (a night highway to the inspection center), `bridge-documents` (a car carrier leaving the bay at night), `bridge-sea` (the night sea, a ship, the moon, the wake), `bridge-customs` (the customs gate at dawn);
- **textures**: `tex-asphalt-wet`, `tex-terrain-coast`, `tex-terrain-forest`, `tex-terrain-steppe` (seamless, top-down view).

Vladivostok's hills: the prompt wording is "rounded forested hills (sopki), Russian Far East". Not volcano-like peaks — last time volcanoes came out.

## The car
- The same `car-v2.glb` in all the 3D blocks: normalized as in the garage (length 4.4 m).
- The headlights are on at night (emissive sprites + bloom).
- The wheels turn when moving. The wheels are part of one mesh, so use a soft body vibration (a slight tilt and a 1–2 mm shake) instead of rotation.
- In the 3D blocks the car moves with the scroll progress, not with time. Scrolling up rewinds exactly.

## HUD (always visible)
- The stage indicator on the right (on mobile — compact at the top). Stages: Purchase → Inspection → Documents → Port → Sea → Arrival → Customs → Delivery. The current one is highlighted. A click — a smooth scroll to the start of the block.
- One caption zone (bottom left), the text changes by beat.
- RU/EN switch (default EN; `?lang=ru`). The texts — `stageContent.ts` and the new `journey-v2/copy.ts`.
- The "Find a car" button is always visible.

## Reviews
The reviewer will place `public/reviews/manifest.json`: `[{ id, client, city, car, video, poster, quote_ru, quote_en }]` + mp4 files and posters.
- Show 2–3 cards: a video without sound with autoplay on visibility, a poster before loading, a quote, "client, city, car".
- **If the file is absent — the block is hidden.** No invented reviews, names, or stars.

## Performance and fallbacks
- Desktop 60 fps on a Mac. On mobile: pixelRatio ≤ 1.5, no bloom and no reflections, block heights ×1.3.
- `prefers-reduced-motion` / no WebGL: a vertical strip — one frame per block (Muse Image pictures) with the same captions and cards. The garage has its own fallback.
- Budget per 3D block ≤ 400 000 triangles (without the car).

## Files
Allowed:
- `src/components/journey-v2/*`
- `src/app/page.tsx` (connect `JourneyV2` instead of the old hero)
- `src/app/lab/journey-v2/*`
- `scripts/journey-v2/*`
- `public/journey-v2/*`
- `tests/journey-v2-*.test.ts`
- `docs/reports/tz-11.md` and `docs/reports/assets/tz11-*`

Do not change `garage-3d/*` — only import it. Do not change `journey-3d/*` except for importing `stageContent`.

## Tests (vitest, no WebGL and no network)
- `blockAt` — boundaries and monotonicity;
- the sum of heights = the length of the history;
- every HUD stage is reachable;
- `stageForBlock` covers all blocks;
- `copy.ts` — every text has `ru` and `en`;
- reviews: with an empty manifest the block does not render.

## Acceptance criteria
1. Green:
   - `npx tsc --noEmit`;
   - `npm run lint`;
   - `npx vitest run` (all old + new tests);
   - `npm run build`;
   - `node --check` for the new `.mjs` files.
2. `scripts/journey-v2/capture.mjs` (on a Mac, GPU, like `scripts/garage/capture.mjs`). Screenshots at 1440×900:
   - the middle of each 3D block and each bridge: `tz11-01-seoul.png`, `tz11-02-sourcing.png`… in order;
   - mobile 390×844: Seoul, Busan, the road from above;
   - the fallback.
   - FPS from `data-fps` of each block.
3. On the screenshots:
   - the car is the same one and stands on the ground/deck;
   - no objects float in the air;
   - the text on the bridges is readable;
   - Vladivostok has hills, not volcanoes;
   - the route line is visible on the road.
4. Report `docs/reports/tz-11.md`:
   - raw output of the checks;
   - the time of each Muse Image call and the asset sizes;
   - triangles and fps per block;
   - the full page height and the estimated scroll duration;
   - `git diff --stat main`;
   - what did not work.

## Recording
After review, Arthur records `/` with a full scroll (~2:45). These are frames 0:00–0:25 and 2:20–2:52 of the video, and the clip for X.
