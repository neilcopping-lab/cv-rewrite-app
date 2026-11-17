// "Fresh" CV designs for the master CV builder.
//
// Bright, modern, print-ready PDF designs made for first CVs and people early
// in their working lives. Unlike the older designs, every section of the master
// CV gets a proper home: the personal statement, the key skills and behaviours
// people ticked, the skills they can prove, work history, education and
// interests. The same HTML is shown live on the builder page and turned into a
// PDF with weasyprint (lib/htmlToPdf.js), so what you see is what you get.
//
// Nothing is invented: every word comes from what the person typed or ticked.

const path = require("path");
const behaviours = require("./behaviours");

const FRESH_TEMPLATES = [
  { id: "f-sunrise", name: "Sunrise", kind: "fresh", category: "Fresh",
    description: "A warm orange header, with your strengths in a side panel." },
  { id: "f-green", name: "Fresh Green", kind: "fresh", category: "Fresh",
    description: "A green sidebar with your initials, contact details and strengths." },
  { id: "f-bold", name: "Bold", kind: "fresh", category: "Fresh",
    description: "A big, confident name and your strengths laid out as cards." },
  { id: "f-sky", name: "Sky", kind: "fresh", category: "Fresh",
    description: "Light and airy blue, with tidy tags for each section." },
];
const isFresh = (id) => FRESH_TEMPLATES.some((t) => t.id === id);

// Where the fonts live: a file path for the PDF, a web path for the preview.
const FONT_FILE_BASE = "file://" + path.join(__dirname, "..", "public", "fonts", "cv") + "/";
const FONT_WEB_BASE = "/fonts/cv/";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const shortUrl = (u) => String(u || "").replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");

// A reason for leaving only belongs on a CV once you've left.
const STILL_THERE = /^(still (here|there|working|employed)|current(ly)?|ongoing|n\/?a|present|not (left|leaving))\b/i;
const reasonFor = (r) => (r.reasonForLeaving && !STILL_THERE.test(r.reasonForLeaving.trim()) ? r.reasonForLeaving : "");

// Everything the templates need, already tidy.
function prep(cv) {
  const h = cv.header || {};
  const c = h.contacts || {};
  const links = [];
  if (h.linkedin) links.push({ label: "LinkedIn", url: h.linkedin });
  if (h.portfolio) links.push({ label: "Portfolio", url: h.portfolio });
  if (h.introVideo) links.push({ label: "My intro video", url: h.introVideo });
  const name = h.name || "Your name";
  return {
    name,
    initials: name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
    role: h.targetRole || "",
    contacts: [c.email, c.phone, c.location].filter(Boolean),
    links,
    statement: cv.personalStatement || "",
    strengths: Array.isArray(cv.strengths) ? cv.strengths : behaviours.toSkills(cv.behaviours),
    skills: (cv.skills || []).filter((s) => s && s.skill),
    experience: (cv.experience || []).filter((r) => r && (r.title || r.company)),
    education: (cv.education || []).filter((e) => e && (e.qualification || e.institution)),
    interests: (cv.interests || []).filter(Boolean),
  };
}

// ---- shared pieces ------------------------------------------------------------
function fontFaces(base) {
  const f = (fam, file, weight, style = "normal") =>
    `@font-face{font-family:'${fam}';src:url('${base}${file}') format('truetype');font-weight:${weight};font-style:${style}}`;
  return [
    f("CV Sans", "DMSans-400-normal.ttf", 400), f("CV Sans", "DMSans-400-italic.ttf", 400, "italic"),
    f("CV Sans", "DMSans-500-normal.ttf", 500), f("CV Sans", "DMSans-700-normal.ttf", 700),
    f("CV Display", "Bricolage-700-normal.ttf", 700), f("CV Display", "Bricolage-800-normal.ttf", 800),
  ].join("");
}

