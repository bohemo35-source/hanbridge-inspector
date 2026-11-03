#!/usr/bin/env python3
# @agent:   claude-code
# @project: hanbridge-inspector
# @purpose: Timelapse of the Muse Code session recording ТЗ-11 (recordings/tz-11.mov, 52 min): keyframes only (~1 per 1.5 s → ~45×), black stretch cut,
#           corner label with the real session clock, intro card and the result sheet at the end → recordings/timelapse/tz11-timelapse.mp4 (+ -720p)
# @created: 2026-11-03
# usage: python3 scripts/video/tz11_timelapse.py <recordings dir> <keyframe times txt> [black_start black_end]
# keyframe times: ffprobe -v error -select_streams v -skip_frame nokey -show_entries frame=pts_time -of csv=p=0 tz-11.mov > kf.txt
import os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

rec, kf_file = os.path.abspath(sys.argv[1]), sys.argv[2]
b0, b1 = (float(sys.argv[3]), float(sys.argv[4])) if len(sys.argv) > 4 else (50.9, 55.833)
out = os.path.join(rec, "timelapse")
raw = os.path.join(out, "tz11-timelapse-raw.mp4")
kf = [float(x.strip().rstrip(",")) for x in open(kf_file) if x.strip()]
FPS, W, H = 30, 1920, 974  # raw is 1920 x 974 (3824 x 1940 scaled)
tmp = os.path.join(out, "frames"); os.makedirs(tmp, exist_ok=True)
mono = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 26)
serif = ImageFont.truetype("/System/Library/Fonts/Supplemental/Georgia.ttf", 64)
small = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 24)
SODIUM, BONE, INK = (238, 166, 90), (239, 233, 223), (6, 7, 8)

def run(*a): subprocess.run(list(a), check=True)

# 1) keep frames outside the black stretch: raw frame n ↔ real time kf[n]
keep = [n for n in range(len(kf)) if not (b0 * FPS <= n < b1 * FPS)]
# 2) label per kept frame: real session clock
for j, n in enumerate(keep):
    t = int(kf[min(n, len(kf) - 1)])
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    txt = f"MUSE CODE · TASK TZ-11 · REAL TIME {t // 60:02d}:{t % 60:02d} / 51:58 · ~45x"
    tw = d.textlength(txt, font=mono)
    d.rounded_rectangle((W - tw - 56, H - 74, W - 24, H - 24), 8, fill=(6, 7, 8, 215))
    d.text((W - tw - 40, H - 64), txt, font=mono, fill=SODIUM)
    im.save(os.path.join(tmp, f"l{j:05d}.png"))
sel = "+".join(f"between(n,{a},{b})" for a, b in [(0, int(b0 * FPS) - 1), (int(b1 * FPS), len(kf))])
main = os.path.join(out, "main.mp4")
run("ffmpeg", "-v", "error", "-y", "-i", raw, "-framerate", str(FPS), "-i", os.path.join(tmp, "l%05d.png"), "-filter_complex",
    f"[0:v]select='{sel}',setpts=N/{FPS}/TB,pad=1920:1080:0:(1080-ih)/2:color=0x060708[v];[1:v]setpts=N/{FPS}/TB[l];[v][l]overlay=0:(1080-{H})/2:shortest=1,format=yuv420p[o]",
    "-map", "[o]", "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "20", main)

# 3) cards: intro (2.5 s) and the result (4 s)
def card(path, lines, img=None):
    im = Image.new("RGB", (1920, 1080), INK); d = ImageDraw.Draw(im)
    y = 120 if img else 400
    if img:
        # the sheet is 2 columns x 6 rows (portrait): lay its 12 shots out 4 x 3 so they read on a 16:9 card
        src = Image.open(img).convert("RGB"); cw, ch = src.width // 2, src.height // 6
        r = Image.new("RGB", (cw * 4, ch * 3), INK)
        for k in range(12): r.paste(src.crop(((k % 2) * cw, (k // 2) * ch, (k % 2 + 1) * cw, (k // 2 + 1) * ch)), ((k % 4) * cw, (k // 4) * ch))
        r.thumbnail((1760, 800)); im.paste(r, ((1920 - r.width) // 2, 250))
    for font, text, col in lines:
        tw = d.textlength(text, font=font); d.text(((1920 - tw) / 2, y), text, font=font, fill=col); y += font.size + 28
    im.save(path)
card(os.path.join(out, "intro.png"), [(small, "BUILT DURING THE HACKATHON", SODIUM), (serif, "Muse Code builds the 3D journey", BONE),
     (small, "one session · task TZ-11 · 52 minutes in 70 seconds", BONE)])
card(os.path.join(out, "outro.png"), [(small, "RESULT OF THIS SESSION", SODIUM), (serif, "Seoul · Busan · Vladivostok · home", BONE)],
     img=os.path.join(rec, "tz11-sheet.jpg"))
parts = []
for name, sec in (("intro", 2.5), ("outro", 4)):
    p = os.path.join(out, f"{name}.mp4"); parts.append(p)
    run("ffmpeg", "-v", "error", "-y", "-loop", "1", "-t", str(sec), "-i", os.path.join(out, f"{name}.png"), "-vf", f"fps={FPS},format=yuv420p,fade=t=in:d=0.4,fade=t=out:st={sec - 0.4}:d=0.4",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", p)
lst = os.path.join(out, "list.txt")
open(lst, "w").write("".join(f"file '{p}'\n" for p in (parts[0], main, parts[1])))
final = os.path.join(out, "tz11-timelapse.mp4")
run("ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", final)
run("ffmpeg", "-v", "error", "-y", "-i", final, "-vf", "scale=1280:-2", "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-movflags", "+faststart", final.replace(".mp4", "-720p.mp4"))
print("OK", final, "frames kept", len(keep))
