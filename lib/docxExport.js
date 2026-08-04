// ─── Shared docx generation module ──────────────────────────────────────────
// ONE renderer, parameterised by a design config (lib/designs.js). Each design
// carries a distinct STRUCTURE (headerStyle / headingStyle / skillsStyle /
// layout) so no two templates read the same. Produces a Word document Buffer.
//
// Every design also renders an ATS-safe version from the SAME config:
//   { ats: true } -> flattened to a plain single column, standard headings, no
//   tables, no icons, no colour bands, no header/footer. See flattenForAts().

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, ShadingType, TabStopType, TabStopPosition,
  ExternalHyperlink, ImageRun
} = require("docx");
const brand = require("./brand");

const INK = brand.docColours.ink;
const MUTED = brand.docColours.muted;
const LIGHT = "F2F0EA";   // subtle tint for boxes/callouts
const HAIR = "DDDDDD";    // hairline rule
const LINE = 268;         // ~1.16 line spacing — readable, never squashed

// ---- small builders --------------------------------------------------------
const pt = (n) => n * 2; // point -> half-point

function normUrl(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (/^mailto:/i.test(s)) return s;
  return "https://" + s.replace(/^\/+/, "");
}
function linkRun(label, url, opts = {}) {
  const text = label || url;
  if (opts.ats) return run(text, { color: MUTED, size: opts.size || pt(9.5) });
  return new ExternalHyperlink({
    link: normUrl(url),
    children: [new TextRun({ text, style: "Hyperlink", size: opts.size || pt(9.5), font: opts.font || "Calibri", color: opts.color })]
  });
}
function collectLinks(cv) {
  const h = cv.header || {};
  const out = [];
  if (h.linkedin) out.push({ label: "LinkedIn", url: h.linkedin });
  if (h.portfolio) out.push({ label: "Portfolio", url: h.portfolio });
  if (h.website) out.push({ label: "Website", url: h.website });
  if (h.github) out.push({ label: "GitHub", url: h.github });
  if (h.introVideo) out.push({ label: "Intro video", url: h.introVideo });
  return out;
}

function run(text, opts = {}) {
  return new TextRun({
    text: text == null ? "" : String(text),
    bold: opts.bold || false,
    italics: opts.italics || false,
    color: opts.color || INK,
    size: opts.size || pt(10.5),
    font: opts.font || "Calibri",
    allCaps: opts.allCaps || false
  });
}

function para(children, opts = {}) {
  return new Paragraph({
    children: Array.isArray(children) ? children : [children],
    spacing: { after: opts.after != null ? opts.after : 80, before: opts.before || 0, line: opts.line || LINE },
    alignment: opts.align,
    border: opts.border,
    shading: opts.shading,
    indent: opts.indent,
    bullet: opts.bullet,
    tabStops: opts.tabStops,
    keepNext: opts.keepNext || false,   // keep with the next paragraph (no orphan headings/titles)
    keepLines: opts.keepLines || false, // never split this paragraph's own lines across a page
    widowControl: true
  });
}