const BASE_CSS = `
@page{size:A4;margin:12mm 0 12mm 0}
@page:first{margin-top:0}
html,body{margin:0;padding:0}
body{font-family:'CV Sans','Liberation Sans','DejaVu Sans',Arial,sans-serif;font-size:10pt;line-height:1.4;color:#22262B}
h1,h2,.disp{font-family:'CV Display','CV Sans','Liberation Sans',sans-serif}
p{margin:0 0 6px}
ul{margin:3px 0 6px;padding-left:15px}
li{margin:0 0 3px}
a{color:inherit;text-decoration:none}
.job{margin:0 0 9px;page-break-inside:avoid}
.jt{font-weight:700;font-size:10.6pt}
.jm{font-size:8.8pt;color:#6B6F76;margin:1px 0 3px}
.why{font-size:8.6pt;color:#6B6F76;font-style:italic;margin:2px 0 0}
li.win{list-style:none;margin-left:-15px}
.edu{margin:0 0 7px;page-break-inside:avoid}
.edu b{font-weight:700}
.st{margin:0 0 8px;page-break-inside:avoid}
.st b{display:block;font-weight:700;font-size:9.8pt}
.st span{display:block;font-size:8.9pt}
@media screen{
  html{background:#fff}
  body{width:210mm;min-height:297mm;margin:0 auto}
}`;

function page(fontBase, css, body) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>CV</title><style>${fontFaces(fontBase)}${BASE_CSS}${css}</style></head><body>${body}</body></html>`;
}

function jobsHtml(d, star, accent) {
  return d.experience.map((r) => {
    const meta = [r.dates, r.location].filter(Boolean).map(esc).join(" &nbsp;·&nbsp; ");
    const did = (r.responsibilities || []).map((x) => `<li>${esc(x)}</li>`).join("");
    const won = (r.achievements || []).map((x) => `<li class="win"><span style="color:${accent};font-weight:700">${star}</span>&nbsp; <b>${esc(x)}</b></li>`).join("");
    const why = reasonFor(r);
    return `<div class="job"><div class="jt">${esc(r.title)}${r.title && r.company ? ` <span class="co">· ${esc(r.company)}</span>` : esc(r.company)}</div>${meta ? `<div class="jm">${meta}</div>` : ""}${did || won ? `<ul>${did}${won}</ul>` : ""}${why ? `<p class="why">Reason for leaving: ${esc(why)}</p>` : ""}</div>`;
  }).join("");
}
function eduHtml(d) {
  return d.education.map((e) => {
    const where = [e.institution, e.dates].filter(Boolean).map(esc).join(" &nbsp;·&nbsp; ");
    return `<div class="edu"><b>${esc(e.qualification || e.institution)}</b>${e.grade ? ` <span class="grade">(${esc(e.grade)})</span>` : ""}${e.qualification && where ? `<br><span class="jm">${where}</span>` : ""}</div>`;
  }).join("");
}
const strengthsHtml = (d) => d.strengths.map((s) => `<div class="st"><b>${esc(s.skill)}</b><span>${esc(s.proof)}</span></div>`).join("");
const skillsHtml = (d) => d.skills.map((s) => `<div class="st"><b>${esc(s.skill)}</b>${s.proof ? `<span>${esc(s.proof)}</span>` : ""}</div>`).join("");
const linksHtml = (d, sep) => d.links.map((l) => `<a href="${esc(l.url)}">${esc(l.label)}: ${esc(shortUrl(l.url))}</a>`).join(sep);
const statementHtml = (d) => d.statement.split(/\n+/).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join("");

// ---- 1. Sunrise ----------------------------------------------------------------
function sunrise(cv, fontBase) {
  const d = prep(cv);
  const css = `
