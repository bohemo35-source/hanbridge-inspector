# TZ-02 — SAM 3.1 + Spark vision: car, plate, defects with evidence

First read AGENTS.md (especially "Muse quota saving" and the section on `sam-3.1` — the response format is already verified live). Complete it in full, without questions; what did not work — into the report.

## Goal
Agent tools for inspection photos:
1. `segment_image` — SAM 3.1 finds the car, the plate, the wheels (boxes + masks) → `Evidence` of type `mask`.
2. `find_defects` — Spark vision looks for defects on the cut-out car (SAM `car`), each defect with a box on the original photo → `Finding` with evidence `frame`.
3. A script that runs this on the car photos from `demo-data/<car>/photos/` and draws overlays (images for the video and the report).

Why this way: the live test showed that SAM confidently finds `car` / `license plate`, but returns 0 for `scratch`/`dent`. So SAM = geometry and evidence, Spark = the expert that looks at the cut-out.

## Data
- `demo-data/mini-cooper-s/photos/*.jpg` — 73 real photos (not in git). Photo with a plate for smoke: `photo_243114_0.jpg` (rear view).
- `tests/fixtures/sam/*.txt` — real raw SAM responses (see the README in that folder). Parser tests — only on these, no API requests.

## What to do
1. `src/lib/meta/sam.ts`
   - `samSegment(image: Buffer, concept: string)` → `{ width, height, instances: SamInstance[] }`. Before sending: sharp `.rotate()` (EXIF), resize to fit inside 1280×1280, JPEG q85, data URL. Via `metaFetch` (`/responses`, timeout 30 s).
   - `parseSamText(text)` — strictly per the format in AGENTS.md: `<|box;x1=…;y1=…;x2=…;y2=…;w=…;h=…|>` (key=value), optionally followed by `<|mask;x=…;y=…;data=H,W,<encoded>|>`. Empty string → `[]`.
   - Mask decoding per https://dev.meta.ai/docs/sam/reading-segmentation → binary mask H×W relative to the box. If it does not work after 2 attempts — `mask: null, maskDecoded: false`, work with the boxes, and write it in the report. This is not a blocker.
   - `scaleBox(box, from {w,h}, to {w,h})` — recalculation into the coordinates of the original photo.
2. `src/lib/agent/tools/segment.ts` — `segmentImage({ carId, photoId, imagePath | imageUrl, concepts })`, concepts ⊂ `["car","license plate","wheel"]`, requests in parallel (≤3). Selecting the main instance:
   - `car`: the box with the largest area that crosses the center of the frame;
   - `license plate`: inside or at the bottom edge of the main car's box, aspect ratio 2–6, the largest one. Other plates (other cars in the background) are discarded.
   - Masks saved as PNG to `public/generated/<carId>/<photoId>-<concept>.png` (folder is in .gitignore) → `maskRef`.
3. `src/lib/agent/tools/defects.ts` — `findDefects({ carId, photoId, image })`:
   - crop by the main car's box (+5% margin), ≤1280 px;
   - `sparkJson` with an exact contract (modeled on `src/lib/schema/prompt.ts`): `{ view: front|rear|left|right|front_left|front_right|rear_left|rear_right|detail|interior|engine, panels_visible: Panel[], defects: [{ panel, kind, severity, box:{x1,y1,x2,y2} (in crop coordinates), description_en, description_ru, confidence }] }`;
   - convert the boxes to the coordinates of the original photo; `Finding` with evidence `{ type:"frame", mediaId: photoId, box, panel }`, `verified:false`;
   - the panel dictionary is the shared `src/lib/domain/panels.ts`. If branch `tz-06` (3D map) is already in `main`: move `PANELS`/`PanelId`/`panelLabel` from `src/components/damage-map-3d/panels.ts` into `src/lib/domain/panels.ts`, and leave a re-export in the 3D file (do not change the ids or their order; TZ-06 tests must pass without edits). If it is not merged — create it with the same 13 ids (+ `unknown`) as in `prompt.ts`.
4. `scripts/inspect-photos.ts` (run `npx tsx scripts/inspect-photos.ts <carId> [--limit N]`):
   - takes photos from `demo-data/<carId>/photos/` (by default the first 8 by name, `--limit`), and for each: `segmentImage` + `findDefects`;
   - writes `demo-data/<carId>/out/photos.json` (detections, defects, view, time of each call) and overlays `demo-data/<carId>/out/overlay/<photoId>.jpg`: car box (thin), plate (yellow), defects (red with a kind/severity label), car mask as a semi-transparent fill if decoded. Draw via sharp + SVG composite.
   - Do not run it on all 73 photos: only `--limit 8` in the report.
5. Tests (vitest, no network): parser on three fixtures (5 boxes for plate, 11 for car, 0 for scratch; exact coordinates of the main plate 514,354,756,415); main plate selection; `scaleBox`; if the mask decodes — mask area > 0 and ≤ box area.
6. `scripts/smoke/sam.mjs` — one live `license plate` request on `photo_243114_0.jpg`, print the number of instances and the box of the main plate. `node --check`.
7. `devDependencies`: add `tsx`. `.gitignore`: `public/generated/`, `demo-data/*/out/`.

## Not in this TZ
Blob upload, UI pages, plate blurring (TZ-04), the agent (TZ-05).

## Acceptance criteria
- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` — green; `next build` — once at the end, green.
- `node --check scripts/smoke/sam.mjs`; smoke run, raw output in the report.
- `npx tsx scripts/inspect-photos.ts mini-cooper-s --limit 8` run: the report has a summary per photo (view, whether a plate was found, number of defects, ms) and 2–3 paths to overlays.
- Main plate on `photo_243114_0.jpg` found, other plates discarded.
- Report `docs/reports/tz-02.md` — raw command output + "mask decoded: YES/NO".
- Branch `tz-02`, commits along the way, `git push -u origin tz-02`. Do not merge into main.
