// The CV writer, rebuilt (28 Nov 2026).
//
// The old writer did everything in one giant AI call, from the first 9,000
// characters of the CV, and trusted the AI with dates. Long careers lost their
// older roles, dates went wrong and the opening paragraph could contradict
// the rest. This one works in stages, from the career record the person has
// checked at step 2:
//
//   1. Career history: the AI writes the bullet points for each role from
//      that role's own text in the CV, plus anything the person told us.
//      Employer, job title and dates are copied from the record, never
//      written by the AI, and every role the person kept is on the CV.
//   2. Skills and the skills-match, from the finished history (in parallel
//      with 3).
//   3. The personal statement, written last from the finished history, so
//      it can't contradict it.
//   4. A hiring manager's read: fixes repeats and contradictions, and says
//      plainly how the CV lands for this job.
//
// Every line keeps a note of where it came from (your CV, an answer, or your
// story bank), so the person can see it at step 3.
// The honesty check still runs after all of this (server.js).

const { askJSON, hasKey, FAST_MODEL } = require("./anthropic");
const { CORE_RULES } = require("./prompts");
const { EMPTY_CV } = require("./cvGenerator");
const record = require("./careerRecord");

const STYLE_GUIDE = {
  professional: "PROFESSIONAL & POLISHED: clear, credible and recruiter-friendly. Confident but not flashy.",
  warm: "WARM & PERSONABLE: friendly and human, a natural first-person voice, genuine without being casual.",
  concise: "CONCISE & PUNCHY: short, high-impact sentences, minimal filler, every word earning its place.",
  senior: "CONFIDENT & SENIOR: authoritative and strategic, leadership-focused, the register of an experienced professional."
};

const WRITER_RULES = `
HONESTY (hard):
- Use only what is in the role's own CV text and the candidate's answers. Never add a claim, number, scope, team size, sector or result that isn't there.
- Copy every number exactly as the source gives it.
- Never write [MISSING] or leave a gap in a sentence. If you can't say something fully and truthfully, leave that sentence out.
- Don't work out totals or durations the candidate never stated ("five years' experience" from their dates).
- Write in the first person or as plain verb-led bullets, never "he" or "she".
- No em dashes or en dashes. UK spelling.`;

const answerBlock = (answers) => (answers || [])
  .filter((a) => a && a.answer)
  .map((a, i) => `[A${i + 1}] Q: ${a.question || ""}\nA: ${a.answer}`)
  .join("\n\n");

// Where a line came from: "cv", "answer" or "story" (an answer that came out
// of the person's story bank).
function sourceOf(from, answers) {
  const m = /^A(\d+)$/i.exec(String(from || "").trim());
  if (!m) return "cv";
  const a = (answers || []).filter((x) => x && x.answer)[Number(m[1]) - 1];
  return a && a.fromStory ? "story" : "answer";
}

const coreOf = (gaps) => (gaps && gaps.requirements || []).filter((r) => r.core).map((r) => r.requirement);

// ---------- 1. career history ----------
async function writeHistory({ rec, advertText, gaps, answers, styleLine, sampleBlock }) {
  const roles = record.onCv(rec);
  const roleBlock = roles.map((r) => `### ROLE ${r.id} (${r.level === "full" ? "FULL: up to 6 bullets" : "SHORT: 1 or 2 bullets, the most relevant to this job"})
${r.title} | ${r.company} | ${r.dates}
CV TEXT FOR THIS ROLE:
"""${(r.source || "(none: the candidate added this role themselves; only use what their answers say about it)").slice(0, 6000)}"""`).join("\n\n");

  const data = await askJSON({
    system: CORE_RULES + "\n\nYou are the career-history pass. You write the bullet points for each role, one role at a time, from that role's own text." + WRITER_RULES,
    prompt: `Write the bullets for EVERY role listed below. Return one entry per role id, in the same order. Do not skip any role, do not merge roles, do not invent roles.

For each role:
- "responsibilities": what they did, verb-led, tailored to the job advert where it's true.
- "achievements": results, with the numbers the source gives.
- Each bullet is {"text":"...","from":"cv"} or {"text":"...","from":"A3"} when it comes from answer A3.
- Put first whatever shows the advert's CORE REQUIREMENTS (listed below), for example leading and developing a team. If the candidate's answers describe this role in more detail (team size, offices, coaching, results), use those answers under this role.
- FULL roles: up to 6 bullets in total, keep every achievement with a number. SHORT roles: 1 or 2 bullets in total.
- Never repeat the same fact in two roles.

Also return:
- "education": each qualification from EDUCATION below, as {"qualification":"","institution":"","dates":"","grade":""}, copied, not reworded. Add any qualification the candidate gives in their answers.
- "interests": 3 to 6 real interests, as {"text":"","from":"cv"|"A2"}. Use the CV's interests and anything the candidate says in their answers. Keep their meaning, tidy the wording. Never add an interest they didn't give.

Return JSON:
{"roles":[{"id":"r1","responsibilities":[{"text":"","from":"cv"}],"achievements":[{"text":"","from":"cv"}]}],"education":[{"qualification":"","institution":"","dates":"","grade":""}],"interests":[{"text":"","from":"cv"}]}

WRITING STYLE: ${styleLine}${sampleBlock}

CORE REQUIREMENTS OF THE JOB:
${coreOf(gaps).map((r) => "- " + r).join("\n") || "- (see advert)"}

JOB ADVERT:
"""${String(advertText || "").slice(0, 20000)}"""

ROLES:
${roleBlock}

EDUCATION (from the CV):
${(rec.education || []).map((e) => "- " + e.text + (e.dates ? ` (${e.dates})` : "")).join("\n") || "- (none listed)"}

INTERESTS (from the CV):
${(rec.interests || []).map((x) => "- " + x).join("\n") || "- (none listed)"}

CANDIDATE ANSWERS:
"""${answerBlock(answers).slice(0, 30000) || "(none)"}"""`,
    maxTokens: 16000,
  });
  return data || {};
}

