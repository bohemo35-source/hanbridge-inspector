# CONTEXT — Hanbridge Inspector

<!-- @agent: muse-code · @project: hanbridge-inspector · @purpose: long-lived project context · @created: 2026-10-28 · @updated: 2026-11-03 claude-code -->

AI inspection of used cars in Korea for CIS / Central Asia buyers: media → findings with evidence → verifier → verdict BUY/NEGOTIATE/WALK AWAY → public report `/r/:id` + chat. Meta Global AI Developer hackathon.

## Stack and rules
Next.js 15 + TS strict + Tailwind, Vercel Blob, zod, sharp. Meta API only via `src/lib/meta/*` (muse-spark-1.3, sam-3.1, transcribe, muse-image-1.0; open-weight — Baseten `meta-models/muse-spark-open-1026`). Secrets only in env. Details, domain rules (thickness gauge ≤150/151–220/>220, evidence is mandatory, handoff <0.6) and prohibitions (no code from scratch, no customs duty figures) — in `AGENTS.md`.

## Key entry points
- `src/lib/schema` — Inspection/Finding/Evidence/Report; `src/lib/domain/panels.ts` — 13 panels.
- `src/components/damage-map-3d/buildCar.ts` — parametric car (TZ-06); copying from the import is prohibited.
- `src/components/journey-3d/` — road scene (TZ-08/09): `route.ts` (7 stages, `beatAt` — 3 beats/stage), `stageContent.ts` (RU/EN texts), `scenery.ts`, `JourneyScene.tsx` (2.5D: photo plates `public/journey/` + minimal foreground; proof — `public/journey/proof/`).
- `src/lib/agent/tools/` — segment, defects, shipping (`getShippingStatus`, fixture), listing (TZ-04: `makeListingPhoto` — number from `segmentImage`, car diff guard; `getOrCreateHeroImage`; listing is never evidence), `src/lib/meta/image.ts` (generations/edits; edits do not accept a mask).
- TZ-05: `src/lib/agent/orchestrator.ts` (Spark tool calling, ≤16 steps, SSE `POST /api/inspections/:carId/run`, page `/inspect/:carId`), `src/lib/agent/verifier.ts` (open-weight Baseten `src/lib/meta/sparkOpen.ts`, fallback Spark; model recorded in trace), tools `tools/{diagnostic,inspector}.ts`, catalog `src/lib/agent/catalog.ts`, store Blob/`data/reports/`, pages `/r/:id` (noindex, OG), `/cars`; run: `node scripts/e2e/run-cars.mjs [carId…]`.
- Labs: `/lab/3d`, `/lab/journey` (production 404).
- Home `/` — journey v2 (`src/components/journey-v2/`): `blocks.ts` (BLOCKS/PLATES, vh), `SceneBlock` + `sceneKit` (WebGL ≤2 canvases, HDRI `setHdri`), `scenes/PlateScene.ts` (Muse Image plate + 3D car: plate frame via `setViewOffset`, HDRI from `public/hdri/` CC0, wet mirror, headlight spots, AO; debug `?debug=plate&envrot=&envint=&exp=&key=&rim=&fxoff=`), `scenes/RoadScene.tsx` (aerial photos `public/journey-v2/aerial-*.jpg` + map), `Bridge.tsx`, `FilmGrade.tsx` (vignette/tone/grain), `useStageFade.ts` (block crossfade: `LEAD_VH` 118 = margin −118vh + height +118vh). Garage — `src/components/garage-3d/GarageScene.tsx` (+ `/lab/garage?beat=N`).
- Screenshots: `node scripts/journey-v2/capture.mjs http://localhost:3100` (env `ONLY/AT/PREFIX/SUFFIX/OUT_DIR/QUERY/TRANS/SKIP_*`), `node scripts/garage/capture.mjs http://localhost:3100 <filter>`; needs system Chrome (GPU) and sandbox exit (localhost).

