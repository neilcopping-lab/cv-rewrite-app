// Skills match report (Comquat CV Rewrite, Nov 2026).
// A private, candidate-only read-out of how the rewritten CV lines up with
// what the job advert asks for: every requirement from the gap analysis,
// marked strong / partial / gap, with the evidence (or what's missing) and a
// headline match score. It is shown in the app after the rewrite and is NOT
// added to the CV the candidate sends (the CV keeps its own "skills-match
// exercise" page, which only lists requirements the candidate can prove).
//
// Source, in order of preference:
//   1. cv.matchReport from the rewrite pass (judged against the finished CV
//      and the candidate's Q&A answers).
//   2. Fallback: the gap analysis run before the questions (covered -> strong,
//      thin -> partial, missing -> gap), so the report is never empty when a
//      gap analysis exists.

const STATUS = { strong: "strong", partial: "partial", gap: "gap", covered: "strong", thin: "partial", missing: "gap" };

function clean(s, max) {
  const t = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

function fromRewrite(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      requirement: clean(r && r.requirement, 140),
      status: STATUS[String((r && r.status) || "").toLowerCase()] || null,
      evidence: clean(r && r.evidence, 220)
    }))
    .filter((r) => r.requirement && r.status);
}

function fromGaps(gaps) {
  return ((gaps && gaps.requirements) || [])
    .map((r) => ({
      requirement: clean(r.requirement, 140),
      status: STATUS[String(r.status || "").toLowerCase()] || null,
      evidence: clean(r.evidenceInCV || r.why || "", 220)
    }))
    .filter((r) => r.requirement && r.status);
}

function build(cv, gaps) {
  let rows = fromRewrite(cv && cv.matchReport);
  let basis = "rewrite";
  if (!rows.length) { rows = fromGaps(gaps); basis = "gaps"; }
  rows = rows.slice(0, 15);
  const strong = rows.filter((r) => r.status === "strong").length;
  const partial = rows.filter((r) => r.status === "partial").length;
  const gap = rows.filter((r) => r.status === "gap").length;
  const total = rows.length;
  const percent = total ? Math.round(((strong + partial * 0.5) / total) * 100) : null;
  // Strongest first, then partial, then gaps, so the good news leads.
  const order = { strong: 0, partial: 1, gap: 2 };
  rows.sort((a, b) => order[a.status] - order[b.status]);
  return { rows, total, strong, partial, gap, percent, basis };
}

module.exports = { build };
