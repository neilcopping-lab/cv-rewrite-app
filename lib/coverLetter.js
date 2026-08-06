// ─── Personalised cover letter generator ────────────────────────────────────
// Writes a short, honest cover letter from the candidate's finished CV data and
// the job advert, in their chosen writing voice. Same rule as the CV: nothing
// is invented - every claim must trace back to the CV / their own words.
const { askJSON, ask, hasKey } = require("./anthropic");
const { CORE_RULES } = require("./prompts");
const cliches = require("./cliches");

// The questions we ask before writing, so the letter is built from the person's
// real reasons - not invented ones. All optional. {company} is filled in when
// we can spot it in the advert. Kept short and plain-spoken.
const QUESTION_TEMPLATES = [
  { id: "why", q: "What is it about this role or company that genuinely interests you? One honest sentence is plenty." },
  { id: "proof", q: "Which one thing from your career best shows you can do this job? What actually happened, and what was the result?" },
  { id: "move", q: "Why are you looking to move now? (Optional - keep it short and positive.)" },
  { id: "bring", q: "What do you most want them to know about you that your CV doesn't already say?" },
  { id: "extra", q: "Anything specific about the company you want to mention - a product, value, or piece of news you liked?" }
];

// Build the question list, tailoring the wording to the advert where we can.
function buildQuestions({ advertText, cv } = {}) {
  const company = spotCompany(advertText);
  const role = cv?.header?.targetRole || spotRole(advertText) || "this role";
  return QUESTION_TEMPLATES.map((t) => ({
    id: t.id,
    question: t.q
      .replace("this role or company", company ? `${role} at ${company}` : role)
      .replace("the company", company || "the company")
  }));
}