// Bold + accent any numeric/currency/percent tokens (KPI designs).
function metricRuns(text, accent, base = {}) {
  const rx = /(£\s?\d[\d,\.]*\s?(?:k|m|bn|million|billion|thousand)?|\d[\d,\.]*\s?%|\b\d[\d,\.]{1,}\b)/gi;
  const out = []; let last = 0, m;
  while ((m = rx.exec(text)) !== null) {
    if (m.index > last) out.push(run(text.slice(last, m.index), base));
    out.push(run(m[0], { ...base, bold: true, color: accent }));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(run(text.slice(last), base));
  return out.length ? out : [run(text, base)];
}

// A section heading. Standard titles only. Always keepNext so a heading can
// never be stranded at the foot of a page away from its content.
function heading(text, design) {
  const font = design.headingFont;
  const accent = design.accent;
  const size = pt(design.dense ? 11 : 12.5);
  const T = text.toUpperCase();
  const style = design.headingStyle || "rule";
  const K = { before: 250, after: 110, keepNext: true };

  if (style === "bar")
    return para(run(T, { bold: true, size, color: "FFFFFF", font }), { ...K, indent: { left: 90 }, shading: { type: ShadingType.CLEAR, fill: accent } });
  if (style === "tag")
    return para(run(T, { bold: true, size, color: accent, font }), { ...K, indent: { left: 140 }, border: { left: { color: accent, space: 12, size: 22, style: BorderStyle.SINGLE } } });
  if (style === "mono")
    return para([run(">> ", { bold: true, size, color: accent, font }), run(T, { bold: true, size, color: accent, font })], K);
  if (style === "accentText")
    return para(run(T, { bold: true, size, color: accent, font }), K);
  if (style === "caps-spaced")
    return para(run(T.split("").join(" "), { bold: true, size: pt(10.5), color: INK, font }), { ...K, before: 220, border: { bottom: { color: accent, space: 3, size: 4, style: BorderStyle.SINGLE } } });
  if (style === "serif-rule")
    return para(run(T, { bold: true, size, color: INK, font }), { ...K, border: { bottom: { color: accent, space: 3, size: 6, style: BorderStyle.SINGLE } } });
  if (style === "serif-plain")
    return para(run(text, { bold: true, size: pt(13.5), color: INK, font }), { ...K, border: { bottom: { color: HAIR, space: 3, size: 4, style: BorderStyle.SINGLE } } });
  if (style === "plain" || style === "plain-hair")
    return para(run(T, { bold: true, size, color: INK, font }), { ...K, border: style === "plain-hair" ? { bottom: { color: HAIR, space: 3, size: 2, style: BorderStyle.SINGLE } } : undefined });
  // "rule" (default)
  return para(run(T, { bold: true, size, color: accent, font }), { ...K, border: { bottom: { color: accent, space: 3, size: 6, style: BorderStyle.SINGLE } } });
}

// ---- header / contacts -----------------------------------------------------
function renderPhoto(photo, ats) {
  if (!photo || ats || !photo.data) return [];
  try {
    const buf = Buffer.from(photo.data, "base64");
    const type = /png/i.test(photo.type) ? "png" : /gif/i.test(photo.type) ? "gif" : "jpg";
    return [new Paragraph({ children: [new ImageRun({ data: buf, type, transformation: { width: 96, height: 120 } })], spacing: { after: 120 } })];
  } catch (_) { return []; }
}

function renderName(cv, design, ats) {
  const nm = cv.header?.name || "[MISSING]";
  const role = cv.header?.targetRole || "";
  const font = design.headingFont;
  const style = ats ? "plain" : (design.headerStyle || "plain");

  if (style === "block") {
    return [
      para(run(nm, { bold: true, size: pt(25), color: "FFFFFF", font }), { after: 30, before: 90, indent: { left: 140 }, shading: { type: ShadingType.CLEAR, fill: design.accent }, keepNext: true }),
      para(run(role, { color: "FFFFFF", size: pt(12.5) }), { after: 170, indent: { left: 140 }, shading: { type: ShadingType.CLEAR, fill: design.accent } })
    ];
  }
  if (style === "centered" || style === "letterhead") {
    return [
      para(run(nm, { bold: true, size: pt(style === "letterhead" ? 27 : 25), font }), { after: 12, align: AlignmentType.CENTER, keepNext: true }),
      role ? para(run(role, { color: MUTED, size: pt(12.5) }), { after: style === "letterhead" ? 70 : 50, align: AlignmentType.CENTER,
        border: style === "centered" ? { bottom: { color: design.accent, space: 8, size: 6, style: BorderStyle.SINGLE } } : undefined }) : null
    ].filter(Boolean);
  }
  if (style === "leftbar") {
    const bar = { left: { color: design.accent, space: 14, size: 28, style: BorderStyle.SINGLE } };
    return [
      para(run(nm, { bold: true, size: pt(25), font }), { after: 10, indent: { left: 170 }, border: bar, keepNext: true }),
      role ? para(run(role, { color: design.accent, size: pt(12.5) }), { after: 110, indent: { left: 170 }, border: bar }) : null
    ].filter(Boolean);
  }
  if (style === "boxed") {
    const box = { color: design.accent, space: 10, size: 8, style: BorderStyle.SINGLE };
    return [new Paragraph({
      children: [run(nm, { bold: true, size: pt(24), font }), new TextRun({ break: 1 }), run(role, { color: MUTED, size: pt(12.5) })],
      spacing: { after: 150, before: 30, line: 320 },
      shading: { type: ShadingType.CLEAR, fill: LIGHT },
      border: { top: box, bottom: box, left: box, right: box }, keepNext: true
    })];
  }
  // plain
  return [
    para(run(nm, { bold: true, size: pt(ats ? 20 : 25), font }), { after: 10, keepNext: true }),
    role ? para(run(role, { color: ats ? INK : MUTED, size: pt(12.5) }), { after: 70 }) : null
  ].filter(Boolean);
}

function renderContactsLine(cv, design, ats) {
  const c = cv.header?.contacts || {};
  const bits = [c.email, c.phone, c.location].filter(Boolean);
  const links = collectLinks(cv);
  const sep = () => run("   ·   ", { color: MUTED, size: pt(9.5) });
  const children = [];
  bits.forEach((b, i) => { if (i) children.push(sep()); children.push(run(b, { color: MUTED, size: pt(9.5) })); });
  if (!design.linksProminent) links.forEach((l) => { children.push(sep()); children.push(linkRun(l.label, l.url, { ats })); });
  const opts = { after: 150 };
  if (design.centeredContacts && !ats) opts.align = AlignmentType.CENTER;
  if (design.headerStyle === "letterhead" && !ats) { opts.border = { bottom: { color: design.accent, space: 8, size: 10, style: BorderStyle.SINGLE } }; opts.after = 200; }
  return para(children.length ? children : [run("")], opts);
}

function renderLinksBlock(cv, design, ats) {
  const links = collectLinks(cv);
  if (!links.length) return [];
  const out = [heading("Online", design)];
  links.forEach((l) => {
    out.push(para([
      run(l.label + ":  ", { bold: true, size: pt(10.5) }),
      linkRun(l.url, l.url, { ats, size: pt(10.5), color: ats ? MUTED : design.accent })
    ], { after: 40 }));
  });
  return out;
}

// ---- sections --------------------------------------------------------------
function renderStatement(cv, design) {
  if (!cv.personalStatement) return [];
  return [heading("Profile", design), para(run(cv.personalStatement), { after: 140, keepLines: true })];
}

function renderSkills(cv, design, ats) {
  if (!cv.skills?.length) return [];
  const style = ats ? "list" : (design.skillsStyle || "list");
  const out = [heading("Skills", design)];

  if (style === "grid") {
    const cols = design.skillsColumns || 2;
    const rows = [];
    for (let i = 0; i < cv.skills.length; i += cols) {
      const cells = [];
      for (let j = 0; j < cols; j++) {
        const s = cv.skills[i + j];
        cells.push(new TableCell({
          margins: { top: 100, bottom: 100, left: 150, right: 150 },
          shading: { type: ShadingType.CLEAR, fill: LIGHT },
          children: s
            ? [para(run(s.skill, { bold: true, size: pt(10) }), { after: 30 }), para(run(s.proof, { size: pt(9.5), color: MUTED }), { after: 0 })]
            : [para(run(""))]
        }));
      }
      rows.push(new TableRow({ children: cells }));
    }
    out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: gridGap(), rows }));
    return out;
  }

  if (style === "pills") {
    const chips = [];
    cv.skills.forEach((s, i) => {
      if (i) chips.push(run("     ·     ", { color: MUTED, size: pt(10) }));
      chips.push(run(s.skill, { bold: true, color: design.accent, size: pt(10.5) }));
    });
    out.push(para(chips, { after: 110, line: 300 }));
    return out;
  }

  // list: bolded skill + prove-it line
  for (const s of cv.skills) {
    out.push(para([run(s.skill + "   ", { bold: true }), run(s.proof || "", { color: MUTED })], { after: 70 }));
  }
  return out;
}

