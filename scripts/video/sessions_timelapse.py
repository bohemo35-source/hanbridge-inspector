#!/usr/bin/env python3
# @agent:   claude-code
# @project: hanbridge-inspector
# @purpose: One timelapse of all recorded Muse Code sessions (ТЗ-01…11): per ТЗ a title card (number, date, what was built) and ~12 s of keyframes
#           with the real session clock; black and idle stretches dropped; every frame that goes into the video is OCR'd (macOS Vision) and
#           scanned for keys, tokens, e-mails and phone numbers before anything is built — a hit stops the build until it is blurred (BLUR below)
# @created: 2026-11-04
# usage: python3 scripts/video/sessions_timelapse.py <META-HACKATON dir> extract|scan|build
import json, os, re, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageStat, ImageChops

root = os.path.abspath(sys.argv[1]); phase = sys.argv[2]
REC = os.path.join(root, "recordings"); WORK = os.path.join(REC, "timelapse", "sessions"); os.makedirs(WORK, exist_ok=True)
OCR = "/tmp/claude-501/ocr/ocr"  # built from scripts/video/ocr.swift
FPS, PER = 30, 12.0  # 12 s of picture per ТЗ
# (ТЗ, recording, date shown, one line on what was built) — lines from docs/reports/tz-*.md; dates: recording start (file creation or mtime − duration, Bangkok time)
SESS = [
    ("01", "tz01.mp4", "27 Oct", "Meta API client, schemas, the Muse Spark expert"),
    ("02", "tz-02.mp4", "28 Oct", "SAM 3.1 segmentation and Spark defect vision"),
    ("08", "tz-08.mp4", "29 Oct", "the 3D journey: route, bridge, port, ro-ro ship"),
    ("09", "tz-09-Cap 2026-10-29 at 02.04.23.mp4", "29 Oct", "journey polish: photo plates, story beats, stage texts"),
    ("04", "tz-04.mov", "29 Oct", "listing photo with the plate hidden (SAM + Muse Image)"),
    ("05", "tz-05.mp4", "29 Oct", "the agent: tool calls, verifier, public report"),
    ("10", "tz-10.1.mov", "29 Oct", "inspection garage on a real 3D car"),
    ("10b", "tz-10.mov", "29 Oct", "garage v2: new car model, live environment"),
    ("11", "tz-11.mov", "29 Oct", "journey v2: short 3D scenes + Muse Image bridges"),
]
NOT_RECORDED = "TZ-03, TZ-06, TZ-07 and TZ-12 were not recorded (TZ-03 and TZ-06 were done by Claude)"
# regions to blur per ТЗ, normalised x,y,w,h over the 1920-wide frame — filled after reviewing scan hits
BLUR: dict[str, list[tuple[float, float, float, float]]] = {}
# extracted frames left out whole (first..last file number): TZ-02 115–147 — WhatsApp with contacts, a phone number, then the OBD PDF (VIN, owner)
EXCLUDE: dict[str, tuple[int, int]] = {"02": (115, 147)}
SECRET = re.compile(r"(sk-[A-Za-z0-9]{8,}|vercel_blob_rw_\w+|ghp_\w{10,}|xox[abp]-\w+|AKIA[0-9A-Z]{12,}|Bearer\s+[A-Za-z0-9._-]{12,}|eyJ[A-Za-z0-9_-]{15,}|"
                    r"(API_KEY|TOKEN|SECRET|PASSWORD|BASETEN|GLIMMER|META_API|BLOB_READ)\w*\s*[=:]\s*\S{6,}|[\w.+-]+@[\w-]+\.[\w.]{2,}|\+?\d[\d\s()-]{9,}\d)", re.I)

def run(*a, **k): return subprocess.run(list(a), check=True, **k)
def kf_times(path, cache):
    if os.path.exists(cache): return json.load(open(cache))
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-skip_frame", "nokey", "-show_entries", "frame=pts_time", "-of", "csv=p=0", path], capture_output=True, text=True).stdout
    t = [float(x.strip().rstrip(",")) for x in out.splitlines() if x.strip()]; json.dump(t, open(cache, "w")); return t

