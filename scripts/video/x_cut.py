#!/usr/bin/env python3
# @agent:   claude-code
# @project: hanbridge-inspector
# @purpose: ~46 s cut for X (16:9, burned-in captions, drums bed): pain → agent → NEGOTIATE → 3D garage → film → Muse Code timelapse → end card with the link.
#           Pieces come from the jury cut (cursor already removed), the site film recording, the ТЗ-11 timelapse and the blurred client chats.
# @created: 2026-11-03
# @updated: 2026-11-03 claude-code — collage of 4: night booking, «Когда отправка?», «когда она поедет?», a wall of photos (Arthur's dm/ shots)
# usage: python3 scripts/video/x_cut.py <META-HACKATON dir>   → recordings/x/hanbridge-x.mp4
import os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

root = os.path.abspath(sys.argv[1])
R = lambda *p: os.path.join(root, *p)
out = R("recordings", "x"); os.makedirs(out, exist_ok=True)
JURY, FILM, TL = R("recordings", "jury-cut-final-v4.mp4"), R("recordings", "film", "hanbridge-film-en-1080p.mp4"), R("recordings", "timelapse", "tz11-timelapse.mp4")
DRUMS = R("film-v3", "work", "music", "drums-video-v4.mp3")
FPS = 30
SANS = "/System/Library/Fonts/Helvetica.ttc"; SERIF = "/System/Library/Fonts/Supplemental/Georgia.ttf"; MONO = "/System/Library/Fonts/Menlo.ttc"
SODIUM, BONE, INK = (238, 166, 90), (239, 233, 223), (6, 7, 8)

def run(*a): subprocess.run(list(a), check=True)

def caption(path, kicker, text):
    """top caption: dark pill, mono kicker in sodium, the line in white (X autoplays muted, so the story is in the text)"""
    im = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    f1, f2 = ImageFont.truetype(MONO, 24), ImageFont.truetype(SANS, 46)
    w = max(d.textlength(kicker, font=f1), d.textlength(text, font=f2)) + 64
    x0 = (1920 - w) / 2
    d.rounded_rectangle((x0, 54, x0 + w, 54 + 124), 14, fill=(6, 7, 8, 222))
    d.text(((1920 - d.textlength(kicker, font=f1)) / 2, 72), kicker, font=f1, fill=SODIUM)
    d.text(((1920 - d.textlength(text, font=f2)) / 2, 108), text, font=f2, fill=BONE)
    im.save(path)

# (id, source, start, duration, speed, kicker, caption[, crop w:h:x:y — zoom into the part that tells the story])
SEG = [
    ("agent", JURY, 10.0, 10.0, 1, "THE AGENT · META MODELS", "An AI agent inspects a used car in Korea"),
    ("verdict", JURY, 85.9, 5.0, 0.6, "VERDICT", "NEGOTIATE — every finding backed by evidence", "1700:956:110:0"),
    ("garage", JURY, 88.9, 10.0, 1, "3D GARAGE", "Click a panel: real photos, gauge, inspector's words"),
    ("film", FILM, 104.0, 8.0, 1, "THE CROSSING", "Then the car sails home — tracked all the way"),
    ("musecode", TL, 30.0, 5.0, 1, "BUILT WITH MUSE CODE", "A 52-minute session built the 3D journey"),
]
parts = []

# 1) pain, 3 s: three blurred chats over ink
pain = os.path.join(out, "pain.png")
im = Image.new("RGB", (1920, 1080), INK)
# night booking, «when does it ship?», «when will it go?» + voice notes, a wall of photos (phone shots: status/input bars cropped)
shots = ("chat-1", "bolt-4021", "dm-0949", "dm-0752")
cw = (1920 - 2 * 90 - (len(shots) - 1) * 24) // len(shots)
for k, n in enumerate(shots):
    c = Image.open(R("recordings", "pain", f"{n}.jpg")).convert("RGB")
    if not n.startswith("dm-"): c = c.crop((0, round(c.height * 0.1125), c.width, round(c.height * 0.8875)))
    c.thumbnail((cw, 860))
    im.paste(c, (90 + k * (cw + 24), 190))
im.save(pain)
cp = os.path.join(out, "cap-pain.png"); caption(cp, "BEFORE", "Buying a car in Korea: hundreds of photos in a chat")
p = os.path.join(out, "00-pain.mp4"); parts.append(p)
run("ffmpeg", "-v", "error", "-y", "-loop", "1", "-t", "3", "-i", pain, "-i", cp, "-filter_complex",
    f"[0:v]fps={FPS},fade=t=in:d=0.3[b];[b][1:v]overlay=0:0,format=yuv420p",
    "-t", "3", "-c:v", "libx264", "-preset", "medium", "-crf", "18", p)

# 2) the five footage pieces with their captions
for i, (sid, src, ss, dur, sp, kick, text, *crop) in enumerate(SEG, start=1):
    cpath = os.path.join(out, f"cap-{sid}.png"); caption(cpath, kick, text)
    p = os.path.join(out, f"{i:02d}-{sid}.mp4"); parts.append(p)
    run("ffmpeg", "-v", "error", "-y", "-ss", str(ss), "-t", str(dur * sp), "-i", src, "-i", cpath, "-filter_complex",
        f"[0:v]{f'crop={crop[0]},' if crop else ''}setpts=PTS/{sp},fps={FPS},scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x060708[v];[v][1:v]overlay=0:0,format=yuv420p",
        "-an", "-t", str(dur), "-c:v", "libx264", "-preset", "medium", "-crf", "18", p)

# 3) end card, 5 s
end = os.path.join(out, "end.png")
im = Image.new("RGB", (1920, 1080), INK); d = ImageDraw.Draw(im)
for font, text, col, y in ((ImageFont.truetype(SERIF, 120), "HANBRIDGE", BONE, 330), (ImageFont.truetype(SANS, 44), "Used cars from Korea, inspected by an AI agent", BONE, 500),
                           (ImageFont.truetype(MONO, 40), "hanbridge-inspector.vercel.app", SODIUM, 610), (ImageFont.truetype(MONO, 26), "BUILT ON META MODELS · MUSE SPARK · SAM 3.1 · MUSE IMAGE · MUSE CODE", (160, 166, 172), 720)):
    d.text(((1920 - d.textlength(text, font=font)) / 2, y), text, font=font, fill=col)
im.save(end)
p = os.path.join(out, "99-end.mp4"); parts.append(p)
run("ffmpeg", "-v", "error", "-y", "-loop", "1", "-t", "5", "-i", end, "-vf", f"fps={FPS},format=yuv420p,fade=t=in:d=0.5", "-c:v", "libx264", "-preset", "medium", "-crf", "18", p)

lst = os.path.join(out, "list.txt"); open(lst, "w").write("".join(f"file '{x}'\n" for x in parts))
silent = os.path.join(out, "silent.mp4")
run("ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", silent)
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", silent], capture_output=True, text=True).stdout)
final = os.path.join(out, "hanbridge-x.mp4")
run("ffmpeg", "-v", "error", "-y", "-i", silent, "-stream_loop", "-1", "-i", DRUMS, "-filter_complex",
    f"[1:a]atrim=0:{dur},asetpts=PTS-STARTPTS,afade=t=in:d=0.6,afade=t=out:st={dur - 2.5}:d=2.5,loudnorm=I=-16:TP=-1.5:LRA=11[a]",
    "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart", "-shortest", final)
print("OK", final, round(dur, 2), "s")
