// "Write it up for me" on the master CV builder.
//
// People answer questions, type or speak about a job in their own words, and
// pick a writing style. This turns those words into CV wording in that style.
// The rules are strict: it may only use what the person told us. No new
// employers, numbers, qualifications or claims. Personal details are taken out
// before anything reaches the AI (lib/anthropic.js uses the identity shield).

const ai = require("./anthropic");
const journeys = require("./journeys");
const cliches = require("./cliches");

const STYLES = {
  professional: "PROFESSIONAL & POLISHED: clear, credible and recruiter-friendly. Confident but not flashy.",
  warm: "WARM & PERSONABLE: friendly and human, a natural first-person voice, genuine without being casual.",
  concise: "CONCISE & PUNCHY: short, high-impact sentences, minimal filler, every word earning its place.",
  senior: "CONFIDENT & SENIOR: authoritative and strategic, leadership-focused, the register of an experienced professional.",
};
const styleKey = (s) => (STYLES[s] ? s : "professional");

const RULES = `HONESTY RULES (non-negotiable):
- Use ONLY facts the person gave you. Never add an employer, job title, qualification, number, percentage, award, tool, skill or result they did not state.
- If they gave no numbers, use no numbers. Keep any number exactly as they wrote it.
- You may tidy grammar, order and wording, and turn chatty speech (this may be a voice transcript) into clear CV language.
- UK English spelling. Never use an em dash or en dash; use a comma, a full stop or "and".
- Plain words. Write the way a real, plain-spoken person talks.
${cliches.promptBlock()}`;

const sample = (s) => (String(s || "").trim()
  ? `\n\nVOICE SAMPLE: the person's own writing. Mirror its tone, rhythm and vocabulary (NOT its content):\n"""${String(s).slice(0, 2000)}"""`
  : "");

// ---- tidy-ups that run on every answer -------------------------------------------
const noDashes = (t) => String(t || "").replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",").trim();
const tidy = (t) => cliches.scrub(noDashes(t));

// Any number in the output must already be in what they told us.
function invented(out, source) {
  const nums = (t) => (String(t).match(/\d[\d,.]*/g) || []).map((n) => n.replace(/[.,]$/, "").replace(/,/g, ""));
  const have = new Set(nums(source));
  return nums(out).filter((n) => !have.has(n));
}

// ---- the personal statement ---------------------------------------------------------
// The questions differ by journey (lib/journeys.js). Private answers, such as
// the hours someone needs, are never sent.
async function statement({ answers, current, targetRole, style, styleSample, journey }) {
  const labels = journeys.labelsFor(journey);
  const given = Object.keys(labels)
    .filter((k) => answers && String(answers[k] || "").trim())
    .map((k) => `${labels[k]}: ${String(answers[k]).trim().slice(0, 1200)}`);
  if (!given.length && !String(current || "").trim()) {
    const e = new Error("Answer at least one of the questions first, by typing or recording.");
    e.status = 400; throw e;
  }
  const source = [given.join("\n"), current ? `Their current draft: ${current}` : "", targetRole ? `The kind of job they want: ${targetRole}` : ""].filter(Boolean).join("\n");
  const system = `You write the personal statement at the top of a CV, the master CV writer's statement pass.
Write in the FIRST PERSON, as the person themselves. Three to five short sentences, 50 to 110 words.
Be a person, not a press release: specific, warm and memorable. Lead with who they are and their story, include something they're proud of, how they work, and what they want next. If they shared something real about their life outside work, keep it: it makes them memorable.
${journeys.isJourney(journey) ? journeys.JOURNEYS[journey].statementBrief : "Many people using this are writing their first CV and may have no work history. School, college, caring, sport, volunteering and hobbies all count. Never apologise for a lack of experience."}
WRITING STYLE: ${STYLES[styleKey(style)]}${sample(styleSample)}
${RULES}
Reply with JSON only: {"statement": "..."}`;
  const prompt = `WHAT THEY TOLD US:\n${source}`;
  let out = await ai.askJSON({ system, prompt, maxTokens: 800, model: ai.FAST_MODEL });
  let text = tidy(out && out.statement);
  let bad = invented(text, source);
  let hits = cliches.detect(text);
  if (text && (bad.length || hits.length)) {
    out = await ai.askJSON({ system, prompt: `${prompt}\n\nYOUR LAST TRY broke the rules${bad.length ? `: it used numbers they never gave (${bad.join(", ")})` : ""}${hits.length ? `${bad.length ? " and" : ":"} it used banned phrases (${hits.join(", ")})` : ""}. Write it again without them.`, maxTokens: 800, model: ai.FAST_MODEL });
    text = tidy(out && out.statement);
    bad = invented(text, source); hits = cliches.detect(text);
  }
  if (!text || bad.length) { const e = new Error("We couldn't write that up just now. Please try again, or build it from your answers instead."); e.status = 502; throw e; }
  return { statement: text, warnings: hits };
}

