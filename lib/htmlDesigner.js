// ─── "Designer" CV templates (HTML → PDF) ───────────────────────────────────
// A premium, PDF-only tier that sits alongside the Word/ATS docx templates.
// These render with real print CSS (coloured panels, icons, pills) via
// weasyprint (see lib/htmlToPdf.js). ONE data object (the same CV schema used
// by docxExport) drives every template. Nothing is invented: skills are shown
// as labels (no fabricated proficiency bars) and key achievements come straight
// from the candidate's own experience.

const DESIGNER_TEMPLATES = [
  { id: "d-executive-navy", name: "Executive Navy", kind: "designer",
    description: "Right-hand navy panel with key achievements and skills. Bold and senior." },
  { id: "d-teal-sidebar", name: "Teal Sidebar", kind: "designer",
    description: "Left teal sidebar with a monogram, contact, achievements and skills." },
  { id: "d-header-band", name: "Header Band", kind: "designer",
    description: "A full-width colour header, achievement cards and skill pills." },
  { id: "d-minimal-elegant", name: "Minimal Elegant", kind: "designer",
    description: "Centered serif, formal and understated — an Ivy-League feel." },
  { id: "d-timeline", name: "Timeline", kind: "designer",
    description: "A coloured timeline running down your career history." }
];
const isDesigner = (id) => DESIGNER_TEMPLATES.some((t) => t.id === id);

