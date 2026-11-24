// "My writing style": one description of how someone writes, learned from
// three pieces of their own writing and saved to their Comquat account.
// CV Rewrite, the CV Builder, cover letters and Interview Prep all use it
// when the person picks "My writing style".
//
// Only the DESCRIPTION of the voice is kept and shared between Comquat apps.
// The pasted samples are used once to learn it and are never shared.

const { askJSON, hasKey } = require("./anthropic");

const MIN_WORDS = 40;
const SAMPLES = 3;
const words = (s) => String(s || "").trim().split(/\s+/).filter(Boolean).length;

/** The instruction every writer gets when the person picks "My writing style". */
function voiceLine(profile) {
  return `THEIR OWN VOICE: write the way this person writes, as described below. Match their tone, sentence length, formality and habits. Copy the voice only, never any content.\nHow they write: ${String(profile).slice(0, 1500)}`;
}

/** The style line to use: their own voice when chosen and saved, else the preset. */
function styleLineFor(writingStyle, presets, profile, fallback = "professional") {
  if (writingStyle === "mine" && profile) return voiceLine(profile);
  return presets[writingStyle] || presets[fallback];
}

/** Learn a voice from three samples. Returns the description to save. */
async function learn(samples) {
  const clean = (samples || []).map((x) => String(x || "").trim().slice(0, 4000));
  if (clean.length !== SAMPLES || clean.some((x) => words(x) < MIN_WORDS)) {
    const e = new Error(`Paste ${SAMPLES} pieces of your own writing, each at least ${MIN_WORDS} words.`);
    e.status = 400;
    throw e;
  }
  if (!hasKey()) {
    const e = new Error("Learning your style isn't available just now. Please try again later.");
    e.status = 503;
    throw e;
  }
  const out = await askJSON({
    system: `You study how one person writes so future CVs, cover letters and interview pitches sound like them. Describe their VOICE only: tone, sentence length, formality, punctuation habits, typical structure and recurring phrasing patterns. Do NOT record any names, employers, places, dates, numbers, contact details or other facts from the samples. UK English. Reply with JSON only: {"summary": two or three sentences describing the voice, "sentence_length": short description, "formality": short description, "habits": [up to 6 writing habits], "avoid": [up to 4 things they never do]}.`,
    prompt: clean.map((x, i) => `--- Sample ${i + 1} ---\n${x}`).join("\n\n"),
    maxTokens: 900,
  });
  return [
    out.summary,
    out.sentence_length ? `Sentence length: ${out.sentence_length}` : "",
    out.formality ? `Formality: ${out.formality}` : "",
    Array.isArray(out.habits) && out.habits.length ? `Habits: ${out.habits.join("; ")}` : "",
    Array.isArray(out.avoid) && out.avoid.length ? `Avoids: ${out.avoid.join("; ")}` : "",
  ].filter(Boolean).join("\n").slice(0, 2000);
}

/** The signed-in person's saved style, or null. Runs as them (row level security). */
async function load(req) {
  if (!req.user || !req.sb) return null;
  const { data } = await req.sb.from("profiles").select("style_profile, style_learned_at, style_source").eq("id", req.user.id).maybeSingle();
  return data && data.style_profile ? { profile: data.style_profile, learnedAt: data.style_learned_at, source: data.style_source || "comquat-job-seekers" } : null;
}

module.exports = { learn, load, voiceLine, styleLineFor, MIN_WORDS, SAMPLES, words };