function renderExperience(cv, design, ats) {
  if (!cv.experience?.length) return [];
  const out = [heading("Experience", design)];
  const timeline = design.layout === "timeline" && !ats;
  const datesRight = design.datesRight && !ats;
  const metrics = design.metricsProminent && !ats;

  for (const role of cv.experience) {
    const titleRun = [
      run(role.title || "[MISSING]", { bold: true, size: pt(11.5) }),
      run(role.company ? "   ·   " + role.company : "", { size: pt(11.5) }),
      run(role.location ? "   ·   " + role.location : "", { color: MUTED, size: pt(10) })
    ];
    if (datesRight && role.dates) {
      out.push(new Paragraph({
        children: [...titleRun, new TextRun({ text: "\t" + role.dates, italics: true, color: MUTED, size: pt(9.5), font: design.bodyFont })],
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        spacing: { before: 130, after: 30, line: LINE }, keepNext: true, widowControl: true
      }));
    } else {
      out.push(para(titleRun, {
        after: 14, before: 130, keepNext: true,
        border: timeline ? { left: { color: design.accent, space: 10, size: 14, style: BorderStyle.SINGLE } } : undefined,
        indent: timeline ? { left: 180 } : undefined
      }));
      if (role.dates) out.push(para(run(role.dates, { italics: true, color: MUTED, size: pt(9.5) }), { after: 60, keepNext: true, indent: timeline ? { left: 180 } : undefined }));
    }

    (role.responsibilities || []).filter(Boolean).forEach((b) =>
      out.push(para(metrics ? metricRuns(b, design.accent) : run(b), { after: 40, bullet: { level: 0 }, keepLines: true })));
    (role.achievements || []).filter(Boolean).forEach((a) => {
      const callout = design.achievementCallouts && !ats;
      const kids = metrics ? metricRuns(a, design.accent, { bold: true }) : [run(a, { bold: true, color: callout ? design.accent : INK })];
      out.push(para(kids, { after: 40, bullet: { level: 0 }, keepLines: true, shading: callout ? { type: ShadingType.CLEAR, fill: "FBF1E6" } : undefined }));
    });
    if (role.reasonForLeaving) out.push(para(run("Reason for leaving: " + role.reasonForLeaving, { italics: true, color: MUTED, size: pt(9.5) }), { after: 110 }));
    else out.push(para(run(""), { after: 70 }));
  }
  return out;
}

