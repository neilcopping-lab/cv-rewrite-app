// ─── Shared docx generation module ──────────────────────────────────────────
// ONE renderer, parameterised by a design config (lib/designs.js). Produces a
// Word document Buffer. Branding is baked into the document itself (header for
// the human version; a plain brand line in the body for the ATS version) so it
// survives however the file is forwarded - no separate email step.
//
// Every design also renders an ATS-safe version from the SAME config:
//   { ats: true } -> single column, standard headings, no tables, no icons,
//   no header/footer, readable sans-serif. See Section 8 formatting rules.

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, ShadingType, HeadingLevel, Header, Footer,
  ExternalHyperlink, ImageRun
} = require("docx");
const brand = require("./brand");

const INK = brand.docColours.ink;
const MUTED = brand.docColours.muted;

// ---- small builders --------------------------------------------------------
const pt = (n) => n * 2; // point -> half-point

// Ensure a link has a protocol so Word treats it as a real, clickable URL.
function normUrl(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (/^mailto:/i.test(s)) return s;
  return "https://" + s.replace(/^\/+/, "");
}
// A clickable hyperlink run (human version). ats=true returns plain text.
function linkRun(label, url, opts = {}) {
  const text = label || url;
  if (opts.ats) return run(text, { color: MUTED, size: opts.size || pt(9.5) });
  return new ExternalHyperlink({
    link: normUrl(url),
    children: [new TextRun({ text, style: "Hyperlink", size: opts.size || pt(9.5), font: opts.font || "Calibri", color: opts.color })]
  });
}
// Collect the CV's links as {label,url} pairs.
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
    spacing: { after: opts.after != null ? opts.after : 80, before: opts.before || 0, line: opts.line },
    alignment: opts.align,
    border: opts.border,
    shading: opts.shading,
    indent: opts.indent,
    bullet: opts.bullet
  });
}

// A section heading. Standard titles only (Experience / Skills / Education …).
function heading(text, design) {
  const serif = design.serifHeadings;
  const color = ["heading", "rule"].includes(design.accentUsage) ? design.accent : INK;
  const border =
    design.sectionRule || design.accentUsage === "rule"
      ? { bottom: { color: design.accent, space: 2, size: 6, style: BorderStyle.SINGLE } }
      : undefined;
  return para(
    run(text.toUpperCase(), {
      bold: true,
      size: pt(design.dense ? 11 : 12),
      color,
      font: design.headingFont,
      allCaps: false
    }),
    { before: 200, after: 90, border }
  );
}

// ---- section renderers (return array of paragraphs) ------------------------
function renderContactsLine(cv, design, ats) {
  const c = cv.header?.contacts || {};
  const bits = [c.email, c.phone, c.location].filter(Boolean);
  const links = collectLinks(cv);
  const sep = () => run("  ·  ", { color: MUTED, size: pt(9.5) });
  const children = [];
  bits.forEach((b, i) => { if (i) children.push(sep()); children.push(run(b, { color: MUTED, size: pt(9.5) })); });
  // On a links-prominent design the links get their own block, so keep the
  // contact line to the basics there.
  if (!design.linksProminent) {
    links.forEach((l) => { children.push(sep()); children.push(linkRun(l.label, l.url, { ats })); });
  }
  return para(children.length ? children : [run("")], { after: 120 });
}

// A bold, clickable "Find me online" block for creative / portfolio designs.
function renderLinksBlock(cv, design, ats) {
  const links = collectLinks(cv);
  if (!links.length) return [];
  const out = [heading("Online", design)];
  links.forEach((l) => {
    out.push(para([
      run(l.label + ":  ", { bold: true, size: pt(10.5), color: design.accentUsage === "heading" && !ats ? INK : INK }),
      linkRun(l.url, l.url, { ats, size: pt(10.5), color: ats ? MUTED : design.accent })
    ], { after: 30 }));
  });
  return out;
}

// The optional photo, shown at the very top of the human version only.
function renderPhoto(photo, ats) {
  if (!photo || ats || !photo.data) return [];
  try {
    const buf = Buffer.from(photo.data, "base64");
    const type = /png/i.test(photo.type) ? "png" : /gif/i.test(photo.type) ? "gif" : "jpg";
    return [new Paragraph({
      children: [new ImageRun({ data: buf, type, transformation: { width: 96, height: 120 } })],
      spacing: { after: 100 }
    })];
  } catch (_) { return []; }
}

function renderName(cv, design, ats) {
  const nm = cv.header?.name || "[MISSING]";
  const role = cv.header?.targetRole || "";
  if (design.layout === "headerblock" && !ats) {
    return [
      para(run(nm, { bold: true, size: pt(24), color: "FFFFFF", font: design.headingFont }), {
        after: 20, before: 60, shading: { type: ShadingType.CLEAR, fill: design.accent }
      }),
      para(run(role, { color: "FFFFFF", size: pt(12) }), {
        after: 140, shading: { type: ShadingType.CLEAR, fill: design.accent }
      })
    ];
  }
  const serif = design.serifHeadings;
  return [
    para(run(nm, { bold: true, size: pt(ats ? 20 : 24), font: design.headingFont }), { after: 10 }),
    role ? para(run(role, { color: ats ? INK : (design.accentUsage === "heading" ? design.accent : MUTED), size: pt(12) }), { after: 60 }) : null
  ].filter(Boolean);
}

