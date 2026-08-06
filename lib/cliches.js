// ─── Banned AI clichés & recruiter cringe-phrases ───────────────────────────
// The words and phrases that make a CV or cover letter read as machine-written
// or hollow. Used three ways: (1) injected into generation prompts as a hard
// ban, (2) detected after generation, (3) grammar-safe swaps for the mechanical
// ones so we can silently clean anything that slips through.
// Sourced from recruiter guidance + AI-detection research (see chat).

// Multi-word phrases - the clearest "a machine wrote this" tells and the
// cover-letter clichés recruiters roll their eyes at.
const BANNED_PHRASES = [
  // cover-letter openers / fillers
  "i was drawn to", "drawn to this", "i am writing to express", "i am writing to apply",
  "i am excited to apply", "i am thrilled", "excited about the opportunity",
  "i am confident that", "i believe i would be a perfect fit", "perfect fit",
  "ideal candidate", "i am the best person for", "look no further",
  "please find attached", "please find enclosed", "i would be a great addition",
  "align with my values", "aligns with my", "resonates with me", "resonate with",
  "it would be an honour", "dream job", "my passion for", "i am passionate about",
  "passionate about", "deeply passionate", "wealth of experience", "wealth of knowledge",
  "proven track record", "track record of success", "results-driven professional",
  "results-oriented", "results-driven", "detail-oriented", "detail oriented",
  "team player", "go-getter", "self-starter", "hard worker", "fast learner",
  "quick learner", "think outside the box", "thinking outside the box",
  "hit the ground running", "go the extra mile", "bring to the table",
  "wear many hats", "roll up my sleeves", "make a real impact", "make a difference",
  "add value", "drive results", "value-add", "dynamic professional",
  "dynamic environment", "fast-paced environment", "fast-paced world", "fast paced",
  "in today's fast-paced", "in today's digital age", "in today's competitive",
  "ever-evolving", "ever-changing", "constantly evolving",
  "commitment to excellence", "strive for excellence", "unwavering commitment",
  "unwavering dedication", "meticulous attention to detail", "keen eye for detail",
  "strong work ethic", "excellent communication skills", "proven ability to",
  "extensive experience in", "a demonstrated history of", "seamless experience",
  "cutting-edge", "state-of-the-art", "best-in-class", "world-class",
  "game changer", "game-changing", "next level", "take it to the next level",
  "embark on a journey", "embark on this journey", "on a journey", "professional journey",
  "navigate the landscape", "navigate the complexities", "the ever-changing landscape",
  "at the intersection of", "a testament to", "stand as a testament", "speaks volumes",
  "it is worth noting", "it's worth noting", "it is important to note", "it's important to note",
  "needless to say", "last but not least", "in conclusion", "in summary",
  "furthermore", "moreover", "additionally, it is", "not only", "but also",
  "i look forward to the opportunity", "i look forward to hearing from you",
  "thank you for considering my application", "eager to contribute",
  "poised to", "well-positioned to", "uniquely positioned", "uniquely qualified",
  "leverage my skills", "leverage my experience", "harness my", "synergy between"
];

// Single words that AI massively over-uses. Swapped for plainer words below,
// or banned outright in the prompt.
const BANNED_WORDS = [
  "delve", "delving", "tapestry", "beacon", "realm", "embark", "embarking",
  "leverage", "leveraging", "leveraged", "utilise", "utilize", "utilising", "utilizing",
  "spearhead", "spearheaded", "spearheading", "orchestrate", "orchestrated",
  "synergy", "synergies", "synergistic", "paradigm", "holistic", "bespoke",
  "seamless", "seamlessly", "robust", "innovative", "cutting-edge", "revolutionise",
  "revolutionize", "revolutionary", "transformative", "groundbreaking",
  "unlock", "unleash", "empower", "empowering", "elevate", "elevating",
  "amplify", "supercharge", "boast", "boasts", "boasting", "showcase", "showcasing",
  "underscore", "underscores", "pivotal", "myriad", "plethora", "multifaceted",
  "meticulous", "meticulously", "diligently", "adept", "proficient", "vibrant",
  "dynamic", "passionate", "enthusiastically", "effectively", "efficiently",
  "furthermore", "moreover", "additionally", "notably", "crucially", "ultimately",
  "resonate", "foster", "fostering", "cultivate", "cultivating", "navigate",
  "landscape", "endeavour", "endeavor", "commendable", "noteworthy", "testament"
];

