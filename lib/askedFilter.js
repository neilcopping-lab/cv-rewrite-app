// Step 3 used to re-ask things people had already been asked (and chose to
// skip) at step 2, plus optional extras like a phone number or interests, and
// treat them all as honesty problems that locked "Choose a design". Nothing
// here is in the CV (the writer leaves out what it can't ground), so these are
// not honesty issues at all. This drops them from the writer's own "missing"
// list. Real honesty flags from the checker are never touched by this.

const STOP = new Set(("a an and are as at be been but by can could did do does for from had has have how i if in into is it its just of on or our so than that the their them then there these they this to us was we were what when where which who why will with would you your yours " +
  "any anything have used ever even also give tell share include add advert asks role job please real roughly about").split(" "));

function words(s) {
  return new Set(
    String(s || "").toLowerCase().replace(/[^a-z0-9£%\s]/g, " ").split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  );
}

// Optional bits a CV is fine without. If someone didn't give them, leave them out.
const OPTIONAL = /\b(phone|mobile|telephone|contact number|linkedin|portfolio|website|github|youtube|interests?|hobbies|outside work|photo)\b/i;

// Words that say nothing about WHAT a requirement is.
const GENERIC = new Set("experience experienced skills skill knowledge working work strong good proven ability track record understanding background specifically level years year".split(" "));

// Was this step 3 item already covered by a step 2 question? It matches when
// every key word of that question's requirement (e.g. "HubSpot", "SaaS") shows
// up in it, or when the two questions are clearly the same question.
function coveredBy(text, asked) {
  const T = words(text);
  const key = [...words(asked.requirement || asked.section || "")].filter((w) => !GENERIC.has(w));
  if (key.length && key.every((w) => T.has(w))) return true;
  const Q = words(asked.question || "");
  let shared = 0;
  for (const w of T) if (Q.has(w)) shared++;
  return shared >= 3 && shared / Math.min(T.size || 1, Q.size || 1) >= 0.6;
}

function dropAlreadyAsked(missing, askedQuestions) {
  const asked = (askedQuestions || []).map((q) => (typeof q === "string" ? { question: q } : q || {}));
  return (missing || []).filter((m) => {
    const text = `${(m && m.item) || ""} ${(m && m.question) || ""}`;
    if (OPTIONAL.test(text)) return false;
    return !asked.some((q) => coveredBy(text, q));
  });
}

// Every question the person saw at step 2, whether they answered it or not.
function askedAtStep2(st) {
  const q = (st && st.questions) || {};
  return [...(q.gapQuestions || []), ...(q.sectionQuestions || [])]
    .map((x) => ({ question: x.question || "", requirement: x.requirement || "", section: x.section || "" }));
}

module.exports = { dropAlreadyAsked, askedAtStep2, coveredBy };