function renderStatement(cv, design) {
  if (!cv.personalStatement) return [];
  return [heading("Profile", design), para(run(cv.personalStatement), { after: 120 })];
}

function renderSkills(cv, design, ats) {
  if (!cv.skills?.length) return [];
  const out = [heading("Skills", design)];
  // Grid layout (human only) - light borderless table.
  if (design.layout === "grid" && !ats) {
    const cols = design.skillsColumns || 2;
    const rows = [];
    for (let i = 0; i < cv.skills.length; i += cols) {
      const cells = [];
      for (let j = 0; j < cols; j++) {
        const s = cv.skills[i + j];
        cells.push(
          new TableCell({
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            shading: { type: ShadingType.CLEAR, fill: "F2F0EA" },
            children: s
              ? [para(run(s.skill, { bold: true, size: pt(10) }), { after: 20 }), para(run(s.proof, { size: pt(9.5), color: MUTED }), { after: 0 })]
              : [para(run(""))]
          })
        );
      }
      rows.push(new TableRow({ children: cells }));
    }
    out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders(), rows }));
    return out;
  }
  // Default: bolded skill + prove-it line.
  for (const s of cv.skills) {
    out.push(
      para([
        run(s.skill + "  ", { bold: true, color: design.accentUsage === "heading" && !ats ? INK : INK }),
        run(s.proof || "", { color: MUTED })
      ], { after: 50 })
    );
  }
  return out;
}

function renderExperience(cv, design, ats) {
  if (!cv.experience?.length) return [];
  const out = [heading("Experience", design)];
  for (const role of cv.experience) {
    const titleRun = [
      run(role.title || "[MISSING]", { bold: true, size: pt(11) }),
      run(role.company ? "  ·  " + role.company : "", { size: pt(11) }),
      run(role.location ? "  ·  " + role.location : "", { color: MUTED, size: pt(10) })
    ];
    // Timeline family: accent left border + dates emphasised.
    const timeline = design.layout === "timeline" && !ats;
    out.push(
      para(titleRun, {
        after: 10, before: 80,
        border: timeline ? { left: { color: design.accent, space: 8, size: 12, style: BorderStyle.SINGLE } } : undefined,
        indent: timeline ? { left: 160 } : undefined
      })
    );
    if (role.dates) out.push(para(run(role.dates, { italics: true, color: MUTED, size: pt(9.5) }), { after: 40, indent: timeline ? { left: 160 } : undefined }));

    (role.responsibilities || []).filter(Boolean).forEach((b) =>
      out.push(para(run(b), { after: 20, bullet: { level: 0 } }))
    );
    (role.achievements || []).filter(Boolean).forEach((a) => {
      const callout = design.achievementCallouts && !ats;
      out.push(
        para(run(a, { bold: true, color: callout ? design.accent : INK }), {
          after: 20, bullet: { level: 0 },
          shading: callout ? { type: ShadingType.CLEAR, fill: "FBF1E6" } : undefined
        })
      );
    });
    if (role.reasonForLeaving) out.push(para(run("Reason for leaving: " + role.reasonForLeaving, { italics: true, color: MUTED, size: pt(9.5) }), { after: 80 }));
    else out.push(para(run(""), { after: 40 }));
  }
  return out;
}

function renderInterests(cv, design) {
  if (!cv.interests?.length) return [];
  const out = [heading("Interests", design)];
  cv.interests.filter(Boolean).forEach((i) => out.push(para(run(i), { after: 20, bullet: { level: 0 } })));
  return out;
}

function renderEducation(cv, design) {
  if (!cv.education?.length) return [];
  const out = [heading("Education", design)];
  for (const e of cv.education) {
    out.push(para([
      run(e.qualification || "[MISSING]", { bold: true }),
      run(e.institution ? "  ·  " + e.institution : ""),
      run(e.dates ? "  ·  " + e.dates : "", { color: MUTED, size: pt(9.5) })
    ], { after: 10 }));
    if (e.grade) out.push(para(run(e.grade, { color: MUTED, size: pt(9.5) }), { after: 40 }));
  }
  return out;
}

// ---- helpers ---------------------------------------------------------------
function noBorders() {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
}

function brandHeader(design) {
  return new Header({
    children: [
      para([
        run("The Com'mon People", { bold: true, color: design.accent, size: pt(9), font: design.headingFont }),
        run("   ·   CV Rewrite", { color: MUTED, size: pt(8) })
      ], { after: 0 })
    ]
  });
}
function brandFooter() {
  return new Footer({
    children: [para(run("the-common-people.com  ·  Built on mutual aid.", { color: MUTED, size: pt(8) }), { after: 0, align: AlignmentType.CENTER })]
  });
}

