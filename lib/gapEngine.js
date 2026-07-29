// The skills-gap engine (Section 4). Runs as two explicit passes so each can
// be tested on its own, exactly like the "hand them the answer key" exercise.
const { askJSON, hasKey } = require("./anthropic");
const { CORE_RULES } = require("./prompts");

// PASS ONE - gap detection. Compare the advert against the CV requirement by
// requirement. For each requirement, decide: covered / thin / missing.
async function detectGaps({ cvText, advertText }) {
  if (!hasKey()) {
    return {
      requirements: [],
      note: "ANTHROPIC_API_KEY not set - gap detection skipped (offline mode)."
    };
  }
  const data = await askJSON({
    system:
      CORE_RULES +
      "\n\nYou are the gap-detection pass. Read the job advert and the candidate's CV. Focus on the genuine requirements, not boilerplate about the company.",
    prompt: `Return JSON in EXACTLY this shape and keep it compact:
{
  "requirements": [
    {
      "requirement": "short paraphrase of the requirement (max 12 words)",
      "advertLanguage": "the key term the advert uses",
      "status": "covered" | "thin" | "missing",
      "evidenceInCV": "short phrase from the CV, or null",
      "why": "max 10 words"
    }
  ]
}

Rules:
- Return AT MOST the 15 most important requirements. Ignore generic company/background text.
- Keep every field short. Do not repeat the advert verbatim.
- "covered": CV clearly, currently evidences it. "thin": weak/dated/vague. "missing": no evidence.
- Do not invent evidence. If unsure, mark "thin" or "missing".

JOB ADVERT:
"""${(advertText || "").slice(0, 7000)}"""

CANDIDATE CV:
"""${(cvText || "").slice(0, 8000)}"""`,
    maxTokens: 8000
  });
  return data;
}

// PASS TWO - targeted questions. Only ask about genuine gaps (thin/missing),
// never re-ask what the CV already answers. Also add one short question per
// standard section so the rewrite has raw material in the candidate's voice.
async function buildQuestions({ cvText, advertText, gaps }) {
  if (!hasKey()) {
    return { gapQuestions: [], sectionQuestions: defaultSectionQuestions() };
  }
  const gapList = (gaps.requirements || [])
    .filter((r) => r.status === "thin" || r.status === "missing")
    .map((r) => `- (${r.status}) ${r.requirement}`)
    .join("\n");

  const data = await askJSON({
    system:
      CORE_RULES +
      "\n\nYou are the question pass. Keep it to the MINIMUM needed. This is a CV, not an interrogation. Questions must be short, specific and answerable, never vague.",
    prompt: `Two lists.

1) gapQuestions: one short, specific question for each genuine gap below. Phrase like: "The advert asks for Salesforce experience - is that something you've used, even informally?" Skip anything the CV already answers.

GENUINE GAPS:
${gapList || "(none flagged)"}

2) sectionQuestions: one short prompt for EACH standard CV section so the rewrite has real raw material in the candidate's own words: personal statement, key skills, career history highlights, interests, education. Only ask what the CV does not already give richly.

Return JSON:
{
  "gapQuestions": [{"id":"g1","requirement":"...","question":"..."}],
  "sectionQuestions": [{"id":"s_statement","section":"personal statement","question":"..."}]
}

CANDIDATE CV (so you don't re-ask what's already here):
"""${(cvText || "").slice(0, 8000)}"""`,
    maxTokens: 8000
  });
  if (!data.sectionQuestions || !data.sectionQuestions.length) {
    data.sectionQuestions = defaultSectionQuestions();
  }
  return data;
}

function defaultSectionQuestions() {
  return [
    { id: "s_statement", section: "personal statement", question: "In a sentence or two, in your own words: how did you get into this line of work, and what do you care about in it? Something real is better than something polished." },
    { id: "s_skills", section: "key skills", question: "Which two or three skills do you most want this employer to notice, and what's one concrete result you got with each?" },
    { id: "s_history", section: "career history highlights", question: "What's the achievement from your recent roles you're most proud of, ideally with a number attached?" },
    { id: "s_interests", section: "interests", question: "Three to six things you actually do outside work - be specific (\"restoring Vespas\" beats \"cars\")." },
    { id: "s_education", section: "education", question: "Any qualifications, strong grades or certifications worth including? Say if you'd rather keep this brief." }
  ];
}

module.exports = { detectGaps, buildQuestions, defaultSectionQuestions };
