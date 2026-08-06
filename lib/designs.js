// The CV design library (Section 6). ONE parameterised engine, 16 style
// configs. Each config describes typography, colour, and - crucially - a
// distinct STRUCTURE so no two templates read the same:
//   headerStyle : plain | centered | letterhead | leftbar | boxed | block | sidebar
//   headingStyle: plain | rule | accentText | tag | bar | mono | caps-spaced
//                 | serif-rule | serif-plain
//   skillsStyle : list | grid | pills   (sidebar layout handles its own)
//   layout      : single | sidebar | timeline | grid | headerblock
// Every design also renders an ATS-safe version (flattened to a plain single
// column) from the SAME config - see docxExport.flattenForAts().

const A = {                     // palette (brand-led, with distinct accents)
  navy: "161F29", gold: "B8860B", teal: "2C7A8C", orange: "C2571A",
  ink: "1A1A1A", slate: "44515E", forest: "2E4636", plum: "5B2A4E",
  burgundy: "7A2E2E", blue: "27476E", grey: "6B6B6B", mono: "2B2B2B"
};

const designs = [
  { id: "classic-serif", name: "Classic Serif", category: "Traditional",
    description: "Centered serif letterhead with a double rule; timeless and formal.",
    layout: "single", bodyFont: "Georgia", headingFont: "Georgia", serifHeadings: true,
    accent: A.ink, headerStyle: "centered", centeredContacts: true, headingStyle: "serif-rule",
    skillsStyle: "list", margins: 1440 },

  { id: "modern-minimal", name: "Modern Minimal Sans", category: "Minimal",
    description: "Airy sans-serif, hairline dividers, maximum white space.",
    layout: "single", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.slate, headerStyle: "plain", headingStyle: "plain-hair",
    skillsStyle: "list", margins: 1680, airy: true },

  { id: "two-column-sidebar", name: "Two-Column Sidebar", category: "Structured",
    description: "A navy sidebar holds contact and skills; experience runs beside it.",
    layout: "sidebar", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.navy, headerStyle: "plain", headingStyle: "rule", sidebarWidth: 33,
    skillsStyle: "sidebar", margins: 1040 },

  { id: "vertical-timeline", name: "Vertical Timeline", category: "Structured",
    description: "Career history hung on a coloured timeline down the page.",
    layout: "timeline", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.teal, headerStyle: "leftbar", headingStyle: "rule",
    skillsStyle: "list", margins: 1260 },

  { id: "bold-header-block", name: "Bold Header Block", category: "Statement",
    description: "A full block of colour behind the name; tagged section headings.",
    layout: "headerblock", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.orange, headerStyle: "block", headingStyle: "tag",
    skillsStyle: "list", margins: 1200 },

  { id: "compact-executive", name: "Compact Executive", category: "Senior",
    description: "Dense two-page layout, right-aligned dates, letter-spaced headings.",
    layout: "single", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.slate, headerStyle: "plain", headingStyle: "caps-spaced", datesRight: true,
    skillsStyle: "list", margins: 900, dense: true, fontSize: 20 },

  { id: "subtle-accent", name: "Subtle Accent", category: "Minimal",
    description: "Almost entirely plain, with one accent colour on the headings only.",
    layout: "single", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.burgundy, headerStyle: "plain", headingStyle: "accentText",
    skillsStyle: "list", margins: 1440 },

  { id: "monochrome-grid", name: "Monochrome Grid", category: "Structured",
    description: "Reversed black heading bars and a two-column skills grid.",
    layout: "grid", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.ink, headerStyle: "plain", headingStyle: "bar", skillsStyle: "grid",
    skillsColumns: 2, margins: 1200 },

  { id: "academic-longform", name: "Academic / Long-form", category: "Academic",
    description: "Serif, education and qualifications first, room for detail.",
    layout: "single", bodyFont: "Georgia", headingFont: "Georgia", serifHeadings: true,
    accent: A.blue, headerStyle: "centered", centeredContacts: true, headingStyle: "serif-plain",
    skillsStyle: "list", margins: 1440, educationFirst: true, allowLong: true },

  { id: "graduate-entry", name: "Graduate / Entry-level", category: "Early career",
    description: "Friendly, one page, education up top, skills shown as pills.",
    layout: "single", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.teal, headerStyle: "plain", headingStyle: "tag", skillsStyle: "pills",
    margins: 1440, educationFirst: true, onePage: true },

  { id: "tech-digital", name: "Tech / Digital", category: "Technical",
    description: "Monospace heading labels with a » marker; skills as pills.",
    layout: "single", bodyFont: "Calibri", headingFont: "Consolas", monoLabels: true,
    accent: A.teal, headerStyle: "plain", headingStyle: "mono", skillsStyle: "pills",
    margins: 1260 },

  { id: "consultant-pro", name: "Consultant / Professional Services", category: "Professional",
    description: "Centered, muted and understated - quiet confidence.",
    layout: "single", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.slate, headerStyle: "centered", centeredContacts: true, headingStyle: "rule",
    skillsStyle: "list", margins: 1500, muted: true },

  { id: "warm-operational", name: "Warm Operational", category: "Ops / Hospitality",
    description: "Left accent bar header, tagged headings, highlighted achievements.",
    layout: "single", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.orange, headerStyle: "leftbar", headingStyle: "tag",
    skillsStyle: "list", margins: 1260, achievementCallouts: true },

  { id: "commercial-sales", name: "Commercial / Sales", category: "Sales",
    description: "Boxed header, reversed heading bars, KPI numbers pulled out bold.",
    layout: "single", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.burgundy, headerStyle: "boxed", headingStyle: "bar", datesRight: true,
    skillsStyle: "list", margins: 1200, metricsProminent: true },

  { id: "simple-letterhead", name: "Simple Letterhead", category: "Plain",
    description: "A centered letterhead with a full rule, then an entirely plain body.",
    layout: "single", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.ink, headerStyle: "letterhead", centeredContacts: true, headingStyle: "plain",
    skillsStyle: "list", margins: 1440, plainBody: true },

  { id: "creative-portfolio", name: "Creative / Portfolio", category: "Creative",
    description: "Bold colour-band name, prominent clickable links, skills as pills.",
    layout: "single", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.plum, headerStyle: "block", headingStyle: "tag", skillsStyle: "pills",
    margins: 1240, linksProminent: true }
];

function byId(id) {
  return designs.find((d) => d.id === id) || designs[0];
}

module.exports = { designs, byId, ACCENTS: A };
