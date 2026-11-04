#!/usr/bin/env python3
# @agent:   claude-code
# @project: hanbridge-inspector
# @purpose: One timelapse of all recorded Muse Code sessions (TZ-01…11): per TZ a title card (number, date, what was built) and ~12 s of keyframes
#           with the real session clock; black and idle stretches dropped; every frame that goes into the video is OCR'd (macOS Vision) and
#           scanned for keys, tokens, e-mails and phone numbers before anything is built — a hit stops the build until it is blurred (BLUR below)
# @created: 2026-11-04
# @updated: 2026-11-04 claude-code — Arthur: only Muse Code at work — frames with the Claude app / Claude Code / a chat in view are cut whole
#           (not blurred), frames without Muse Code's terminal too; a TZ with too little Muse Code left goes to the "not recorded" card
# @updated: 2026-11-04 claude-code — review: names of people and of other projects (Claude app chat list, Finder, 1Password, the account footer)
#           are blurred frame by frame from the OCR boxes, the whole sidebar column with them; scans fail closed (every frame must come back
#           from OCR, a TZ with no text stops); `verify` re-OCRs the built frames and the final mp4 and fails on any name left readable
# usage: [OCR=<binary from ocr.swift>] python3 scripts/video/sessions_timelapse.py <META-HACKATON dir> extract|scan|build|verify
#        (macOS Vision does not run inside the agent sandbox: run scan and verify outside it)
import json, os, re, shutil, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageStat, ImageChops

root = os.path.abspath(sys.argv[1]); phase = sys.argv[2]
REC = os.path.join(root, "recordings"); WORK = os.path.join(REC, "timelapse", "sessions"); os.makedirs(WORK, exist_ok=True)
OCR = os.environ.get("OCR", "/tmp/claude-501/ocr/ocr")  # swiftc -O scripts/video/ocr.swift -o $OCR
FPS, PER = 30, 12.0  # 12 s of picture per TZ
# (TZ, recording, date shown, one line on what was built) — lines from docs/reports/tz-*.md; dates: recording start (file creation or mtime − duration, Bangkok time)
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
NOT_RECORDED = "TZ-03, TZ-06, TZ-07 and TZ-12 were not recorded (TZ-03 and TZ-06 were done by Claude), TZ-13 was a Claude Code task"
# regions to blur per TZ, normalised x,y,w,h over the 1920-wide frame — filled after reviewing scan hits
BLUR: dict[str, list[tuple[float, float, float, float]]] = {}
# extracted frames left out whole (first..last file number): TZ-02 115–147 — WhatsApp with contacts, a phone number, then the OBD PDF (VIN, owner)
EXCLUDE: dict[str, tuple[int, int]] = {"02": (115, 147)}
SECRET = re.compile(r"(sk-[A-Za-z0-9]{8,}|vercel_blob_rw_\w+|ghp_\w{10,}|xox[abp]-\w+|AKIA[0-9A-Z]{12,}|Bearer\s+[A-Za-z0-9._-]{12,}|eyJ[A-Za-z0-9_-]{15,}|"
                    r"(API_KEY|TOKEN|SECRET|PASSWORD|BASETEN|GLIMMER|META_API|BLOB_READ)\w*\s*[=:]\s*\S{6,}|[\w.+-]+@[\w-]+\.[\w.]{2,}|\+?\d[\d\s()-]{9,}\d)", re.I)

# personal data seen in TZ-01/02 (the Claude app's chat list, Finder, 1Password, the account footer, the shell prompt): people's names and other projects
DENY = re.compile(r"[name]|[name]|[name]|Артур|Artur\b|Arthur Lim|arthurlim@|\bЛим\b|[name]|Export Company|OpenClaw|HERMES|\.hermes|\bШтаб|Таможня /|калькулятор|"
                  r"manus\.|Лидогенерац|[name]|[name]|1Pass|WhatsApp|Сотрудник", re.I)
