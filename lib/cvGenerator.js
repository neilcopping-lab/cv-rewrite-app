// Builds the structured CV (the seven stops) from the source material. Output
// is a plain data object the template engine renders — no formatting here.
const { askJSON, hasKey } = require("./anthropic");
const { CORE_RULES } = require("./prompts");

// Canonical CV shape used by the generator, the checker and every template.
const EMPTY_CV = () => ({
  header: { name: "", targetRole: "", contacts: {}, linkedin: null, portfolio: null, website: null, github: null, introVideo: null },
  personalStatement: "",
  skills: [],        // { skill, proof }
  experience: [],    // { company, title, dates, location, responsibilities[], achievements[], reasonForLeaving }
  interests: [],     // strings
  education: [],     // { qualification, institution, dates, grade }
  skillsMatch: [],   // { requirement, proof }  (stop seven — the answer key)
  missing: []        // { item, question }
});

async function generate({ cvText, advertText, gaps, answers, linksConfirmed }) {
  if (!hasKey()) {
    // Offline stub so the pipeline and render tests run without a key.
    return EMPTY_CV();
  }

  const answerBlock = (answers || [])
    .map((a) => `Q: ${a.question || a.id || ""}\nA: ${a.answer || ""}`)
    .join("\n\n");

  const gapBlock = JSON.stringify(gaps?.requirements || [], null, 0).slice(0, 4000);

  const cv = await askJSON({
    system:
      CORE_RULES +
      `\n\nYou are assembling the final CV as DATA. Build the seven stops:
1 header & contacts  2 personal statement  3 key skills with proof  4 career history (reverse chronological)  5 interests  6 education  7 skills-match exercise (advert requirement -> candidate proof).
Links (LinkedIn/portfolio/GitHub/intro video) are included ONLY if linksConfirmed says so. Otherwise set them null.
Anything you cannot ground in the source goes to "missing" with a clarifying question, and is left out of the body (write [MISSING] only inside a field you must fill but cannot).`,
    prompt: `Return JSON exactly in this shape:
{
  "header": {"name":"","targetRole":"","contacts":{"email":"","phone":"","location":""},"linkedin":null,"portfolio":null,"github":null,"introVideo":null},
  "personalStatement": "",
  "skills": [{"skill":"","proof":""}],
  "experience": [{"company":"","title":"","dates":"","location":"","responsibilities":[""],"achievements":[""],"reasonForLeaving":null}],
  "interests": [""],
  "education": [{"qualification":"","institution":"","dates":"","grade":""}],
  "skillsMatch": [{"requirement":"","proof":""}],
  "missing": [{"item":"","question":""}]
}

linksConfirmed: ${JSON.stringify(linksConfirmed || {})}

Tailor to THIS advert. Mirror the advert's own terms in skills where the candidate genuinely has the experience. Personal statement max 3 sentences, in the candidate's voice, using their Q&A words. Every bullet starts with a strong verb; include a number wherever the source gives one. Skills-match: one row per real advert requirement with matching proof from the candidate.

DATES ARE MANDATORY. For every role in experience and every entry in education, copy the exact dates or date-range from the source CV VERBATIM into the "dates" field (for example "2017 – Present", "2015 – 2017", "Sept 2009 – 2012"). Rules: (a) never leave "dates" blank when the source shows dates for that item; (b) never invent or add month-level precision that isn't in the source; (c) if the source truly gives no date for an item, leave "dates" as "" — do not guess. Keep experience in reverse-chronological order (most recent first).

JOB ADVERT:
"""${(advertText || "").slice(0, 7000)}"""

CANDIDATE CV (source of truth):
"""${(cvText || "").slice(0, 9000)}"""

GAP ANALYSIS:
${gapBlock}

CANDIDATE Q&A ANSWERS (their own words — prefer these for voice):
"""${answerBlock.slice(0, 6000)}"""`,
    maxTokens: 16000
  });

  return { ...EMPTY_CV(), ...cv };
}

module.exports = { generate, EMPTY_CV };
