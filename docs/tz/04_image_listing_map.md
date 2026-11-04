# TZ-04 — Listing photos without plates (Muse Image)

First read AGENTS.md. Complete the task in full; record problems in the report.

## Goal
Photos for a listing: plates hidden, background brought to a studio look via Muse Image, while **the car itself is not changed**. Do NOT build a damage map: it is replaced by the 3D body map from TZ-06 (`InspectionMap`, with its own fallback without WebGL).

## Trust principle (important for the jury)
The report, as evidence, always uses the ORIGINAL frames. A processed photo is labeled with the badge "Listing image · plate hidden · background edited by Muse Image · vehicle pixels unchanged" and is never used as evidence.

## What to do
1. Hiding the plate (deterministic): `license_plate` boxes from TZ-02 → sharp: blur (sigma ≥ 25) + a "HANBRIDGE" badge on top, with an 8% margin from the box. If no plate is found — the photo does not go into the listing; in trace: `skipped: plate_not_found`.
2. Background: `src/lib/meta/image.ts` — `editImage({image, mask, prompt})` via /images/edits; the mask = inverse of the car mask (SAM target `car`). Prompt: neutral light studio, soft shadow, no text. If /images/edits does not accept the mask or the result changes the car — fallback: only the plate is hidden, original background. "Car not changed" check: in code, compare the pixels inside the car mask (original vs result) — average difference > threshold → discard the result and write it to trace.
3. Hero image for the report page: `generateImage` via /images/generations (abstract background in brand style, no cars, no text), cache in Blob, generate once per report.
4. Agent tool: `make_listing_photo({carId, photoId})` → `{url, plateHidden, backgroundEdited, rejectedReason?}`. The plate box is taken from `segment_image` (TZ-02).
5. `/lab/image` (dev only): before/after, pixel difference inside the car mask.
6. `scripts/smoke/image.mjs` — live /images/generations (1 image) + an attempt at /images/edits; the time of each call in the output.

## Acceptance criteria
- tsc / build / lint / vitest green; raw output in docs/reports/tz-04.md.
- `node --check scripts/smoke/image.mjs`; smoke output in the report.
- On the MINI demo photo: before/after files in `docs/reports/assets/` + the number "diff inside the car mask".
- No image from Muse Image ends up in `Finding.evidence` (test on the report schema/assembly).
