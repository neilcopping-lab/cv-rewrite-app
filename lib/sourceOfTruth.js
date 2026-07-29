// Builds the session's source-of-truth record: every fact the fabrication
// checker (Section 9) is allowed to treat as legitimate. It is the union of
// the candidate's uploaded CV text and their own Q&A answers, PLUS a
// structured index of numbers, employers, titles, dates and qualifications.
const { askJSON, hasKey } = require("./anthropic");

// Pull every standalone number/percentage/currency/duration out of raw text.
function extractNumbers(text) {
  if (!text) return [];
  const rx = /(?:£|\$|€)\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m|bn|billion|million|thousand)?|\b\d[\d,]*(?:\.\d+)?\s?%|\b\d[\d,]*(?:\.\d+)?\s?(?:years?|yrs?|months?|weeks?|days?|people|staff|accounts?|clients?|projects?|reports?|stores?|sites?|cohorts?|k|m)\b|\b(19|20)\d{2}\b|\b\d[\d,]{1,}\b/gi;
  const found = new Set();
  let m;
  while ((m = rx.exec(text)) !== null) found.add(m[0].trim().toLowerCase().replace(/\s+/g, " "));
  return [...found];
}

// Raw corpus = the only text the checker treats as ground truth.
function rawCorpus({ cvText, answers }) {
  const answerText = (answers || [])
    .map((a) => (typeof a === "string" ? a : `${a.question || ""} ${a.answer || ""}`))
    .join("\n");
  return `${cvText || ""}\n${answerText}`.trim();
}

async function build({ cvText, answers }) {
  const corpus = rawCorpus({ cvText, answers });
  const numbers = extractNumbers(corpus);

  // Structured index via the model when a key is present; deterministic
  // fallback (raw corpus + regex numbers) keeps the checker working offline.
  let structured = { employers: [], titles: [], dates: [], qualifications: [], skills: [] };
  if (hasKey()) {
    try {
      structured = await askJSON({
        system:
          "You index a candidate's own source material. Extract ONLY items literally present. Do not infer or add.",
        prompt: `From the text below, list every employer name, job title, date or date-range, qualification/certification, and named skill or tool the candidate actually states. Return JSON:
{"employers":[],"titles":[],"dates":[],"qualifications":[],"skills":[]}

SOURCE:
"""${corpus.slice(0, 12000)}"""`,
        maxTokens: 6000
      });
    } catch (_) {
      /* fall back to corpus-only */
    }
  }

  return {
    corpus,
    corpusLower: corpus.toLowerCase(),
    numbers,
    employers: structured.employers || [],
    titles: structured.titles || [],
    dates: structured.dates || [],
    qualifications: structured.qualifications || [],
    skills: structured.skills || []
  };
}

module.exports = { build, extractNumbers, rawCorpus };
