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
// of the person's story bank). We check the words ourselves rather than trust
// the AI's label: the line goes to whichever source shares most of its
// distinctive words. The AI's label only settles a tie.
const STOPW = new Set("the and for with from that this have has had was were are our their they them into over across within about after before also such than then which while where when what who whom your you yours of to in on at by as an a or it its is be been being".split(" "));
const keyWords = (t) => [...new Set(String(t || "").toLowerCase().replace(/[^a-z0-9£%\s]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !STOPW.has(w)))];
function attribute(text, cvText, answers, from) {
  const words = keyWords(text);
  if (!words.length) return sourceOf(from, answers);
  const share = (src) => { const s = " " + String(src || "").toLowerCase().replace(/[^a-z0-9£%\s]/g, " ").replace(/\s+/g, " ") + " "; return words.filter((w) => s.includes(" " + w + " ")).length / words.length; };
  const cvShare = share(cvText);
  // Words the line shares with an answer but that aren't anywhere in the CV
  // mean the line includes something they told us.
  const cvFlat = " " + String(cvText || "").toLowerCase().replace(/[^a-z0-9£%\s]/g, " ").replace(/\s+/g, " ") + " ";
  const inCv = (w) => cvFlat.includes(" " + w + " ");
  const onlyAnswer = (a) => { const s = " " + String(a || "").toLowerCase().replace(/[^a-z0-9£%\s]/g, " ").replace(/\s+/g, " ") + " "; return words.filter((w) => s.includes(" " + w + " ") && !inCv(w)).length; };
  const answered = (answers || []).filter((x) => x && x.answer);
  const mixed = answered.map((a, i) => [onlyAnswer(a.answer), i]).sort((x, y) => y[0] - x[0])[0];
  if (mixed && mixed[0] >= 2) return answered[mixed[1]].fromStory ? "story" : "answer";
  let best = -1, bestShare = 0;
  (answers || []).filter((x) => x && x.answer).forEach((a, i) => { const v = share(a.answer); if (v > bestShare) { bestShare = v; best = i; } });
  if (best >= 0 && bestShare > cvShare + 0.1) return (answers.filter((x) => x && x.answer)[best].fromStory ? "story" : "answer");
  if (cvShare > bestShare + 0.1) return "cv";
  return sourceOf(from, answers);
}
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
  const isNow = (d) => /\b(present|now|current|to date|today)\b/i.test(String(d || ""));
  const roleBlock = roles.map((r) => `### ROLE ${r.id} (${r.level === "full" ? "FULL: up to 6 bullets" : "SHORT: 1 or 2 bullets, the most relevant to this job"}; ${isNow(r.dates) ? "CURRENT ROLE: responsibilities in the present tense" : "PAST ROLE: everything in the past tense"})
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
- Tense: each role's heading says CURRENT or PAST. CURRENT role: responsibilities in the present tense ("Lead", "Connect"). PAST roles: past tense ("Led", "Generated"). Achievements are always in the past tense ("Built", "Authored"), even in the current role.
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
function assembleHistory(rec, written, answers, cvText) {
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
        responsibilities: keepResp.map((b) => attribute(b.text, cvText, answers, b.from)),
        achievements: keepAch.map((b) => attribute(b.text, cvText, answers, b.from)),
      },
    };
  });
}

// ---------- 2. skills and skills-match ----------
async function writeSkills({ cv, advertText, gaps, answers, styleLine }) {
  return askJSON({
    system: CORE_RULES + "\n\nYou are the skills pass. You pick the candidate's strongest real skills for this job, each with proof from their finished career history." + WRITER_RULES,
    prompt: `From the FINISHED CAREER HISTORY and the candidate's answers, write:
- "skills": 6 to 8 key skills for THIS job, in the advert's own terms where true. Each {"skill":"","proof":"up to 14 words of real proof","from":"cv"|"A2"}. Lead with the CORE REQUIREMENTS. The proof points to the evidence briefly (where and what), it does NOT copy a history line word for word. Use each figure (like a percentage or a £ amount) in at most ONE skill.
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
async function writeStatement({ cv, rec, cvText, advertText, gaps, answers, styleLine, sampleBlock, feedback }) {
  const timeline = (rec.roles || []).map((r) => `- ${r.title}, ${r.company}: ${r.dates || "dates not given"}`).join("\n");
  return askJSON({
    system: CORE_RULES + "\n\nYou are the personal-statement pass. You write the opening paragraph LAST, from the finished CV, so it matches it exactly." + WRITER_RULES,
    prompt: `Write:
- "personalStatement": at most 3 sentences, in the candidate's voice (first person), for THIS job. Open with what the job is most about (the CORE REQUIREMENTS) and the candidate's real evidence for it. Use their own words from their CV's profile and their answers where you can.
  Facts must match the TIMELINE exactly: say what they do now in the present tense, and say how long they've done something ONLY in the words their CV or answers use ("nine years in recruitment", "15 years in hospitality management"). Never invent a duration like "the last few years".
  Every claim names a real example from the finished history (an employer, a team, a number). No generic lines like "a track record of delivering measurable results" or "strong stakeholder management".
- "header": {"name":"","contacts":{"email":"","phone":"","location":""}} copied from the CV (placeholders like [NAME] stay exactly as written). location = town only.

Return JSON: {"personalStatement":"","header":{"name":"","contacts":{"email":"","phone":"","location":""}}}
${feedback ? `\nA HIRING MANAGER READ YOUR LAST VERSION AND SAID:\n${feedback}\nFix what you can with facts that are ALREADY in the finished history or the answers. If a point asks for something the candidate hasn't given us (a target, a number, a team they didn't mention), ignore that point: never fill a gap with a claim.\n` : ""}

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
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const lines = [];
  (cv.experience || []).forEach((r) => [...r.responsibilities, ...r.achievements].forEach((b) => lines.push(`[${r.roleId}] ${b}`)));
  return askJSON({
    system: `You are the hiring manager for the job advert below, reading a candidate's CV carefully. You are fair, specific and honest. You never add facts. Today is ${today}.`,
    prompt: `Read this CV as the hiring manager for this job. Return JSON:
{
  "verdict": "2 sentences: how this CV lands for this job, and the one thing that would most strengthen it",
  "issues": ["specific problems: the same fact or figure repeated, anything that doesn't make sense, a claim with no example behind it, the job's core requirement not obvious on page one. The employers, job titles and dates have been checked by the candidate against their own CV, so never question those"],
  "statementIssues": ["problems with the opening paragraph only: it contradicts the history, is generic, or doesn't open with what this job is most about. [] if it's fine"],
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
  cv.experience = assembleHistory(rec, written, answers, st.cvText);
  cv.education = (written.education || []).map((e) => ({ qualification: String(e.qualification || "").trim(), institution: String(e.institution || "").trim(), dates: String(e.dates || "").trim(), grade: String(e.grade || "").trim() })).filter((e) => e.qualification || e.institution);
  if (!cv.education.length) cv.education = (rec.education || []).map((e) => ({ qualification: e.text, institution: "", dates: e.dates || "", grade: "" }));
  const ints = (written.interests || []).map((x) => (typeof x === "string" ? { text: x, from: "cv" } : x)).filter((x) => x && String(x.text || "").trim()).slice(0, 6);
  cv.interests = ints.map((x) => String(x.text).trim());
  cv.interestSources = ints.map((x) => attribute(x.text, st.cvText, answers, x.from));

  const [skills, statement] = await Promise.all([
    writeSkills({ cv, advertText: st.advertText, gaps: st.gaps, answers, styleLine }),
    writeStatement({ cv, rec, cvText: st.cvText, advertText: st.advertText, gaps: st.gaps, answers, styleLine, sampleBlock }),
  ]);
  cv.skills = (skills.skills || []).filter((s) => s && s.skill).map((s) => ({ skill: String(s.skill).trim(), proof: String(s.proof || "").trim() }));
  cv.skillSources = (skills.skills || []).filter((s) => s && s.skill).map((s) => attribute(s.proof, st.cvText, answers, s.from));
  cv.skillsMatch = (skills.skillsMatch || []).filter((m) => m && m.requirement && m.proof);
  cv.matchReport = skills.matchReport || [];
  cv.personalStatement = String(statement.personalStatement || "").trim();
  const h = statement.header || {};
  cv.header = { ...cv.header, name: h.name || rec.name || "", contacts: h.contacts || {} };
  // The line under the name: the person's real current title, unless they've
  // chosen something else. Never the advert's job title by default.
  cv.header.targetRole = st.headline || rec.currentTitle || "";

  const read = await hiringManagerRead({ cv, advertText: st.advertText, gaps: st.gaps });
  applyRead(cv, read);
  // If the hiring manager had a problem with the opening paragraph, the
  // statement pass writes it again with that feedback (it never rewrites it
  // itself, so the facts stay tied to the checked timeline).
  const sIssues = ((read && read.statementIssues) || []).map(String).filter(Boolean);
  if (sIssues.length) {
    const again = await writeStatement({ cv, rec, cvText: st.cvText, advertText: st.advertText, gaps: st.gaps, answers, styleLine, sampleBlock, feedback: sIssues.map((x) => "- " + x).join("\n") }).catch(() => null);
    if (again && String(again.personalStatement || "").trim().length > 40) { cv.statementFirst = cv.personalStatement; cv.personalStatement = String(again.personalStatement).trim(); }
    cv.read.issues = [...sIssues, ...(cv.read.issues || [])].slice(0, 8);
  }
  cv.missing = [];
  return cv;
}

module.exports = { write, assembleHistory, applyRead, sourceOf, attribute, writeHistory };
