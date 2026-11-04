# TZ-03 — Inspector voice and paint-gauge video → findings with timecodes

First read AGENTS.md. Complete the task in full; record problems in the report.

## Goal
Agent tool `transcribe_note`: the inspector dictates the walk-around (RU/EN/KO), Muse Voice Transcribe produces the text, and Muse Spark breaks it down into findings by panel; each finding references a quote with a timecode (`Evidence` of type `transcript`).

## What to do
Part A — voice (`transcribe_note`). For cars without a voice note the agent skips this source.

1. Recording in the browser: `VoiceNote` component (MediaRecorder) → convert to WAV 16 kHz mono on the client → upload to Blob. Also accept an uploaded WAV/M4A (convert M4A to WAV on the client via WebAudio decode).
2. `src/lib/meta/asr.ts` — `transcribe(wavUrl)`: download the WAV from Blob, multipart: `request` = JSON `{model:"muse-voice-transcribe-1.0", audioEncoding:"WAV", mode:"PUSH_TO_TALK"}` + `audio`. If the response contains segments/timecodes — keep them; if not — split the WAV into 20 s chunks (by silence, if that is simple; otherwise exactly) and transcribe the chunks, with the timecode = chunk start. Record in the report which variant worked.
3. `extractFindingsFromTranscript(segments, vehicle)` → `sparkJson` per the `FindingsDraft` schema: each finding must contain `quote` — a verbatim fragment of the transcript — and `tStart/tEnd`. Post-check in code: `quote` must actually occur in the transcript (normalizing whitespace/case), otherwise the finding is dropped and written to `trace` as `rejected: quote_not_found`.
4. Normalize panels to the same dictionary as in TZ-02 (shared `src/lib/domain/panels.ts`, RU/EN/KO synonyms: the Russian term for "front bumper", "front bumper", "앞범퍼"… (RU synonyms live in the dictionary in src/lib/domain/panels.ts).
5. Tool `transcribe_note({mediaId})` → `{transcript, segments, findings}`.
6. `/lab/voice` (dev only): recording → transcript with timecodes → findings; clicking a finding highlights its quote.
7. `scripts/smoke/asr.mjs` — live request on `demo-data/audio/*.wav` (if it is absent — generate a 10-second silent WAV and report that a real file is needed).

## Part B — paint gauge from video (`read_gauge_video`) — required
MINI has no voice note, but it has `demo-data/mini-cooper-s/video/paint_gauge.mp4`: the inspector applies the gauge to the panels, and the number is visible on the gauge's screen.
1. `scripts/` / `src/lib/agent/tools/gauge.ts`: frames from the video via ffmpeg (system `ffmpeg`; if absent — `ffmpeg-static`), 1 frame/s, ≤ 60 frames, width ≤ 960.
2. Spark vision in batches of 6 frames, strict JSON contract: `{ frames: [{ t, gaugeVisible, microns|null, panel|null, panelConfidence }] }`. The panel comes from the dictionary `src/lib/domain/panels.ts`, based on what is visible around the gauge (headlight → hood/fender, handle → door, etc.).
3. Merging: adjacent frames with the same panel → one measurement (median microns), `Evidence { type:"gauge", mediaId:"paint_gauge.mp4", tStart, tEnd, gaugeMicrons, panel }` — each measurement is clickable to the second of video.
4. Result → `demo-data/<carId>/out/paint.json` (same format that `analyze_paint_readings` accepts) + a summary in the report: how many panels were read, which frames were not recognized.
5. Test without network: frame merging (a fixture of 10 JSON "frames").
Criterion: on MINI ≥ 4 panels read, the hood marked (in the inspector's report: "cosmetic repaint of the hood" (Russian in the original input)), raw output in `docs/reports/tz-03.md`.

## Acceptance criteria (part A — voice)
- tsc / build / lint / vitest green; raw output in docs/reports/tz-03.md.
- `node --check scripts/smoke/asr.mjs`; smoke output (transcript + response time) in the report.
- Test: a fake transcript with 3 remarks + 1 Spark "hallucination" (a quote that does not exist) → the result is 3 findings, 1 rejected.
- RU voice note "repaint on the rear left wing, gauge reads two hundred" (Russian in the original input) → finding `rear_left_fender / repaint` with the quote (live run, output in the report).