# Arthur (04.11): the video shows Muse Code coding, not our chats. A frame stays only if Muse Code's terminal is in it (MUSE) and nothing of a chat
# is (CHAT: the Claude app, Claude Code, messengers, mail); everything else is cut whole
MUSE = re.compile(r"Ran \d* ?commands?|^\W*(Edited|Explored|Read|Ran|Added|Updated|Wrote) |muse[- ]wonder|muse tz-|esc to interrupt|Worked for|context left|\bmuse\b", re.I)
CHAT = re.compile(r"Ответить|это ИИ|может ошибаться|Opus \d|Sonnet \d|Показать все|Claude Code|bypass permissions|⏺|✻|Summary kickoff|claude\.ai|WhatsApp|Telegram|Gmail|Входящие|"
                  r"Поделиться|этой сессии|Рабочий стол \d|^\W*(Claude|Google Chrome|Finder|Safari)\W*$", re.I)  # last: window labels in Mission Control
MIN_FRAMES = 25  # fewer distinct Muse Code frames than this → the TZ is left out and named on the last card (its 12 s would be a slideshow of >0.5 s stills)
# rows that mark a sidebar list even when no name in it was read; the whole list column around them is blurred
SIDEBAR = re.compile(r"Показать все|Недавние|Избранное|Рабочий стол|Chrome Apps|huggingface|Open Design|СЕЙФЫ|Watchtower|Audit & Setup")
# the desktop "Pictures" stack (RU macOS label) shows a photo of a person as its icon: the icon above the label is blurred
ICON = re.compile(r"^Из\W*ния$|^Изображения$")

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

def ocr(files):
    """OCR lines "path\tx,y,w,h\ttext" for every file; stops unless every file came back (a missing OCR result never passes as 'no text')"""
    if not os.access(OCR, os.X_OK): sys.exit(f"no OCR binary at {OCR}: swiftc -O scripts/video/ocr.swift -o {OCR}")
    lines = []
    for i in range(0, len(files), 40):
        r = subprocess.run([OCR, *files[i:i + 40]], capture_output=True, text=True)
        if r.returncode: sys.exit(f"OCR failed ({r.returncode}) on {files[i]}…: {r.stderr[-300:]}")
        lines += r.stdout.splitlines()
    seen = {l.split("\t")[0] for l in lines}
    if missing := [f for f in files if f not in seen]: sys.exit(f"OCR gave nothing for {len(missing)} frames, e.g. {missing[0]}")
    return lines

def text_lines(lines):
    return [l for l in lines if l.split("\t")[1] != "-"]

if phase == "scan":
    report, hits = [], 0
    for tz, *_ in SESS:
        sel = pick(tz); d = os.path.join(WORK, tz)
        lines = ocr([os.path.join(d, n) for n, _ in sel]); txt = text_lines(lines)
        if not txt: sys.exit(f"TZ-{tz}: OCR read no text at all in {len(sel)} frames — the OCR is broken, not the frames")
        open(os.path.join(WORK, f"{tz}-ocr.txt"), "w").write("\n".join(lines))
        bad = [l for l in txt if SECRET.search(l.split("\t")[-1])]
        names = sum(1 for l in txt if DENY.search(l.split("\t")[-1]))
        hits += len(bad); report.append(f"TZ-{tz}: {len(sel)} frames, {len(txt)} text lines, {len(bad)} suspicious, {names} name lines (blurred at build)")
        open(os.path.join(WORK, f"{tz}-hits.txt"), "w").write("\n".join(bad))
    print("\n".join(report)); print("suspicious lines total:", hits)

def private_boxes(lines):
    """OCR lines (x, y, w, h, text) of one frame → boxes (x1, y1, x2, y2) to blur: every DENY line, and the whole list column around it or around a SIDEBAR row"""
    hit = [l for l in lines if DENY.search(l[4])]
    boxes = [(l[0] - .006, l[1] - .006, l[0] + l[2] + .006, l[1] + l[3] + .006) for l in hit]
    boxes += [(l[0] - .015, l[1] - .075, l[0] + l[2] + .015, l[1] + .002) for l in lines if ICON.search(l[4].strip())]
    # a shell prompt (arthurlim@…) is blurred as a line only: its column is the terminal itself
    for a in [l for l in hit if "arthurlim@" not in l[4].lower()] + [l for l in lines if SIDEBAR.search(l[4])]:
        col = sorted((l for l in lines if abs(l[0] - a[0]) < .015), key=lambda l: l[1])
        lo = hi = col.index(a)  # the run of list rows around the anchor: rows less than 10 % of the frame height apart (OCR skips some rows)
        while lo > 0 and col[lo][1] - col[lo - 1][1] < .1: lo -= 1
        while hi < len(col) - 1 and col[hi + 1][1] - col[hi][1] < .1: hi += 1
        r = col[lo:hi + 1]  # plus a row above and below: the first and last rows are often cut by the window edge and not read
        boxes.append((min(l[0] for l in r) - .012, r[0][1] - .04, max(l[0] + l[2] for l in r) + .01, r[-1][1] + r[-1][3] + .03))
    return boxes

