// The CV design library (Section 6). ONE parameterised engine, 15 style
// configs — not 15 bespoke builds. Each config only describes typography,
// colour, layout family and emphasis. docxExport.js renders them all.
//
// layout families: "single" | "sidebar" | "timeline" | "grid" | "headerblock"
// Every design also produces an ATS-safe render (single column, standard
// headings, no tables/icons/columns/header-footer) from the SAME config.

const A = {           // shared accent palette
  red: "D6482B", ink: "1A1A1A", navy: "1F2A44", teal: "156E63",
  plum: "5B2A4E", slate: "44515E", forest: "2E4636", amber: "B26A00",
  mono: "2B2B2B", grey: "6B6B6B"
};

const designs = [
  { id: "classic-serif", name: "Classic Serif", category: "Traditional",
    description: "Traditional serif headers, generous margins, timeless and safe.",
    layout: "single", bodyFont: "Georgia", headingFont: "Georgia", serifHeadings: true,
    accent: A.ink, accentUsage: "none", margins: 1440, sectionRule: true },

  { id: "modern-minimal", name: "Modern Minimal Sans", category: "Minimal",
    description: "Clean sans-serif, lots of white space, understated.",
    layout: "single", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.ink, accentUsage: "none", margins: 1620, sectionRule: false, airy: true },

  { id: "two-column-sidebar", name: "Two-Column Sidebar", category: "Structured",
    description: "Contact and skills in a sidebar, experience in the main column.",
    layout: "sidebar", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.navy, accentUsage: "sidebar", sidebarWidth: 32, margins: 1080 },

  { id: "vertical-timeline", name: "Vertical Timeline", category: "Structured",
    description: "Career history laid out against a timeline down the page.",
    layout: "timeline", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.teal, accentUsage: "rule", margins: 1260 },

  { id: "bold-header-block", name: "Bold Header Block", category: "Statement",
    description: "A single block of colour behind the name and title.",
    layout: "headerblock", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.red, accentUsage: "block", margins: 1260 },

  { id: "compact-executive", name: "Compact Executive", category: "Senior",
    description: "Dense, high information density, built for senior two-page CVs.",
    layout: "single", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.slate, accentUsage: "heading", margins: 900, dense: true, fontSize: 21 },

  { id: "subtle-accent", name: "Subtle Accent", category: "Minimal",
    description: "Mostly plain, one accent colour used sparingly by section headers only.",
    layout: "single", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.red, accentUsage: "heading", margins: 1440 },

  { id: "monochrome-grid", name: "Monochrome Grid", category: "Structured",
    description: "Skills presented in a light grid rather than a plain list.",
    layout: "grid", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.ink, accentUsage: "heading", margins: 1260, skillsColumns: 2 },

  { id: "academic-longform", name: "Academic / Long-form", category: "Academic",
    description: "For research-heavy CVs where publications and qualifications need room.",
    layout: "single", bodyFont: "Georgia", headingFont: "Georgia", serifHeadings: true,
    accent: A.ink, accentUsage: "none", margins: 1440, educationProminent: true, allowLong: true },

  { id: "graduate-entry", name: "Graduate / Entry-level", category: "Early career",
    description: "One page, education given more prominence, for early-career candidates.",
    layout: "single", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.teal, accentUsage: "heading", margins: 1440, educationProminent: true, onePage: true },

  { id: "tech-digital", name: "Tech / Digital", category: "Technical",
    description: "A slightly technical feel — monospace touches in labels only, never body.",
    layout: "single", bodyFont: "Calibri", headingFont: "Consolas", monoLabels: true,
    accent: A.teal, accentUsage: "heading", margins: 1260 },

  { id: "consultant-pro", name: "Consultant / Professional Services", category: "Professional",
    description: "Muted palette, understated confidence.",
    layout: "single", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.slate, accentUsage: "heading", margins: 1440, muted: true },

  { id: "warm-operational", name: "Warm Operational", category: "Ops / Hospitality",
    description: "For hospitality, retail and ops — achievement callouts given visual weight.",
    layout: "single", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.amber, accentUsage: "callout", margins: 1260, achievementCallouts: true },

  { id: "commercial-sales", name: "Commercial / Sales", category: "Sales",
    description: "Headline metrics and KPI numbers pulled out and made prominent.",
    layout: "single", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.red, accentUsage: "heading", margins: 1260, metricsProminent: true },

  { id: "simple-letterhead", name: "Simple Letterhead", category: "Plain",
    description: "A plain letterhead-style header, entirely plain body beneath it.",
    layout: "single", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.ink, accentUsage: "letterhead", margins: 1440, plainBody: true },

  { id: "creative-portfolio", name: "Creative / Portfolio", category: "Creative",
    description: "For creatives: a bold header and a prominent, clickable links block for your portfolio, website, LinkedIn and more.",
    layout: "single", bodyFont: "Calibri", headingFont: "Calibri",
    accent: A.plum, accentUsage: "block", margins: 1260, linksProminent: true }
];

function byId(id) {
  return designs.find((d) => d.id === id) || designs[0];
}

module.exports = { designs, byId, ACCENTS: A };
