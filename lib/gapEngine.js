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
      "why": "max 10 words",
      "core": true | false
    }
  ]
}

Rules:
- Return AT MOST the 15 most important requirements. Ignore generic company/background text.
- Keep every field short. Do not repeat the advert verbatim.
- "covered": CV clearly, currently evidences it. "thin": weak/dated/vague. "missing": no evidence.
- Do not invent evidence. If unsure, mark "thin" or "missing".
- "core": true for the 3 or 4 things this job is MOST about (what the advert says matters most, or spends most words on, for example leading a team, winning new business). false for everything else. Read the WHOLE CV, including older roles, before judging evidence: experience from 20 years ago still counts.

JOB ADVERT:
"""${(advertText || "").slice(0, 20000)}"""

CANDIDATE CV (read all of it, older roles included):
"""${(cvText || "").slice(0, 60000)}"""`,
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
  const coreList = (gaps.requirements || [])
    .filter((r) => r.core)
    .map((r) => `- ${r.requirement} (CV evidence: ${r.evidenceInCV || "none"})`)
    .join("\n");

  const data = await askJSON({
    system:
      CORE_RULES +
      "\n\nYou are the question pass. Ask as FEW questions as possible. This is a CV, not an interrogation. It is completely fine to return zero questions if the CV is already strong.",
    prompt: `Produce three lists. The GOLDEN RULE: never ask for anything the CV already contains. Read the CV first. If the answer is anywhere in the CV, do NOT ask it.

1) gapQuestions: one short question ONLY for each genuine gap below (things the advert wants that the CV does not evidence). Skip any gap the CV actually already answers. Phrase like: "The advert asks for Salesforce - have you used it, even informally?"

GENUINE GAPS:
${gapList || "(none flagged)"}

2) sectionQuestions: ONLY for a standard section (personal statement, key skills, career history, interests, education) that is genuinely MISSING or thin in the CV. If the CV already has a personal statement, do NOT ask for one. If it already lists skills, do NOT ask for skills. If interests are already there, do NOT ask. Most complete CVs should get zero or one section question. Never ask a section question just to "gather material" when the CV already covers it.

3) priorityQuestions: the advert's core requirements are listed below. For each one where the CV shows it but WITHOUT the detail a hiring manager needs (how many people, where, what you changed, what happened as a result), ask ONE question that invites that detail. Name what the CV already says so they know you've read it, and give them prompts. For example: "Leading a team is the heart of this job. Your CV says you managed a team of senior consultants at Tate. Tell us more: how many people, in which offices, how you coached them, and what changed because of you." Skip a core requirement if the CV already gives that detail, or if gapQuestions already asks about it. At most 3.

CORE REQUIREMENTS:
${coreList || "(none marked)"}

Return JSON (any list may be empty):
{
  "gapQuestions": [{"id":"g1","requirement":"...","question":"..."}],
  "sectionQuestions": [{"id":"s_statement","section":"personal statement","question":"..."}],
  "priorityQuestions": [{"id":"p1","requirement":"...","question":"..."}]
}

CANDIDATE CV (read all of it, and do NOT re-ask anything already present here):
"""${(cvText || "").slice(0, 60000)}"""`,
    maxTokens: 8000
  });
  // Trust the model to ask only what's needed. Only fall back to the generic
  // section prompts when we're offline (no key) and have nothing at all.
  if (!hasKey() && (!data.sectionQuestions || !data.sectionQuestions.length)) {
    data.sectionQuestions = defaultSectionQuestions();
  }
  data.gapQuestions = data.gapQuestions || [];
  data.sectionQuestions = data.sectionQuestions || [];
  data.priorityQuestions = (data.priorityQuestions || []).slice(0, 3);
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
