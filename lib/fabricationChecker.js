// Section 9 - the fabrication / unqualified-content HARD GATE.
// Runs as its own pass against the stored source-of-truth record. Nothing in
// the generated CV may go out unless it traces back to something the candidate
// actually said. Numbers get special scrutiny. Fails are STRIPPED, not softened.
const { askJSON, hasKey } = require("./anthropic");
const { extractNumbers } = require("./sourceOfTruth");

// Normalise a number token for comparison ("£1.4m", "1,400,000", "22 %").
function normNum(s) {
  return String(s).toLowerCase().replace(/[£$€,\s]/g, "").replace(/%/g, "pct").trim();
}

// DETERMINISTIC number check: every number in the CV must appear in the source.
function checkNumbers(cv, sot) {
  const sourceNums = new Set(sot.numbers.map(normNum));
  // also allow individual components of ranges present in source text
  const flags = [];
  const cvNums = extractNumbers(JSON.stringify(forCheck(cv)));
  for (const n of cvNums) {
    const nn = normNum(n);
    if (nn.length < 2) continue;               // skip trivial single digits
    if (/^(19|20)\d\d$/.test(nn)) {            // years must be in source too
      if (!sourceNums.has(nn) && !sot.corpusLower.includes(nn)) {
        flags.push({ kind: "number", value: n, why: "Year not present in source material." });
      }
      continue;
    }
    // Percentages are a distinct claim: "30%" must appear AS a percentage in
    // the source. Do NOT clear it just because the bare digits "30" appear
    // elsewhere (e.g. "30 SME accounts"). This is where invented stats hide.
    if (/pct$/.test(nn)) {
      const bare = nn.replace("pct", "");
      const inSource =
        sourceNums.has(nn) ||
        sot.corpusLower.includes(bare + "%") ||
        sot.corpusLower.includes(bare + " percent") ||
        sot.corpusLower.includes(bare + " per cent");
      if (!inSource) flags.push({ kind: "number", value: n, why: "Percentage not present in the source material." });
      continue;
    }
    if (!sourceNums.has(nn) && !sot.corpusLower.includes(nn)) {
      flags.push({ kind: "number", value: n, why: "Metric/number not traceable to anything the candidate provided." });
    }
  }
  return flags;
}

// SEMANTIC check via the model: sentence-by-sentence tracing for invented
// employers, titles, dates, qualifications, skills or inflated scope.
async function checkSemantic(cv, sot) {
  if (!hasKey()) return { flags: [] };
  const data = await askJSON({
    system:
      "You are a fabrication auditor for CVs. You are STRICT. Tidying/rephrasing the candidate's own content is fine. ADDING any claim, achievement, employer, title, date, qualification, skill or scope of responsibility that is not present in the source is a FABRICATION. When in doubt, flag it.",
    prompt: `Compare the generated CV against the SOURCE OF TRUTH (the candidate's own CV + their Q&A answers). List every item in the CV that is NOT traceable to the source.

Return JSON:
{"flags":[{"kind":"employer|title|date|qualification|skill|scope|claim","location":"which CV field","text":"the offending text","why":"one sentence"}]}

"text" must be words copied EXACTLY from the CV (a phrase is fine). We take out the whole line or sentence that contains them, so pick words that appear only in the line you mean.

The candidate's Q&A answers are part of the source: anything they said there is traceable. Read ALL of the source, including older roles near the end of the CV and the last answers. Employer names, job titles and dates in the career history have already been checked against the CV word for word, so don't flag those.

Do NOT flag: grammar tidy-ups, rephrasing, reordering, mirroring the advert's wording for a skill the candidate genuinely has.
DO flag: invented employers/titles/dates/qualifications, skills the candidate never claimed, responsibilities inflated beyond what they described.

SOURCE OF TRUTH (all of it):
"""${sot.corpus.slice(0, 120000)}"""

GENERATED CV (all of it):
"""${JSON.stringify(forCheck(cv)).slice(0, 60000)}"""`,
    maxTokens: 8000
  });
  return { flags: data.flags || [] };
}

// Just the words that go on the CV (none of our own notes about it).
function forCheck(cv) {
  const c = cv || {};
  return {
    header: { name: c.header && c.header.name, targetRole: c.header && c.header.targetRole },
    personalStatement: c.personalStatement,
    skills: (c.skills || []).map((s) => ({ skill: s.skill, proof: s.proof })),
    experience: (c.experience || []).map((r) => ({ company: r.company, title: r.title, dates: r.dates, responsibilities: r.responsibilities, achievements: r.achievements })),
    education: c.education,
    interests: c.interests,
    skillsMatch: (c.skillsMatch || []).map((m) => ({ requirement: m.requirement, proof: m.proof })),
  };
}

// Strip fabricated content from the CV and move it to the [MISSING] list with
// a clarifying question the candidate can answer to legitimately fill it.
// Whole lines and sentences go, never single words, so nothing is left with a
// hole in it (28 Nov 2026: cutting words out left "with a at Tate").
function stripAndQueue(cv, flags) {
  const out = JSON.parse(JSON.stringify(cv));
  out.missing = out.missing || [];
  for (const f of flags) {
    const text = (f.value || f.text || "").toString();
    if (!text) continue;
    if (!removeContaining(out, text)) continue; // not on the CV: nothing to ask
    out.missing.push({
      item: `${f.kind}: ${text}`.slice(0, 160),
      question: clarifyingQuestion(f)
    });
  }
  return out;
}

