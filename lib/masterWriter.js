// "Write it up for me" on the master CV builder.
//
// People answer questions, type or speak about a job in their own words, and
// pick a writing style. This turns those words into CV wording in that style.
// The rules are strict: it may only use what the person told us. No new
// employers, numbers, qualifications or claims. Personal details are taken out
// before anything reaches the AI (lib/anthropic.js uses the identity shield).

const ai = require("./anthropic");
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
const QUESTION_LABELS = {
  story: "Your story so far", proud: "What you're proud of", care: "What matters to you",
  best: "Where you do your best work", next: "What you want next", real: "The real you",
};

async function statement({ answers, current, targetRole, style, styleSample }) {
  const given = Object.keys(QUESTION_LABELS)
    .filter((k) => answers && String(answers[k] || "").trim())
    .map((k) => `${QUESTION_LABELS[k]}: ${String(answers[k]).trim().slice(0, 900)}`);
  if (!given.length && !String(current || "").trim()) {
    const e = new Error("Answer at least one of the questions first, by typing or recording.");
    e.status = 400; throw e;
  }
  const source = [given.join("\n"), current ? `Their current draft: ${current}` : "", targetRole ? `The kind of job they want: ${targetRole}` : ""].filter(Boolean).join("\n");
  const system = `You write the personal statement at the top of a CV, the master CV writer's statement pass.
Write in the FIRST PERSON, as the person themselves. Three to five short sentences, 50 to 110 words.
Be a person, not a press release: specific, warm and memorable. Lead with who they are and their story, include something they're proud of, how they work, and what they want next. If they shared something real about their life outside work, keep it: it makes them memorable.
Many people using this are writing their first CV and may have no work history. School, college, caring, sport, volunteering and hobbies all count. Never apologise for a lack of experience.
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

module.exports = { statement, job, STYLES, invented, tidy };
