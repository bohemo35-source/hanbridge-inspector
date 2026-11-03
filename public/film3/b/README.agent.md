<!-- @agent: claude-code · @project: hanbridge-inspector · @purpose: pre-blurred film backgrounds for phones · @created: 2026-11-03 -->
`b/*.jpg` — the film posters pre-blurred and darkened (480 px, gaussian σ18, ×0.42 brightness, saturation 0.6 — the look of the desktop CSS `blur-2xl brightness-[.42] saturate-[.6]`). Phones use them as the fill behind the 16:9 clip band in portrait and as insert backgrounds, so no CSS blur is redrawn every frame.
`ffmpeg -i <poster>.jpg -vf "scale=480:-2,gblur=sigma=18,colorchannelmixer=rr=.42:gg=.42:bb=.42,eq=saturation=0.6" b/<poster>.jpg`