function renderInterests(cv, design) {
  if (!cv.interests?.length) return [];
  const out = [heading("Interests", design)];
  cv.interests.filter(Boolean).forEach((i) => out.push(para(run(i), { after: 40, bullet: { level: 0 }, keepLines: true })));
  return out;
}

function renderEducation(cv, design) {
  if (!cv.education?.length) return [];
  const out = [heading("Education", design)];
  for (const e of cv.education) {
    out.push(para([
      run(e.qualification || "[MISSING]", { bold: true }),
      run(e.institution ? "   ·   " + e.institution : ""),
      run(e.dates ? "   ·   " + e.dates : "", { color: MUTED, size: pt(9.5) })
    ], { after: 14, keepLines: true }));
    if (e.grade) out.push(para(run(e.grade, { color: MUTED, size: pt(9.5) }), { after: 60 }));
  }
  return out;
}

// ---- helpers ---------------------------------------------------------------
function noBorders() {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
}
// White "gutter" borders between grid cells so tinted skill boxes have breathing room.
function gridGap() {
  const w = { style: BorderStyle.SINGLE, size: 24, color: "FFFFFF" };
  return { top: w, bottom: w, left: w, right: w, insideHorizontal: w, insideVertical: w };
}

// Flatten any design to a clean, plain, single-column ATS-safe config.
function flattenForAts(design) {
  return {
    ...design, layout: "single", headerStyle: "plain", headingStyle: "plain", skillsStyle: "list",
    serifHeadings: false, monoLabels: false, metricsProminent: false, achievementCallouts: false,
    datesRight: false, centeredContacts: false, bodyFont: "Calibri", headingFont: "Calibri",
    dense: false, fontSize: undefined
  };
}

// ---- MAIN CONTENT ORDER ----------------------------------------------------
function bodyChildren(cv, design0, ats, photo) {
  const design = ats ? flattenForAts(design0) : design0;
  const namePart = [...renderPhoto(photo, ats), ...renderName(cv, design, ats)];
  const linksBlock = design.linksProminent ? renderLinksBlock(cv, design, ats) : [];
  const edu = renderEducation(cv, design);
  const exp = renderExperience(cv, design, ats);
  const mainCol = [
    ...renderStatement(cv, design),
    ...(design.educationFirst ? [...edu, ...exp] : [...exp, ...edu]),
    ...renderInterests(cv, design)
  ];

  if (design.layout === "sidebar" && !ats) {
    const sidebar = [
      para(run("CONTACT", { bold: true, color: "FFFFFF", size: pt(10), font: design.headingFont }), { after: 70 }),
      ...contactsStacked(cv),
      para(run("SKILLS", { bold: true, color: "FFFFFF", size: pt(10), font: design.headingFont }), { before: 180, after: 70 }),
      ...sidebarSkills(cv)
    ];
    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorders(),
      columnWidths: [design.sidebarWidth * 92, (100 - design.sidebarWidth) * 92],
      rows: [new TableRow({ children: [
        new TableCell({ width: { size: design.sidebarWidth, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: design.accent }, margins: { top: 220, bottom: 260, left: 220, right: 200 }, children: sidebar }),
        new TableCell({ width: { size: 100 - design.sidebarWidth, type: WidthType.PERCENTAGE }, margins: { top: 200, bottom: 220, left: 300, right: 140 }, children: mainCol })
      ] })]
    });
    return [...namePart, table];
  }

  return [...namePart, renderContactsLine(cv, design, ats), ...linksBlock, ...renderSkills(cv, design, ats), ...mainCol];
}

