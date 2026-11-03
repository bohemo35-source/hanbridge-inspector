#!/usr/bin/env python3
# @agent:   claude-code
# @project: hanbridge-inspector
# @purpose: Client-chat screenshots for the "before" story: blur names, avatar, licence plates and car thumbnails in quotes (boxes found by eye, 736x1600 phone shots);
#           originals untouched, output → <out>/chat-1..8.jpg
# @created: 2026-11-03
# usage: python3 scripts/video/blur_pain.py <dir with PHOTO-*.jpg> <out dir>
import glob, os, sys
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
files = sorted(glob.glob(os.path.join(src, "PHOTO-*.jpg")))  # same order as the review sheet
# (x, y, w, h) per file index
BOXES = {
    0: [(488, 558, 94, 94), (40, 1306, 132, 48)],             # voice-note avatar; «[name]» in a forwarded message
    1: [(258, 1150, 310, 48), (218, 936, 100, 116)],          # «[name]»; video thumbnail (car)
    2: [(240, 1334, 205, 46), (610, 498, 96, 142), (418, 1090, 96, 146)],  # «[name]»; car thumbnails in quotes
    3: [],
    4: [],
    5: [(414, 944, 66, 40), (136, 1232, 98, 46)],             # plates «…1133»
    6: [(236, 386, 108, 34), (646, 364, 64, 36)],             # plates «327주 6672»
    7: [(420, 398, 165, 48)],                                  # «Номер машины: 336저 1133»
}
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB")
    for (x, y, w, h) in BOXES.get(i, []):
        reg = im.crop((x, y, x + w, y + h))
        reg = reg.resize((max(1, w // 10), max(1, h // 10)), Image.BILINEAR).resize((w, h), Image.NEAREST).filter(ImageFilter.GaussianBlur(4))
        im.paste(reg, (x, y))
    im.save(os.path.join(out, f"chat-{i + 1}.jpg"), quality=90)
    print(os.path.basename(f), "→", f"chat-{i + 1}.jpg", len(BOXES.get(i, [])), "boxes")