if phase == "extract":
    for tz, f, *_ in SESS:
        d = os.path.join(WORK, tz); os.makedirs(d, exist_ok=True)
        kf = kf_times(os.path.join(REC, f), os.path.join(WORK, f"{tz}-kf.json"))
        step = max(1, len(kf) // 480)  # a little more than needed: black/idle frames are dropped later
        if not os.path.exists(os.path.join(d, "00001.jpg")):
            run("ffmpeg", "-v", "error", "-y", "-skip_frame", "nokey", "-i", os.path.join(REC, f), "-an", "-vf", f"select='not(mod(n\\,{step}))',scale=1920:-2",
                "-fps_mode", "passthrough", "-q:v", "3", os.path.join(d, "%05d.jpg"))
        n = len([x for x in os.listdir(d) if x.endswith(".jpg")])
        json.dump({"step": step, "times": [kf[i * step] for i in range(n) if i * step < len(kf)]}, open(os.path.join(WORK, f"{tz}-map.json"), "w"))
        print(tz, f, "keyframes", len(kf), "step", step, "extracted", n)

def pick(tz):
    """drop black frames and idle repeats, then thin to PER*FPS frames evenly"""
    d = os.path.join(WORK, tz); m = json.load(open(os.path.join(WORK, f"{tz}-map.json")))
    names = sorted(x for x in os.listdir(d) if x.endswith(".jpg"))
    keep, prev = [], None
    for k, n in enumerate(names):
        if tz in EXCLUDE and EXCLUDE[tz][0] <= int(n[:5]) <= EXCLUDE[tz][1]: continue
        im = Image.open(os.path.join(d, n)).convert("L").resize((480, 270))
        if ImageStat.Stat(im).mean[0] < 12: continue  # black / screen off
        if prev is not None and ImageStat.Stat(ImageChops.difference(im, prev)).mean[0] < 0.08: continue  # the same frame again (idle)
        keep.append((n, m["times"][k] if k < len(m["times"]) else m["times"][-1])); prev = im
    want = int(PER * FPS)
    if len(keep) > want: keep = [keep[round(i * (len(keep) - 1) / (want - 1))] for i in range(want)]
    return keep

if phase == "scan":
    report, hits = [], 0
    for tz, *_ in SESS:
        sel = pick(tz); d = os.path.join(WORK, tz)
        files = [os.path.join(d, n) for n, _ in sel]
        lines = []
        for i in range(0, len(files), 40):
            lines += subprocess.run([OCR, *files[i:i + 40]], capture_output=True, text=True).stdout.splitlines()
        open(os.path.join(WORK, f"{tz}-ocr.txt"), "w").write("\n".join(lines))
        bad = [l for l in lines if SECRET.search(l.split("\t")[-1])]
        hits += len(bad); report.append(f"TZ-{tz}: {len(sel)} frames, {len(lines)} text lines, {len(bad)} suspicious")
        open(os.path.join(WORK, f"{tz}-hits.txt"), "w").write("\n".join(bad))
    print("\n".join(report)); print("suspicious lines total:", hits)

def font(p, s): return ImageFont.truetype(p, s)
SANS, SERIF, MONO = "/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/Supplemental/Georgia.ttf", "/System/Library/Fonts/Menlo.ttc"
INK, SODIUM, BONE, MIST = (6, 7, 8), (238, 166, 90), (239, 233, 223), (150, 156, 162)

def card(path, lines):
    im = Image.new("RGB", (1920, 1080), INK); d = ImageDraw.Draw(im); y = 380
    for f, t, c in lines:
        d.text(((1920 - d.textlength(t, font=f)) / 2, y), t, font=f, fill=c); y += f.size + 30
    im.save(path)

if phase == "build":
    hits = sum(len(open(os.path.join(WORK, f"{tz}-hits.txt")).read().strip().splitlines()) for tz, *_ in SESS if os.path.exists(os.path.join(WORK, f"{tz}-hits.txt")))
    if hits and not os.environ.get("HITS_REVIEWED"): sys.exit(f"{hits} suspicious OCR lines — review *-hits.txt, add BLUR regions, then HITS_REVIEWED=1")
    parts = []
    def clip(png, sec, name):
        p = os.path.join(WORK, f"{name}.mp4"); parts.append(p)
        run("ffmpeg", "-v", "error", "-y", "-loop", "1", "-t", str(sec), "-i", png, "-vf", f"fps={FPS},format=yuv420p,fade=t=in:d=0.3,fade=t=out:st={sec - 0.3}:d=0.3", "-c:v", "libx264", "-preset", "medium", "-crf", "18", p)
    card(os.path.join(WORK, "intro.png"), [(font(MONO, 26), "BUILT DURING THE HACKATHON", SODIUM), (font(SERIF, 70), "Muse Code at work", BONE),
         (font(MONO, 26), "every recorded session · tasks TZ-01 … TZ-11 · real time sped up", MIST)])
    clip(os.path.join(WORK, "intro.png"), 3, "000-intro")
    for tz, f, date, what in SESS:
        dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", os.path.join(REC, f)], capture_output=True, text=True).stdout)
        card(os.path.join(WORK, f"{tz}-card.png"), [(font(MONO, 28), f"TZ-{tz.upper()} · {date} 2026 · {round(dur / 60)} MIN SESSION", SODIUM), (font(SERIF, 64), what, BONE)])
        clip(os.path.join(WORK, f"{tz}-card.png"), 2.2, f"{tz}-a-card")
        sel = pick(tz); fr = os.path.join(WORK, f"{tz}-frames"); os.makedirs(fr, exist_ok=True)
        f1 = font(MONO, 24)
        for j, (n, t) in enumerate(sel):
            im = Image.open(os.path.join(WORK, tz, n)).convert("RGB")
            im = im.resize((1920, round(im.height * 1920 / im.width)))
            for (x, y, w, h) in BLUR.get(tz, []):
                box = (int(x * 1920), int(y * im.height), int((x + w) * 1920), int((y + h) * im.height))
                im.paste(im.crop(box).filter(ImageFilter.GaussianBlur(18)), box[:2])
            can = Image.new("RGB", (1920, 1080), INK); can.paste(im.crop((0, 0, 1920, min(1080, im.height))), (0, (1080 - min(1080, im.height)) // 2))
            d = ImageDraw.Draw(can); txt = f"MUSE CODE · TZ-{tz.upper()} · REAL TIME {int(t) // 60:02d}:{int(t) % 60:02d} / {int(dur) // 60:02d}:{int(dur) % 60:02d}"
            tw = d.textlength(txt, font=f1); d.rounded_rectangle((1920 - tw - 56, 1080 - 70, 1896, 1080 - 22), 8, fill=(6, 7, 8)); d.text((1920 - tw - 40, 1080 - 62), txt, font=f1, fill=SODIUM)
            can.save(os.path.join(fr, f"{j:05d}.jpg"), quality=90)
        p = os.path.join(WORK, f"{tz}-b-run.mp4"); parts.append(p)
        # always PER seconds: fewer frames than PER*FPS are simply shown longer
        run("ffmpeg", "-v", "error", "-y", "-framerate", f"{len(sel) / PER:.4f}", "-i", os.path.join(fr, "%05d.jpg"), "-vf", f"fps={FPS},format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "20", p)
        print("built", tz, len(sel), "frames")
    card(os.path.join(WORK, "outro.png"), [(font(MONO, 26), "NOT IN THIS VIDEO", SODIUM), (font(SANS, 40), NOT_RECORDED, BONE),
         (font(MONO, 26), "the 3D garage studio, the film player and the site design: Claude Code", MIST)])
    clip(os.path.join(WORK, "outro.png"), 4, "999-outro")
    lst = os.path.join(WORK, "list.txt"); open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
    out = os.path.join(REC, "timelapse", "muse-code-sessions-timelapse.mp4")
    run("ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out)
    print("OK", out)
