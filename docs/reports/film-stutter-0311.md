<!-- @agent: claude-code · @project: hanbridge-inspector · @purpose: film stutter, per scene, before/after 8c8cf11 · @created: 2026-11-03 -->
# Film: stutter measurement per scene (03.11)

Instrument: `scripts/film4/stutter-scenes.mjs` — visible Chrome (GPU), 1600×900, production `/lab/film?lang=en`. "Before" — code 36a7115 (production before 8c8cf11), "after" — 8c8cf11. Play — the "Play the film" button until the end; scroll — mouse wheel evenly over 120 s.
**frozen** — how many ms a clip stood paused on screen (in Play): before the fix, the incoming clip waited on frame 0 for the entire transition.

Play total: frozen 22650 → 1067 ms (repeat "after" run — 443 ms; the remainder — the first clip stands 0.4–1.1 s in scene open until the sound starts, this is visible); long frames >50 ms 0 → 0; waiting 0 → 1. Repeat "after" run with a refined stall metric (the clip was playing before and after the gap): frozen 443 ms, 4 stalls (all in busan, exactly 100 ms: a 5 s clip stretched over the ~11 s voice-over window, speed ~0.45 — slow frames, not a failure).
Scroll total: long frames 3 → 3 (all in the finale, garage loading), max seek 13 → 9 ms.

| scene | clip | Play frozen, ms before → after | Play long frames before → after | scroll max seek, ms before → after |
|---|---|---|---|---|
| open | bridge-a.mp4 | 1767 → 1067 | 0 → 0 | 7 → 7 |
| b | bridge-b.mp4 | 992 → 0 | 0 → 0 | 4 → 8 |
| c | bridge-c.mp4 | 858 → 0 | 0 → 0 | 5 → 7 |
| d | s0-5.mp4 | 1200 → 0 | 0 → 0 | 5 → 5 |
| e | s0-6.mp4 | 0 → 0 | 0 → 0 | 5 → 5 |
| act2 | — | 0 → 0 | 0 → 0 | 0 → 0 |
| req | — | 0 → 0 | 0 → 0 | 0 → 0 |
| pick | — | 2000 → 0 | 0 → 0 | 0 → 3 |
| lift | s2-1.mp4 | 700 → 0 | 0 → 0 | 5 → 9 |
| gauge | gauge-v4.mp4 | 0 → 0 | 0 → 0 | 5 → 4 |
| report | — | 0 → 0 | 0 → 0 | 0 → 0 |
| fork | — | 1300 → 0 | 0 → 0 | 0 → 3 |
| keys | s3-1.mp4 | 0 → 0 | 0 → 0 | 5 → 6 |
| act3 | — | 533 → 0 | 0 → 0 | 0 → 6 |
| hwy | s4-2.mp4 | 0 → 0 | 0 → 0 | 5 → 5 |
| mapkr | — | 557 → 0 | 0 → 0 | 0 → 4 |
| busan | s5-1.mp4 | 2175 → 0 | 0 → 0 | 6 → 7 |
| sea | sea-v5.mp4 | 0 → 0 | 0 → 0 | 8 → 5 |
| fan | — | 2333 → 0 | 0 → 0 | 0 → 4 |
| bay | vlad-v5.mp4 | 658 → 0 | 0 → 0 | 13 → 5 |
| ramp | s7-2.mp4 | 1708 → 0 | 0 → 0 | 7 → 5 |
| orbit | s8-1.mp4 | 1650 → 0 | 0 → 0 | 8 → 7 |
| gate | s8-2.mp4 | 0 → 0 | 0 → 0 | 4 → 5 |
| act4 | — | 450 → 0 | 0 → 0 | 0 → 5 |
| vload | s9-1.mp4 | 792 → 0 | 0 → 0 | 5 → 6 |
| hills | s9-2.mp4 | 0 → 0 | 0 → 0 | 4 → 5 |
| maproad | — | 908 → 0 | 0 → 0 | 0 → 5 |
| taiga | s9-3.mp4 | 467 → 0 | 0 → 0 | 6 → 7 |
| sunset | s9-4.mp4 | 394 → 0 | 0 → 0 | 5 → 8 |
| street | s10-1.mp4 | 450 → 0 | 0 → 0 | 5 → 6 |
| hand | s10-3.mp4 | 758 → 0 | 0 → 0 | 4 → 5 |
| house | s10-4.mp4 | 0 → 0 | 0 → 0 | 7 → 6 |
| end | — | 0 → 0 | 0 → 0 | 0 → 0 |
