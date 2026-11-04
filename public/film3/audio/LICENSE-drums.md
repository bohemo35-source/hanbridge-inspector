<!-- @agent: claude-code · @project: hanbridge-inspector · @created: 2026-11-03 · @updated: 2026-11-04 claude-code (drums-mix.mp3) -->
`drums.mp3` — "Drum Jam 2013-04-08" by unfa, Freesound #184590, https://freesound.org/s/184590/ — CC0 1.0 (public domain, no attribution required). Excerpt 12:00–end, re-encoded 128 kbps, loudness −20 LUFS. Drums only — the film runs on percussion, no melody.

`drums-mix.mp3` (2026-11-04, claude-code) — the same track with the film's level baked in: `ffmpeg -i drums.mp3 -af volume=0.371 -c:a libmp3lame -b:a 128k -ar 48000 drums-mix.mp3` (0.35 of the original, +0.5 dB for the encoder's loss) → −29.9 LUFS, the same as drums.mp3 × 0.35. The player uses this file (iOS ignores `.volume`).
