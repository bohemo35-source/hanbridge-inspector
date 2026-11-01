# Hanbridge Inspector

**An AI agent inspects a used car in Korea for a buyer in Central Asia / CIS — and every finding links to its evidence.**
Photos, paint-gauge video, the inspector's voice and the OBD report go in; a verified report with a BUY / NEGOTIATE / WALK AWAY verdict comes out in ~1–2 minutes.

Built for the **Meta Global AI Developer Hackathon** (Indie Developer track, Oct 26 – Nov 4, 2026).

**Try it live (no login):** https://hanbridge-inspector.vercel.app — pick a demo car → "Watch the agent live" streams every tool call (model badge on each step) → report `/r/:id`.
Demo video (3 min): _link added at submission_

## Why
A buyer in Almaty or Tashkent pays thousands of dollars for a car they have never seen. Trust breaks at the inspection: 40 WhatsApp photos, a paint-gauge readout and an auction sheet in Korean that the buyer cannot verify.

## What the agent does
1. Inspector uploads a walk-around video/photos, a voice note, the auction sheet photo and paint-gauge readings.
2. **SAM 3.1** segments panels, defects and license plates.
3. **Muse Voice Transcribe** turns the inspector's voice note into findings with timestamps.
4. **Muse Spark 1.3** orchestrates the tools, reads the Korean auction sheet and writes the verdict.
5. A separate verifier pass checks every finding against its evidence — no evidence, no finding.
6. **Muse Image** prepares a listing photo (plate hidden, background cleaned, vehicle pixels untouched).
7. Client gets one link `/r/:id` — every claim clicks through to the frame, mask, voice quote or gauge reading. EN/RU.

Low confidence → hand-off to a human manager. No invented customs/landed-cost numbers.

## Stack
Next.js (App Router) · TypeScript · Tailwind · Vercel · Vercel Blob · zod · sharp · Meta Model API (`muse-spark-1.3`, `sam-3.1`, `muse-voice-transcribe-1.0`, `muse-image-1.0`). Code written with **Muse Code**.

## Run locally
```bash
cp .env.example .env.local   # fill META_API_KEY
npm install
npm run dev
```

## Built during the hackathon
All code in this repository was written after the kickoff on 2026-10-26. Progress by task:
- [x] TZ-01 core + Spark expert — `tz-01` (merged)
- [x] TZ-02 SAM segmentation + defects — `tz-02` (merged)
- [x] TZ-03 voice + paint-gauge video → findings — `tz-03` (merged)
- [x] TZ-04 listing image (plate hidden, car-pixel diff guard) — `tz-04` (merged)
- [x] TZ-05 agent orchestrator + open-weight verifier + report `/r/:id` — branch `tz-05`
- [x] TZ-06 3D body map (parametric templates, 13 panels) — `tz-06` (merged)
- [x] TZ-08/09 journey scene (7 stages, 2.5D photo plates) — `tz-08`, `tz-09` (merged)
- [x] TZ-10…13 inspection garage with a real 3D car, journey v2/v3 with Muse Image plates, visual polish
- [x] TZ-14 tool-first landing: one-line pitch, demo cars with instant reports, live agent run, Meta model roles
- [x] Agent media in Vercel Blob (`src/lib/agent/media.ts`, `blob-manifest.json`), `ffmpeg-static`, Glimmer photo indexes for every demo car — the live run works on Vercel within the 300 s function limit (measured: Kia Morning 79 s, MINI 101 s, BMW 530i 75 s, Audi A5 92 s)
- [x] Film v3 on `/lab/film` (narrated, RU/EN)

Reports with raw run output: `docs/reports/tz-01.md` … `tz-09.md`.

## Architecture (TZ-05)
```mermaid
flowchart LR
  UI["/inspect/:carId (SSE live trace)"] --> API["POST /api/inspections/:carId/run"]
  API --> ORCH["Spark 1.3 orchestrator (tool calling, ≤16 steps)"]
  ORCH --> TOOLS["segment_image (SAM 3.1) · find_defects (Spark vision) · transcribe_note (Voice) · read_gauge_video · read_diagnostic_report · read_inspector_report · analyze_paint_readings · make_listing_photo (Muse Image) · shipping / cost / handoff"]
  TOOLS --> MERGE["Cross-source merge: 2nd source +confidence, contradiction -> conflict"]
  MERGE --> VER["Verifier: muse-spark-open-1026 (Baseten open weights), fallback Spark 1.3"]
  VER --> VERDICT["Deterministic verdict BUY/NEGOTIATE/WALK_AWAY + handoff rules"]
  VERDICT --> STORE["Blob reports/{id}.json or data/reports/*.json"]
  STORE --> REPORT["/r/:id — 3D map, findings, Unconfirmed, trace, chat, delivery"]
  BLOB["Vercel Blob demo/carId/ (photos, voice, OBD text, Glimmer index)"] --> TOOLS
  GLIMMER["Muse Glimmer on Modal: photo triage"] --> ORCH
  CARS["/cars catalog"] --> UI
```

| Meta model | Where used |
|---|---|
| `muse-spark-1.3` | Agent orchestrator (native tool calling), defect scan, voice/OBD/inspector extraction, verdict text, report chat |
| `sam-3.1` | `segment_image`, car crop for defects, plate box for listing |
| `muse-voice-transcribe-1.0` | `transcribe_note` (15 s chunks from any inspection video) |
| `muse-image-1.0` | Listing background edit (car-pixel diff guard) + report hero |
| `muse-spark-open-1026` (Baseten, open weights) | Independent verifier — only the finding + its evidence; fallback `muse-spark-1.3`, model written to trace |
| Muse Glimmer 30B (open weights, our own vLLM on Modal — `infra/modal/glimmer_vllm.py`) | Photo triage: indexes every inspection photo (view, whole car, visible panels) so Spark/SAM spend calls only on the right frames and the listing photo is a real 3/4 whole-car shot (`src/lib/agent/tools/photoIndex.ts`) |
| Muse Code | Coding agent: wrote a large part of this repository (files marked `@agent: muse-code`, task specs in `docs/tz`, reports in `docs/reports`) |

Not Meta: the short film on `/lab/film` ("how the car gets home") is animated with Wan from Muse Image start frames; the film is decoration below the tool, not part of the agent. Code was also written with Claude (marked `@agent: claude` / `claude-code`).

## Assets and data
- Third-party assets (CC0 HDRIs, one CC-BY 3D model) and generated media are listed with sources in [`ASSETS.md`](ASSETS.md).
- The 3D body map uses parametric brand-neutral templates generated in code (`src/components/damage-map-3d/buildCar.ts`); inspection evidence always uses the original inspection frames.
- Demo-car media are real inspections of the company's cars. Public OBD reports are redacted copies (names, phones, links removed; VIN tail masked); listing photos hide the plate.

## Pre-hackathon
Nothing from earlier projects is used here. Earlier Hanbridge prototypes (landing page, 3D showroom) live in separate repositories and are not part of this submission.

## License
MIT
