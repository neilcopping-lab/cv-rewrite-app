"""Contrast test for the Identify Your Options landing page.
For every piece of text on the page, hides the text, screenshots the box behind it,
finds the worst background pixel and works out the WCAG contrast ratio against the text colour.
WCAG AA: 4.5:1 for normal text, 3:1 for large text (24px+, or 18.66px+ bold)."""
import sys, json, io
from playwright.sync_api import sync_playwright
import os
CHROME = {'executable_path': '/usr/bin/google-chrome'} if os.path.exists('/usr/bin/google-chrome') else {}
from PIL import Image

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3399/options.html"
WIDTHS = [(360, 780, "small phone"), (390, 844, "phone"), (768, 1024, "tablet"), (1280, 900, "laptop"), (1600, 1000, "wide screen")]

def lum(rgb):
    def ch(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb[:3]
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)

def ratio(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)

JS = """() => {
  const out = [];
  const walker = document.createTreeWalker(document.querySelector('main') || document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode; if (!t.textContent.trim()) continue;
    const el = t.parentElement; const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const r = document.createRange(); r.selectNodeContents(t);
    for (const b of r.getClientRects()) {
      if (b.width < 2 || b.height < 2) continue;
      out.push({ text: t.textContent.trim().slice(0, 60), color: cs.color,
        size: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight) || 400,
        x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height });
    }
    el.setAttribute('data-ct', '1');
  }
  return out;
}"""

results = []
with sync_playwright() as p:
    br = p.chromium.launch(**CHROME, args=["--no-sandbox"])
    for w, h, name in WIDTHS:
        pg = br.new_page(viewport={"width": w, "height": h})
        pg.route("**/savri.io/**", lambda r: r.abort())
        pg.goto(URL); pg.wait_for_timeout(1200)
        items = pg.evaluate(JS)
        pg.add_style_tag(content="[data-ct]{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}")
        pg.wait_for_timeout(200)
        shot = Image.open(io.BytesIO(pg.screenshot(full_page=True))).convert("RGB")
        for it in items:
            rgb = [int(float(v)) for v in it["color"].replace("rgba(", "").replace("rgb(", "").replace(")", "").split(",")[:3]]
            box = shot.crop((int(it["x"]), int(it["y"]), int(it["x"] + it["w"]), int(it["y"] + it["h"])))
            px = list(box.get_flattened_data())
            if not px: continue
            worst = min(px, key=lambda c: ratio(rgb, c))
            r = ratio(rgb, worst)
            large = it["size"] >= 24 or (it["size"] >= 18.66 and it["weight"] >= 700)
            need = 3.0 if large else 4.5
            results.append({"width": name, "text": it["text"], "ratio": round(r, 2), "need": need, "pass": r >= need,
                            "text_colour": "#%02X%02X%02X" % tuple(rgb), "worst_bg": "#%02X%02X%02X" % worst})
        pg.close()
    br.close()

fails = [r for r in results if not r["pass"]]
hero = [r for r in results if r["text_colour"] in ("#E6FF1A","#FFFFFF") and r["ratio"] < 7]
hl=[r["ratio"] for r in results if r["text"].startswith("Not sure")]
note=[r["ratio"] for r in results if "Opening soon" in r["text"] or "loading the official" in r["text"]]
print("note lowest", min(note) if note else None)
print("headline lowest", min(hl) if hl else None)
print(json.dumps({"checked": len(results), "failed": len(fails), "fails": fails, "yellow_or_white_under_7": hero}, indent=1))
