// Is it worth applying? A plain, kind verdict from the gap check, before any
// rewriting. It never stops anyone: they can always rewrite anyway.
function fitVerdict(reqs) {
  const n = reqs.length;
  if (!n) return null;
  const missing = reqs.filter((r) => r.status === "missing");
  const thin = reqs.filter((r) => r.status === "thin").length;
  const level = missing.length / n >= 0.4 ? "red" : (missing.length / n >= 0.2 || (missing.length + thin) / n >= 0.5) ? "amber" : "green";
  const names = missing.slice(0, 3).map((r) => String(r.requirement || "").slice(0, 80)).filter(Boolean);
  const note = level === "green" ? "Your CV already covers most of what they're asking for."
    : level === "amber" ? `A few gaps${names.length ? `, such as ${names.join(", ")}` : ""}. Your answers to the questions below could close them.`
    : `They want quite a lot your CV doesn't show yet${names.length ? `, including ${names.join(", ")}` : ""}. If you really have done these things, say so below. If not, your energy might be better spent on a closer match.`;
  return { level, label: { green: "Go for it", amber: "Worth a try", red: "A long shot" }[level], note, missing: missing.length, total: n };
}

module.exports = { fitVerdict };