@page{background:linear-gradient(to right,#fff 0,#fff 63%,#FFF3E2 63%,#FFF3E2 100%)}
@media screen{body{background:linear-gradient(to right,#fff 0,#fff 63%,#FFF3E2 63%,#FFF3E2 100%)}}
.hdr{background:linear-gradient(115deg,#FF8A1F 0%,#F25C54 100%);color:#fff;padding:30px 38px 24px}
.hdr h1{font-size:30pt;font-weight:800;line-height:1.05;margin:0;letter-spacing:-.5px}
.hdr .role{font-size:12.5pt;font-weight:500;margin:6px 0 10px;color:#FFF1E4}
.hdr .ct{font-size:9pt;color:#fff}
.hdr .ct span{margin-right:16px;white-space:nowrap}
.side{float:right;width:37%;box-sizing:border-box;padding:20px 30px 10px 22px}
.main{margin-right:37%;padding:20px 26px 10px 38px}
h2{font-size:12.5pt;font-weight:800;color:#C2410C;margin:8px 0 9px;padding-bottom:3px;border-bottom:3px solid #FF8A1F;display:inline-block}
.side h2{color:#9A3412}
.co{color:#E0571B}
.side .st span{color:#4B4F56}
ul.int{list-style:none;padding:0}
ul.int li:before{content:"●";color:#FF8A1F;font-size:8pt;margin-right:7px}
.lnk a{display:block;font-size:8.8pt;color:#9A3412;margin:0 0 3px}`;
  const side = [
    d.strengths.length ? `<h2>Key strengths</h2>${strengthsHtml(d)}` : "",
    d.skills.length ? `<h2>Skills I can prove</h2>${skillsHtml(d)}` : "",
    d.interests.length ? `<h2>Interests</h2><ul class="int">${d.interests.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "",
    d.links.length ? `<h2>Find me online</h2><div class="lnk">${linksHtml(d, "")}</div>` : "",
  ].join("");
  const main = [
    d.statement ? `<h2>About me</h2>${statementHtml(d)}` : "",
    d.experience.length ? `<h2>Experience</h2>${jobsHtml(d, "★", "#FF8A1F")}` : "",
    d.education.length ? `<h2>Education and training</h2>${eduHtml(d)}` : "",
  ].join("");
  const body = `<div class="hdr"><h1>${esc(d.name)}</h1>${d.role ? `<div class="role">${esc(d.role)}</div>` : ""}<div class="ct">${d.contacts.map((c) => `<span>${esc(c)}</span>`).join("")}</div></div>
<div class="side">${side}</div><div class="main">${main}</div>`;
  return page(fontBase, css, body);
}

// ---- 2. Fresh Green ----------------------------------------------------------------
function green(cv, fontBase) {
  const d = prep(cv);
  const css = `
@page{background:linear-gradient(to right,#1F6B45 0,#1F6B45 35%,#fff 35%,#fff 100%)}
@page:first{margin-top:0}
@media screen{body{background:linear-gradient(to right,#1F6B45 0,#1F6B45 35%,#fff 35%,#fff 100%)}}
.side{float:left;width:35%;box-sizing:border-box;padding:34px 22px 10px 28px;color:#fff}
.main{margin-left:35%;padding:34px 36px 10px 28px}
.mono{width:66px;height:66px;border-radius:50%;background:#FFB547;color:#17191C;font-family:'CV Display',sans-serif;font-weight:800;font-size:22pt;text-align:center;line-height:66px;margin:0 0 16px}
.side h2{font-size:10.5pt;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:#FFD48A;margin:16px 0 8px}
.side .st b{color:#fff}
.side .st span{color:#D5EADC}
.side .ct div{font-size:8.9pt;margin:0 0 4px;color:#fff;word-wrap:break-word}
.side ul{list-style:none;padding:0}
.side li{font-size:9pt;color:#fff}
.side li:before{content:"▸";color:#FFB547;margin-right:6px}
h1{font-size:28pt;font-weight:800;color:#17191C;margin:0;line-height:1.05;letter-spacing:-.5px}
.role{font-size:12pt;font-weight:700;color:#1F6B45;margin:6px 0 4px}
.bar{width:54px;height:5px;background:#FFB547;border-radius:3px;margin:8px 0 6px}
.main h2{font-size:12.5pt;font-weight:800;color:#1F6B45;margin:14px 0 8px}
.main h2:after{content:"";display:block;height:2px;background:#DCEFE3;margin-top:3px}
.co{color:#1F6B45}
.main .st span{color:#4B4F56}`;
  const side = [
    `<div class="mono">${esc(d.initials)}</div>`,
    d.contacts.length || d.links.length ? `<h2>Contact</h2><div class="ct">${d.contacts.map((c) => `<div>${esc(c)}</div>`).join("")}${d.links.map((l) => `<div><a href="${esc(l.url)}">${esc(l.label)}</a></div>`).join("")}</div>` : "",
    d.strengths.length ? `<h2>Key strengths</h2>${strengthsHtml(d)}` : "",
    d.interests.length ? `<h2>Interests</h2><ul>${d.interests.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "",
  ].join("");
  const main = [
    `<h1>${esc(d.name)}</h1>${d.role ? `<div class="role">${esc(d.role)}</div>` : ""}<div class="bar"></div>`,
    d.statement ? `<h2>About me</h2>${statementHtml(d)}` : "",
    d.skills.length ? `<h2>Skills I can prove</h2>${skillsHtml(d)}` : "",
    d.experience.length ? `<h2>Experience</h2>${jobsHtml(d, "★", "#E89B12")}` : "",
    d.education.length ? `<h2>Education and training</h2>${eduHtml(d)}` : "",
  ].join("");
  return page(fontBase, css, `<div class="side">${side}</div><div class="main">${main}</div>`);
}

// ---- 3. Bold -------------------------------------------------------------------------
function bold(cv, fontBase) {
  const d = prep(cv);
  const css = `
@page{margin:14mm 0 12mm 0}
@page:first{margin-top:0}
.hdr{background:#17191C;color:#fff;padding:28px 40px 18px;border-bottom:7px solid #FF8A1F}
.hdr h1{font-size:33pt;font-weight:800;margin:0;line-height:1;letter-spacing:-.8px}
.hdr .role{font-size:12.5pt;font-weight:700;color:#FF8A1F;margin:8px 0 10px}
.hdr .ct{font-size:9pt;color:#D9D4CB}
.hdr .ct span{margin-right:16px;white-space:nowrap}
.hdr .ct a{color:#FFB869}
.wrap{padding:16px 40px 0}
h2{font-size:13pt;font-weight:800;color:#17191C;margin:11px 0 7px}
h2 i{display:inline-block;width:12px;height:12px;background:#FF8A1F;border-radius:3px;margin-right:8px;font-style:normal}
.lead{font-size:10.6pt}
table.cards{width:100%;border-collapse:separate;border-spacing:0 6px;table-layout:fixed;margin:-6px 0 0}
table.cards td{vertical-align:top;width:50%}
.card{background:#FBF6EE;border-left:4px solid #FF8A1F;border-radius:0 6px 6px 0;padding:6px 10px;page-break-inside:avoid}
.card b{display:block;font-size:9.8pt}
.card span{display:block;font-size:8.8pt;color:#4B4F56}
td.gap{width:10px!important}
.co{color:#C2410C}
.tl{border-left:2px solid #F3D9BC;margin-left:5px;padding-left:16px}
.tl .job{position:relative}
.tl .job:before{content:"";position:absolute;left:-22.5px;top:4px;width:9px;height:9px;border-radius:50%;background:#FF8A1F}
.pill{display:inline-block;background:#FFF0DF;color:#7C2D12;border-radius:12px;padding:3px 11px;font-size:9pt;margin:0 5px 6px 0;font-weight:500}
table.two{width:100%;border-collapse:collapse;table-layout:fixed}
table.two td{vertical-align:top;width:50%}`;
  const cards = (list) => {
    const rows = [];
    for (let i = 0; i < list.length; i += 2) {
      const a = list[i], b = list[i + 1];
      const cell = (s) => (s ? `<div class="card"><b>${esc(s.skill)}</b>${s.proof ? `<span>${esc(s.proof)}</span>` : ""}</div>` : "");
      rows.push(`<tr><td>${cell(a)}</td><td class="gap"></td><td>${cell(b)}</td></tr>`);
    }
    return `<table class="cards">${rows.join("")}</table>`;
  };
  const eduCol = d.education.length ? `<h2><i></i>Education and training</h2>${eduHtml(d)}` : "";
  const intCol = d.interests.length ? `<h2><i></i>Interests</h2>${d.interests.map((i) => `<span class="pill">${esc(i)}</span>`).join(" ")}` : "";
  const body = `<div class="hdr"><h1>${esc(d.name)}</h1>${d.role ? `<div class="role">${esc(d.role)}</div>` : ""}<div class="ct">${d.contacts.map((c) => `<span>${esc(c)}</span>`).join("")}${d.links.map((l) => `<span><a href="${esc(l.url)}">${esc(l.label)}</a></span>`).join("")}</div></div>
<div class="wrap">
${d.statement ? `<h2><i></i>About me</h2><div class="lead">${statementHtml(d)}</div>` : ""}
${d.strengths.length ? `<h2><i></i>Key strengths</h2>${cards(d.strengths)}` : ""}
${d.skills.length ? `<h2><i></i>Skills I can prove</h2>${cards(d.skills)}` : ""}
${d.experience.length ? `<h2><i></i>Experience</h2><div class="tl">${jobsHtml(d, "★", "#FF8A1F")}</div>` : ""}
${eduCol && intCol ? `<table class="two"><tr><td style="padding-right:18px">${eduCol}</td><td>${intCol}</td></tr></table>` : eduCol + intCol}
</div>`;
  return page(fontBase, css, body);
}

// ---- 4. Sky ----------------------------------------------------------------------------
function sky(cv, fontBase) {
  const d = prep(cv);
  const css = `
@page{margin:14mm 0 12mm 0}
@page:first{margin-top:0}
.hdr{background:#EAF3FF;padding:26px 42px 18px;border-bottom:3px solid #2B7BE4}
.hdr h1{font-size:29pt;font-weight:800;color:#0F2A4A;margin:0;line-height:1.05;letter-spacing:-.5px}
.hdr .role{font-size:12pt;font-weight:700;color:#2B7BE4;margin:6px 0 9px}
.hdr .ct{font-size:9pt;color:#36506E}
.hdr .ct span{margin-right:16px;white-space:nowrap}
.wrap{padding:8px 42px 0}
h2{display:inline-block;font-size:10pt;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#fff;background:#2B7BE4;border-radius:12px;padding:3px 12px;margin:12px 0 7px}
h2.mint{background:#12A88A}
.co{color:#2B7BE4}
table.grid{width:100%;border-collapse:collapse;table-layout:fixed}
table.grid td{vertical-align:top;width:50%;padding:0 14px 0 0}
.tick{color:#12A88A;font-weight:700;margin-right:5px}
.st{padding-left:0}
.st b{display:inline}
.st span{color:#4B4F56;margin-left:19px}
.int{font-size:9.6pt}
.int span{display:inline-block;border:1.5px solid #9CC3F5;color:#0F2A4A;border-radius:12px;padding:2px 10px;margin:0 5px 6px 0}`;
  const grid = (list, render) => {
    const half = Math.ceil(list.length / 2);
    return `<table class="grid"><tr><td>${list.slice(0, half).map(render).join("")}</td><td>${list.slice(half).map(render).join("")}</td></tr></table>`;
  };
  const eduCol = d.education.length ? `<h2>Education and training</h2>${eduHtml(d)}` : "";
  const intCol = d.interests.length ? `<h2 class="mint">Interests</h2><div class="int">${d.interests.map((i) => `<span>${esc(i)}</span>`).join(" ")}</div>` : "";
  const strength = (s) => `<div class="st"><b><span class="tick" style="margin:0 5px 0 0;display:inline">✓</span>${esc(s.skill)}</b>${s.proof ? `<span>${esc(s.proof)}</span>` : ""}</div>`;
  const body = `<div class="hdr"><h1>${esc(d.name)}</h1>${d.role ? `<div class="role">${esc(d.role)}</div>` : ""}<div class="ct">${d.contacts.map((c) => `<span>${esc(c)}</span>`).join("")}${d.links.map((l) => `<span><a href="${esc(l.url)}" style="color:#2B7BE4">${esc(l.label)}</a></span>`).join("")}</div></div>
<div class="wrap">
${d.statement ? `<h2>About me</h2>${statementHtml(d)}` : ""}
${d.strengths.length ? `<h2 class="mint">Key strengths</h2>${grid(d.strengths, strength)}` : ""}
${d.skills.length ? `<h2>Skills I can prove</h2>${grid(d.skills, strength)}` : ""}
${d.experience.length ? `<h2>Experience</h2>${jobsHtml(d, "★", "#12A88A")}` : ""}
${eduCol && intCol ? `<table class="grid"><tr><td style="padding-right:18px">${eduCol}</td><td>${intCol}</td></tr></table>` : eduCol + intCol}
</div>`;
  return page(fontBase, css, body);
}

const RENDER = { "f-sunrise": sunrise, "f-green": green, "f-bold": bold, "f-sky": sky };

// For the PDF (fonts from disk) or the on-page preview (fonts from the web).
function renderFresh(cv, id, { forScreen = false } = {}) {
  const fn = RENDER[id] || sunrise;
  return fn(cv || {}, forScreen ? FONT_WEB_BASE : FONT_FILE_BASE);
}

module.exports = { FRESH_TEMPLATES, isFresh, renderFresh, reasonFor };
