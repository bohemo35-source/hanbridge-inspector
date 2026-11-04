# TZ-01 — Skeleton, Meta client, report schema, expert on Muse Spark

First read AGENTS.md. Complete the task in full, without intermediate questions; if something does not work, record it in the report and move on.

## Goal
A working product skeleton: Next.js app, a single Meta API client, zod schemas for inspection/report, an expert on `muse-spark-1.3` (structured analysis + chat about the report), and a check of tool calling support. Deploy to Vercel Preview.

## What to do
1. Initialize Next.js 15 + TS strict + Tailwind + ESLint. `.gitignore` with `.env*`, `.env.example` with empty `META_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_APP_URL`.
2. `src/lib/meta/client.ts` — `metaFetch(path, init, {timeoutMs, retries:1})`: Bearer from env, AbortController, log `{model, path, ms, status}` without the body. Errors — typed `MetaApiError`.
3. `src/lib/meta/spark.ts`:
   - `sparkChat({messages, tools?, json?})` — always `reasoning_effort:"low"`, `max_tokens: 2000`; empty/`null` content without tool_calls → retry once → `MetaApiError("empty_content")`.
   - `sparkJson<T>(schema: ZodType<T>, messages)` — asks for strictly JSON, parses it (strips ```json```), validates with zod; if invalid — 1 retry with the validation error text.
   - Image support in messages (content parts `image_url` with data URL / https).
4. `src/lib/schema/` — zod: `Media {id, kind: photo|video_frame|audio|auction_sheet, url, takenAt?}`, `Evidence {type: frame|mask|transcript|gauge|auction_sheet, mediaId, box?, maskRef?, quote?, tStart?, tEnd?, gaugeMicrons?, panel?}`, `Finding {id, panel, kind: scratch|dent|rust|repaint|putty|panel_replaced|mechanical|other, severity: low|medium|high|critical, description_en, description_ru, confidence, evidence: Evidence[] (min 1), verified: boolean, verifierNote?}`, `Verdict {decision: BUY|NEGOTIATE|WALK_AWAY, reasons_en[], reasons_ru[], confidence, handoff: boolean}`, `Report {id, vehicle {make, model, year?, mileageKm?, vin?}, findings[], verdict, paintReadings[], costEstimate {status: ok|manager_quote_required, ...}, trace: AgentStep[], createdAt}`.
5. `src/lib/domain/paint.ts` — deterministic classification of the paint gauge (≤150 / 151–220 / >220 µm) → Finding with evidence of type `gauge`. Unit tests (vitest) at the boundaries 150/151/220/221.
6. Expert: `POST /api/expert/analyze` — input: vehicle + paintReadings + up to 6 photo URLs → `sparkJson(FindingsDraft)`; `POST /api/expert/chat` — input: reportId + history, answers only from the report data, in the language of the question (EN/RU); for questions about the customs/import cost it answers "the manager will calculate it" without any figures.
7. `scripts/smoke/spark.mjs` — 3 live requests: (a) text, (b) JSON per schema, (c) **tool calling**: pass `tools:[{type:"function", function:{name:"get_paint_status", parameters:{...}}}]` and check whether `tool_calls` come back. Record the result (supported / not) in the report — TZ-05 depends on it.
8. Minimal home page `/` — title, one sentence about the product, a "New inspection" button (a stub for now). Dark theme, no mockups from the old project.
9. `README.md`: what it is, stack, Meta models, section `## Built during the hackathon` (empty commit list, to be filled in later), `## Pre-hackathon` — "nothing, all code in this repo was written after 26.10.2026".

## Acceptance criteria
- tsc / build / lint / vitest — green, raw output in docs/reports/tz-01.md.
- `node --check scripts/smoke/spark.mjs` OK; smoke run, output (3 cases) in the report, explicitly: "tool calling: YES/NO" + raw response fragment.
- `curl -X POST localhost:3000/api/expert/analyze` with demo MINI readings returns JSON that is valid per zod (output in the report).
- `curl /api/expert/chat` with the question "how much will customs clearance cost?" (Russian in the original input) → answer without figures.
- `git grep -n "META_API_KEY="` finds only `.env.example` (empty value).
- Vercel Preview URL in the report (prod — only after Arthur's "go").
