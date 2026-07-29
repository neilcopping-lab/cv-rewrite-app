// Central brand config for The Com'mon People. Single source of truth so
// the landing page, the flow UI and the generated documents all match.
module.exports = {
  name: "The Com'mon People",
  product: "CV Rewrite",
  productLong: "The CV Rewrite",
  priceGBP: process.env.CV_PRICE_GBP || "12.50",
  tagline:
    "Paste your current CV and the job advert. Answer a few questions where we spot the gaps. Get back a CV rewritten to align with this specific role - pick your design, download as Word or PDF.",
  siteBase: "https://the-common-people.com",
  nav: [
    { label: "Guides", href: "https://the-common-people.com/guides.html" },
    { label: "Dispatches", href: "https://the-common-people.com/dispatches.html" },
    { label: "Loudspeaker", href: "https://the-common-people.com/loudspeaker.html" },
    { label: "About", href: "https://the-common-people.com/about.html" },
    { label: "Interview Prep Report", href: "https://the-common-people.com/prep-report.html" }
  ],
  // Editorial "field guide" palette: warm paper, ink, punk red accent.
  colours: {
    navy: "#161F29",
    navyDeep: "#0F151C",
    panel: "#2A333D",
    cream: "#ECE6D8",
    creamMuted: "#A9A293",
    accent: "#E0B03C",      // gold (primary accent)
    accentDeep: "#C69A2E",
    teal: "#5AA9C2",
    orange: "#D2691E",
    line: "#2E3945",
    muted: "#7A7466"
  },
  fonts: { display: "Anton", label: "Oswald", body: "Arvo" },
  // Document palette (hex without # for docx)
  docColours: {
    ink: "1A1A1A",
    accent: "E0B03C",
    muted: "726C5E",
    line: "1A1A1A",
    paper: "F4F0E6"
  },
  footer: {
    blurb:
      "A free resource centre for marketing, HR, finance, events and operations people. Built on mutual aid.",
    copyright: "© 2026 The Com'mon People. Built on mutual aid. Free, always."
  }
};