// ---- one job or experience ---------------------------------------------------------
async function job({ job: j, style, styleSample }) {
  const r = j || {};
  const about = String(r.about || "").trim().slice(0, 3000);
  const did = (Array.isArray(r.responsibilities) ? r.responsibilities : String(r.responsibilities || "").split("\n")).map((x) => String(x).trim()).filter(Boolean);
  const won = (Array.isArray(r.achievements) ? r.achievements : String(r.achievements || "").split("\n")).map((x) => String(x).trim()).filter(Boolean);
  if (!about && !did.length && !won.length) {
    const e = new Error("Tell us a bit about it first, by typing or recording, then press the button again.");
    e.status = 400; throw e;
  }
  const source = [
    r.title ? `Role: ${r.title}` : "", r.company ? `Where: ${r.company}` : "", r.dates ? `When: ${r.dates}` : "",
    about ? `In their own words: ${about}` : "",
    did.length ? `What they did:\n- ${did.join("\n- ")}` : "",
    won.length ? `What they achieved:\n- ${won.join("\n- ")}` : "",
  ].filter(Boolean).join("\n");
  const system = `You turn what someone tells you about a job, placement, volunteering role or project into CV bullet points, the master CV writer's job pass.
"responsibilities": what they did, three to six lines. Start each with a doing word (served, cooked, organised, looked after). No "I".
"achievements": results, praise, trust or anything that got better because of them, nought to three lines. Only include one if they actually told you about it. Never make one up.
Each line under 20 words. No full stop at the end of a line.
WRITING STYLE: ${STYLES[styleKey(style)]}${sample(styleSample)}
${RULES}
Reply with JSON only: {"responsibilities": ["..."], "achievements": ["..."]}`;
  const prompt = `WHAT THEY TOLD US:\n${source}`;
  const clean = (o) => ({
    responsibilities: (Array.isArray(o && o.responsibilities) ? o.responsibilities : []).map(tidy).map((x) => x.replace(/[.;]$/, "")).filter(Boolean).slice(0, 8),
    achievements: (Array.isArray(o && o.achievements) ? o.achievements : []).map(tidy).map((x) => x.replace(/[.;]$/, "")).filter(Boolean).slice(0, 4),
  });
  let res = clean(await ai.askJSON({ system, prompt, maxTokens: 900, model: ai.FAST_MODEL }));
  const all = (x) => [...x.responsibilities, ...x.achievements].join("\n");
  let bad = invented(all(res), source);
  if (bad.length || cliches.detect(all(res)).length) {
    res = clean(await ai.askJSON({ system, prompt: `${prompt}\n\nYOUR LAST TRY broke the rules${bad.length ? ` (numbers they never gave: ${bad.join(", ")})` : " (banned phrases)"}. Write it again.`, maxTokens: 900, model: ai.FAST_MODEL }));
    bad = invented(all(res), source);
  }
  if (!res.responsibilities.length || bad.length) { const e = new Error("We couldn't write that up just now. Please try again in a moment."); e.status = 502; throw e; }
  return { ...res, warnings: cliches.detect(all(res)) };
}