- Home `/` (since 02.11, branch film-v4): `Hero` + film v4 `src/components/film4/` (`story.ts` — scenes/lines/transitions, `Film4.tsx` — player, `Inserts.tsx` — inserts and maps) + garage studio in the epilogue. Garage studio: `src/components/garage-studio/` + `src/lib/garage/data.ts`, page `/garage/:carId`. Design tokens — `src/app/globals.css`, fonts — `src/app/layout.tsx`. Film contact sheets: `node scripts/film4/capture.mjs <url> <outDir> [id@t,…|all]` (needs sandbox exit; the WebGL garage cannot be captured headless — view it in the app's browser).

- Polish, 03.11: `src/components/garage-studio/slice.ts` (exact boundaries of template parts + seams), `src/app/api/blob-upload` (client-side video upload to Blob), `src/lib/agent/toolModels.ts`; landing `src/components/hero/Hero.tsx` («How it was before», «How the agent worked — up to 16 steps», assets `public/landing/`). Video: `scripts/film4/record-film.mjs` (film recording from the site: window = CSS 1600×900 @1.2, each frame 1920×1080), `scripts/film4/play-check.mjs` and `scripts/film4/stutter-scenes.mjs` (judder measurement per scene; report `docs/reports/film-stutter-0311.md`), film clip timing — `src/components/film4/clipTime.ts`; upload-video rule (the thickness-gauge screen is confirmed by the voice) — `verifier.ts` + `src/lib/agent/orchestrator.upload.test.ts`, `scripts/garage/studio-shot.mjs`, `scripts/e2e/upload-{run,page}.mjs`, `scripts/video/{tz11_timelapse,blur_pain,jury_v5,x_cut}.py`. Final files for upload — `~/Documents/META-HACKATON/UPLOAD/` (README inside), original recordings — `~/Documents/META-HACKATON/recordings/`.

## Commands
`npx tsc --noEmit` · `npm run lint` · `npx vitest run` · `npm run build`. Each TZ (technical spec): branch `tz-0N`, report `docs/reports/tz-0N.md` with raw output, no push to main without an explicit "do it".

## Live state (updated 01.11.2026, Claude)
- **Demo car media in Vercel Blob** (store `store_W8Cg01wtFGFsm1zk`, same token on Vercel): `demo/<carId>/{photos,video,sheets,out,…}`; 5 cars, 512 files, ~349 MB of the Hobby 1 GB limit (when exceeded, Blob is blocked for 30 days, including reports and hero).
- Manifest `src/lib/agent/blob-manifest.json` (in git) — map `carId → folder → file → URL`. Read by `src/lib/agent/media.ts`: if local `demo-data/<carId>` exists → it is used (dev, as before); if not → the file is downloaded from Blob to `/tmp` once per instance. `MEDIA_SOURCE=blob|local` forces the source.
- What was uploaded: photos as is; `inspector_report_ru.txt`; `out/photo-index.json` (Glimmer indexes for all 5 cars, so the run does not index photos live); video — light copies (144p, AAC 64k mono: the agent needs the inspector's voice), except `mini-cooper-s/paint_gauge.mp4` (original, frames are read from it). OBD-PDF in Blob — a copy without personal data (`scripts/redact_diag_pdf.py`: name/address/phones/links removed, VIN truncated); the 530i original contained a name and a phone number.
- Re-upload/add: `node --env-file=.env.local scripts/upload-demo-to-blob.mjs [--cars a,b] [--budget 150]` (idempotent, resumes where it stopped; `--verify` — HEAD on all URLs). Photo index for a new car: `npx tsx --env-file=.env.local scripts/build-photo-index.ts <carId>`.
- Vercel compatibility of the run: `ffmpeg-static` (`src/lib/agent/tools/ffbin.ts`, duration from `ffmpeg -i`, no ffprobe; `next.config.ts` puts the binary into the route trace), generated files are written to `/tmp` (`src/lib/runtime/generated.ts`), SAM masks are not saved on Vercel, the listing is published to Blob via `publishMedia`.
- Run time: hero is generated in parallel, verifier runs over 4 findings at once, after 235 s the listing is discarded without re-check (route aborts at 300 s). Measurements in "as on Vercel" mode (without `demo-data`, without token): Kia Morning 94 s, MINI over HTTP 128 s.
- **Vercel is missing** `GLIMMER_API_KEY` and `GLIMMER_BASE_URL` (only `META_API_KEY`, `BASETEN_API_KEY`, `BLOB_READ_WRITE_TOKEN` exist): without them the open-weight indexing step is skipped. Nothing deployed, committed or pushed.

## Language and authorship (TZ-FINAL-0411, 04.11)
- The repository is English-only; Cyrillic is allowed only in RU UI copy (`?lang=ru`), the RU film, real data (`demo-data/**`, inspector sheets, reviews), Russian keyword regexes for real inputs, RU UI tests/fixtures and raw command output. Russian originals of the translated docs: `~/Documents/META-HACKATON/ru-archive-0411/` (outside git).
- Coding model: "Muse Wonder (inside Muse Code, Meta's coding agent)" on first mention, then "Muse Wonder". `@agent: muse-code` = code written by Muse Wonder in Muse Code.
- One photo number everywhere: "100 photos and a few videos in a chat".
