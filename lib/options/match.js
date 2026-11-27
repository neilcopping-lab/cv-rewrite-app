// Identify Your Options: matching a person against the career data.
//
// This is rules-based and runs without AI, so it still works with the AI setting
// on Off. It never sees health details: the private "What helps me" notes and
// anything marked private are left out of the profile before it gets here.
//
// A match is an estimate, never a verdict, and every score comes with the
// reasons behind it so the person can see how it was worked out.

const { TRAITS, VALUES } = require("./cards");

const TRAIT = new Map(TRAITS.map((t) => [t.id, t]));
const VALUE = new Map(VALUES.map((v) => [v.id, v]));
const lc = (s) => String(s || "").toLowerCase();
const STOP = new Set("the a an and or of to in on for with by at as is are be from into this that their your our you will can use using including such other work working ensure maintain within across relevant appropriate".split(" "));
const tokens = (s) => lc(s).replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w));
const stem = (w) => w.replace(/(ing|ed|es|s|ment|ation|ions|ion)$/, "");

function occupationText(o) {
  return lc([o.title, o.overview, o.summary, o.route, o.pathway, ...(o.jobTitles || []), ...(o.keywords || []), ...(o.duties || []), ...(o.skills || []), ...(o.knowledge || []), ...(o.behaviours || [])].join(" \n "));
}
const hits = (text, words) => (words || []).filter((w) => text.includes(lc(w)));
function onetScore(map, names) {
  if (!map || !names || !names.length) return null;
  const vals = [];
  for (const [k, val] of Object.entries(map)) if (names.some((n) => lc(k).includes(n))) vals.push(val);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

// The person's level, from their experience and highest qualification.
const QUAL_LEVEL = { none: 1, gcse: 2, level2: 2, alevel: 3, level3: 3, level4: 4, hnc: 4, level5: 5, hnd: 5, foundation: 5, degree: 6, masters: 7, phd: 8 };
function personLevel(p) {
  let lvl = QUAL_LEVEL[p.qualification] || 2;
  const yrs = Number(p.experienceYears) || 0;
  if (yrs >= 5 && lvl < 4) lvl += 1;
  if (yrs >= 10 && lvl < 5) lvl += 1;
  return Math.max(2, Math.min(7, lvl));
}

// Everyday words people use for work skills, so a carer who "looked after" someone
// or a chef who "ran the rota" gets credit for the same skill in work language.
// It only ever adds words to the person's side; it never removes any.
const EVERYDAY = [
  [/\b(looked after|looking after|caring for|carer|cared for)\b/g, " care support wellbeing "],
  [/\b(trained|training|taught|teaching|mentored|showed)\b/g, " train explain learners teach "],
  [/\b(rota|rotas|shift pattern)\b/g, " schedule plan coordinate resources "],
  [/\b(budget|budgets|costs|cash)\b/g, " budget finance "],
  [/\b(ran|run|running|managed|in charge of)\b/g, " manage lead "],
  [/\b(staff|crew|colleagues)\b/g, " team "],
  [/\b(complaints|complaint|unhappy customers)\b/g, " resolve problems customer "],
  [/\b(appointments|letters|paperwork|forms)\b/g, " organise records documents "],
  [/\b(spreadsheet|spreadsheets|excel)\b/g, " data spreadsheets analyse "],
  [/\b(suppliers|ordering|deliveries)\b/g, " stock coordinate "],
  [/\b(customers|public|guests)\b/g, " customer service "],
  [/\b(videos|logo|logos|designs|posted)\b/g, " content create design "],
];
function widen(text) {
  let t = lc(text); let extra = "";
  for (const [re, add] of EVERYDAY) { re.lastIndex = 0; if (re.test(t)) extra += add; re.lastIndex = 0; }
  return t + " " + extra;
}

// Statements from the occupation that the person's own words back up.
function evidence(statements, personTokens) {
  const strong = [], partial = [], gaps = [];
  for (const s of statements) {
    const st = [...new Set(tokens(s).map(stem))];
    if (!st.length) continue;
    const n = st.filter((w) => personTokens.has(w)).length;
    if (n >= Math.min(3, Math.ceil(st.length * 0.4))) strong.push(s);
    else if (n >= 1 && st.length > 2) partial.push(s);
    else gaps.push(s);
  }
  return { strong, partial, gaps };
}

// How well a CV and answers line up with one occupation's skills and knowledge:
// the % match used in Your Options Report. Strong counts in full, partial in half.
function specMatch(o, personText) {
  const pt = new Set(tokens(widen(personText)).map(stem));
  const statements = [...(o.skills || []), ...(o.knowledge || [])];
  const e = evidence(statements, pt);
  const total = e.strong.length + e.partial.length + e.gaps.length;
  const percent = total ? Math.round(((e.strong.length + e.partial.length * 0.5) / total) * 100) : 0;
  return { percent, total, ...e, how: "Each skill and knowledge statement in this role's Skills England standard is checked against your CV and answers. Clearly backed up counts in full, partly backed up counts as half. It's an estimate, not a verdict." };
}

function styleFit(o, text, ws) {
  let s = 0.5; const why = [];
  if (!ws) return { s, why };
  const outdoor = /outdoor|site|land|garden|horticultur|construct|agricultur/.test(text);
  const handsOn = /install|repair|operate|prepare|construct|maintain|physical|assembl/.test(text);
  const people = /customer|patient|client|learner|care|service|team/.test(text);
  if (ws.where === "Outdoors") { s += outdoor ? 0.25 : -0.15; if (outdoor) why.push("you'd rather be outdoors, and this work is often outside"); }
  if (ws.where === "Indoors" && outdoor) s -= 0.15;
  if (ws.hands === "Hands-on, on my feet") { s += handsOn ? 0.2 : -0.1; if (handsOn) why.push("you like to be hands-on, and this is practical work"); }
  if (ws.hands === "At a desk or screen" && handsOn && !/data|software|design|document/.test(text)) s -= 0.15;
  if (ws.people === "Mostly people") { s += people ? 0.15 : -0.1; if (people) why.push("you like a day spent with people"); }
  if (ws.people === "Mostly tasks, things or screens" && /customer|patient|client/.test(text)) s -= 0.1;
  return { s: Math.max(0, Math.min(1, s)), why };
}

// Score every occupation and return the best options, with reasons.
//   profile: { personText, traits:[{id, example}], values:{id: "must"|"nice"|"no"}, topValues:[ids],
//              workStyle:{...}, qualification, experienceYears }
function rank(occupations, profile, { limit = 12, exclude = null, avoidRoutes = null } = {}) {
  const traits = (profile.traits || []).filter((t) => TRAIT.has(t.id) && String(t.example || "").trim().length >= 10);
  const must = Object.entries(profile.values || {}).filter(([, p]) => p === "must").map(([id]) => id).filter((id) => VALUE.has(id));
  const top = (profile.topValues || []).filter((id) => must.includes(id));
  const level = personLevel(profile);
  const personText = String(profile.personText || "");
  const results = [];
  for (const o of occupations) {
    if (exclude && exclude.has(o.code)) continue;
    if (avoidRoutes && avoidRoutes.size && avoidRoutes.has(o.route)) continue;
    const text = occupationText(o);
    // Traits
    let tSum = 0; const traitWhy = [];
    for (const pt of traits) {
      const tr = TRAIT.get(pt.id);
      const h = hits(text, tr.words);
      let s = Math.min(1, h.length / 2);
      const on = o.onet ? onetScore(o.onet.styles, tr.styles) : null;
      if (on !== null) s = s * 0.6 + on * 0.4;
      tSum += s;
      if (h.length) traitWhy.push(tr.card);
    }
    const traitScore = traits.length ? tSum / traits.length : 0.5;
    // Values (Must haves, top five counting double)
    let vSum = 0, vW = 0; const valueWhy = [];
    for (const id of must) {
      const val = VALUE.get(id); const w = top.includes(id) ? 2 : 1;
      const h = hits(text, val.words);
      let s = val.words.length ? (h.length ? 1 : 0.3) : 0.5;
      const on = o.onet ? onetScore(o.onet.values, val.onet) : null;
      if (on !== null) s = s * 0.5 + on * 0.5;
      vSum += s * w; vW += w;
      if (h.length) valueWhy.push(val.label);
    }
    const valueScore = vW ? vSum / vW : 0.5;
    const sf = styleFit(o, text, profile.workStyle);
    const spec = specMatch(o, personText);
    // Level: options at, just below or one step above the person's level.
    const lvl = o.level || null;
    let levelNote = "";
    if (lvl) {
      if (lvl > level + 1) continue;
      levelNote = lvl > level ? `A step up, at Level ${lvl}, with training built in`
        : lvl < level ? `At Level ${lvl}: a way in to something new, building on what you already know`
        : `At Level ${lvl}, in line with your experience`;
      if (lvl < level - 2) continue;
    }
    const fit = 0.35 * traitScore + 0.25 * valueScore + 0.15 * sf.s + 0.25 * (spec.percent / 100);
    const reasons = [];
    if (traitWhy.length) reasons.push(`You said "${traitWhy[0]}"${traitWhy.length > 1 ? ` and ${traitWhy.length - 1} more of your strengths fit this work` : ", and that fits this work"}.`);
    if (valueWhy.length) reasons.push(`It lines up with what matters to you: ${valueWhy.slice(0, 3).join(", ")}.`);
    if (sf.why.length) reasons.push(`It suits how you work: ${sf.why[0]}.`);
    if (spec.strong.length) reasons.push(`Your CV and answers already back up ${spec.strong.length} of the ${spec.total} skills and knowledge areas.`);
    results.push({
      code: o.code, title: o.title, overview: o.overview, level: lvl, levelNote, route: o.route, jobTitles: (o.jobTitles || []).slice(0, 6),
      fit: Math.round(fit * 100), match: spec.percent, reasons, onetLinked: !!o.onet,
    });
  }
  results.sort((a, b) => b.fit - a.fit);
  return { level, options: results.slice(0, limit) };
}

module.exports = { rank, specMatch, personLevel, occupationText, evidence, tokens, widen };