// Build the experience section: facts from the record, bullets from the AI.
// Every kept role appears, in the record's order, whatever the AI returned.
function assembleHistory(rec, written, answers) {
  const byId = new Map(((written && written.roles) || []).map((r) => [String(r.id), r]));
  return record.onCv(rec).map((r) => {
    const w = byId.get(r.id) || {};
    const lines = (arr) => (Array.isArray(arr) ? arr : [])
      .map((b) => (typeof b === "string" ? { text: b, from: "cv" } : b))
      .filter((b) => b && String(b.text || "").trim());
    const resp = lines(w.responsibilities), ach = lines(w.achievements);
    const cap = r.level === "full" ? 6 : 2;
    const keepAch = ach.slice(0, r.level === "full" ? 4 : 1);
    const keepResp = resp.slice(0, Math.max(0, cap - keepAch.length));
    return {
      company: r.company,
      title: r.title,
      dates: r.dates,
      location: r.location,
      responsibilities: keepResp.map((b) => String(b.text).trim()),
      achievements: keepAch.map((b) => String(b.text).trim()),
      reasonForLeaving: null,
      roleId: r.id,
      level: r.level,
      sources: {
        responsibilities: keepResp.map((b) => sourceOf(b.from, answers)),
        achievements: keepAch.map((b) => sourceOf(b.from, answers)),
      },
    };
  });
}

// ---------- 2. skills and skills-match ----------
async function writeSkills({ cv, advertText, gaps, answers, styleLine }) {
  return askJSON({
    system: CORE_RULES + "\n\nYou are the skills pass. You pick the candidate's strongest real skills for this job, each with proof from their finished career history." + WRITER_RULES,
    prompt: `From the FINISHED CAREER HISTORY and the candidate's answers, write:
- "skills": 6 to 8 key skills for THIS job, in the advert's own terms where true. Each {"skill":"","proof":"one line of real proof","from":"cv"|"A2"}. Lead with the CORE REQUIREMENTS. Use each figure (like a percentage or a £ amount) in at most ONE skill.
- "skillsMatch": one row per ESSENTIAL requirement in the advert that the candidate can genuinely prove: {"requirement":"the advert's words, short","proof":"one short line"}. At most 10. Don't reuse a proof line word for word from the skills.
- "matchReport": one row for EVERY requirement in the GAP ANALYSIS, same order: {"requirement":"","status":"strong"|"partial"|"gap","evidence":"max 20 words"}. "strong" = clear evidence with an example or result, "partial" = some but thin or indirect, "gap" = none. Never upgrade without real evidence.

Return JSON: {"skills":[{"skill":"","proof":"","from":"cv"}],"skillsMatch":[{"requirement":"","proof":""}],"matchReport":[{"requirement":"","status":"strong","evidence":""}]}

WRITING STYLE: ${styleLine}

CORE REQUIREMENTS: ${coreOf(gaps).join("; ") || "(see advert)"}

GAP ANALYSIS:
${JSON.stringify((gaps && gaps.requirements) || []).slice(0, 8000)}

JOB ADVERT:
"""${String(advertText || "").slice(0, 20000)}"""

FINISHED CAREER HISTORY:
${historyText(cv)}

CANDIDATE ANSWERS:
"""${answerBlock(answers).slice(0, 30000) || "(none)"}"""`,
    maxTokens: 8000,
  });
}