// ---- a "prove it" line for a strength they ticked ------------------------------------
async function proof({ strength, words: said, style, styleSample }) {
  const own = String(said || "").trim().slice(0, 1500);
  if (own.split(/\s+/).length < 4) { const e = new Error("Tell us a bit more first: when did you do that, and what happened?"); e.status = 400; throw e; }
  const source = `The strength: ${String(strength || "").slice(0, 120)}\nWhat they told us: ${own}`;
  const system = `You turn someone's example into ONE "prove it" line for a key skill on their CV, the master CV proof pass.
One line, under 22 words. Start with a doing word. No "I". No full stop at the end. Say what they did and, if they told you, what came of it.
WRITING STYLE: ${STYLES[styleKey(style)]}${sample(styleSample)}
${RULES}
Reply with JSON only: {"proof": "..."}`;
  const prompt = `WHAT THEY TOLD US:\n${source}`;
  let line = tidy((await ai.askJSON({ system, prompt, maxTokens: 400, model: ai.FAST_MODEL }) || {}).proof).replace(/[.;]$/, "");
  if (line && (invented(line, own).length || cliches.detect(line).length)) {
    line = tidy((await ai.askJSON({ system, prompt: `${prompt}\n\nYOUR LAST TRY broke the rules. Write it again using only what they said.`, maxTokens: 400, model: ai.FAST_MODEL }) || {}).proof).replace(/[.;]$/, "");
  }
  if (!line || invented(line, own).length) { const e = new Error("We couldn't write that up just now. You can type the line yourself."); e.status = 502; throw e; }
  return { proof: line.slice(0, 300) };
}

// ---- one follow-up question, and what we heard ------------------------------------
// After someone answers a question (or tells us about a job), we play back the
// facts we picked up and ask ONE short question to draw out the detail a
// recruiter wants. It only ever asks. It never suggests an answer.
async function followUp({ question, answer, journey, context }) {
  const said = String(answer || "").trim().slice(0, 2000);
  if (said.split(/\s+/).length < 5) { const e = new Error("Say a bit more first, then we'll ask you a follow-up."); e.status = 400; throw e; }
  const who = journeys.isJourney(journey) ? journeys.JOURNEYS[journey].who : "";
  const system = `You help someone tell their story for their CV by listening and asking one good follow-up question, the master CV follow-up pass.
Who they are: ${who || "a job seeker"}
"heard": two to four short lines playing back the facts they told you, starting "You". Restate ONLY what they said. Never add a number, name, result or skill they didn't say.
"followUp": ONE short, friendly question (under 25 words) that draws out the detail a recruiter would want and that their answer is missing: what they actually did, how many or how much, how long, what changed because of them, who noticed, what they learned. Ask about ONE thing. Never suggest an answer or put words in their mouth. Never ask about health, family circumstances, age or the reason for a career break unless they raised it themselves, and even then never ask for more detail about it. If their answer already has plenty of detail, return an empty string.
Plain, warm UK English. Never use an em dash or en dash.
Reply with JSON only: {"heard": ["..."], "followUp": "..."}`;
  const prompt = `${context ? `${context}\n` : ""}THE QUESTION: ${String(question || "").slice(0, 300)}\nTHEIR ANSWER (may be a voice transcript): ${said}`;
  const out = (await ai.askJSON({ system, prompt, maxTokens: 600, model: ai.FAST_MODEL })) || {};
  const heard = (Array.isArray(out.heard) ? out.heard : []).map(noDashes).map((x) => x.trim()).filter((x) => x && x.length < 220 && !invented(x, said).length).slice(0, 4);
  let q = noDashes(out.followUp || "").trim();
  if (q && (!/\?$/.test(q) || q.length > 220 || invented(q, said).length)) q = "";
  return { heard, followUp: q };
}

