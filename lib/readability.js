// The readability gate: the last thing before a CV is shown. Any line or
// sentence with a hole in it ("with a at Tate", "including a proposed , and",
// "in 2018 to and") is taken out whole, so nobody ever downloads a CV with
// broken sentences. It also catches a stray [MISSING].
//
// Lines are removed, never patched: patching would mean guessing words.

const BROKEN = [
  /\[missing\]/i,
  /\[[A-Z_]{3,}\]/,                    // a placeholder that never got filled
  /\s[,.;:](?!\d)/,                     // "consultants , and"
  /,\s*[,.;:]/,                         // ", ," or ",."
  /\(\s*\)/,                            // "( )"
  /\b(?:a|an|the)\s+(?:at|in|of|to|and|with|from|for|on|by|or)\b(?!\s+(?:least|all|once|large|whole|time|first|last|most|best))/i, // "with a at Tate"
  /\b(?:to|of|at|with|from|for|by|across|between|within|into|throughout|including)\s+(?:and|or|at|of|with|from|for|by)\b(?<!\bup to and)/i,        // "in 2018 to and"
  /\b(?:a|an|the|to|of|at|with|from|for|by|including|and|or)\s*$/i,                                  // ends mid-phrase
  /^\s*(?:and|or|but|including|with)\b/i,                                                            // starts mid-phrase
];

// Phrases that look broken but are fine.
const FINE = [/\bup to and including\b/i, /\bfrom time to time\b/i, /\bto and from\b/i, /\bby and large\b/i, /\bat or above\b/i, /\bat or below\b/i];

function isBroken(text) {
  let t = String(text || "").trim();
  if (!t) return false;
  for (const f of FINE) t = t.replace(f, "ok");
  // Ignore the full stop at the very end when checking "ends mid-phrase".
  const body = t.replace(/[.!?]+$/, "");
  return BROKEN.some((rx) => rx.test(rx.source.endsWith("$/") ? body : t));
}

// Split prose into sentences, keeping their punctuation.
function sentences(text) {
  return String(text || "").match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) || [];
}

// Remove broken sentences from prose. Returns { text, removed: [..] }.
function proseFix(text) {
  const removed = [];
  const kept = sentences(text).filter((s) => {
    if (isBroken(s)) { removed.push(s.trim()); return false; }
    return true;
  });
  return { text: kept.join(" ").replace(/\s{2,}/g, " ").trim(), removed };
}

// Walk the CV, dropping broken lines and sentences. Keeps the per-line source
// notes in step. Returns the list of what was removed (for logging).
function gate(cv) {
  const removed = [];
  if (!cv) return removed;
  const p = proseFix(cv.personalStatement);
  cv.personalStatement = p.text; removed.push(...p.removed);
  (cv.experience || []).forEach((r) => {
    for (const k of ["responsibilities", "achievements"]) {
      const src = (r.sources && r.sources[k]) || [];
      const keep = [], keepSrc = [];
      (r[k] || []).forEach((b, i) => { if (isBroken(b)) removed.push(b); else { keep.push(b); keepSrc.push(src[i]); } });
      r[k] = keep;
      if (r.sources) r.sources[k] = keepSrc;
    }
  });
  const rows = (arr, field, srcKey) => {
    const src = srcKey ? (cv[srcKey] || []) : null;
    const keep = [], keepSrc = [];
    (cv[arr] || []).forEach((row, i) => {
      const t = typeof row === "string" ? row : row && row[field];
      if (isBroken(t)) removed.push(t); else { keep.push(row); if (src) keepSrc.push(src[i]); }
    });
    cv[arr] = keep;
    if (src) cv[srcKey] = keepSrc;
  };
  rows("skills", "proof", "skillSources");
  rows("skillsMatch", "proof");
  rows("interests", null, "interestSources");
  if (removed.length) console.warn("[readability] removed", removed.length, "broken line(s)");
  return removed;
}

module.exports = { gate, isBroken, proseFix, sentences };