function historyText(cv) {
  return (cv.experience || []).map((r) => `${r.title} | ${r.company} | ${r.dates}\n${[...r.responsibilities, ...r.achievements].map((b) => "- " + b).join("\n")}`).join("\n\n");
}

// ---------- 3. personal statement (last) ----------
async function writeStatement({ cv, rec, cvText, advertText, gaps, answers, styleLine, sampleBlock }) {
  const timeline = (rec.roles || []).map((r) => `- ${r.title}, ${r.company}: ${r.dates || "dates not given"}`).join("\n");
  return askJSON({
    system: CORE_RULES + "\n\nYou are the personal-statement pass. You write the opening paragraph LAST, from the finished CV, so it matches it exactly." + WRITER_RULES,
    prompt: `Write:
- "personalStatement": at most 3 sentences, in the candidate's voice (first person), for THIS job. Open with what the job is most about (the CORE REQUIREMENTS) and the candidate's real evidence for it. Use their own words from their CV's profile and their answers where you can.
  Facts must match the TIMELINE exactly: say what they do now in the present tense, and say how long they've done something ONLY in the words their CV or answers use ("nine years in recruitment", "15 years in hospitality management"). Never invent a duration like "the last few years".
- "header": {"name":"","contacts":{"email":"","phone":"","location":""}} copied from the CV (placeholders like [NAME] stay exactly as written). location = town only.

Return JSON: {"personalStatement":"","header":{"name":"","contacts":{"email":"","phone":"","location":""}}}

WRITING STYLE: ${styleLine}${sampleBlock}

CORE REQUIREMENTS: ${coreOf(gaps).join("; ") || "(see advert)"}

TIMELINE (facts, checked by the candidate):
${timeline}

THE TOP OF THEIR CV (profile and contact details, their own words):
"""${String(cvText || "").slice(0, 4000)}"""

FINISHED CAREER HISTORY:
${historyText(cv).slice(0, 20000)}

JOB ADVERT:
"""${String(advertText || "").slice(0, 12000)}"""

CANDIDATE ANSWERS:
"""${answerBlock(answers).slice(0, 20000) || "(none)"}"""`,
    maxTokens: 3000,
  });
}

// ---------- 4. hiring manager's read ----------
// Reads the finished CV as the hiring manager would. It may only rewrite the
// statement using facts already in the CV, and drop lines that repeat a fact
// made elsewhere. Anything it changes is honesty-checked afterwards.
async function hiringManagerRead({ cv, advertText, gaps }) {
  const lines = [];
  (cv.experience || []).forEach((r) => [...r.responsibilities, ...r.achievements].forEach((b) => lines.push(`[${r.roleId}] ${b}`)));
  return askJSON({
    system: "You are the hiring manager for the job advert below, reading a candidate's CV carefully. You are fair, specific and honest. You never add facts.",
    prompt: `Read this CV as the hiring manager for this job. Return JSON:
{
  "verdict": "2 sentences: how this CV lands for this job, and the one thing that would most strengthen it",
  "issues": ["specific problems: contradictions (dates, durations, what they do now), the same fact or figure repeated, anything that doesn't make sense, the job's core requirement not obvious on page one"],
  "statement": "a corrected personal statement ONLY if the current one contradicts the CV, repeats itself or buries what this job is most about; otherwise \\"\\". Use only facts already in the CV, first person, max 3 sentences",
  "dropLines": ["exact text of any history line that repeats a fact already made in another line (keep the one in the role it belongs to)"],
  "dropSkills": ["exact skill name of any key skill whose proof repeats another skill's proof"]
}

CORE REQUIREMENTS: ${coreOf(gaps).join("; ") || "(see advert)"}

JOB ADVERT:
"""${String(advertText || "").slice(0, 12000)}"""

CV:
Headline: ${cv.header && cv.header.targetRole}
Statement: ${cv.personalStatement}
Skills:
${(cv.skills || []).map((s) => `- ${s.skill}: ${s.proof}`).join("\n")}
History:
${historyText(cv)}`,
    maxTokens: 4000,
    model: FAST_MODEL,
  }).catch(() => ({}));
}

