// The career record: the facts the whole CV is built on.
//
// Before anything is written, we pull every role out of the person's CV with
// its employer, job title and dates copied exactly, plus their education and
// interests. Then we check every one of those facts is really in the CV text
// (no AI involved in the check). The person sees the list at step 2, can
// correct it, and chooses how much space each role gets. The writer then
// works from this record: employers, titles and dates are copied from it onto
// the CV, never written by the AI, and no role can go missing.
//
// Why: the old writer read only the first 9,000 characters of a CV, so long
// careers lost their older roles, and it could get dates wrong.

const { askJSON, hasKey } = require("./anthropic");

const LEVELS = ["full", "short", "out"]; // how much space a role gets

const norm = (s) => String(s || "")
  .toLowerCase()
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[–—−]/g, "-")
  .replace(/\s+/g, " ")
  .trim();

// Is this short piece of text in the CV? Spacing, curly quotes and dash types
// are ignored; so is a trailing full stop.
function found(piece, cvNorm) {
  const p = norm(piece).replace(/[.,;:]+$/, "");
  if (!p) return true;
  return cvNorm.includes(p);
}

// The years in a date range must all be in the CV, and when the CV spells the
// range out we want it exactly. Returns "exact" | "years" | "missing".
function dateMatch(dates, cvNorm) {
  const d = norm(dates);
  if (!d) return "missing";
  if (cvNorm.includes(d)) return "exact";
  // Reworded but the same range ("2015 - 2017" for "2015 to 2017"): all its
  // years must sit together in the CV, not just appear somewhere in it.
  const years = d.match(/\b(19|20)\d\d\b/g) || [];
  if (!years.length) return "missing";
  let at = cvNorm.indexOf(years[0]);
  while (at !== -1) {
    const win = cvNorm.slice(Math.max(0, at - 40), at + 60);
    if (years.every((y) => win.includes(y))) return "years";
    at = cvNorm.indexOf(years[0], at + 1);
  }
  return "missing";
}

// Date ranges written in the CV ("March 2015 to September 2017", "2009 to
// 2010", "1999 - 2007", "2026 to Present"). Used to spot a role the extractor
// may have missed.
const RANGE = /\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(19|20)\d\d\s*(?:to|-|until|through)\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(?:(?:19|20)\d\d|present|now|current|date|today)\b/gi;
function dateRangesIn(text) {
  return [...norm(text).matchAll(RANGE)].map((m) => m[0]);
}

// Check every fact against the CV text. Adds `checks` (what we couldn't find)
// to each role, and a list of warnings for the record as a whole.
function verify(record, cvText) {
  const cvNorm = norm(cvText);
  const roles = (record.roles || []).map((r) => {
    const checks = [];
    if (r.company && !found(r.company, cvNorm)) checks.push("employer");
    if (r.title && r.kind !== "break" && !found(r.title, cvNorm)) checks.push("title");
    const dm = dateMatch(r.dates, cvNorm);
    if (dm === "missing") checks.push("dates");
    return { ...r, checks, datesExact: dm === "exact" };
  });
  const warnings = [];
  // A range in the CV that no role (or qualification) accounts for may be a
  // role we missed. We say so rather than guess.
  const known = [...roles.map((r) => norm(r.dates)), ...(record.education || []).map((e) => norm(e.dates || e.text))].filter(Boolean);
  const loose = dateRangesIn(cvText).filter((rng) => !known.some((k) => k.includes(rng) || rng.includes(k)));
  if (loose.length) warnings.push(`Your CV mentions ${loose.slice(0, 3).map((x) => `"${x}"`).join(", ")}, which isn't on this list. If that's a role, add it below.`);
  return { ...record, roles, warnings };
}

// First pass at how much space each role gets. Every role is kept; the person
// changes these at step 2.
function defaultLevel(role, i) {
  if (role.relevance === "high") return "full";
  if (i < 2) return "full";
  return "short";
}

function clean(record) {
  const roles = (record.roles || [])
    .filter((r) => r && (r.company || r.title))
    .map((r, i) => ({
      id: "r" + (i + 1),
      company: String(r.company || "").trim(),
      title: r.kind === "break" ? "Career break" : String(r.title || "").trim(),
      dates: String(r.dates || "").trim(),
      location: String(r.location || "").trim(),
      kind: ["job", "parttime", "break", "volunteer", "self"].includes(r.kind) ? r.kind : "job",
      relevance: ["high", "medium", "low"].includes(r.relevance) ? r.relevance : "medium",
      why: String(r.why || "").trim().slice(0, 140),
      source: String(r.source || "").trim(),
    }));
  roles.forEach((r, i) => { r.level = defaultLevel(r, i); });
  return {
    name: String(record.name || "").trim(),
    currentTitle: String(record.currentTitle || (roles[0] && roles[0].title) || "").trim(),
    roles,
    education: (record.education || []).map((e) => ({ text: String((e && (e.text || e)) || "").trim(), dates: String((e && e.dates) || "").trim() })).filter((e) => e.text),
    interests: (record.interests || []).map((x) => String(x || "").trim()).filter(Boolean),
    breakNote: String(record.breakNote || "").trim(),
  };
}

