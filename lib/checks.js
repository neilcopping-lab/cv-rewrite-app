// Section 8 final checks that can be run PROGRAMMATICALLY (no judgement needed):
// UK spelling locale, banned punctuation, standard-heading whitelist.
// The judgement checks (voice, honesty, overstatement) run as an AI self-review
// pass in reviewer.js. Both feed the download gate.

// Common US -> UK spellings we flag if they appear in generated copy.
const US_TO_UK = {
  organize: "organise", organized: "organised", organization: "organisation",
  optimize: "optimise", optimized: "optimised", prioritize: "prioritise",
  analyze: "analyse", analyzed: "analysed", color: "colour", favorite: "favourite",
  center: "centre", "meter": "metre", program: "programme", license: "licence",
  fulfill: "fulfil", enrollment: "enrolment", catalog: "catalogue",
  labor: "labour", honor: "honour", behavior: "behaviour", traveled: "travelled",
  modeling: "modelling", canceled: "cancelled"
};
// US phrasing the guide explicitly bans.
const US_PHRASES = ["outreach", "leverage synergies", "reach out", "gotten", "touch base"];

const BANNED_PUNCT = [
  { rx: /—/g, name: "em dash" },
  { rx: /–/g, name: "en dash" },
  // hyphen used as sentence punctuation:  word - word  (spaced hyphen)
  { rx: /\s-\s/g, name: "hyphen used as punctuation" }
];

const ALLOWED_HEADINGS = ["experience", "skills", "education"];

function walkStrings(obj, out = []) {
  if (typeof obj === "string") out.push(obj);
  else if (Array.isArray(obj)) obj.forEach((x) => walkStrings(x, out));
  else if (obj && typeof obj === "object") Object.values(obj).forEach((x) => walkStrings(x, out));
  return out;
}

function run(cv) {
  const strings = walkStrings(cv);
  const text = strings.join("\n");
  const lower = text.toLowerCase();
  const issues = [];

  // UK spelling
  for (const [us, uk] of Object.entries(US_TO_UK)) {
    const rx = new RegExp(`\\b${us}\\b`, "gi");
    if (rx.test(text)) issues.push({ type: "spelling", severity: "warn", detail: `US spelling "${us}" — use "${uk}".` });
  }
  for (const p of US_PHRASES) {
    if (lower.includes(p)) issues.push({ type: "phrasing", severity: "warn", detail: `US/sales phrasing "${p}".` });
  }

  // Banned punctuation
  for (const b of BANNED_PUNCT) {
    const m = text.match(b.rx);
    if (m) issues.push({ type: "punctuation", severity: "fail", detail: `${b.name} found (${m.length}). Rephrase or use plain punctuation.` });
  }

  // Heading whitelist — the section-title keys we actually render are fixed,
  // but we also scan for creative headings smuggled into the body.
  const creative = ["professional experience", "employment journey", "my story", "core competencies", "areas of expertise", "career objective"];
  for (const c of creative) {
    if (lower.includes(c)) issues.push({ type: "heading", severity: "warn", detail: `Non-standard heading "${c}" — use Experience / Skills / Education.` });
  }

  // Personal statement length (max 3 sentences per the guide).
  if (cv.personalStatement) {
    const sentences = cv.personalStatement.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length > 3) issues.push({ type: "statement", severity: "warn", detail: `Personal statement has ${sentences.length} sentences (max 3).` });
  }

  // Every experience bullet ideally starts with a verb — we can't POS-tag
  // cheaply, but we flag bullets that start lowercase or with a number word.
  (cv.experience || []).forEach((role, i) => {
    (role.responsibilities || []).concat(role.achievements || []).forEach((b) => {
      if (b && /^[a-z]/.test(b.trim())) issues.push({ type: "bullet", severity: "info", detail: `Bullet does not start with a capitalised verb: "${b.slice(0, 40)}…"` });
    });
  });

  const fails = issues.filter((i) => i.severity === "fail");
  return { ok: fails.length === 0, issues, fails };
}

module.exports = { run, US_TO_UK, BANNED_PUNCT, ALLOWED_HEADINGS };
