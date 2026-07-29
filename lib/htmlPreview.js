// Lightweight on-screen preview: render the CV + chosen design to HTML so the
// candidate can compare designs and switch before committing to a download.
// This is a preview only; the real deliverable is the docx/PDF from docxExport.
const { byId } = require("./designs");
const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function preview(cv, designId) {
  const d = byId(designId);
  const accent = "#" + d.accent;
  const serif = d.serifHeadings ? "Georgia, serif" : "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const c = cv.header?.contacts || {};
  const links = [cv.header?.linkedin, cv.header?.portfolio, cv.header?.github, cv.header?.introVideo].filter(Boolean);
  const contacts = [c.email, c.phone, c.location, ...links].filter(Boolean).map(esc).join(" &nbsp;·&nbsp; ");

  const H = (t) => `<h2 style="font-family:${serif};font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:${["heading","rule"].includes(d.accentUsage) ? accent : "#1A1A1A"};border-bottom:${d.sectionRule || d.accentUsage === "rule" ? `2px solid ${accent}` : "none"};padding-bottom:4px;margin:18px 0 8px">${t}</h2>`;

  const skills = (cv.skills || []).map((s) => `<p style="margin:4px 0"><strong>${esc(s.skill)}</strong> <span style="color:#726C5E">${esc(s.proof)}</span></p>`).join("");
  const exp = (cv.experience || []).map((r) => `
    <div style="margin:10px 0;${d.layout === "timeline" ? `border-left:3px solid ${accent};padding-left:12px` : ""}">
      <p style="margin:0"><strong>${esc(r.title)}</strong> · ${esc(r.company)} ${r.location ? `· <span style="color:#726C5E">${esc(r.location)}</span>` : ""}</p>
      <p style="margin:2px 0;color:#726C5E;font-style:italic;font-size:12px">${esc(r.dates)}</p>
      <ul style="margin:4px 0 4px 18px">${(r.responsibilities || []).filter(Boolean).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
      <ul style="margin:2px 0 2px 18px">${(r.achievements || []).filter(Boolean).map((a) => `<li style="${d.achievementCallouts ? `color:${accent};` : ""}font-weight:600">${esc(a)}</li>`).join("")}</ul>
      ${r.reasonForLeaving ? `<p style="margin:2px 0;color:#726C5E;font-style:italic;font-size:12px">Reason for leaving: ${esc(r.reasonForLeaving)}</p>` : ""}
    </div>`).join("");
  const interests = (cv.interests || []).filter(Boolean).map((i) => `<li>${esc(i)}</li>`).join("");
  const edu = (cv.education || []).map((e) => `<p style="margin:4px 0"><strong>${esc(e.qualification)}</strong> · ${esc(e.institution)} <span style="color:#726C5E">${esc(e.dates)} ${e.grade ? "· " + esc(e.grade) : ""}</span></p>`).join("");

  const nameBlock = d.layout === "headerblock"
    ? `<div style="background:${accent};color:#fff;padding:14px 16px;margin:-4px -4px 12px"><div style="font-family:${serif};font-size:26px;font-weight:700">${esc(cv.header?.name)}</div><div>${esc(cv.header?.targetRole)}</div></div>`
    : `<div style="font-family:${serif};font-size:26px;font-weight:700">${esc(cv.header?.name)}</div><div style="color:${d.accentUsage === "heading" ? accent : "#726C5E"};margin-bottom:6px">${esc(cv.header?.targetRole)}</div>`;

  const body = `
    ${nameBlock}
    <p style="color:#726C5E;font-size:12px;margin:0 0 10px">${contacts}</p>
    ${cv.personalStatement ? H("Profile") + `<p>${esc(cv.personalStatement)}</p>` : ""}
    ${skills ? H("Skills") + skills : ""}
    ${exp ? H("Experience") + exp : ""}
    ${edu ? H("Education") + edu : ""}
    ${interests ? H("Interests") + `<ul style="margin:4px 0 4px 18px">${interests}</ul>` : ""}`;

  return `<div style="font-family:${d.serifHeadings ? "Georgia, serif" : "system-ui, sans-serif"};color:#1A1A1A;background:#fff;padding:${Math.round(d.margins / 90)}px;line-height:1.45;font-size:13.5px;max-width:820px;margin:auto;box-shadow:0 2px 24px rgba(0,0,0,.12)">${body}</div>`;
}

module.exports = { preview };