function clarifyingQuestion(f) {
  const t = (f.value || f.text || "this").toString();
  switch (f.kind) {
    case "number":
      return `The draft included the figure "${t}", which isn't in what you gave us. What's the real number, if any?`;
    case "scope":
      return `The draft implied "${t}". What's the accurate scope of what you actually did?`;
    case "skill":
      return `The draft listed "${t}" as a skill. Have you genuinely used it, and can you give one real example?`;
    case "qualification":
      return `The draft listed the qualification "${t}". Do you actually hold it? If so, where and when?`;
    case "employer":
    case "title":
    case "date":
      return `The draft added "${t}", which isn't in your source material. Is it correct? Please confirm the accurate detail.`;
    default:
      return `The draft added "${t}", which we couldn't trace to anything you told us. Is it true, and how would you phrase it?`;
  }
}

// Take out every line, row or sentence containing `text`. Employer, title
// and dates come from the person's checked career record, so they stay.
// Returns true if anything was removed.
function removeContaining(cv, text) {
  const needle = String(text).toLowerCase().trim();
  if (!needle) return false;
  const has = (t) => typeof t === "string" && t.toLowerCase().includes(needle);
  let hit = false;
  // Personal statement: drop the sentence(s).
  if (has(cv.personalStatement)) {
    const parts = cv.personalStatement.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) || [cv.personalStatement];
    cv.personalStatement = parts.filter((p) => !has(p)).join(" ").replace(/\s{2,}/g, " ").trim();
    hit = true;
  }
  const dropRows = (arr, fields, srcKey) => {
    if (!Array.isArray(cv[arr])) return;
    const src = srcKey && Array.isArray(cv[srcKey]) ? cv[srcKey] : null;
    const keep = [], keepSrc = [];
    cv[arr].forEach((row, i) => {
      const t = typeof row === "string" ? [row] : fields.map((k) => row && row[k]);
      if (t.some(has)) hit = true; else { keep.push(row); if (src) keepSrc.push(src[i]); }
    });
    cv[arr] = keep; if (src) cv[srcKey] = keepSrc;
  };
  dropRows("skills", ["skill", "proof"], "skillSources");
  dropRows("skillsMatch", ["proof"]);
  dropRows("interests", [], "interestSources");
  dropRows("education", ["qualification", "institution", "grade"]);
  (cv.experience || []).forEach((r) => {
    for (const k of ["responsibilities", "achievements"]) {
      const src = r.sources && r.sources[k];
      const keep = [], keepSrc = [];
      (r[k] || []).forEach((b, i) => { if (has(b)) hit = true; else { keep.push(b); if (src) keepSrc.push(src[i]); } });
      r[k] = keep; if (src) r.sources[k] = keepSrc;
    }
  });
  if (cv.header && has(cv.header.targetRole)) { cv.header.targetRole = ""; hit = true; }
  return hit;
}

// Remove the offending string wherever it appears in string fields/arrays.
// (Old behaviour, kept for reference by tests; no longer used by the gate.)
function stripText(obj, text) {
  const needle = text.toLowerCase();
  const walk = (node, parent, key) => {
    if (typeof node === "string") {
      if (node.toLowerCase().includes(needle)) {
        if (Array.isArray(parent)) parent[key] = null; // drop array item
        else parent[key] = node.replace(new RegExp(escapeRx(text), "ig"), "[MISSING]");
      }
    } else if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, node, i));
      // compact removed items
      for (let i = node.length - 1; i >= 0; i--) if (node[i] === null) node.splice(i, 1);
    } else if (node && typeof node === "object") {
      Object.keys(node).forEach((k) => walk(node[k], node, k));
    }
  };
  walk(obj, null, null);
}
const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A "date" flag is a false alarm if every year in the flagged text is actually
// present in the source CV. That happens when the writer merely reformats a real
// date (e.g. "2015-2017" -> "2015 – 2017"); we must NOT strip those, or the CV
// loses its genuine employment/education dates. Genuinely invented dates (a year
// not in the source) still get flagged and stripped.
function isTraceableDate(text, sot) {
  const years = (String(text || "").match(/\b(19|20)\d\d\b/g)) || [];
  if (!years.length) return false; // no year to verify - leave the flag in place
  return years.every((y) => sot.corpusLower.includes(y));
}

// Main entry: returns { pass, flags, cleanedCV }. pass=false blocks download.
async function check(cv, sot) {
  const numberFlags = checkNumbers(cv, sot);
  const { flags: rawSemanticFlags } = await checkSemantic(cv, sot);
  const semanticFlags = rawSemanticFlags.filter(
    (f) => !(f.kind === "date" && isTraceableDate(f.text, sot))
  );
  const flags = [...numberFlags, ...semanticFlags];
  const cleanedCV = flags.length ? stripAndQueue(cv, flags) : cv;
  return {
    pass: flags.length === 0,
    flags,
    cleanedCV,
    // unresolved [MISSING] the candidate must see before download
    missing: cleanedCV.missing || []
  };
}

module.exports = { check, checkNumbers, checkSemantic, stripAndQueue, removeContaining, forCheck, normNum, isTraceableDate };
