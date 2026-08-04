#!/usr/bin/env python3
# Reads an HTML document on stdin, writes a PDF to stdout. Used by
# lib/htmlToPdf.js to render the "designer" CV templates via weasyprint.
import sys

def main():
    html = sys.stdin.buffer.read().decode("utf-8", "replace")
    from weasyprint import HTML
    pdf = HTML(string=html, base_url=".").write_pdf()
    sys.stdout.buffer.write(pdf)
    sys.stdout.buffer.flush()

if __name__ == "__main__":
    main()
