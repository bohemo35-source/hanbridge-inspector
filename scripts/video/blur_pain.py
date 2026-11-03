#!/usr/bin/env python3
# @agent:   claude-code
# @project: hanbridge-inspector
# @purpose: Client-chat screenshots for the "before" story: blur names, avatar, licence plates and car thumbnails in quotes (boxes found by eye, 736x1600 phone shots);
#           originals untouched, output → <out>/chat-1..8.jpg
# @created: 2026-11-03
# @updated: 2026-11-03 claude-code — bottom strip of the bolt shots blurred
# @updated: 2026-11-03 claude-code — Arthur's own name («Artur Lim») blurred too, everywhere
# @updated: 2026-11-03 claude-code — dm/ desktop shots (18.09.49 «когда она поедет?», 18.07.52 photo wall): names, plates, avatar; the photo wall pixelated whole (neighbour plates)
# @updated: 2026-11-03 claude-code — also the two «from bolt» shots (IMG_4020/4021: «Когда отправка?», «Не отправилось»): names, company, avatars, people's names in file names
# usage: python3 scripts/video/blur_pain.py <dir with PHOTO-*.jpg> <out dir>   (a «from bolt» subfolder, when present, gives bolt-4020.jpg / bolt-4021.jpg)
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
def blur(src_file, boxes, dst, k=1, pixelate=(), crop=None):
    im = Image.open(src_file).convert("RGB")
    for (x, y, w, h, f) in pixelate:  # coarse mosaic over a whole area: shapes stay, small text (plates) does not
        x, y, w, h = x * k, y * k, w * k, h * k
        reg = im.crop((x, y, x + w, y + h))
        im.paste(reg.resize((max(1, w // f), max(1, h // f)), Image.BILINEAR).resize((w, h), Image.BILINEAR), (x, y))
    for (x, y, w, h) in boxes:
        x, y, w, h = x * k, y * k, w * k, h * k
        reg = im.crop((x, y, x + w, y + h))
        reg = reg.resize((max(1, w // 10), max(1, h // 10)), Image.BILINEAR).resize((w, h), Image.NEAREST).filter(ImageFilter.GaussianBlur(4 * k))
        im.paste(reg, (x, y))
    if crop: im = im.crop(tuple(v * k for v in crop))
    im.save(dst, quality=90)
    print(os.path.basename(src_file), "→", os.path.basename(dst), len(boxes), "boxes")

for i, f in enumerate(files):
    blur(f, BOXES.get(i, []), os.path.join(out, f"chat-{i + 1}.jpg"))

# «from bolt»: 1206 x 2622 shots, boxes found on a half-size view (k = 2)
BOLT = {
    "IMG_4020.PNG": [(186, 98, 272, 66), (506, 92, 80, 80),                    # chat name, avatar
                     (40, 642, 405, 58), (40, 772, 405, 58),                     # «[name]» + people's names in file names
                     (85, 898, 130, 52), (162, 966, 418, 54), (162, 1070, 418, 54), (136, 1146, 50, 46)],  # forwarded from, two more names, reaction avatar
    "IMG_4021.PNG": [(190, 98, 272, 66), (508, 92, 80, 80),
                     (42, 420, 245, 34), (40, 556, 60, 56), (98, 558, 245, 34), (94, 832, 245, 34), (322, 1062, 245, 34),  # «[name]» x4, document photo
                     (332, 758, 50, 46), (352, 1160, 50, 46),               # reaction avatars
                     (40, 290, 190, 58)],                                    # «Artur Lim · Видео» quote (name + thumbnail)
}
# the bottom strip (input bar, a phone number and a passport edge peeking in) is blurred too, though every use crops it off
for boxes in BOLT.values(): boxes.append((0, 1160, 603, 151))
bolt = os.path.join(src, "from bolt")
for name, boxes in BOLT.items():
    if os.path.exists(os.path.join(bolt, name)):
        blur(os.path.join(bolt, name), boxes, os.path.join(out, f"bolt-{name[4:8]}.jpg"), k=2)

# dm/: desktop Telegram shots, boxes found on a half-size view (k = 2); left strip of the window cropped
DM = {
    "18.09.49": dict(out="dm-0949.jpg", crop=(28, 0, 685, 1022), boxes=[(22, 12, 44, 44), (64, 14, 175, 34),   # avatar, chat name
                     (254, 118, 112, 26),                                                                     # «[name]» (plate digits + surname)
                     (356, 558, 76, 24), (544, 540, 70, 24),                                                  # plates on the two videos
                     (236, 676, 52, 24),                                                                      # «[name]»
                     (44, 920, 195, 40),                                                                      # «[name]»
                     (46, 184, 76, 22)]),                                                                     # «Artur Lim» quote
    "18.07.52": dict(out="dm-0752.jpg", crop=(0, 0, 672, 1123), boxes=[(10, 6, 44, 44), (50, 8, 175, 34), (78, 1024, 155, 40)],  # + «В ответ Artur Lim»
                     pixelate=[(288, 98, 384, 920, 14)]),                                                     # the whole photo wall
}
dm = os.path.join(src, "dm")
if os.path.isdir(dm):
    for tag, o in DM.items():
        f = next((os.path.join(dm, n) for n in os.listdir(dm) if tag in n), None)
        if f: blur(f, o["boxes"], os.path.join(out, o["out"]), k=2, pixelate=o.get("pixelate", ()), crop=o["crop"])