// ---- MAIN CONTENT ORDER ----------------------------------------------------
function bodyChildren(cv, design, ats, photo) {
  const namePart = [...renderPhoto(photo, ats), ...renderName(cv, design, ats)];
  // Creative designs surface the links prominently near the top.
  const linksBlock = design.linksProminent ? renderLinksBlock(cv, design, ats) : [];
  const mainCol = [
    ...renderStatement(cv, design),
    ...renderExperience(cv, design, ats),
    ...renderEducation(cv, design),
    ...renderInterests(cv, design)
  ];

  // Sidebar layout (human only): contacts + skills in a narrow left column.
  if (design.layout === "sidebar" && !ats) {
    const sidebar = [
      para(run("CONTACT", { bold: true, color: "FFFFFF", size: pt(9) }), { after: 40 }),
      renderContactsStacked(cv),
      para(run("SKILLS", { bold: true, color: "FFFFFF", size: pt(9) }), { before: 120, after: 40 }),
      ...sidebarSkills(cv)
    ];
    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorders(),
      columnWidths: [design.sidebarWidth * 90, (100 - design.sidebarWidth) * 90],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: design.sidebarWidth, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: design.accent },
              margins: { top: 160, bottom: 160, left: 160, right: 160 },
              children: sidebar
            }),
            new TableCell({
              width: { size: 100 - design.sidebarWidth, type: WidthType.PERCENTAGE },
              margins: { top: 160, bottom: 160, left: 200, right: 120 },
              children: mainCol
            })
          ]
        })
      ]
    });
    return [...namePart, table];
  }

  // All single-column families (and every ATS render).
  return [...namePart, renderContactsLine(cv, design, ats), ...linksBlock, ...renderSkills(cv, design, ats), ...mainCol];
}

function renderContactsStacked(cv) {
  const c = cv.header?.contacts || {};
  const lines = [c.email, c.phone, c.location, cv.header?.linkedin, cv.header?.portfolio, cv.header?.github, cv.header?.introVideo].filter(Boolean);
  return new Paragraph({
    children: lines.flatMap((l, i) => [new TextRun({ text: l, color: "FFFFFF", size: pt(9), break: i ? 1 : 0 })]),
    spacing: { after: 40 }
  });
}
function sidebarSkills(cv) {
  return (cv.skills || []).map((s) => new Paragraph({
    children: [new TextRun({ text: "• " + s.skill, color: "FFFFFF", bold: true, size: pt(9) })],
    spacing: { after: 20 }
  }));
}

// ---- skills-match exercise (stop seven) -> its own page --------------------
function skillsMatchPage(cv, design, ats) {
  if (!cv.skillsMatch?.length) return [];
  const children = [
    new Paragraph({ children: [run("Skills-match exercise", { bold: true, size: pt(16), font: design.headingFont })], pageBreakBefore: true, spacing: { after: 60 } }),
    para(run("The job's requirements in one column, matching proof from my career in the other.", { color: MUTED, italics: true }), { after: 140 })
  ];
  if (ats) {
    // ATS: no tables. Plain two-line pairs.
    cv.skillsMatch.forEach((m) => {
      children.push(para(run("What the job asks for: " + m.requirement, { bold: true }), { after: 10 }));
      children.push(para(run("What I've actually done: " + m.proof), { after: 120 }));
    });
    return children;
  }
  const rows = [
    new TableRow({
      tableHeader: true,
      children: ["What the job asks for", "What I've actually done"].map((t) =>
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: design.accent },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [para(run(t, { bold: true, color: "FFFFFF", size: pt(10) }), { after: 0 })]
        })
      )
    }),
    ...cv.skillsMatch.map((m, i) =>
      new TableRow({
        children: [m.requirement, m.proof].map((t) =>
          new TableCell({
            shading: i % 2 ? { type: ShadingType.CLEAR, fill: "F4F1EA" } : undefined,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [para(run(t, { size: pt(10) }), { after: 0 })]
          })
        )
      })
    )
  ];
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
  return children;
}

// ---- public API ------------------------------------------------------------
async function buildDocx(cv, design, { ats = false, includeSkillsMatch = true, photo = null } = {}) {
  const children = bodyChildren(cv, design, ats, photo);
  if (includeSkillsMatch) children.push(...skillsMatchPage(cv, design, ats));
  // ATS: branding baked as a plain body line (no header/footer elements).
  if (ats) children.push(para(run("Prepared with The Com'mon People · the-common-people.com", { color: MUTED, size: pt(8) }), { before: 200 }));

  const section = {
    properties: { page: { margin: { top: design.margins, bottom: design.margins, left: design.margins, right: design.margins } } },
    children
  };
  if (!ats) { section.headers = { default: brandHeader(design) }; section.footers = { default: brandFooter() }; }

  const doc = new Document({
    creator: "The Com'mon People",
    title: `${cv.header?.name || "CV"} - ${cv.header?.targetRole || "CV"}`,
    styles: { default: { document: { run: { font: design.bodyFont, size: pt(design.fontSize ? design.fontSize / 2 : 10.5) } } } },
    sections: [section]
  });
  return Packer.toBuffer(doc);
}

module.exports = { buildDocx };