function spotCompany(advert) {
  const s = String(advert || "");
  let m = s.match(/\bat\s+([A-Z][A-Za-z0-9&'.\- ]{2,40}?)(?:\s+(?:is|are|we|as|in|to|for)\b|[.,\n])/);
  if (m) return m[1].trim();
  m = s.match(/\b([A-Z][A-Za-z0-9&'.\-]{2,}(?:\s+[A-Z][A-Za-z0-9&'.\-]+){0,3})\s+is (?:a|an|the|looking|seeking|hiring)\b/);
  return m ? m[1].trim() : null;
}
function spotRole(advert) {
  const m = String(advert || "").match(/\b(?:seeking|hiring|for)\s+(?:an?\s+)?([A-Z][A-Za-z/ ]{3,40}?)(?:\s+to\b|[.,\n])/);
  return m ? m[1].trim() : null;
}

const STYLE_GUIDE = {
  professional: "Professional and polished - clear, credible, recruiter-friendly.",
  warm: "Warm and personable - friendly and human, a natural first-person voice.",
  concise: "Concise and punchy - short, high-impact sentences, no filler.",
  senior: "Confident and senior - authoritative, strategic, an experienced register."
};

// Condense the CV to the facts the letter may draw on (keeps the prompt tight).
function cvDigest(cv) {
  const h = cv.header || {};
  const exp = (cv.experience || []).slice(0, 5).map((r) => {
    const wins = [...(r.achievements || []), ...(r.responsibilities || [])].slice(0, 3);
    return `${r.title || ""} at ${r.company || ""} (${r.dates || ""}): ${wins.join("; ")}`;
  }).join("\n");
  const skills = (cv.skills || []).map((s) => s.skill).join(", ");
  return `Name: ${h.name || ""}\nTarget role: ${h.targetRole || ""}\nProfile: ${cv.personalStatement || ""}\nKey skills: ${skills}\nExperience:\n${exp}`;
}

function offlineStub(cv) {
  const name = cv.header?.name || "";
  return {
    greeting: "Dear Hiring Manager,",
    paragraphs: [
      `I'm applying for the ${cv.header?.targetRole || "role"}, and I think my background lines up well with what you need.`,
      cv.personalStatement || "My experience has given me the skills this job calls for.",
      "I'd welcome the chance to talk it through and show how I could help."
    ],
    signOff: "Yours sincerely,",
    name
  };
}

// Turn the user's question answers into a plain block the model must build on.
function answersBlock(answers) {
  const list = Array.isArray(answers) ? answers : [];
  const good = list.map((a) => ({ q: (a.question || a.q || "").trim(), a: (a.answer || a.a || "").trim() })).filter((x) => x.a);
  if (!good.length) return "";
  return "\n\nWHAT THE CANDIDATE TOLD US (use THESE as the backbone of the letter - their real reasons, in roughly their words; do not overwrite them with generic phrasing):\n" +
    good.map((x) => `• ${x.q}\n  → ${x.a}`).join("\n");
}

async function generate({ cv, advertText, writingStyle, styleSample, answers }) {
  if (!hasKey()) return offlineStub(cv || {});

  const styleLine = STYLE_GUIDE[writingStyle] || STYLE_GUIDE.professional;
  const sampleBlock = (styleSample || "").trim()
    ? `\n\nVOICE SAMPLE - mirror the candidate's own tone and rhythm (not its content):\n"""${String(styleSample).slice(0, 2000)}"""`
    : "";
  const answerText = answersBlock(answers);

  const data = await askJSON({
    system:
      CORE_RULES +
      `\n\nYou are writing a PERSONALISED COVER LETTER to accompany a CV. It must be honest: every claim must be grounded in the candidate's own answers, their CV digest, or the advert. Do NOT invent employers, results, figures or skills.

WRITE LIKE A REAL PERSON, NOT AI. This is the whole point:
- Plain, direct, first person. The way someone actually speaks, not marketing copy.
- Lead with the candidate's OWN reasons from their answers. If they gave you a real story or result, that is the heart of the letter.
- Short paragraphs. THREE or FOUR of them, under 300 words total.
- NEVER open with "I was drawn to", "I am writing to", "I am excited to apply", "I am passionate about", or "I am confident that". Just start with something real.
- No buzzwords, no filler, no "proven track record", no "perfect fit". If a sentence could appear on anyone's letter, cut or rewrite it.
- A warm, plain close - no grovelling, no "thank you for considering my application".
- If the advert names the company or role, use them; otherwise address it "Dear Hiring Manager,".`,
    prompt: `Return JSON exactly:
{"greeting":"Dear Hiring Manager,","paragraphs":["","",""],"signOff":"Yours sincerely,","name":""}

Write in this voice: ${styleLine}${sampleBlock}${answerText}

JOB ADVERT:
"""${(advertText || "").slice(0, 6000)}"""

CANDIDATE CV DIGEST (facts you may draw on):
"""${cvDigest(cv || {}).slice(0, 6000)}"""`,
    maxTokens: 4000
  });

  // The model may return paragraphs as an array OR a single string - normalise.
  let paras = data.paragraphs;
  if (typeof paras === "string") paras = paras.split(/\n\s*\n+/);
  paras = (Array.isArray(paras) ? paras : []).map((p) => String(p || "").trim()).filter(Boolean);
  if (!paras.length && data.body) paras = String(data.body).split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);

  // Silent de-cliché pass: if any banned phrases slipped through, ask the model
  // to rewrite them out (keeping the facts), then scrub the mechanical ones.
  paras = await declichePass(paras, styleLine);
  paras = paras.map((p) => cliches.scrub(p)).filter(Boolean);

  return {
    greeting: cliches.scrub(data.greeting || "Dear Hiring Manager,"),
    paragraphs: paras.length ? paras : ["I'd welcome the chance to talk through how my experience fits what you're looking for."],
    signOff: data.signOff || "Yours sincerely,",
    name: data.name || cv.header?.name || ""
  };
}

// If banned clichés are present, rewrite them out in one pass. Returns the
// original paragraphs unchanged if nothing is flagged or the rewrite fails.
async function declichePass(paras, styleLine) {
  const joined = paras.join("\n\n");
  const hits = cliches.detect(joined);
  if (!hits.length || !hasKey()) return paras;
  try {
    const fixed = await ask({
      system: `You rewrite text to remove clichéd, AI-sounding words and phrases while keeping every fact, name, number and the candidate's meaning identical. Voice: ${styleLine}. Do not add new claims. Keep the same paragraph breaks.`,
      prompt: `Rewrite the cover letter below so it contains NONE of these words/phrases: ${hits.join(", ")}. Replace them with how a normal person would actually say it. Keep it the same length and keep the paragraph breaks (blank line between paragraphs). Return ONLY the rewritten letter text, nothing else.\n\n"""${joined}"""`,
      maxTokens: 2000
    });
    const out = String(fixed || "").split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
    return out.length ? out : paras;
  } catch (_) { return paras; }
}

module.exports = { generate, buildQuestions, QUESTION_TEMPLATES };
