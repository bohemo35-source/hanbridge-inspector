<!-- @agent: claude-code · @project: hanbridge-inspector · @purpose: light film clips for phones · @created: 2026-11-03 -->
`m/*.mp4` — the same 28 film clips for narrow screens / phones: 540p, keyframe every 10 frames, no B-frames, crf 26 (~1 MB each, from the pre-all-intra originals). Desktop keeps `../*.mp4` (720p all-intra, ~4 MB). Built by:
`ffmpeg -i <clip> -an -vf scale=-2:540 -c:v libx264 -preset slow -crf 26 -g 10 -bf 0 -pix_fmt yuv420p -movflags +faststart m/<clip>`
