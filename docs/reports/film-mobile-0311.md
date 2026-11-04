<!-- @agent: claude-code · @project: hanbridge-inspector · @purpose: film on phones, per scene, before/after ccb93c3+219efdb · @created: 2026-11-03 -->
# Film on phones: stutter measurement per scene (03.11)

Instrument: `BROWSER=webkit MBPS=8 node scripts/film4/stutter-scenes.mjs` — Playwright WebKit, iPhone 14 profile (390×844 @3, touch), mp4 responses throttled to 8 Mbit/s; production `/lab/film?lang=en`. Scroll — evenly over 40 s (as in Arthur's screen recording), Play — via the button until the end.
**noFrame** — ms during which the clip layer on screen has no decoded frame (before the fix — a black screen on the phone; after — the poster is always under the clip); **black** — neither a frame nor a loaded poster (exists only in the new markup).

Scroll: noFrame 30521 → 1904 ms, black — → 0 ms, long frames >50 ms 85 → 2.
Play: long frames 224 (ccb93c3, light clips without hb-lite) → 4 (219efdb), black 0 ms, noFrame 1587 ms (first scene until its first frame, the poster is visible).
Desktop after (Chrome GPU, 1600×900): Play — long frames 0, freeze frame 475 ms; scroll 120 s — long frames 3, max seek 17 ms (before, per `docs/reports/film-stutter-0311.md` after 8c8cf11: Play 0 long frames, freeze frame 443–1067 ms in two runs; scroll 3 long frames, max seek 9–14 ms). "After" measurements — production 219efdb.

| scene | clip | scroll noFrame, ms before → after | Play fps ccb93c3 → 219efdb |
|---|---|---|---|
| open | bridge-a.mp4 | 5452 → 1766 | 60 → 59 |
| b | bridge-b.mp4 | 0 → 0 | 60 → 60 |
| c | bridge-c.mp4 | 283 → 0 | 60 → 60 |
| d | s0-5.mp4 | 1234 → 0 | 60 → 60 |
| e | s0-6.mp4 | 951 → 0 | 60 → 60 |
| act2 | — | 0 → 0 | 57 → 60 |
| req | — | 0 → 0 | 49 → 60 |
| pick | s2-1.mp4 | 367 → 0 | 57 → 60 |
| lift | s2-1.mp4 | 1117 → 0 | 60 → 60 |
| gauge | gauge-v4.mp4 | 1212 → 0 | 54 → 60 |
| report | — | 0 → 0 | 53 → 60 |
| fork | s3-1.mp4 | 338 → 0 | 30 → 60 |
| keys | s3-1.mp4 | 1061 → 0 | 59 → 60 |
| act3 | s4-2.mp4 | 100 → 0 | 60 → 60 |
| hwy | s4-2.mp4 | 1400 → 0 | 53 → 60 |
| mapkr | s5-1.mp4 | 118 → 0 | 19 → 60 |
| busan | s5-1.mp4 | 1762 → 0 | 60 → 60 |
| sea | sea-v5.mp4 | 1639 → 0 | 51 → 60 |
| fan | vlad-v5.mp4 | 340 → 0 | 15 → 60 |
| bay | vlad-v5.mp4 | 1060 → 0 | 60 → 60 |
| ramp | s7-2.mp4 | 1334 → 0 | 60 → 60 |
| orbit | s8-1.mp4 | 1183 → 0 | 60 → 60 |
| gate | s8-2.mp4 | 1433 → 0 | 60 → 60 |
| act4 | s9-1.mp4 | 81 → 0 | 60 → 60 |
| vload | s9-1.mp4 | 1116 → 0 | 60 → 60 |
| hills | s9-2.mp4 | 1104 → 0 | 51 → 60 |
| maproad | s9-3.mp4 | 288 → 138 | 28 → 60 |
| taiga | s9-3.mp4 | 1015 → 0 | 60 → 60 |
| sunset | s9-4.mp4 | 1017 → 0 | 60 → 60 |
| street | s10-1.mp4 | 1016 → 0 | 60 → 60 |
| hand | s10-3.mp4 | 1117 → 0 | 60 → 60 |
| house | s10-4.mp4 | 1383 → 0 | 60 → 60 |
| end | — | 0 → 0 | 58 → 58 |
