#!/usr/bin/env bash
# Encode accepted film takes for the site: 1280x720, short GOP for smooth scroll scrubbing, no audio, + poster jpg.
# Usage: scripts/film/encode-site.sh <outDir-with-log.json> [<outDir2> ...]   → public/film/<scene>.mp4|.jpg
set -euo pipefail
DEST="$(cd "$(dirname "$0")/../.." && pwd)/public/film"; mkdir -p "$DEST"
for dir in "$@"; do
  node -e '
    const l=require(process.argv[1]+"/log.json");
    for (const [id,v] of Object.entries(l)) if (!id.includes("_") && v.accepted) console.log(id, v.accepted);
  ' "$dir" | while read -r id take; do
    src="$dir/$id-t$take.mp4"; [ -f "$src" ] || continue
    ffmpeg -nostdin -v error -y -i "$src" -vf "scale=1280:720:flags=lanczos,minterpolate=fps=24:mi_mode=blend,format=yuv420p" \
      -c:v libx264 -preset slow -crf 24 -g 4 -keyint_min 4 -sc_threshold 0 -movflags +faststart -an "$DEST/$id.mp4"
    ffmpeg -nostdin -v error -y -i "$src" -frames:v 1 -vf scale=1280:720 -q:v 4 "$DEST/$id.jpg"
    echo "$id ← t$take $(du -h "$DEST/$id.mp4" | cut -f1)"
  done
done
