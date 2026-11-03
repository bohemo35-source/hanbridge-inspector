# @agent:   claude-code
# @project: hanbridge-inspector
# @purpose: Wan opened the stern ramp in the sea clip; track the ship (phase correlation on the superstructure) and paste the closed stern from frame 0 over the ramp area, feathered
# @created: 2026-11-03
# usage: python3 scripts/film4/patch-stern.py <in.mp4> <out.mp4>
import sys, subprocess, numpy as np
from PIL import Image, ImageDraw, ImageFilter
src, dst = sys.argv[1:3]; W, H = 1280, 720
dec = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
F = np.frombuffer(dec, np.uint8).reshape(-1, H, W, 3).astype(np.float32)
ref = F[0]
# superstructure window for tracking
ty, tx = slice(330, 500), slice(690, 880)
def gray(a): return a @ np.array([0.299, 0.587, 0.114], np.float32)
def shift(a, b):
    A = np.fft.fft2(a - a.mean()); B = np.fft.fft2(b - b.mean())
    R = A * np.conj(B); R /= np.abs(R) + 1e-6
    c = np.fft.ifft2(R).real; y, x = np.unravel_index(np.argmax(c), c.shape)
    h, w = c.shape; return (y if y < h // 2 else y - h), (x if x < w // 2 else x - w)
# mask: ramp + lit opening (frame coords of the ship at frame 0), feathered
m = Image.new("L", (W, H), 0)
ImageDraw.Draw(m).polygon([(740, 470), (900, 440), (930, 560), (915, 625), (770, 625), (735, 560)], fill=255)
M = np.asarray(m.filter(ImageFilter.GaussianBlur(10)), np.float32)[..., None] / 255
out = []
g0 = gray(ref[ty, tx])
for i, fr in enumerate(F):
    dy, dx = shift(gray(fr[ty, tx]), g0)
    patch = np.roll(np.roll(ref, dy, 0), dx, 1); mk = np.roll(np.roll(M, dy, 0), dx, 1)
    out.append((fr * (1 - mk) + patch * mk).clip(0, 255).astype(np.uint8))
    if i % 10 == 0: print(i, "shift", dy, dx)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", "16", "-i", "-", "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", dst], input=np.stack(out).tobytes(), check=True)
