#!/usr/bin/env python3
# @agent:   claude-code
# @project: hanbridge-inspector
# @purpose: Jury cut v5 = 9.5 s «pain» intro (real buyer chats, blurred; Arthur's ElevenLabs line) + jury cut v4 (voice, no music) minus three silent waits
#           (C-home tail, D2a wait, F2 GPU wait) so the film stays ≤ 3:00; music is mixed afterwards by video-build/voice-build/mix_music.sh as before
# @created: 2026-11-03
# @updated: 2026-11-03 claude-code — collage of 4: night booking, «Когда отправка?», «когда она поедет?», a wall of photos (Arthur's dm/ shots)
# usage: python3 scripts/video/jury_v5.py <META-HACKATON dir> <voice line mp3>   → recordings/jury-cut-voiced-el-v5.mp4
import os, re, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

root, line = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
R = lambda *p: os.path.join(root, *p)
work = R("recordings", "v5work"); os.makedirs(work, exist_ok=True)
V4 = R("recordings", "jury-cut-voiced-el-v4.mp4")
FPS, INTRO = 30, 9.5
# keep-ranges of v4 (s): cuts fall where the narration is silent (silencedetect −45 dB, ≥1.5 s) and the picture only waits
KEEP = [(0, 29.0), (32.13, 38.75), (40.25, 126.27), (130.33, None)]
INK, SODIUM, BONE = (6, 7, 8), (238, 166, 90), (239, 233, 223)

def run(*a): subprocess.run(list(a), check=True)
def lufs(path):
    err = subprocess.run(["ffmpeg", "-nostats", "-i", path, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", err)[-1])

# 1) intro picture: three blurred chats + a quiet kicker; slow push-in
bg = os.path.join(work, "intro.png")
im = Image.new("RGB", (1920, 1080), INK); d = ImageDraw.Draw(im)
# night booking, «when does it ship?», «when will it go?» + voice notes, a wall of photos (phone shots: status/input bars cropped)
shots = ("chat-1", "bolt-4021", "dm-0949", "dm-0752")
cw = (1920 - 2 * 90 - (len(shots) - 1) * 24) // len(shots)
for k, n in enumerate(shots):
    c = Image.open(R("recordings", "pain", f"{n}.jpg")).convert("RGB")
    if not n.startswith("dm-"): c = c.crop((0, round(c.height * 0.1125), c.width, round(c.height * 0.8875)))
    c.thumbnail((cw, 840))
    im.paste(c, (90 + k * (cw + 24), 150))
f = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 24)
t = "BEFORE HANBRIDGE · REAL CHATS WITH OUR BUYERS · NAMES AND PLATES HIDDEN"
d.text(((1920 - d.textlength(t, font=f)) / 2, 1020), t, font=f, fill=SODIUM)
im.save(bg)
target = lufs(V4)  # the line sits at the level of the rest of the narration
gain = target - lufs(line)
intro = os.path.join(work, "intro.mp4")
run("ffmpeg", "-v", "error", "-y", "-loop", "1", "-t", str(INTRO), "-i", bg, "-i", line, "-filter_complex",
    f"[0:v]fps={FPS},scale=1920*1.04:-1,crop=1920:1080:'(iw-1920)/2':'(ih-1080)/2*(1-t/{INTRO})',fade=t=in:d=0.5,fade=t=out:st={INTRO - 0.5}:d=0.5,format=yuv420p[v];"
    f"[1:a]volume={gain:.2f}dB,adelay=300:all=1,apad,atrim=0:{INTRO},aformat=sample_rates=48000:channel_layouts=stereo[a]",
    "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-c:a", "pcm_s16le", intro)

# 2) v4 pieces (re-encoded to the same format so the concat is clean)
parts = [intro]
for i, (a, b) in enumerate(KEEP):
    p = os.path.join(work, f"p{i}.mov"); parts.append(p)
    run("ffmpeg", "-v", "error", "-y", "-ss", str(a), *(["-to", str(b)] if b else []), "-i", V4, "-vf", f"fps={FPS},format=yuv420p",
        "-af", "aformat=sample_rates=48000:channel_layouts=stereo", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-c:a", "pcm_s16le", p)
lst = os.path.join(work, "list.txt"); open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
out = R("recordings", "jury-cut-voiced-el-v5.mp4")
run("ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out)
dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out], capture_output=True, text=True).stdout.strip()
print("OK", out, dur, "s; line gain", round(gain, 2), "dB to", target, "LUFS")