// ---- helpers ---------------------------------------------------------------
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function contactBits(cv) {
  const c = cv.header?.contacts || {};
  const links = [];
  if (cv.header?.linkedin) links.push(cv.header.linkedin.replace(/^https?:\/\//, ""));
  return { email: c.email || "", phone: c.phone || "", location: c.location || "", link: links[0] || "" };
}
function achievements(cv, n) {
  const out = [];
  (cv.experience || []).forEach((r) => (r.achievements || []).forEach((a) => { if (a && out.length < (n || 4)) out.push(a); }));
  return out;
}
function expHtml(cv, { datesRight = false, timeline = false } = {}) {
  return (cv.experience || []).map((r) => {
    const title = `${esc(r.title || "")} &nbsp;&middot;&nbsp; <span class="rco">${esc(r.company || "")}</span>`;
    const li = (r.responsibilities || []).filter(Boolean).map((b) => `<li>${esc(b)}</li>`).join("") +
               (r.achievements || []).filter(Boolean).map((a) => `<li><b>${esc(a)}</b></li>`).join("");
    const dot = timeline ? '<span class="tdot"></span>' : "";
    if (datesRight) {
      return `<div class="job">${dot}<div class="rrow"><span class="rtitle">${title}</span><span class="rdate">${esc(r.dates || "")}</span></div><ul>${li}</ul></div>`;
    }
    return `<div class="job">${dot}<div class="rtitle">${title}</div><div class="rmeta">${esc(r.dates || "")}</div><ul>${li}</ul></div>`;
  }).join("");
}
function eduHtml(cv) {
  return "<ul>" + (cv.education || []).map((e) => {
    const bits = [e.qualification, e.institution, e.dates].filter(Boolean).map(esc).join(" &middot; ");
    return `<li>${bits}</li>`;
  }).join("") + "</ul>";
}
function achSide(cv) {
  return achievements(cv, 4).map((a) => `<div class="ach"><span class="star">&#9733;</span><span class="atext">${esc(a)}</span></div>`).join("");
}
function skillLines(cv) {
  return (cv.skills || []).map((s) => `<div class="skill">${esc(s.skill)}</div>`).join("");
}
function skillPills(cv) {
  return '<div class="pills">' + (cv.skills || []).map((s) => `<span class="pill">${esc(s.skill)}</span>`).join(" ") + "</div>";
}
function contactsIconRow(cv) {
  const c = contactBits(cv);
  const bit = (ic, v) => v ? `<span><span class="ic">${ic}</span> ${esc(v)}</span>` : "";
  return bit("&#9993;", c.email) + bit("&#9742;", c.phone) + bit("&#8962;", c.location) + bit("in", c.link);
}

const BASE = "font-family:'Liberation Sans','DejaVu Sans','Arial',sans-serif;";
function pageWrap(css, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:0}body{margin:0;${BASE}color:#2b2b2b;font-size:10pt;line-height:1.42}${css}</style></head><body>${body}</body></html>`;
}

// ---- the five templates ----------------------------------------------------
function tNavy(cv) {
  const css = `.sb{position:fixed;top:0;bottom:0;right:0;width:38%;background:#1F3346;z-index:-1}
  td.main{width:62%;vertical-align:top;padding:30px 24px 30px 34px}td.side{width:38%;vertical-align:top;padding:30px 26px;color:#fff}
  table{width:100%;border-collapse:collapse}.name{font-size:23pt;font-weight:700;color:#1F3346}.role{color:#2C7A8C;font-weight:700;font-size:11pt;margin:3px 0 9px}
  .contacts{font-size:8.6pt;color:#5a5a5a;margin-bottom:4px}.contacts span{margin-right:14px}.ic{color:#2C7A8C;font-weight:700}
  h2{font-size:10.5pt;letter-spacing:1.2px;text-transform:uppercase;color:#2C7A8C;border-bottom:1.6px solid #dbe4e7;padding-bottom:3px;margin:16px 0 9px}
  .side h2{color:#E0B03C;border-bottom:1px solid rgba(255,255,255,.28)}.rtitle{font-weight:700;font-size:10.5pt;color:#1F3346}.rco{color:#2b2b2b;font-weight:700}
  .rmeta{color:#8a8a8a;font-style:italic;font-size:8.6pt;margin:1px 0 5px}ul{margin:4px 0 10px;padding-left:15px}li{margin-bottom:4px}
  .ach{margin-bottom:9px}.atext{color:#eaf0f4;font-size:8.9pt}.star{color:#E0B03C;margin-right:6px}
  .skill{color:#fff;font-size:9.2pt;margin-bottom:5px;font-weight:600}`;
  const body = `<div class="sb"></div><table><tr><td class="main"><div class="name">${esc(cv.header?.name)}</div><div class="role">${esc(cv.header?.targetRole)}</div><div class="contacts">${contactsIconRow(cv)}</div><h2>Summary</h2><div>${esc(cv.personalStatement)}</div><h2>Experience</h2>${expHtml(cv)}<h2>Education</h2>${eduHtml(cv)}</td><td class="side"><h2>Key Achievements</h2>${achSide(cv)}<h2>Skills</h2>${skillLines(cv)}</td></tr></table>`;
  return pageWrap(css, body);
}
function tTeal(cv) {
  const mono = (cv.header?.name || "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const c = contactBits(cv);
  const css = `.sb{position:fixed;top:0;bottom:0;left:0;width:35%;background:#14707E;z-index:-1}
  td.side{width:35%;vertical-align:top;padding:30px 24px;color:#fff}td.main{width:65%;vertical-align:top;padding:30px 30px 30px 26px}table{width:100%;border-collapse:collapse}
  .mono{width:70px;height:70px;border-radius:50%;background:rgba(255,255,255,.15);border:2px solid #E0B03C;color:#fff;font-size:22pt;font-weight:700;text-align:center;line-height:70px;margin-bottom:14px}
  .name{font-size:21pt;font-weight:700;color:#14707E}.role{color:#B8860B;font-weight:700;font-size:10.5pt;margin:3px 0 10px}
  h2{font-size:10pt;letter-spacing:1.2px;text-transform:uppercase;color:#14707E;border-bottom:1.6px solid #dfeaeb;padding-bottom:3px;margin:15px 0 8px}
  .side h2{color:#E0B03C;border-bottom:1px solid rgba(255,255,255,.3)}
  .rtitle{font-weight:700;font-size:10.5pt;color:#1a1a1a}.rco{color:#14707E;font-weight:700}.rmeta{color:#8a8a8a;font-style:italic;font-size:8.6pt;margin:1px 0 5px}
  ul{margin:4px 0 10px;padding-left:15px}li{margin-bottom:4px}
  .ach{margin-bottom:8px}.atext{color:#eaf6f6;font-size:8.6pt}.star{color:#E0B03C;margin-right:6px}
  .skill{color:#fff;font-size:9pt;margin-bottom:5px;font-weight:600}.cont{font-size:8.6pt;color:#eaf6f6;line-height:1.9}`;
  const cont = `<div class="cont">${c.email ? "&#9993; " + esc(c.email) + "<br>" : ""}${c.phone ? "&#9742; " + esc(c.phone) + "<br>" : ""}${c.location ? "&#8962; " + esc(c.location) + "<br>" : ""}${c.link ? "in " + esc(c.link) : ""}</div>`;
  const body = `<div class="sb"></div><table><tr><td class="side"><div class="mono">${esc(mono)}</div><h2>Contact</h2>${cont}<h2>Key Achievements</h2>${achSide(cv)}<h2>Skills</h2>${skillLines(cv)}</td><td class="main"><div class="name">${esc(cv.header?.name)}</div><div class="role">${esc(cv.header?.targetRole)}</div><h2>Summary</h2><div>${esc(cv.personalStatement)}</div><h2>Experience</h2>${expHtml(cv)}<h2>Education</h2>${eduHtml(cv)}</td></tr></table>`;
  return pageWrap(css, body);
}
function tBand(cv) {
  const css = `.hdr{background:#1F3346;color:#fff;padding:26px 40px 22px}.name{font-size:24pt;font-weight:700}
  .role{color:#E0B03C;font-weight:700;font-size:11pt;margin:4px 0 8px}.contacts{font-size:8.8pt;color:#cdd7de}.contacts span{margin-right:16px}.ic{color:#E0B03C;font-weight:700}
  .wrap{padding:22px 40px}h2{font-size:11pt;letter-spacing:1.2px;text-transform:uppercase;color:#2C7A8C;border-bottom:2px solid #E0B03C;display:inline-block;padding-bottom:2px;margin:16px 0 9px}
  .rrow{display:flex;justify-content:space-between}.rtitle{font-weight:700;font-size:10.7pt;color:#1F3346}.rco{color:#2b2b2b;font-weight:700}.rdate{color:#8a8a8a;font-style:italic;font-size:8.8pt;white-space:nowrap}
  ul{margin:4px 0 10px;padding-left:16px}li{margin-bottom:4px}
  .achrow{display:flex;gap:14px;margin:6px 0 4px}.acard{flex:1;background:#f4f7f8;border-left:3px solid #2C7A8C;padding:8px 10px}.acard .t{color:#1F3346;font-size:8.8pt}
  .pill{display:inline-block;background:#eaf1f2;color:#1F3346;border:1px solid #cfe0e2;border-radius:11px;padding:3px 11px;font-size:8.8pt;margin:0 6px 6px 0;font-weight:600}`;
  const ach = achievements(cv, 4);
  const cards = (arr) => '<div class="achrow">' + arr.map((a) => `<div class="acard"><div class="t"><b>&#9733;</b> ${esc(a)}</div></div>`).join("") + "</div>";
  const achBlock = cards(ach.slice(0, 2)) + (ach.length > 2 ? cards(ach.slice(2, 4)) : "");
  const body = `<div class="hdr"><div class="name">${esc(cv.header?.name)}</div><div class="role">${esc(cv.header?.targetRole)}</div><div class="contacts">${contactsIconRow(cv)}</div></div><div class="wrap"><h2>Summary</h2><div>${esc(cv.personalStatement)}</div>${ach.length ? "<h2>Key Achievements</h2>" + achBlock : ""}<h2>Skills</h2>${skillPills(cv)}<h2>Experience</h2>${expHtml(cv, { datesRight: true })}<h2>Education</h2>${eduHtml(cv)}</div>`;
  return pageWrap(css, body);
}
function tMinimal(cv) {
  const c = contactBits(cv);
  const css = `body{font-family:'Liberation Serif','DejaVu Serif','Georgia',serif}.wrap{padding:44px 60px}
  .name{font-size:26pt;font-weight:700;color:#1a1a1a;text-align:center;letter-spacing:1px}
  .role{text-align:center;color:#8a6a10;font-size:11.5pt;margin:4px 0 8px;font-style:italic}
  .contacts{text-align:center;font-size:9pt;color:#666;border-top:1px solid #d8cba0;border-bottom:1px solid #d8cba0;padding:7px 0;margin-bottom:6px}.contacts span{margin:0 10px}
  h2{font-size:10.5pt;letter-spacing:3px;text-transform:uppercase;color:#8a6a10;text-align:center;margin:20px 0 10px}
  .rtitle{font-weight:700;font-size:11.5pt;color:#1a1a1a}.rco{font-weight:400}.rmeta{color:#8a8a8a;font-style:italic;font-size:9pt;margin:1px 0 5px}
  ul{margin:4px 0 12px;padding-left:18px}li{margin-bottom:5px}.skl{text-align:center;font-size:10.5pt;line-height:1.9}.skl b{color:#1a1a1a}`;
  const skl = (cv.skills || []).map((s) => `<b>${esc(s.skill)}</b>`).join(" &nbsp;&bull;&nbsp; ");
  const cbits = [c.email, c.phone, c.location, c.link].filter(Boolean).map((v) => `<span>${esc(v)}</span>`).join("");
  const body = `<div class="wrap"><div class="name">${esc(cv.header?.name)}</div><div class="role">${esc(cv.header?.targetRole)}</div><div class="contacts">${cbits}</div><h2>Profile</h2><div style="text-align:justify">${esc(cv.personalStatement)}</div><h2>Experience</h2>${expHtml(cv)}<h2>Core Skills</h2><div class="skl">${skl}</div><h2>Education</h2>${eduHtml(cv)}</div>`;
  return pageWrap(css, body);
}
function tTimeline(cv) {
  const css = `.wrap{padding:34px 44px}.name{font-size:23pt;font-weight:700;color:#1F3346}.role{color:#2C7A8C;font-weight:700;font-size:11pt;margin:3px 0 8px}
  .contacts{font-size:8.8pt;color:#5a5a5a;margin-bottom:4px}.contacts span{margin-right:16px}.ic{color:#2C7A8C;font-weight:700}
  h2{font-size:10.5pt;letter-spacing:1.2px;text-transform:uppercase;color:#2C7A8C;border-bottom:1.6px solid #dbe4e7;padding-bottom:3px;margin:17px 0 10px}
  .tl{border-left:2px solid #cfe0e2;margin-left:6px;padding-left:20px}.job{position:relative;margin-bottom:12px}
  .tdot{position:absolute;left:-27px;top:3px;width:11px;height:11px;border-radius:50%;background:#2C7A8C;border:2px solid #fff;box-shadow:0 0 0 2px #cfe0e2}
  .rtitle{font-weight:700;font-size:10.7pt;color:#1F3346}.rco{color:#2b2b2b;font-weight:700}.rmeta{color:#8a8a8a;font-style:italic;font-size:8.8pt;margin:1px 0 5px}
  ul{margin:4px 0 6px;padding-left:16px}li{margin-bottom:4px}
  .pill{display:inline-block;background:#eaf1f2;color:#1F3346;border:1px solid #cfe0e2;border-radius:11px;padding:3px 11px;font-size:8.8pt;margin:0 6px 6px 0;font-weight:600}
  .ach{margin-bottom:6px}.atext{color:#333;font-size:9pt}.star{color:#E0B03C;margin-right:5px}`;
  const ach = achievements(cv, 4).map((a) => `<div class="ach"><span class="star">&#9733;</span><span class="atext">${esc(a)}</span></div>`).join("");
  const body = `<div class="wrap"><div class="name">${esc(cv.header?.name)}</div><div class="role">${esc(cv.header?.targetRole)}</div><div class="contacts">${contactsIconRow(cv)}</div><h2>Summary</h2><div>${esc(cv.personalStatement)}</div>${ach ? "<h2>Key Achievements</h2>" + ach : ""}<h2>Experience</h2><div class="tl">${expHtml(cv, { timeline: true })}</div><h2>Skills</h2>${skillPills(cv)}<h2>Education</h2>${eduHtml(cv)}</div>`;
  return pageWrap(css, body);
}

const RENDERERS = {
  "d-executive-navy": tNavy, "d-teal-sidebar": tTeal, "d-header-band": tBand,
  "d-minimal-elegant": tMinimal, "d-timeline": tTimeline
};
function renderDesignerHtml(cv, id) {
  const fn = RENDERERS[id] || tNavy;
  return fn(cv || {});
}

module.exports = { DESIGNER_TEMPLATES, isDesigner, renderDesignerHtml };
