// "Upload my CV" in the CV builder: reads an existing CV into the builder, so
// people start from what they've got instead of a blank page.
//
// Contact details are picked out here with simple patterns and never sent to
// the AI. The rest is copied into the builder's sections by the AI, under the
// usual rules: copy, don't write. No new employers, numbers, qualifications or
// claims. Any line with a number that isn't in the original is dropped.

const ai = require("./anthropic");
const masterCv = require("./masterCv");
const { invented } = require("./masterWriter");
// Copy as written: only dashes are swapped. Clichés are left in on purpose, so
// the health check can point them out and the person decides what to change.
const tidy = (t) => String(t || "").replace(/\s*[\u2014\u2013]\s*/g, ", ").replace(/,\s*,/g, ",").trim();

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE = /(?<![\w+(])(?:\+44\s?\(?0?\)?\s?|0)\d(?:[\s().-]{0,2}\d){8,10}(?!\d)/;
const LINKEDIN = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_%-]+\/?/i;
const NOT_NAME = /\b(curriculum|vitae|resume|cv|profile|personal|statement|summary|contact|details|experience|education|skills|address|email|phone|mobile|objective|references)\b/i;

// The person's name: the first short line near the top that looks like one.
function nameFrom(text) {
  const lines = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 6);
  for (const l of lines) {
    const t = l.replace(/^(name\s*[:\-]\s*)/i, "").trim();
    if (t.length < 4 || t.length > 50 || NOT_NAME.test(t) || /[@\d|,:;/]/.test(t)) continue;
    const w = t.split(/\s+/);
    if (w.length >= 2 && w.length <= 4 && w.every((x) => /^[A-Za-zÀ-ÿ'’.-]+$/.test(x))) return t.split(/\s+/).map((x) => (x === x.toUpperCase() && x.length > 2 ? x.charAt(0) + x.slice(1).toLowerCase() : x)).join(" ");
  }
  return "";
}

function headerFrom(text) {
  const t = String(text || "");
  const li = (t.match(LINKEDIN) || [])[0] || "";
  return {
    name: nameFrom(t),
    contacts: { email: (t.match(EMAIL) || [])[0] || "", phone: ((t.match(PHONE) || [])[0] || "").trim(), location: "" },
    linkedin: li ? (/^https?:/i.test(li) ? li : "https://" + li) : null,
  };
}

const SYSTEM = `You copy an existing CV into a structured form, the master CV import pass.
COPY, DON'T WRITE. Keep the person's own wording wherever you can. Tidy only obvious typos and spacing.
- "personalStatement": their profile or summary paragraph, as written. Empty string if there isn't one.
- "experience": every job, placement, volunteering role or career break, latest first. For each: "title", "company", "location", "dates" (as written), "responsibilities" (what they did, one line each), "achievements" (results, awards, praise or things that got better, one line each, ONLY lines that already describe a result), "reasonForLeaving" (only if stated), and "kind": "break" for a career break or time out, otherwise "".
- "skills": key skills they list, each {"skill": "...", "proof": "..."}; "proof" only if the CV gives an example for that skill, otherwise "".
- "education": each {"qualification", "institution", "dates", "grade"}, as written.
- "interests": their interests and hobbies, one per item.
RULES (non-negotiable):
- Never add an employer, job title, qualification, number, percentage, award, skill or result that isn't in the CV.
- Never include names, email addresses, phone numbers, home addresses or links. Leave them out completely.
- Never use an em dash or en dash. UK English.
Reply with JSON only: {"personalStatement": "", "experience": [], "skills": [], "education": [], "interests": []}`;

// Drops any line whose numbers aren't in the original CV.
function honest(cv, source) {
  const ok = (t) => !invented(String(t || ""), source).length;
  const keep = (arr) => (arr || []).map((x) => tidy(x)).filter((x) => x && ok(x));
  return {
    personalStatement: ok(cv.personalStatement) ? tidy(cv.personalStatement) : "",
    experience: (cv.experience || []).map((r) => ({
      title: r.title, company: r.company, location: r.location, dates: ok(r.dates) ? r.dates : "",
      responsibilities: keep(r.responsibilities), achievements: keep(r.achievements),
      reasonForLeaving: ok(r.reasonForLeaving) ? r.reasonForLeaving : "", kind: r.kind === "break" ? "break" : "",
    })),
    skills: (cv.skills || []).filter((s) => s && s.skill && ok(s.skill)).map((s) => ({ skill: s.skill, proof: ok(s.proof) ? tidy(s.proof) : "" })),
    education: (cv.education || []).map((e) => ({ ...e, dates: ok(e && e.dates) ? e.dates : "", grade: ok(e && e.grade) ? e.grade : "" })),
    interests: keep(cv.interests),
  };
}

async function read(text) {
  const source = String(text || "").replace(/\r\n?/g, "\n").trim().slice(0, 20000);
  if (source.length < 80) {
    const e = new Error("We couldn't find much writing in that file. If it's a scan or a photo, try a Word version, or start from scratch.");
    e.status = 400; throw e;
  }
  const parsed = await ai.askJSON({ system: SYSTEM, prompt: `THE CV:\n"""\n${source}\n"""`, maxTokens: 6000, model: ai.FAST_MODEL });
  if (!parsed || typeof parsed !== "object") { const e = new Error("We couldn't read that CV just now. Please try again in a moment."); e.status = 502; throw e; }
  const body = honest(parsed, source);
  // Whatever the AI returned, contact details come only from our own patterns.
  return masterCv.normalise({ ...body, header: headerFrom(source) });
}

module.exports = { read, headerFrom, nameFrom };
