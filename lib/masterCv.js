// The master CV: one full CV a signed-in person builds once and keeps in their
// Comquat account, then tailors for each job with CV Rewrite.
//
// It uses the same shape as the CVs CV Rewrite makes, so the same Word designs
// work for it. Nothing here talks to the AI (see lib/masterWriter.js for the
// optional "write it up for me" step).

const behaviours = require("./behaviours");
const { reasonFor } = require("./freshCv");
const STYLES = ["professional", "warm", "concise", "senior"];

const LIMITS = { text: 300, long: 2500, line: 400, lines: 20, roles: 30, skills: 30, education: 20, interests: 15 };

const str = (v, n = LIMITS.text) => String(v == null ? "" : v).replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n);
const oneLine = (v, n) => str(v, n).replace(/\s*\n\s*/g, " ");
const lines = (v) => (Array.isArray(v) ? v : String(v || "").split("\n"))
  .map((l) => oneLine(l, LIMITS.line).replace(/^[-*••]\s*/, ""))
  .filter(Boolean)
  .slice(0, LIMITS.lines);
const link = (v) => {
  const s = oneLine(v, 300);
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s) ? "https://" + s : null;
};
const list = (v, max, fn) => (Array.isArray(v) ? v : []).slice(0, max).map(fn).filter((x) => Object.values(x).some((y) => (Array.isArray(y) ? y.length : y)));

// Turns whatever the page sent into a clean master CV. Never throws.
function normalise(input) {
  const c = input && typeof input === "object" ? input : {};
  const h = c.header || {};
  const ct = h.contacts || {};
  return {
    header: {
      name: oneLine(h.name, 120),
      targetRole: oneLine(h.targetRole, 120),
      contacts: { email: oneLine(ct.email, 200), phone: oneLine(ct.phone, 40), location: oneLine(ct.location, 120) },
      linkedin: link(h.linkedin),
      portfolio: link(h.portfolio),
      introVideo: link(h.introVideo),
    },
    personalStatement: str(c.personalStatement, LIMITS.long),
    experience: list(c.experience, LIMITS.roles, (r) => ({
      title: oneLine(r.title, 150),
      company: oneLine(r.company, 150),
      location: oneLine(r.location, 120),
      dates: oneLine(r.dates, 60),
      responsibilities: lines(r.responsibilities),
      achievements: lines(r.achievements),
      reasonForLeaving: oneLine(r.reasonForLeaving, 200),
      // Their own words about it, typed or recorded, before it's written up.
      about: str(r.about, 3000),
    })),
    skills: list(c.skills, LIMITS.skills, (s) => ({ skill: oneLine(s.skill, 120), proof: oneLine(s.proof, LIMITS.line) })).filter((s) => s.skill),
    behaviours: behaviours.clean(c.behaviours),
    education: list(c.education, LIMITS.education, (e) => ({
      qualification: oneLine(e.qualification, 200),
      institution: oneLine(e.institution, 200),
      dates: oneLine(e.dates, 60),
      grade: oneLine(e.grade, 60),
    })),
    interests: lines(c.interests).slice(0, LIMITS.interests),
    // The answers to the statement questions, kept so people can come back to them.
    // How they'd like it written, and the design they last picked.
    writingStyle: STYLES.includes(c.writingStyle) ? c.writingStyle : "warm",
    styleSample: str(c.styleSample, 3000),
    design: /^[a-z0-9-]{2,40}$/.test(String(c.design || "")) ? String(c.design) : "f-sunrise",
    statementAnswers: ["story", "proud", "care", "best", "next", "real"].reduce((o, k) => {
      const v = str(c.statementAnswers && c.statementAnswers[k], 600);
      if (v) o[k] = v;
      return o;
    }, {}),
  };
}

// How complete it is, for the progress hints on the page.
function progress(cv) {
  const h = cv.header || {};
  const steps = [
    ["Your name", !!h.name],
    ["How to reach you", !!(h.contacts && (h.contacts.email || h.contacts.phone))],
    ["A few lines about you", (cv.personalStatement || "").length >= 60],
    ["At least one job", (cv.experience || []).some((r) => r.title && r.company)],
    ["Three or more key skills or behaviours", (cv.skills || []).length + (cv.behaviours || []).length >= 3],
    ["Education or training", (cv.education || []).length >= 1],
  ];
  return { done: steps.filter((s) => s[1]).length, total: steps.length, missing: steps.filter((s) => !s[1]).map((s) => s[0]) };
}

const hasContent = (cv) => progress(cv).done > 0 || (cv.interests || []).length > 0;

// Their own skills first, then the strengths from the behaviours they ticked.
const allSkills = (cv) => [...(cv.skills || []), ...behaviours.toSkills(cv.behaviours)];

// A reason for leaving only belongs on a CV once you've left (not "Still here").
const leaving = (cv) => (cv.experience || []).map((r) => ({ ...r, reasonForLeaving: reasonFor(r) }));

// The CV as the Word file builder wants it.
function forOutput(cv) {
  return { ...cv, experience: leaving(cv), skills: allSkills(cv), skillsHeading: "Key skills and behaviours" };
}

// The CV as the Fresh designs want it: their own skills and the strengths from
// their ticks kept apart, so each gets its own section.
function forFresh(cv) {
  return { ...cv, experience: leaving(cv), strengths: behaviours.toSkills(cv.behaviours) };
}

// Plain text, for dropping into CV Rewrite's "paste your CV" box.
function toText(cv) {
  const h = cv.header || {};
  const c = h.contacts || {};
  const out = [];
  if (h.name) out.push(h.name);
  if (h.targetRole) out.push(h.targetRole);
  const contact = [c.email, c.phone, c.location, h.linkedin, h.portfolio, h.introVideo].filter(Boolean).join(" | ");
  if (contact) out.push(contact);
  if (cv.personalStatement) out.push("", "PROFILE", cv.personalStatement);
  if ((cv.experience || []).length) {
    out.push("", "WORK HISTORY");
    for (const r of cv.experience) {
      out.push("", [r.title, r.company].filter(Boolean).join(", ") + (r.location ? ` (${r.location})` : "") + (r.dates ? `, ${r.dates}` : ""));
      for (const l of r.responsibilities || []) out.push("- " + l);
      if ((r.achievements || []).length) {
        out.push("Achievements:");
        for (const l of r.achievements) out.push("- " + l);
      }
      if (reasonFor(r)) out.push("Reason for leaving: " + reasonFor(r));
    }
  }
  const skills = allSkills(cv);
  if (skills.length) {
    out.push("", "KEY SKILLS AND BEHAVIOURS");
    for (const s of skills) out.push("- " + s.skill + (s.proof ? `: ${s.proof}` : ""));
  }
  if ((cv.education || []).length) {
    out.push("", "EDUCATION AND TRAINING");
    for (const e of cv.education) out.push("- " + [e.qualification, e.institution, e.dates, e.grade].filter(Boolean).join(", "));
  }
  if ((cv.interests || []).length) out.push("", "INTERESTS", ...cv.interests.map((i) => "- " + i));
  return out.join("\n").trim();
}

module.exports = { normalise, progress, hasContent, toText, forOutput, forFresh, LIMITS, STYLES };
