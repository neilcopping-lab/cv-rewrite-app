// ─── Personalised cover letter generator ────────────────────────────────────
// Writes a short, honest cover letter from the candidate's finished CV data and
// the job advert, in their chosen writing voice. Same rule as the CV: nothing
// is invented — every claim must trace back to the CV / their own words.
const { askJSON, hasKey } = require("./anthropic");
const { CORE_RULES } = require("./prompts");

const STYLE_GUIDE = {
  professional: "Professional and polished — clear, credible, recruiter-friendly.",
  warm: "Warm and personable — friendly and human, a natural first-person voice.",
  concise: "Concise and punchy — short, high-impact sentences, no filler.",
  senior: "Confident and senior — authoritative, strategic, an experienced register."
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
      `I am writing to apply for the role. With my background as ${cv.header?.targetRole || "a professional"}, I believe I can make a real contribution.`,
      cv.personalStatement || "My experience has given me the skills this role needs.",
      "I would welcome the chance to discuss how I could help your team, and I thank you for considering my application."
    ],
    signOff: "Yours sincerely,",
    name
  };
}

async function generate({ cv, advertText, writingStyle, styleSample }) {
  if (!hasKey()) return offlineStub(cv || {});

  const styleLine = STYLE_GUIDE[writingStyle] || STYLE_GUIDE.professional;
  const sampleBlock = (styleSample || "").trim()
    ? `\n\nVOICE SAMPLE — mirror the candidate's own tone and rhythm (not its content):\n"""${String(styleSample).slice(0, 2000)}"""`
    : "";

  const data = await askJSON({
    system:
      CORE_RULES +
      `\n\nYou are writing a PERSONALISED COVER LETTER to accompany a CV. It must be honest: every claim must be grounded in the candidate's CV digest below or the advert. Do NOT invent employers, results, figures or skills. Keep it to THREE or FOUR short paragraphs, under 300 words. Structure: (1) a genuine opening that shows why this specific role/organisation appeals, (2) the two or three strongest, real reasons they fit — mapped to what the advert asks for, (3) a warm, confident close with a call to action. If the advert names the company or role, use them; otherwise address it "Dear Hiring Manager,".`,
    prompt: `Return JSON exactly:
{"greeting":"Dear Hiring Manager,","paragraphs":["","",""],"signOff":"Yours sincerely,","name":""}

Write in this voice: ${styleLine}${sampleBlock}

JOB ADVERT:
"""${(advertText || "").slice(0, 6000)}"""

CANDIDATE CV DIGEST (the only facts you may use):
"""${cvDigest(cv || {}).slice(0, 6000)}"""`,
    maxTokens: 4000
  });

  // The model may return paragraphs as an array OR a single string — normalise.
  let paras = data.paragraphs;
  if (typeof paras === "string") paras = paras.split(/\n\s*\n+/);
  paras = (Array.isArray(paras) ? paras : []).map((p) => String(p || "").trim()).filter(Boolean);
  if (!paras.length && data.body) paras = String(data.body).split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);

  return {
    greeting: data.greeting || "Dear Hiring Manager,",
    paragraphs: paras.length ? paras : ["Thank you for considering my application. I would welcome the chance to discuss how my experience fits this role."],
    signOff: data.signOff || "Yours sincerely,",
    name: data.name || cv.header?.name || ""
  };
}

module.exports = { generate };
