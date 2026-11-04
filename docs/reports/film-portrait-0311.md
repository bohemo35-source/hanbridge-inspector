<!-- @agent: claude-code · @project: hanbridge-inspector · @purpose: film in portrait on phones, before/after dc83821 · @created: 2026-11-03 -->
# Film in portrait on phones (03.11, after recording on a real iPhone)

Arthur's recordings (iPhone, fb44aa2): `~/Downloads/ScreenRecording_11-03-2026 22-59-51_1.MP4` (scroll), `…23-02-30_1.MP4` (Play). freezedetect (0.003, ≥0.4 s) on the Play recording: 3.0–5.9 s; 19.2–20.2; 27.0–30.2; 32.1–35.4; 51.7–55.2; 56.0–56.5; 58.1–62.2; 63.5–63.9; 69.8–74.2.
Frame-by-frame review: 3.4–5.9 — after Play the title card is shown (the picture was waiting for the voice-over to buffer); 27–30 and 51.7–55 — the first half of the `report` scene is black (on the phone the list card was hidden, and the background of the inserts was removed); 58–62 — `fork`: the thin line is drawn slowly on an empty background (not a decoder stop); 68.5–69.8 — the keys clip is stuck on its poster (on iPhone the next clip did not load; the decoder wake-up happened only outside Play); 70–74 — the "The crossing" title card (static on purpose).

Fixed (dc83821): portrait — the full 16:9 frame as a strip above the middle, with a pre-blurred and darkened frame of the same scene behind it (`public/film3/b/`, no CSS blur); inserts on the phone — on the same background; in `report` the cards share one cell, and the list gives way to the finding; Play starts immediately, the voice picks up the picture position once it is actually playing; the next clips are also woken during Play.

Measurement (Playwright WebKit, iPhone 14 390×844, mp4 and mp3 throttled to 8 Mbit/s; "before" — production fb44aa2, "after" — production dc83821):

| | before | after |
|---|---|---|
| Play: picture moved after the press, ms | 3087 | 410 |
| Play: visible clip stalled, ms per film | 1984 | 465 |
| Play: long frames >50 ms | 4 | 2 |
| Play: black (no frame, no poster), ms | — (not measured in the old markup) | 283 (only on first load, scene open) |
| Scroll 40 s: black, ms | — | 73 (scene open) |
| Desktop (Chrome GPU) Play: long frames / freeze frame, ms | 0 / 443–1067 | 0 / 183 |
| Desktop scroll 120 s: long frames / max seek, ms | 3 / 9–17 | 3 / 15 |

After the fix, Play on the phone has 25 short clip stalls of ≥100 ms (in emulation the file is served whole after a delay, not as a stream — the first clips finish loading while the picture is already running) and 38 seeks (the voice picks up the picture position).

Frames of the portrait scenes (top — before, bottom — after; c, d, gauge, report, fork, keys, busan, hand): `docs/reports/assets/portrait-before-after.jpg`.

## Review round 7 (FAIL) → 52bf628
- "Desktop Play in the measurement did not reach the end after the fix" — confirmed on a repeat (1 of 2 runs: the picture stood for 248 s on scene `d`, the voice was "playing" but its time did not advance — it hung after a seek that dc83821 had added; the picture was hard-locked to the voice). Now the picture follows the voice only while its time is actually increasing (otherwise — the scene's pace over the voice-over window), and the voice seeks to the picture only if they diverge by more than 1 s. Production 52bf628, desktop Play, 3 runs in a row: all reached `end` in 167 s, long frames 0, freeze frame 58 / 75 / 67 ms, start 28–29 ms.
- "Regression on the phone in Play … scene `b` … maxFreeze 801 ms" — after 52bf628, iPhone Play (WebKit, 8 Mbit/s): reached `end`, start 28 ms, 2 long frames, 24 stalls, longest 160 ms (busan and others — slow clips), black 359 ms (only on first load, scene open).
- "Text is not 'under the strip' but over it" — large lines in portrait are now under the strip (`docs/reports/assets/portrait-big-lines.jpg`: c, bay, report, fork). The HANBRIDGE title in the first scene and the act titles (on black cards, no clip) are left centered — these are title screens, where there is no strip, or the strip is the title's background.
- Voice-over timings are loaded in advance; a repeated Play does not wait for the voice (same rule: the voice leads only while it is playing). Not done: tests for the player logic (voice-follow, strip) — the logic lives in the component.
