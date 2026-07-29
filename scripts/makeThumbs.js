// Generate a distinct SVG thumbnail per design for the picker, driven by the
// same design config so the thumbnail matches the real layout family/colour.
const fs = require("fs");
const path = require("path");
const { designs } = require("../lib/designs");
const outDir = path.join(__dirname, "..", "public", "img", "thumbs");
fs.mkdirSync(outDir, { recursive: true });

function thumb(d) {
  const a = "#" + d.accent;
  const W = 300, H = 220, ink = "#1A1A1A", paper = "#fff", line = "#E7E2D5";
  const bars = (x, y, w, n, gap = 9) => Array.from({ length: n }, (_, i) => `<rect x="${x}" y="${y + i * gap}" width="${w}" height="4" rx="2" fill="${line}"/>`).join("");
  let head, cols = "";
  if (d.layout === "headerblock") head = `<rect x="0" y="0" width="${W}" height="46" fill="${a}"/><rect x="16" y="14" width="120" height="10" rx="3" fill="#fff"/><rect x="16" y="30" width="80" height="6" rx="3" fill="#ffffffaa"/>`;
  else head = `<rect x="16" y="16" width="140" height="12" rx="3" fill="${ink}"/><rect x="16" y="34" width="90" height="7" rx="3" fill="${["heading","rule"].includes(d.accentUsage)?a:"#9A9382"}"/>${d.sectionRule||d.accentUsage==="rule"?`<rect x="16" y="50" width="${W-32}" height="2" fill="${a}"/>`:""}`;

  if (d.layout === "sidebar") {
    const sw = Math.round(W * (d.sidebarWidth || 32) / 100);
    cols = `<rect x="0" y="56" width="${sw}" height="${H-56}" fill="${a}"/>${bars(12,78,sw-24,7).replace(/fill="[^"]*"/g,'fill="#ffffffcc"')}${bars(sw+16,78,W-sw-32,9)}`;
  } else if (d.layout === "timeline") {
    cols = `<rect x="30" y="70" width="3" height="${H-90}" fill="${a}"/>${[80,120,160].map(y=>`<circle cx="31.5" cy="${y}" r="5" fill="${a}"/>`).join("")}${bars(46,74,W-70,10)}`;
  } else if (d.layout === "grid") {
    let g = "";
    for (let r=0;r<3;r++) for (let c=0;c<2;c++) g += `<rect x="${16+c*(W/2-8)}" y="${70+r*30}" width="${W/2-24}" height="24" rx="3" fill="#F2F0EA" stroke="${line}"/>`;
    cols = g + bars(16,168,W-32,4);
  } else {
    cols = bars(16, 70, W - 32, 12);
    if (d.accentUsage==="heading") cols = `<rect x="16" y="70" width="70" height="6" rx="3" fill="${a}"/>` + bars(16,84,W-32,9);
    if (d.metricsProminent) cols += `<rect x="${W-90}" y="70" width="74" height="30" rx="4" fill="${a}"/>`;
    if (d.achievementCallouts) cols += `<rect x="16" y="150" width="${W-32}" height="16" rx="3" fill="#FBF1E6"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${paper}"/>${head}${cols}</svg>`;
}

let n = 0;
for (const d of designs) { fs.writeFileSync(path.join(outDir, d.id + ".svg"), thumb(d)); n++; }
console.log("Wrote", n, "thumbnails to", outDir);