// Sidebar contact block: one line per item, comfortably spaced (fixes squashing).
function contactsStacked(cv) {
  const c = cv.header?.contacts || {};
  const lines = [c.email, c.phone, c.location, cv.header?.linkedin, cv.header?.portfolio, cv.header?.github, cv.header?.introVideo].filter(Boolean);
  return lines.map((l) => new Paragraph({
    children: [new TextRun({ text: l, color: "FFFFFF", size: pt(9.5) })],
    spacing: { after: 70, line: 264 }
  }));
}
// Sidebar skills: a dot + skill, well spaced.
function sidebarSkills(cv) {
  return (cv.skills || []).map((s) => new Paragraph({
    children: [new TextRun({ text: "•  " + s.skill, color: "FFFFFF", bold: true, size: pt(9.5) })],
    spacing: { after: 60, line: 264 }
  }));
}

// ---- skills-match exercise (stop seven) -> its own page --------------------
function skillsMatchPage(cv, design0, ats) {
  if (!cv.skillsMatch?.length) return [];
  const design = ats ? flattenForAts(design0) : design0;
  const children = [
    new Paragraph({ children: [run("Skills-match exercise", { bold: true, size: pt(16), font: design.headingFont })], pageBreakBefore: true, spacing: { after: 70 } }),
    para(run("The job's requirements in one column, matching proof from my career in the other.", { color: MUTED, italics: true }), { after: 160 })
  ];
  if (ats) {
    cv.skillsMatch.forEach((m) => {
      children.push(para(run("What the job asks for: " + m.requirement, { bold: true }), { after: 14, keepNext: true }));
      children.push(para(run("What I've actually done: " + m.proof), { after: 140, keepLines: true }));
    });
    return children;
  }
  const rows = [
    new TableRow({ tableHeader: true, children: ["What the job asks for", "What I've actually done"].map((t) =>
      new TableCell({ shading: { type: ShadingType.CLEAR, fill: design.accent }, margins: { top: 100, bottom: 100, left: 150, right: 150 }, children: [para(run(t, { bold: true, color: "FFFFFF", size: pt(10) }), { after: 0 })] }))
    }),
    ...cv.skillsMatch.map((m, i) => new TableRow({ cantSplit: true, children: [m.requirement, m.proof].map((t) =>
      new TableCell({ shading: i % 2 ? { type: ShadingType.CLEAR, fill: "F4F1EA" } : undefined, margins: { top: 100, bottom: 100, left: 150, right: 150 }, children: [para(run(t, { size: pt(10) }), { after: 0 })] }))
    }))
  ];
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
  return children;
}

// ---- public API ------------------------------------------------------------
async function buildDocx(cv, design, { ats = false, includeSkillsMatch = true, photo = null } = {}) {
  const children = bodyChildren(cv, design, ats, photo);
  if (includeSkillsMatch) children.push(...skillsMatchPage(cv, design, ats));

  const section = {
    properties: { page: { margin: { top: design.margins, bottom: design.margins, left: design.margins, right: design.margins } } },
    children
  };
  const doc = new Document({
    creator: cv.header?.name || "CV",
    title: `${cv.header?.name || "CV"} - ${cv.header?.targetRole || "CV"}`,
    styles: { default: { document: { run: { font: design.bodyFont, size: pt(design.fontSize ? design.fontSize / 2 : 10.5) } } } },
    sections: [section]
  });
  return Packer.toBuffer(doc);
}

module.exports = { buildDocx };