def obscure(im, x1, y1, x2, y2):
    """mosaic + blur: unreadable to people and to OCR"""
    b = (max(0, int(x1 * im.width)), max(0, int(y1 * im.height)), min(im.width, int(x2 * im.width)), min(im.height, int(y2 * im.height)))
    if b[2] - b[0] < 4 or b[3] - b[1] < 4: return
    c = im.crop(b); c = c.resize((max(1, c.width // 14), max(1, c.height // 14)), Image.BILINEAR).resize(c.size, Image.NEAREST).filter(ImageFilter.GaussianBlur(5))
    im.paste(c, b[:2])

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
    parts, skipped = [], []
    def clip(png, sec, name):
        p = os.path.join(WORK, f"{name}.mp4"); parts.append(p)
        run("ffmpeg", "-v", "error", "-y", "-loop", "1", "-t", str(sec), "-i", png, "-vf", f"fps={FPS},format=yuv420p,fade=t=in:d=0.3,fade=t=out:st={sec - 0.3}:d=0.3", "-c:v", "libx264", "-preset", "medium", "-crf", "18", p)
    card(os.path.join(WORK, "intro.png"), [(font(MONO, 26), "BUILT DURING THE HACKATHON", SODIUM), (font(SERIF, 70), "Muse Code at work", BONE),
         (font(MONO, 26), "the main recording of each task · TZ-01 … TZ-11 · about 4 hours sped up", MIST)])
    clip(os.path.join(WORK, "intro.png"), 3, "000-intro")
    for tz, f, date, what in SESS:
        dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", os.path.join(REC, f)], capture_output=True, text=True).stdout)
        card(os.path.join(WORK, f"{tz}-card.png"), [(font(MONO, 28), f"TZ-{tz.upper()} · {date} 2026 · {round(dur / 60)} MIN SESSION", SODIUM), (font(SERIF, 64), what, BONE)])
        clip(os.path.join(WORK, f"{tz}-card.png"), 2.2, f"{tz}-a-card")
        sel = pick(tz); fr = os.path.join(WORK, f"{tz}-frames"); shutil.rmtree(fr, ignore_errors=True); os.makedirs(fr)
        by = {}
        for l in open(os.path.join(WORK, f"{tz}-ocr.txt")).read().splitlines():
            p, box, t = l.split("\t", 2); by.setdefault(p, [])
            if box != "-": by[p].append((*map(float, box.split(",")), t))
        if missing := [n for n, _ in sel if os.path.join(WORK, tz, n) not in by]: sys.exit(f"TZ-{tz}: {len(missing)} frames were not OCR'd — run scan first")
        texts = lambda n: [l[4] for l in by[os.path.join(WORK, tz, n)]]
        sel = [(n, t) for n, t in sel if any(MUSE.search(x) for x in texts(n)) and not any(CHAT.search(x) for x in texts(n))]
        if len(sel) < MIN_FRAMES:
            skipped.append(tz); parts.pop(); print("skipped", tz, "— only", len(sel), "Muse Code frames"); continue
        blurred = 0
        f1 = font(MONO, 24)
        for j, (n, t) in enumerate(sel):
            im = Image.open(os.path.join(WORK, tz, n)).convert("RGB")
            im = im.resize((1920, round(im.height * 1920 / im.width)))
            for (x, y, w, h) in BLUR.get(tz, []): obscure(im, x, y, x + w, y + h)
            pb = private_boxes(by[os.path.join(WORK, tz, n)]); blurred += bool(pb)
            for b in pb: obscure(im, *b)
            can = Image.new("RGB", (1920, 1080), INK); can.paste(im.crop((0, 0, 1920, min(1080, im.height))), (0, (1080 - min(1080, im.height)) // 2))
            d = ImageDraw.Draw(can); txt = f"MUSE CODE · TZ-{tz.upper()} · REAL TIME {int(t) // 60:02d}:{int(t) % 60:02d} / {int(dur) // 60:02d}:{int(dur) % 60:02d}"
            tw = d.textlength(txt, font=f1); d.rounded_rectangle((1920 - tw - 56, 1080 - 70, 1896, 1080 - 22), 8, fill=(6, 7, 8)); d.text((1920 - tw - 40, 1080 - 62), txt, font=f1, fill=SODIUM)
            can.save(os.path.join(fr, f"{j:05d}.jpg"), quality=90)
        p = os.path.join(WORK, f"{tz}-b-run.mp4"); parts.append(p)
        # always PER seconds: fewer frames than PER*FPS are simply shown longer
        run("ffmpeg", "-v", "error", "-y", "-framerate", f"{len(sel) / PER:.4f}", "-i", os.path.join(fr, "%05d.jpg"), "-vf", f"fps={FPS},format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "20", p)
        print("built", tz, len(sel), "Muse Code frames,", blurred, "with names blurred")
    nr = NOT_RECORDED + (f"; {', '.join('TZ-' + t.upper() for t in skipped)}: too little Muse Code on screen" if skipped else "")
    card(os.path.join(WORK, "outro.png"), [(font(MONO, 26), "NOT IN THIS VIDEO", SODIUM), (font(SANS, 40 if len(nr) < 110 else 32), nr, BONE),
         (font(MONO, 26), "the 3D garage studio, the film player and the site design: Claude Code", MIST)])
    clip(os.path.join(WORK, "outro.png"), 4, "999-outro")
    lst = os.path.join(WORK, "list.txt"); open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
    out = os.path.join(REC, "timelapse", "muse-code-sessions-timelapse.mp4")
    run("ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out)
    print("OK", out)

if phase == "verify":
    # the acceptance check: OCR of what is actually shipped — the built frames and the final mp4 (10 frames a second) — finds no name
    out = os.path.join(REC, "timelapse", "muse-code-sessions-timelapse.mp4"); bad, sec = [], 0
    for tz, *_ in SESS:
        fr = os.path.join(WORK, f"{tz}-frames"); lines = text_lines(ocr(sorted(os.path.join(fr, n) for n in os.listdir(fr) if n.endswith(".jpg"))))
        b = [l for l in lines if DENY.search(l.split("\t")[-1]) or CHAT.search(l.split("\t")[-1])]; bad += b; sec += sum(1 for l in lines if SECRET.search(l.split("\t")[-1]))
        print(f"TZ-{tz} frames: {len(lines)} text lines, {len(b)} with names or chat UI")
    vd = os.path.join(WORK, "verify-mp4"); shutil.rmtree(vd, ignore_errors=True); os.makedirs(vd)
    run("ffmpeg", "-v", "error", "-i", out, "-vf", "fps=10", "-q:v", "2", os.path.join(vd, "%05d.jpg"))
    lines = text_lines(ocr(sorted(os.path.join(vd, n) for n in os.listdir(vd))))
    b = [l for l in lines if DENY.search(l.split("\t")[-1])]; bad += b
    # chat windows in the mp4 too — except on the title cards, whose own text names Claude Code
    cards = {l.split("\t")[0] for l in lines if re.search(r"NOT IN THIS VIDEO|BUILT DURING THE HACKATHON|MIN SESSION", l)}
    ch = [l for l in lines if l.split("\t")[0] not in cards and CHAT.search(l.split("\t")[-1])]; bad += ch
    print(f"mp4: {len(os.listdir(vd))} frames ({len(cards)} title cards), {len(lines)} text lines, {len(b)} with names, {len(ch)} with chat UI; SECRET-pattern lines in frames (reviewed at scan): {sec}")
    open(os.path.join(WORK, "verify-hits.txt"), "w").write("\n".join(bad))
    sys.exit(f"FAIL: {len(bad)} lines with names — verify-hits.txt" if bad else 0)