// ---- "Your 90 seconds": talking notes for an intro video ---------------------------
// Built from their master CV, in the four parts from Field Guide N\u00b002. Notes to
// talk from, never a script: the guide is clear that reading gives it away.
function cvSource(cv) {
  const out = [];
  const h = cv.header || {};
  if (h.targetRole) out.push(`The job they want: ${h.targetRole}`);
  if (cv.personalStatement) out.push(`Their personal statement: ${cv.personalStatement}`);
  const labels = journeys.labelsFor(cv.journey);
  for (const k of Object.keys(labels)) if (cv.statementAnswers && cv.statementAnswers[k]) out.push(`${labels[k]}: ${cv.statementAnswers[k]}`);
  for (const r of cv.experience || []) {
    const head = r.kind === "break" ? `Career break${r.dates ? `, ${r.dates}` : ""}` : [r.title, r.company, r.dates].filter(Boolean).join(", ");
    const bits = [r.about && `In their words: ${r.about}`, (r.responsibilities || []).length && `Did: ${r.responsibilities.join("; ")}`, (r.achievements || []).length && `Results: ${r.achievements.join("; ")}`].filter(Boolean);
    if (head || bits.length) out.push(`ROLE: ${head}\n${bits.join("\n")}`);
  }
  const proofs = Object.entries(cv.behaviourProof || {});
  if (proofs.length) out.push("Their own examples: " + proofs.map(([, v]) => v).join("; "));
  for (const sk of cv.skills || []) if (sk.proof) out.push(`Skill: ${sk.skill}: ${sk.proof}`);
  if ((cv.education || []).length) out.push("Education: " + cv.education.slice(0, 3).map((e) => [e.qualification, e.dates].filter(Boolean).join(", ")).join("; "));
  if ((cv.interests || []).length) out.push("Interests: " + cv.interests.join("; "));
  return out.join("\n").slice(0, 9000);
}

async function videoPlan({ cv, company, role }) {
  const source = cvSource(cv);
  if (source.split(/\s+/).length < 25) { const e = new Error("Add a bit more to your CV first, especially your story and a job or two, then we can plan your 90 seconds."); e.status = 400; throw e; }
  const jobLine = [role ? `The role: ${role}` : "", company ? `The company: ${company}` : ""].filter(Boolean).join("\n");
  const system = `You plan a 90-second intro video for a job application, the master CV video plan pass. You write TALKING NOTES, not a script: short prompts the person glances at while rehearsing, then puts away.
Four parts, from The Com'mon People's guide:
"intro" (15 to 25 seconds): name, role and company once; one line on how they got here; when they're at their best; one real, specific thing from outside work.
"story1" and "story2" (20 to 30 seconds each): two DIFFERENT work stories showing different skills, each as four lines starting "Where:", "What was going on:", "What I did:", "What changed:". School, college, volunteering, caring, sport and Saturday jobs all count for people with little work history.
"close" (15 to 20 seconds): two or three things they'd bring, said as actions in their own plain words, then "CV attached, happy to chat any time".
RULES (non-negotiable):
- Use ONLY facts they gave you. Never add a number, result, employer, skill or detail they didn't give.
- Where a story is missing something, write the line as a prompt in brackets, such as "What changed: (what got better? a number if you have one)". Never fill the gap yourself.
- Each line under 14 words. Fragments are fine. First person.
- Start the intro with "Hi, I'm [NAME]" exactly, so we can put their name in.
- Never include a home address, date of birth, or the name of a school or college: say "at school" or "at college".
- No "passionate", no "team player", no "I look forward to hearing from you". UK English. Never use an em dash or en dash.
Reply with JSON only: {"intro": ["..."], "story1": ["Where: ...", "..."], "story2": ["..."], "close": ["..."]}`;
  const prompt = `${jobLine ? jobLine + "\n" : ""}WHAT THEY'VE TOLD US:\n${source}`;
  const out = (await ai.askJSON({ system, prompt, maxTokens: 1500, model: ai.FAST_MODEL })) || {};
  const all = source + "\n" + jobLine;
  const clean = (arr) => (Array.isArray(arr) ? arr : []).map(noDashes).map((x) => x.replace(/^[-*\u2022]\s*/, "").trim())
    .filter((x) => x && x.length < 200 && !invented(x, all).length && !cliches.detect(x).length).slice(0, 6);
  const plan = { intro: clean(out.intro), story1: clean(out.story1), story2: clean(out.story2), close: clean(out.close) };
  if (!plan.intro.length && !plan.story1.length) { const e = new Error("We couldn't plan that just now. Please try again in a moment."); e.status = 502; throw e; }
  return plan;
}

module.exports = { statement, job, proof, followUp, videoPlan, cvSource, STYLES, invented, tidy };
