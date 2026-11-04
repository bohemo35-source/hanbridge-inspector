# TZ-05 — Orchestrator agent, verifier, report /r/:id, run on real MINI

`main` already contains TZ-01..04, 06, 08, 09. Read AGENTS.md, CONTEXT.md, PROJECT-STATUS.md and docs/reports/tz-02.md, tz-03.md, tz-04.md (they contain raw tool runs on the real MINI). Spark tool calling has been verified: **YES** (native `tool_calls`), JSON mode is not needed. Complete the task in full; record problems in the report.

## Goal
An agent on Muse Spark runs the inspection itself: it decides which tools to call and in what order, collects findings with evidence, verifies each one in a separate pass (a verifiable agent), and issues a verdict or hands the car to a manager. The client gets a link /r/:id with the report, the map, the agent trace and a chat.

## Agent tools
**Already implemented — the agent only calls them, do not rewrite them:**
| tool | function | file |
|---|---|---|
| `segment_image` | `segmentImage` | `src/lib/agent/tools/segment.ts` |
| `find_defects` | `findDefects` | `src/lib/agent/tools/defects.ts` |
| `transcribe_note` | `transcribeNote` (the inspector's voice from **any** inspection video: in the videos of all 5 cars the inspector narrates the measurements) | `src/lib/agent/tools/voice.ts` |
| `read_gauge_video` | `readGaugeVideo` (the color of the gauge screen; the digits are not read — this is normal) | `src/lib/agent/tools/gauge.ts` |
| `make_listing_photo` | `makeListingPhoto`, hero — `getOrCreateHeroImage` | `src/lib/agent/tools/listing.ts` |
| `get_shipping_status` | `getShippingStatus` | `src/lib/agent/tools/shipping.ts` |
| `analyze_paint_readings` | `findingsFromPaintReadings` | `src/lib/domain/paint.ts` |

New (to do in this TZ): `read_diagnostic_report`, `read_inspector_report`, `estimate_landed_cost`, `handoff_to_manager`, `finalize_report`; `read_auction_sheet` — only if the car has a photo of the auction sheet (currently none does — do not build it).

Car data: `docs/DEMO_CARS.md`. The videos are long (3–9 min): call `transcribe_note` on 1–2 videos per car (the agent chooses), not on all of them; `read_gauge_video` — only where `paint_gauge.mp4` exists (MINI). Cross-checking the sources is the main point: voice vs screen color vs photos vs the inspector's text; agreement of two independent sources raises confidence, a contradiction → `conflict` (example from tz-03: the MINI roof reads 161 µm while the inspector said "factory" (Russian in the original input) — explanation: "contrasting roof").

Tools called in the orchestrator loop: `segment_image`, `transcribe_note`, `read_auction_sheet` (if a sheet photo exists), `read_diagnostic_report`, `read_inspector_report`, `analyze_paint_readings`, `find_defects`, `read_gauge_video`, `make_listing_photo`, `get_shipping_status`, `estimate_landed_cost`, `handoff_to_manager`, `finalize_report`.

- `read_auction_sheet({mediaId})` — Spark vision on a photo of a Korean auction sheet → `{grade, mileageKm, year, repairMarks: [{panel, code, meaning_en, meaning_ru}], rawKoreanLines[]}`; each mark → evidence `auction_sheet` with the verbatim line.
- `analyze_paint_readings` — from TZ-01 (deterministic).
- (schema) add `"obd"` to the enum `EvidenceSchema.type` and to `FINDINGS_DRAFT_SPEC`.
- `read_diagnostic_report({carId, file})` — LAUNCH OBD diagnostic PDF from `demo-data/<carId>/sheets/*.pdf` (available for BMW 530i and Kia Morning): text via `pdftotext` (if empty — pages are converted to images and go to Spark vision) → `{ systemsChecked, faultCodes: [{ code, system, description }], mileageKm, vin, scanTime }`; each code → evidence `{ type:"obd", mediaId:<pdf>, quote }`. 0 codes → a positive finding "electronics without faults" (severity low, info). Do NOT output workshop names, phone numbers or addresses from the PDF into the report or the trace; the VIN — only with the last 6 characters shown.
- `read_inspector_report({carId})` — `demo-data/<carId>/inspector_report_ru.txt` (the inspector's text) → statements per panel with a quote (evidence `transcript`, `quote`), so the agent can check the inspector's words against the photos and the gauge.
- `get_shipping_status` — from TZ-08 (`src/lib/agent/tools/shipping.ts`, fixture, `source: "demo_fixture"`), stages `inspection…delivery`.
- `estimate_landed_cost` — ALWAYS `{status:"manager_quote_required"}` (no customs figures in the demo).
- `handoff_to_manager({reason})` — sets `verdict.handoff = true`, the reason goes into the report.

## What to do
1. `src/lib/agent/orchestrator.ts`:
   - Loop: `sparkChat(tools)` → execute tool_calls (independent ones in parallel) → return the results as `role:"tool"` → until `finalize_report` or 16 steps. The agent decides the order itself; the car's available media are passed in the first message (what exists: photos, videos, voice, sheets, inspector's report).
   - Each step → `AgentStep {i, tool, argsSummary, why, ms, ok, outputSummary}` in `trace`. System prompt: "every statement — only with evidence; no evidence — no finding".
2. `src/lib/agent/verifier.ts` — a separate pass over each finding on an **open-weight model** `muse-spark-open-1026` via Baseten (`src/lib/meta/sparkOpen.ts`, see AGENTS.md; if `BASETEN_API_KEY` is absent or Baseten is unavailable — fall back to `muse-spark-1.3`, and the verifier model is written to trace). This way the orchestrator (closed Spark) and the verifier (open weights) are different models: an honest independent check + a nomination for Best Open Weight. The verifier receives ONLY the finding + its evidence (the frame cropped by box with mask, the quote, the measurement, the sheet line) and answers `{supported: boolean, confidence, note}`. Not confirmed → `verified:false`; the finding goes to the "Unconfirmed" section and does not affect the verdict. A source contradiction (gauge ≤150 but voice says "repaint") → mark `conflict`.
3. Verdict: deterministic rules over the confirmed findings (critical → WALK_AWAY; high or ≥3 medium → NEGOTIATE; otherwise BUY) + a textual justification from Spark. Handoff rules from AGENTS.md.
4. Progress streaming: `POST /api/inspections/:id/run` → SSE events for the steps; the UI `/inspect/:id` shows the trace "live" (tool icon, why, time). This is the key frame of the video.
5. Report `/r/:id` (public, no login, `noindex`): car header + verdict in large type; the **3D map** `<InspectionMap report={report} lang={lang} mediaUrl={(id) => url} />` from TZ-06 (`mediaUrl` → URL of the original frame in Blob; set `report.vehicle.bodyType/doors` via `guessBodyType(make, model)`); the list of confirmed findings — each with a thumbnail of the frame with mask / a quote with timecode (click → play the audio from tStart) / a measurement / a sheet line, and confidence; an Unconfirmed section; listing photos; an "Agent trace" block; a chat with the expert (TZ-01) about this report; a "Delivery" tab — `<JourneyScene compact currentStage={shipping.stage} bodyType=… />` from TZ-08. EN/RU switch. OG image for sharing.
6. Storage: `src/lib/store/reports.ts` — if `BLOB_READ_WRITE_TOKEN` is set: the report JSON in Vercel Blob `reports/{id}.json`, original media (only the frames/fragments referenced by evidence; photos — with the plate blurred via the `makeListingPhoto` logic; **there must be no readable plate numbers in Blob or in the report**) in `media/{carId}/…`; without the token — locally `data/reports/*.json` + `public/generated/` (both in .gitignore). id — nanoid(10).
7. (Not to do in this TZ) the `/inspect/new` upload flow — the demo runs on the ready cars from `demo-data`. Instead, `/inspect/:carId` runs the agent on a car from the catalog and shows the trace live (item 4).
8. Catalog: `scripts/e2e/run-cars.mjs [carId…]` — a full agent run on each car from `demo-data/<carId>/` (MINI + up to 4 cars), uploads the originals to Blob, the report to Blob; prints the trace, the findings (total/confirmed/rejected), the verdict, the report URL, the time. Page `/cars` — list of reports (photo, make/model, verdict, link to `/r/:id`).
9. README: update "Built during the hackathon" with links to the PRs/commits of TZ-01..05, an architecture diagram (mermaid), and which Meta models are used where.

## Acceptance criteria
- tsc / build / lint / vitest green; raw output in docs/reports/tz-05.md.
- `node --check scripts/e2e/run-cars.mjs`; a run across all cars from demo-data, full output in the report; `/cars` shows all reports.
- MINI findings come at least from the photos (SAM+Spark) and the gauge (video `paint_gauge.mp4`); voice and the auction sheet — only if the car has them, otherwise the agent writes "source absent" in the trace.
- Verifier test: feed a finding with someone else's frame → `verified:false`.
- Handoff test: confidence 0.5 → `handoff:true`.
- `/r/:id` opens in incognito on Vercel Preview; desktop + mobile screenshots in `docs/reports/assets/`.
- Full run time ≤ 90 s (if longer — where the bottleneck is, per the trace).