async function extract({ cvText, advertText }) {
  if (!hasKey()) return verify(clean({ roles: [] }), cvText);
  const data = await askJSON({
    system:
      "You are the career-record pass for a CV tool. You COPY facts out of a CV exactly as written. You never rewrite, shorten, merge, guess or add anything. Missing a role is the worst mistake you can make.",
    prompt: `Read the WHOLE CV below, from the first line to the last, and list every role in it, in the order the CV gives them.

A "role" is every job, part-time job, freelance or self-employed work, business they owned, volunteering, and any career break the CV describes. Include old roles and short roles. Never skip one.

For each role copy EXACTLY as written in the CV (same words, same spelling, same date format):
- "company": the employer or organisation name
- "title": the job title
- "dates": the dates or date range, exactly as written (for example "March 2015 to September 2017"). "" if the CV gives none.
- "location": if the CV gives one, else ""
- "kind": "job" | "parttime" | "self" | "volunteer" | "break"
- "source": the CV's own text for that role (everything under it: description, responsibilities, achievements), copied word for word
- "relevance": how relevant this role is to the JOB ADVERT below: "high" | "medium" | "low". Judge on what the person actually did, not on how recent it is or which sector it was in. Leading, coaching or developing people, recruiting and training, winning and growing business, and owning revenue or profit are highly relevant in ANY sector if the advert asks for them. A role with no description at all is "low".
- For a career break, "title" is "Career break" and "company" is "".
- "why": up to 12 words on why, in plain English

Also return:
- "name": the person's name as written
- "currentTitle": the job title of their current or most recent role, exactly as written
- "education": every qualification, course and training award, each as {"text": exactly as written, "dates": "" or as written}
- "interests": their interests or hobbies, exactly as written, one per item ([] if none)
- "breakNote": if the CV explains a career break in a sentence, copy that sentence, else ""

Return JSON:
{"name":"","currentTitle":"","roles":[{"company":"","title":"","dates":"","location":"","kind":"job","source":"","relevance":"high","why":""}],"education":[{"text":"","dates":""}],"interests":[""],"breakNote":""}

JOB ADVERT (only to judge relevance):
"""${String(advertText || "").slice(0, 20000)}"""

CV (read all of it):
"""${String(cvText || "").slice(0, 60000)}"""`,
    maxTokens: 16000,
  });
  return verify(clean(data || {}), cvText);
}

// Apply the person's corrections from step 2. Only known fields, only for
// roles we already have, plus any role they added themselves.
function applyEdits(record, edits) {
  if (!record || !edits) return record;
  const byId = new Map((record.roles || []).map((r) => [r.id, r]));
  const roles = [];
  for (const e of edits.roles || []) {
    const base = byId.get(e.id) || { id: e.id && /^u\d+$/.test(e.id) ? e.id : "u" + (roles.length + 1), kind: "job", relevance: "medium", why: "", source: "", added: true };
    const r = { ...base };
    for (const k of ["company", "title", "dates", "location"]) if (typeof e[k] === "string") r[k] = e[k].trim().slice(0, 200);
    if (LEVELS.includes(e.level)) r.level = e.level;
    if (r.company || r.title) roles.push(r);
  }
  const out = { ...record, roles: roles.length ? roles : record.roles };
  if (typeof edits.currentTitle === "string") out.currentTitle = edits.currentTitle.trim().slice(0, 200);
  if (Array.isArray(edits.education)) out.education = edits.education.map((t) => ({ text: String(t || "").trim().slice(0, 300), dates: "" })).filter((e) => e.text);
  if (Array.isArray(edits.interests)) out.interests = edits.interests.map((t) => String(t || "").trim().slice(0, 200)).filter(Boolean);
  out.confirmed = true;
  return out;
}

// Roles that go on the CV, in order (left-out ones removed).
const onCv = (record) => (record && record.roles || []).filter((r) => r.level !== "out");

module.exports = { extract, verify, clean, applyEdits, onCv, dateRangesIn, norm, LEVELS };
