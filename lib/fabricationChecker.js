// Section 9 — the fabrication / unqualified-content HARD GATE.
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
  const cvNums = extractNumbers(JSON.stringify(cv));
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

Do NOT flag: grammar tidy-ups, rephrasing, reordering, mirroring the advert's wording for a skill the candidate genuinely has.
DO flag: invented employers/titles/dates/qualifications, skills the candidate never claimed, responsibilities inflated beyond what they described.

SOURCE OF TRUTH:
"""${sot.corpus.slice(0, 12000)}"""

GENERATED CV (JSON):
"""${JSON.stringify(cv).slice(0, 9000)}"""`,
    maxTokens: 8000
  });
  return { flags: data.flags || [] };
}

// Strip fabricated content from the CV and move it to the [MISSING] list with
// a clarifying question the candidate can answer to legitimately fill it.
function stripAndQueue(cv, flags) {
  const out = JSON.parse(JSON.stringify(cv));
  out.missing = out.missing || [];
  for (const f of flags) {
    const text = (f.value || f.text || "").toString();
    if (!text) continue;
    stripText(out, text);
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

// Remove the offending string wherever it appears in string fields/arrays.
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

// Main entry: returns { pass, flags, cleanedCV }. pass=false blocks download.
async function check(cv, sot) {
  const numberFlags = checkNumbers(cv, sot);
  const { flags: semanticFlags } = await checkSemantic(cv, sot);
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

module.exports = { check, checkNumbers, checkSemantic, stripAndQueue, normNum };
