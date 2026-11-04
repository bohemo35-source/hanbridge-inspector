# AGENTS.md — Hanbridge Inspector (Meta Global AI Developer Hackathon)

You are Muse Wonder (inside Muse Code, Meta's coding agent). This file is read before EVERY TZ from docs/tz/.

## Product
Hanbridge Inspector — an AI agent that runs the entire inspection of a used car in Korea for a buyer from CIS / Central Asia:
inspection media → findings with evidence → findings verification → verdict BUY / NEGOTIATE / WALK AWAY → link to the report /r/:id + chat about the report (EN/RU).
This is NOT an "image analyzer" and NOT "RAG": the value lies in orchestration, verifiability of each finding, and handoff to a manager at low confidence.

## Hard hackathon rules
1. All code is written from scratch in this repo. Copying code/assets from ~/Developer/Landing_Exportal_muse, Hanbridge_3D_lab and any old repos is forbidden.
2. The repo is public. Secrets only in env (`META_API_KEY`, `BLOB_READ_WRITE_TOKEN`, …). `.env*` in `.gitignore`. Do not log keys, do not send them to the client, do not write them to reports.
3. Only assets with usage rights: Arthur's own photos from demo-data/, Muse Image-generated content, own SVG.
4. No invented customs/cost figures. No data → `status: "manager_quote_required"`.
5. Small, meaningful commits: `feat(sam): ...`, `fix(agent): ...`. Each TZ = branch `tz-0N` → PR into main.

## Stack
Next.js 15 (App Router) + TypeScript strict + Tailwind, deployed on Vercel. Storage: Vercel Blob (media + JSON reports). Validation: zod. Image processing: sharp.
Vercel request body limit ≈ 4.5 MB → photos/videos/WAV are uploaded directly from the client to Blob (`@vercel/blob/client` upload); the server receives the URL.
Routes calling Meta: `export const runtime = "nodejs"; export const maxDuration = 60;`

## Meta Model API (verified 21–23.10)
Base `https://api.meta.ai/v1`, `Authorization: Bearer ${META_API_KEY}`.
- `muse-spark-1.3` — POST /chat/completions. ALWAYS `reasoning_effort: "low"`, `max_tokens >= 1500` (with smaller values the response comes back with `content: null`). Empty content = error → retry once → fallback.
- `sam-3.1` — POST /responses, body `{model:"sam-3.1", input:[{role:"user", content:[{type:"input_text",text:"<concept>"},{type:"input_image",image_url:"data:image/jpeg;base64,…"}]}]}`, ~2–3 s. Response in `output[0].content[0].text` (verified 27.10 on a MINI photo): prefix `<0f>0`, then for each instance `<|box;x1=991;y1=193;x2=1025;y2=201;w=1280;h=720|><|mask;x=0;y=0;data=H,W,<encoded>|>` — key=value pairs, coordinates in pixels of the sent image (w,h = its size); `data` starts with the mask height and width (= box size), then the encoded pixels relative to the box. Decoding algorithm: https://dev.meta.ai/docs/sam/reading-segmentation. An empty response = 0 instances. SAM finds objects well (`car`, `license plate`, `wheel`, panels), but `scratch`/`dent` gave 0 on the test photo — defects are searched by Spark on crops, SAM provides the geometry.
- `muse-voice-transcribe-1.0` — POST /asr/transcribe, multipart: `request` (JSON `{model, audioEncoding:"WAV", mode:"PUSH_TO_TALK"}`) + `audio` (WAV ≤ 10 min). Meta has no TTS.
- `muse-image-1.0` — POST /images/generations `{model, prompt, n}` → `data[0].b64_json` (~23 s); edits — /images/edits.
**Open-weight (Baseten, hackathon credits $100 + up to 2M TPM):** `muse-spark-open-1026` (exact model name `meta-models/muse-spark-open-1026`; the endpoint does not accept other names), base `https://inference.baseten.co/v1`, OpenAI-compatible `/chat/completions`, `Authorization: Bearer ${BASETEN_API_KEY}`. The model always reasons (read reasoning separately from content — docs.baseten.co/inference/model-apis/reasoning), supports vision. Client — `src/lib/meta/sparkOpen.ts`, via the same wrapper layer as `metaFetch`.

All calls go only through `src/lib/meta/*` (single client: timeout, 1 retry, logging of duration and model id without body and key).

## Domain rules
- Thickness gauge (microns): ≤150 factory paint; 151–220 repaint; >220 filler/repair.
- Each finding (`Finding`) must have at least one piece of evidence (`Evidence`): frame + box/mask, a quote from a voice note with a timecode, a thickness-gauge reading, or a line from the auction sheet. A finding without evidence does not get into the report.
- `confidence` 0..1. Overall confidence < 0.6, or a critical finding with confidence < 0.7 → `handoff_to_manager`.

## Structure (target)
```
src/app/            pages and route handlers
src/lib/meta/       Meta API clients (spark.ts, sam.ts, asr.ts, image.ts, client.ts)
src/lib/agent/      orchestrator, tools, verifier
src/lib/schema/     zod schemas (Inspection, Finding, Evidence, Report)
src/lib/store/      Blob storage
scripts/smoke/      live smoke scripts for each model
demo-data/<car>/    real inspections (photos/, video/, sheets/, inspector_report_ru.txt, paint.json); not in git
docs/tz/            TZ specs
docs/reports/       Muse reports after each TZ
```

## Saving Muse quota (mandatory)
- Do not launch subagents or "double check"/verify passes: verification is done by the reviewer (Claude).
- Do not re-read large files in full without need; `package-lock.json`, `node_modules`, `.next`, `demo-data` must not be read.
- `npm install` — once at the start. `next build` — once at the end. In between, `tsc --noEmit` and `vitest` are enough.
- Live requests to the Meta API — only in smoke scripts, one run each.
- If you cannot fix something in 2 attempts — write it in the report and move on.

## Definition of Done for any TZ
1. `npx tsc --noEmit` — 0 errors. `npm run build` — success. `npm run lint` — 0 errors.
2. For each changed .js/.mjs script — `node --check <file>`.
3. The smoke script of this TZ was run with a live request, and its output (without the key) is saved.
4. Report `docs/reports/tz-0N.md`: what was done, list of files, RAW output of tsc/build/smoke/curl, what does not work. Not a recap — command output.
5. Do not touch files outside the task. If there is no other way, explain it in the report.
6. Do not publish, do not push to main, do not deploy to prod without an explicit "do it" from Arthur.
