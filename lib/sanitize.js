// Final tidy of the CV data just before it's shown (preview) or written out
// (Word/PDF). The fabrication gate replaces anything it can't trace with a
// "[MISSING]" placeholder and queues a question. By the time the candidate has
// chosen to download, any still-unanswered items should simply be left out —
// so we strip the placeholders and drop entries that end up empty, giving a
// clean CV with gaps left out rather than one peppered with "[MISSING]".

function cleanStr(s) {
  if (typeof s !== "string") return s;
  let t = s.replace(/\[missing\]/gi, " ");
  t = t.replace(/\s{2,}/g, " ").trim();
  // trim leftover leading/trailing separators left behind by a removed token
  t = t.replace(/^[\s,;:·|/+–—-]+/, "").replace(/[\s,;:·|/+–—-]+$/, "").trim();
  return t;
}
// Does the string carry any real (alphanumeric) content?
function meaningful(s) {
  return typeof s === "string" && s.replace(/[^A-Za-z0-9]/g, "").length > 0;
}

function sanitizeForOutput(cv) {
  const out = JSON.parse(JSON.stringify(cv || {}));

  out.header = out.header || {};
  out.header.name = cleanStr(out.header.name);
  out.header.targetRole = cleanStr(out.header.targetRole);

  const c = out.header.contacts || {};
  for (const k of Object.keys(c)) {
    const v = cleanStr(c[k]);
    if (meaningful(v)) c[k] = v; else delete c[k];
  }
  out.header.contacts = c;

  for (const k of ["linkedin", "portfolio", "website", "github", "introVideo"]) {
    const v = cleanStr(out.header[k]);
    out.header[k] = meaningful(v) ? v : null;
  }

  out.personalStatement = cleanStr(out.personalStatement);

  out.skills = (out.skills || [])
    .map((s) => ({ skill: cleanStr(s.skill), proof: cleanStr(s.proof) }))
    .filter((s) => meaningful(s.skill));

  out.experience = (out.experience || [])
    .map((r) => ({
      company: cleanStr(r.company),
      title: cleanStr(r.title),
      dates: cleanStr(r.dates),
      location: cleanStr(r.location),
      responsibilities: (r.responsibilities || []).map(cleanStr).filter(meaningful),
      achievements: (r.achievements || []).map(cleanStr).filter(meaningful),
      reasonForLeaving: meaningful(cleanStr(r.reasonForLeaving)) ? cleanStr(r.reasonForLeaving) : null
    }))
    .filter((r) => meaningful(r.title) || meaningful(r.company));

  out.education = (out.education || [])
    .map((e) => ({
      qualification: cleanStr(e.qualification),
      institution: cleanStr(e.institution),
      dates: cleanStr(e.dates),
      grade: cleanStr(e.grade)
    }))
    .filter((e) => meaningful(e.qualification) || meaningful(e.institution));

  out.interests = (out.interests || []).map(cleanStr).filter(meaningful);

  out.skillsMatch = (out.skillsMatch || [])
    .map((m) => ({ requirement: cleanStr(m.requirement), proof: cleanStr(m.proof) }))
    .filter((m) => meaningful(m.requirement));

  out.missing = [];
  capForLength(out);
  return out;
}

// Bound the content so a finished CV stays within ~3 pages. Recent roles keep
// their detail; older roles are trimmed to a couple of lines. Never adds
// anything — only caps counts.
function capForLength(cv) {
  cv.experience = (cv.experience || []).map((r, i) => {
    const recent = i < 4;
    return {
      ...r,
      responsibilities: (r.responsibilities || []).slice(0, recent ? 6 : 2),
      achievements: (r.achievements || []).slice(0, recent ? 4 : 1)
    };
  });
  cv.skills = (cv.skills || []).slice(0, 10);
  cv.interests = (cv.interests || []).slice(0, 6);
  cv.education = (cv.education || []).slice(0, 8);
  cv.skillsMatch = (cv.skillsMatch || []).slice(0, 10);
  return cv;
}

// Is there enough real content to bother producing a file?
function hasContent(cv) {
  const o = cv || {};
  return meaningful(o.header && o.header.name) ||
    (o.experience || []).length > 0 ||
    (o.education || []).length > 0;
}

module.exports = { sanitizeForOutput, hasContent, cleanStr, meaningful };