// Grammar-safe one-for-one swaps we can apply silently without breaking a
// sentence. Deliberately conservative - only swaps that read fine in context.
// [regex, replacement]. Case-insensitive; capitalisation of the first letter is
// preserved by the applier.
const SAFE_SWAPS = [
  [/\bproven track record of\b/gi, "record of"],
  [/\bproven track record\b/gi, "track record"],
  [/\bleveraging\b/gi, "using"],
  [/\bleveraged\b/gi, "used"],
  [/\bleverage\b/gi, "use"],
  [/\butilis(e|ed|ing)\b/gi, (m, s) => ({ e: "use", ed: "used", ing: "using" }[s])],
  [/\butiliz(e|ed|ing)\b/gi, (m, s) => ({ e: "use", ed: "used", ing: "using" }[s])],
  [/\bspearheaded\b/gi, "led"],
  [/\bspearheading\b/gi, "leading"],
  [/\bspearhead\b/gi, "lead"],
  [/\borchestrated\b/gi, "ran"],
  [/\bshowcasing\b/gi, "showing"],
  [/\bshowcase\b/gi, "show"],
  [/\bboasts\b/gi, "has"],
  [/\bboasting\b/gi, "with"],
  [/\bseamlessly\b/gi, "smoothly"],
  [/\bcutting-edge\b/gi, "modern"],
  [/\bstate-of-the-art\b/gi, "modern"],
  [/\bin today's fast-paced world,?\s*/gi, ""],
  [/\bin today's digital age,?\s*/gi, ""],
  [/\bit'?s worth noting that\s*/gi, ""],
  [/\bit is worth noting that\s*/gi, ""],
  [/\bit'?s important to note that\s*/gi, ""],
  [/\bneedless to say,?\s*/gi, ""],
  [/\bI am writing to express my (?:strong )?interest in\b/gi, "I'm applying for"],
  [/\bI am writing to apply for\b/gi, "I'm applying for"],
  [/\bwealth of experience\b/gi, "experience"],
  [/\bresults-driven\s*/gi, ""],
  [/\bresults-oriented\s*/gi, ""],
  [/\bdetail-oriented\s*/gi, ""]
];

function capMatch(original, replacement) {
  if (!replacement) return replacement;
  return /^[A-Z]/.test(original) ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement;
}

// Silently clean the mechanical clichés from a string. Tidies any double spaces
// / stranded punctuation the removals leave behind.
function scrub(text) {
  let s = String(text == null ? "" : text);
  for (const [re, rep] of SAFE_SWAPS) {
    s = s.replace(re, (...args) => {
      const original = args[0];
      const out = typeof rep === "function" ? rep(...args) : rep;
      return capMatch(original, out);
    });
  }
  return s.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1").replace(/\.\s*\./g, ".").trim();
}

// Find which banned phrases/words appear in a block of text (for detection /
// deciding whether a rewrite pass is needed). Returns lowercased hits.
function detect(text) {
  const s = String(text == null ? "" : text).toLowerCase();
  const hits = [];
  for (const p of BANNED_PHRASES) if (s.includes(p)) hits.push(p);
  for (const w of BANNED_WORDS) if (new RegExp(`\\b${w.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i").test(s)) hits.push(w);
  return [...new Set(hits)];
}

// A compact block to paste into a generation prompt as a hard ban.
function promptBlock() {
  return `BANNED WORDS AND PHRASES (hard rule - NEVER use these, they read as fake AI writing):
Words: ${BANNED_WORDS.join(", ")}.
Phrases: ${BANNED_PHRASES.slice(0, 60).map((p) => `"${p}"`).join(", ")}.
Write the way a real, plain-spoken person actually talks. Say things directly. If you catch yourself reaching for a buzzword, use an ordinary word instead (e.g. "use" not "leverage", "led" not "spearheaded", "experience" not "wealth of experience"). Never open a cover letter with "I was drawn to", "I am writing to", "I am excited to", or "I am passionate about".`;
}

module.exports = { BANNED_PHRASES, BANNED_WORDS, SAFE_SWAPS, scrub, detect, promptBlock };
