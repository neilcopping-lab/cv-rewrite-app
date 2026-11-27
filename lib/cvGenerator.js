// Builds the structured CV (the seven stops) from the source material. Output
// is a plain data object the template engine renders - no formatting here.
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
  skillsMatch: [],   // { requirement, proof }  (stop seven - the answer key)
  matchReport: [],   // { requirement, status: strong|partial|gap, evidence }  (private skills match report, never printed on the CV)
  missing: []        // { item, question }
});

const STYLE_GUIDE = {
  professional: "PROFESSIONAL & POLISHED: clear, credible and recruiter-friendly. Confident but not flashy.",
  warm: "WARM & PERSONABLE: friendly and human, a natural first-person voice, genuine without being casual.",
  concise: "CONCISE & PUNCHY: short, high-impact sentences, minimal filler, every word earning its place.",
  senior: "CONFIDENT & SENIOR: authoritative and strategic, leadership-focused, the register of an experienced professional."
};

async function generate({ cvText, advertText, gaps, answers, linksConfirmed, writingStyle, styleSample, alreadyAsked }) {
  if (!hasKey()) {
    // Offline stub so the pipeline and render tests run without a key.
    return EMPTY_CV();
  }

  const answerBlock = (answers || [])
    .map((a) => `Q: ${a.question || a.id || ""}\nA: ${a.answer || ""}`)
    .join("\n\n");

  const styleLine = STYLE_GUIDE[writingStyle] || STYLE_GUIDE.professional;
  const sampleBlock = (styleSample || "").trim()
    ? `\n\nVOICE SAMPLE - the candidate's own writing. Mirror its tone, rhythm and vocabulary (NOT its content), so the CV reads like they wrote it:\n"""${String(styleSample).slice(0, 2500)}"""`
    : "";

  const gapBlock = JSON.stringify(gaps?.requirements || [], null, 0).slice(0, 4000);

  const cv = await askJSON({
    system:
      CORE_RULES +
      `\n\nYou are assembling the final CV as DATA. Build the seven stops:
1 header & contacts  2 personal statement  3 key skills with proof  4 career history (reverse chronological)  5 interests  6 education  7 skills-match exercise (advert requirement -> candidate proof).
Links (LinkedIn/portfolio/GitHub/intro video) are included ONLY if linksConfirmed says so. Otherwise set them null.
Anything you cannot ground in the source is simply left out of the body.
The "missing" list is ONLY for a detail the CV genuinely cannot be written without (for example a job with no title). Keep it short, usually empty. NEVER use "missing" for:
- an advert requirement the candidate doesn't evidence (the skills match report already shows gaps),
- optional extras they didn't give (phone number, links, interests, photo),
- anything they were already asked at the questions step (listed under ALREADY ASKED), even if they left it blank. A blank answer means "leave it out".
SAY ONLY WHAT THE SOURCE SAYS. Do not add extra scope or colour words to a real fact (for example turning "redesigned onboarding" into "redesigned early-stage onboarding", or adding "not just through a manager"). Do not work out totals the candidate never stated, such as "five years' experience" from their dates.`,
    prompt: `Return JSON exactly in this shape:
{
  "header": {"name":"","targetRole":"","contacts":{"email":"","phone":"","location":""},"linkedin":null,"portfolio":null,"github":null,"introVideo":null},
  "personalStatement": "",
  "skills": [{"skill":"","proof":""}],
  "experience": [{"company":"","title":"","dates":"","location":"","responsibilities":[""],"achievements":[""],"reasonForLeaving":null}],
  "interests": [""],
  "education": [{"qualification":"","institution":"","dates":"","grade":""}],
  "skillsMatch": [{"requirement":"","proof":""}],
  "matchReport": [{"requirement":"","status":"strong","evidence":""}],
  "missing": [{"item":"","question":""}]
}

linksConfirmed: ${JSON.stringify(linksConfirmed || {})}

Tailor to THIS advert. Mirror the advert's own terms in skills where the candidate genuinely has the experience. Personal statement max 3 sentences, in the candidate's voice, using their Q&A words. Every bullet starts with a strong verb; include a number wherever the source gives one. Skills-match: one row per real advert requirement with matching proof from the candidate.

SKILLS MATCH REPORT (matchReport): a private read-out for the candidate, never printed on the CV. One row for EVERY requirement listed in the GAP ANALYSIS below, in the same order (up to 15). Judge each one against the finished CV and the candidate's Q&A answers: "strong" = clearly evidenced with a specific example or result; "partial" = some relevant evidence but thin, dated or indirect; "gap" = no honest evidence in the source. "evidence": max 20 words, the actual proof in plain words, or for a gap, what the advert wants that the candidate has not shown. Never upgrade a status without real evidence in the CV or the answers. Never invent evidence to close a gap.

DATES ARE MANDATORY. For every role in experience and every entry in education, copy the exact dates or date-range from the source CV VERBATIM into the "dates" field (for example "2017 – Present", "2015 – 2017", "Sept 2009 – 2012"). Rules: (a) never leave "dates" blank when the source shows dates for that item; (b) never invent or add month-level precision that isn't in the source; (c) if the source truly gives no date for an item, leave "dates" as "" - do not guess. Keep experience in reverse-chronological order (most recent first).

WRITING STYLE: ${styleLine} Apply this voice throughout the personal statement and every bullet.${sampleBlock}

LENGTH: the finished CV must fit within 3 pages. Prioritise the most recent and most relevant roles (up to about 6 bullets each). Summarise older or less relevant roles in one or two lines. Do not pad - never exceed 3 pages of content.

JOB ADVERT:
"""${(advertText || "").slice(0, 7000)}"""

CANDIDATE CV (source of truth):
"""${(cvText || "").slice(0, 9000)}"""

GAP ANALYSIS:
${gapBlock}

CANDIDATE Q&A ANSWERS (their own words - prefer these for voice):
"""${answerBlock.slice(0, 6000)}"""

ALREADY ASKED (do not put any of these in "missing"):
${(alreadyAsked || []).map((q) => "- " + q).join("\n").slice(0, 3000) || "- (none)"}`,
    maxTokens: 16000
  });

  return { ...EMPTY_CV(), ...cv };
}

module.exports = { generate, EMPTY_CV };