function applyRead(cv, read) {
  if (!read) return cv;
  const drop = new Set((read.dropLines || []).map((t) => String(t).replace(/^\[[^\]]*\]\s*/, "").trim().toLowerCase()));
  (cv.experience || []).forEach((r) => {
    const next = {};
    let left = 0;
    for (const k of ["responsibilities", "achievements"]) {
      next[k] = { keep: [], src: [] };
      (r[k] || []).forEach((b, i) => { if (!drop.has(String(b).trim().toLowerCase())) { next[k].keep.push(b); next[k].src.push((r.sources && r.sources[k] || [])[i]); } });
      left += next[k].keep.length;
    }
    // Never empty a role on the reader's say-so.
    if (!left && ((r.responsibilities || []).length + (r.achievements || []).length)) return;
    r.sources = r.sources || {};
    for (const k of ["responsibilities", "achievements"]) { r[k] = next[k].keep; r.sources[k] = next[k].src; }
  });
  const dropSkills = new Set((read.dropSkills || []).map((t) => String(t).trim().toLowerCase()));
  if (dropSkills.size && (cv.skills || []).length > 4) cv.skills = cv.skills.filter((s) => !dropSkills.has(String(s.skill).trim().toLowerCase()));
  if (read.statement && String(read.statement).trim().length > 40) { cv.personalStatement = String(read.statement).trim(); cv.statementBy = "hiring-manager-read"; }
  cv.read = { verdict: String(read.verdict || "").trim(), issues: (read.issues || []).map(String).filter(Boolean).slice(0, 8) };
  return cv;
}

// ---------- the whole thing ----------
async function write(st) {
  if (!hasKey()) return EMPTY_CV();
  const rec = st.record;
  const answers = st.answers || [];
  const styleLine = STYLE_GUIDE[st.writingStyle] || STYLE_GUIDE.professional;
  const sampleBlock = (st.styleSample || "").trim()
    ? `\n\nVOICE SAMPLE - the candidate's own writing. Mirror its tone, rhythm and vocabulary (NOT its content):\n"""${String(st.styleSample).slice(0, 2500)}"""`
    : "";

  const written = await writeHistory({ rec, advertText: st.advertText, gaps: st.gaps, answers, styleLine, sampleBlock });
  const cv = EMPTY_CV();
  cv.experience = assembleHistory(rec, written, answers);
  cv.education = (written.education || []).map((e) => ({ qualification: String(e.qualification || "").trim(), institution: String(e.institution || "").trim(), dates: String(e.dates || "").trim(), grade: String(e.grade || "").trim() })).filter((e) => e.qualification || e.institution);
  if (!cv.education.length) cv.education = (rec.education || []).map((e) => ({ qualification: e.text, institution: "", dates: e.dates || "", grade: "" }));
  const ints = (written.interests || []).map((x) => (typeof x === "string" ? { text: x, from: "cv" } : x)).filter((x) => x && String(x.text || "").trim()).slice(0, 6);
  cv.interests = ints.map((x) => String(x.text).trim());
  cv.interestSources = ints.map((x) => sourceOf(x.from, answers));

  const [skills, statement] = await Promise.all([
    writeSkills({ cv, advertText: st.advertText, gaps: st.gaps, answers, styleLine }),
    writeStatement({ cv, rec, cvText: st.cvText, advertText: st.advertText, gaps: st.gaps, answers, styleLine, sampleBlock }),
  ]);
  cv.skills = (skills.skills || []).filter((s) => s && s.skill).map((s) => ({ skill: String(s.skill).trim(), proof: String(s.proof || "").trim() }));
  cv.skillSources = (skills.skills || []).filter((s) => s && s.skill).map((s) => sourceOf(s.from, answers));
  cv.skillsMatch = (skills.skillsMatch || []).filter((m) => m && m.requirement && m.proof);
  cv.matchReport = skills.matchReport || [];
  cv.personalStatement = String(statement.personalStatement || "").trim();
  const h = statement.header || {};
  cv.header = { ...cv.header, name: h.name || rec.name || "", contacts: h.contacts || {} };
  // The line under the name: the person's real current title, unless they've
  // chosen something else. Never the advert's job title by default.
  cv.header.targetRole = st.headline || rec.currentTitle || "";

  applyRead(cv, await hiringManagerRead({ cv, advertText: st.advertText, gaps: st.gaps }));
  cv.missing = [];
  return cv;
}

module.exports = { write, assembleHistory, applyRead, sourceOf, writeHistory };
