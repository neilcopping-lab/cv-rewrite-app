#!/usr/bin/env python3
# Stamp a diagonal "PREVIEW" watermark across every page of a PDF.
# Reads a PDF from stdin, writes the watermarked PDF to stdout.
# Used ONLY for the on-screen preview — the paid download is never watermarked.
import sys
from io import BytesIO

def main():
    data = sys.stdin.buffer.read()
    try:
        from reportlab.pdfgen import canvas
        from pypdf import PdfReader, PdfWriter
    except Exception:
        # Dependencies missing: fail open so the preview still renders.
        sys.stdout.buffer.write(data)
        return

    reader = PdfReader(BytesIO(data))
    writer = PdfWriter()
    for page in reader.pages:
        w = float(page.mediabox.width)
        h = float(page.mediabox.height)
        buf = BytesIO()
        c = canvas.Canvas(buf, pagesize=(w, h))
        c.saveState()
        try:
            c.setFillAlpha(0.10)
        except Exception:
            pass
        c.setFillColorRGB(0.45, 0.45, 0.45)
        c.setFont("Helvetica-Bold", 34)
        c.translate(w / 2, h / 2)
        c.rotate(32)
        text = "PREVIEW  ·  the-common-people.com"
        # Tile the text across the whole page so it can't be cropped out.
        y = -int(h)
        while y < int(h):
            x = -int(w)
            while x < int(w):
                c.drawCentredString(x, y, text)
                x += 360
            y += 90
        c.restoreState()
        c.save()
        buf.seek(0)
        overlay = PdfReader(buf).pages[0]
        page.merge_page(overlay)
        writer.add_page(page)

    out = BytesIO()
    writer.write(out)
    sys.stdout.buffer.write(out.getvalue())

if __name__ == "__main__":
    main()
