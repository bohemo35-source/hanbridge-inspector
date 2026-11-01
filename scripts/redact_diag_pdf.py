#!/usr/bin/env python3
# @agent:   claude
# @project: hanbridge-inspector
# @purpose: Public copy of a LAUNCH OBD report: text via pdftotext, personal data redacted (address/name line, phones, links, VIN tail),
#           re-rendered as a plain text PDF. The agent's read_diagnostic_report reads fault codes from it exactly as from the original.
#   python3 scripts/redact_diag_pdf.py <in.pdf> <out.pdf>
# @created: 2026-11-01
import re, subprocess, sys
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

FONT_PATHS = ["/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", "/System/Library/Fonts/Supplemental/Courier New.ttf"]
src, dst = sys.argv[1], sys.argv[2]
text = subprocess.run(["pdftotext", "-layout", src, "-"], capture_output=True, text=True, check=True).stdout

LABELS = re.compile(r"^(\s*(?:Адрес|Address|Телефон|Phone|Tel|Название СТО|Мастерская)\s*[：:])(.*)$", re.I)
def redact_line(line: str) -> str:
    m = LABELS.match(line)
    if m and m.group(2).strip():
        # keep the label, drop the value (names, addresses, phones); several "label : value" pairs can share one line
        line = m.group(1) + " [redacted]"
    line = re.sub(r"(Адрес|Address)\s*[：:]\s*\S+(?:\s\S+)?", r"\1 : [redacted]", line)
    line = re.sub(r"(Телефон|Phone|Tel)\s*[：:]\s*[\d+()\s-]{6,}", r"\1 : [redacted]", line)
    line = re.sub(r"https?://\S+", "[link]", line)
    line = re.sub(r"\+?\d[\d\s()\-]{8,}\d", "[phone]", line) if not re.search(r"\d{4}-\d{2}-\d{2}", line) else line
    line = re.sub(r"\b([A-HJ-NPR-Z0-9]{11})[A-HJ-NPR-Z0-9]{6}\b", r"\1******", line)
    return line

clean = "\n".join(redact_line(l) for l in text.split("\n"))
for pth in FONT_PATHS:
    try: pdfmetrics.registerFont(TTFont("Mono", pth)); break
    except Exception: continue
else: sys.exit("no mono font with Cyrillic found")

W, H = A4; size, lead, margin = 5.6, 7.0, 24
c = canvas.Canvas(dst, pagesize=A4); c.setTitle("Diagnostic report (personal data redacted)")
for page in clean.split("\f"):
    y = H - margin; c.setFont("Mono", size)
    for line in page.split("\n"):
        if y < margin: c.showPage(); c.setFont("Mono", size); y = H - margin
        c.drawString(margin, y, line.rstrip()); y -= lead
    c.showPage()
c.save()
print("ok", dst)
