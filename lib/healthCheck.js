// The CV health check: a master CV checked against the seven stops in
// The CV That Gets Read (the-common-people.com/guide-cv.html).
//
// Green, amber or red for each stop, one plain line on why, the builder step
// that fixes it and the part of the guide to read. Worked out here from the CV
// itself, with simple rules: nothing is sent to an AI.

const cliches = require("./cliches");
const { reasonFor } = require("./freshCv");

const GUIDE = "https://the-common-people.com/guide-cv.html";
const words = (t) => String(t || "").trim().split(/\s+/).filter(Boolean).length;
const sentences = (t) => String(t || "").split(/[.!?]+/).filter((x) => x.trim()).length;

// Interests that tell a stranger nothing on their own.
const VAGUE_INTERESTS = /^(reading|sport|sports|music|travel|travelling|socialising|socializing|films|movies|cooking|gaming|walking|fitness|the gym|gym|football|tv|art|food|going out|spending time with (my )?(friends|family))\.?$/i;

function yearsIn(dates) {
  return (String(dates || "").match(/\b(19|20)\d{2}\b/g) || []).map(Number);
}
const isCurrent = (dates) => /\b(now|present|current|currently|to date|ongoing)\b/i.test(String(dates || ""));

function check(cv, { journey = cv.journey || "", now = new Date() } = {}) {
  const h = cv.header || {}, ct = h.contacts || {};
  const first = journey === "first";
  const out = [];
  const add = (id, n, title, step, rag, note) => out.push({ id, n, title, step, rag, note, url: `${GUIDE}#stop-${n}` });

  // 1. Header and contacts
  if (!h.name || !(ct.email || ct.phone)) add("header", 1, "Header and contacts", "about", "red", !h.name ? "Your name isn't at the top yet." : "There's no email or phone number, so nobody can get hold of you.");
  else if (!ct.location) add("header", 1, "Header and contacts", "about", "amber", "Add your town or city. Employers like to know you can get there.");
  else add("header", 1, "Header and contacts", "about", "green", "Name at the top, easy to reach.");

  // 2. Personal statement
  const st = String(cv.personalStatement || "").trim();
  const press = cliches.detect(st);
  if (!st) add("statement", 2, "Personal statement", "story", "red", "There's no personal statement yet. It's the first thing they read about you.");
  else if (press.length) add("statement", 2, "Personal statement", "story", words(st) < 20 ? "red" : "amber", `It sounds a bit like a press release ("${press.slice(0, 2).join('", "')}"). Answer the questions and say what you actually do instead.`);
  else if (words(st) < 20) add("statement", 2, "Personal statement", "story", "red", "Your statement is very short. Answer a couple of the questions and it'll come to life.");
  else if (words(st) > 120 || sentences(st) > 5) add("statement", 2, "Personal statement", "story", "amber", `${words(st)} words is on the long side. Three to five short sentences is plenty.`);
  else add("statement", 2, "Personal statement", "story", "green", "Sounds like a real person.");

  // 3. Key skills, with proof
  const own = (cv.skills || []).filter((s) => s.skill);
  const ticked = cv.behaviours || [];
  const proved = own.filter((s) => String(s.proof || "").trim()).length + ticked.filter((id) => cv.behaviourProof && cv.behaviourProof[id]).length;
  const total = own.length + ticked.length;
  if (total === 0) add("skills", 3, "Key skills, with proof", "strengths", "red", "No key skills yet. Tick the strengths that sound like you.");
  else if (total < 3) add("skills", 3, "Key skills, with proof", "strengths", "amber", "Only " + total + " so far. Aim for at least three.");
  else if (proved < Math.ceil(total / 2) && proved < 4) add("skills", 3, "Key skills, with proof", "strengths", "amber", `${proved} of your ${total} skills have a "prove it" line in your own words. Add a real example to a few more.`);
  else add("skills", 3, "Key skills, with proof", "strengths", "green", "A good list, with proof behind it.");

  // 4. Career history
  const roles = (cv.experience || []).filter((r) => r.kind !== "break" && (r.title || r.company));
  if (!roles.length) {
    add("history", 4, first ? "Experience" : "Career history", "experience", first ? "amber" : "red",
      first ? "No jobs yet is fine on a first CV. Add a Saturday job, volunteering, babysitting or a project you ran." : "There's no work history yet. Add your roles, latest first.");
  } else {
    const noResults = roles.filter((r) => !(r.achievements || []).length);
    const left = roles.filter((r) => !isCurrent(r.dates));
    const noReason = first ? [] : left.filter((r) => !reasonFor(r));
    const cutOff = now.getFullYear() - 10;
    const old = roles.filter((r) => { const y = yearsIn(r.dates); return y.length && Math.max(...y) < cutOff && (r.responsibilities || []).length + (r.achievements || []).length > 2; });
    const issues = [];
    if (noResults.length) issues.push(noResults.length === roles.length && roles.length > 1 ? "none of your roles say what came of your work" : `${noResults.length} of your ${roles.length} roles list what you did but not what came of it`);
    if (noReason.length) issues.push(`${noReason.length === 1 ? "one role you've left has" : noReason.length + " roles you've left have"} no reason for leaving`);
    if (old.length) issues.push(`${old.length === 1 ? "one role from" : old.length + " roles from"} over ten years ago could be cut to one line`);
    if (issues.length) add("history", 4, first ? "Experience" : "Career history", "experience", "amber", issues.join(", and ").replace(/^./, (c) => c.toUpperCase()) + ".");
    else add("history", 4, first ? "Experience" : "Career history", "experience", "green", "What you did, what came of it and why you moved on.");
  }

  // 5. Interests
  const ints = (cv.interests || []).filter(Boolean);
  const vague = ints.filter((i) => VAGUE_INTERESTS.test(String(i).trim()));
  if (!ints.length) add("interests", 5, "Interests and hobbies", "interests", "amber", "No interests yet. They give a stranger a reason to like you.");
  else if (vague.length) add("interests", 5, "Interests and hobbies", "interests", "amber", `Be specific: "${vague[0]}" could be anyone. Say which team, which books, which games.`);
  else add("interests", 5, "Interests and hobbies", "interests", "green", "Specific and real.");

  // 6. Education
  const edu = (cv.education || []).filter((e) => e.qualification || e.institution);
  const undated = edu.filter((e) => !e.dates);
  if (!edu.length) add("education", 6, "Education and training", "education", first ? "red" : "amber", first ? "On a first CV, education is where you make your case. Add what you're studying now." : "No education or training yet. Add your qualifications and any courses that matter.");
  else if (undated.length) add("education", 6, "Education and training", "education", "amber", `${undated.length === 1 ? "One qualification has" : undated.length + " qualifications have"} no dates. Don't be vague.`);
  else add("education", 6, "Education and training", "education", "green", "Clear: where, what and when.");

  // 7. The skills match: done for each job, so it's a next step rather than a mark.
  add("match", 7, "Skills match", "download", "next", "Do this for each job you really want: Tailor it for a job lines your CV up against the advert.");

  const scored = out.filter((s) => s.rag !== "next");
  return {
    stops: out,
    greens: scored.filter((s) => s.rag === "green").length,
    ambers: scored.filter((s) => s.rag === "amber").length,
    reds: scored.filter((s) => s.rag === "red").length,
  };
}

module.exports = { check };
