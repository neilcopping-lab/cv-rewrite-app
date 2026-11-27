// Identify Your Options: the API behind /options-app.html.
//
// Signed-in only, like the CV Builder: answers are saved to the person's
// account so they can stop and come back.
//
//   GET  /api/options/cards     the trait bank, values cards, work style questions, data status
//   GET  /api/options/profile   their saved answers
//   POST /api/options/profile   save answers (and the private notes, kept apart)
//   POST /api/options/cv-text   pull text from an uploaded CV (plain reading, no AI)
//   POST /api/options/match     their career options (rules-based, works with AI Off)
//   POST /api/options/report    Your Options Report for one option
//   POST /api/options/build-cv  hand one option to CV Rewrite as a job card, to build the CV

const path = require("path");
const multer = require("multer");
const { TRAITS, VALUES, WORK_STYLE, TRAIT_GROUPS, PILES, heard } = require("./cards");
const careers = require("./careerData");
const match = require("./match");
const report = require("./report");
const aiLevel = require("../aiLevel");
const extract = require("../extractText");

const GUIDE_CV = "https://the-common-people.com/guide-cv.html";
const upload = multer({ dest: path.join(__dirname, "..", "..", "tmp"), limits: { fileSize: 8 * 1024 * 1024 } });
const TRAIT_IDS = new Set(TRAITS.map((t) => t.id));
const VALUE_IDS = new Set(VALUES.map((v) => v.id));
const WS = new Map(WORK_STYLE.map((w) => [w.id, w.a]));
const QUALS = ["none", "gcse", "level2", "alevel", "level3", "level4", "hnc", "level5", "hnd", "foundation", "degree", "masters", "phd"];
const str = (v, n) => String(v == null ? "" : v).slice(0, n);

// Keep only what we expect, at sensible sizes.
function cleanAnswers(a) {
  a = a && typeof a === "object" ? a : {};
  const workStyle = {};
  for (const [k, v] of Object.entries(a.workStyle || {})) if (WS.has(k) && WS.get(k).includes(v)) workStyle[k] = v;
  const traits = (Array.isArray(a.traits) ? a.traits : []).filter((t) => t && TRAIT_IDS.has(t.id)).slice(0, 36).map((t) => ({ id: t.id, example: str(t.example, 1200) }));
  const values = {};
  for (const [k, v] of Object.entries(a.values || {})) if (VALUE_IDS.has(k) && PILES.includes(v)) values[k] = v;
  const topValues = (Array.isArray(a.topValues) ? a.topValues : []).filter((id) => values[id] === "must").slice(0, 5);
  const workNotes = {};
  for (const [k, v] of Object.entries(a.workNotes || {})) if (WS.has(k) && String(v).trim()) workNotes[k] = str(v, 1500);
  const life = {};
  for (const k of ["interests", "favourite", "doing", "learn"]) life[k] = str((a.life || {})[k], 3000);
  return {
    step: Math.max(1, Math.min(7, parseInt(a.step, 10) || 1)),
    startedWith: a.startedWith === "none" ? "none" : "cv",
    cvText: str(a.cvText, 40000),
    story: str(a.story, 4000),
    heard: (Array.isArray(a.heard) ? a.heard : []).filter((h) => h && WS.has(h.id) && WS.get(h.id).includes(h.answer)).slice(0, 8)
      .map((h) => ({ id: h.id, answer: h.answer, label: str(h.label, 80), off: h.off === true })),
    workStyle, workNotes, traits, values, topValues,
    goodDay: str(a.goodDay, 3000),
    life,
    qualification: QUALS.includes(a.qualification) ? a.qualification : "",
    experienceYears: Math.max(0, Math.min(60, parseInt(a.experienceYears, 10) || 0)),
  };
}
function cleanPrivate(p) {
  p = p && typeof p === "object" ? p : {};
  const helps = {};
  for (const [k, v] of Object.entries(p.helps || {})) if (TRAIT_IDS.has(k) && String(v).trim()) helps[k] = str(v, 300);
  return { howIWorkBest: str(p.howIWorkBest, 2000), helps, include: p.include === true };
}

// Everything the matching can read. Private notes are never part of it.
function personText(a) {
  return [a.cvText, a.story, a.goodDay, ...Object.values(a.workNotes || {}), ...Object.values(a.life || {}), ...(a.traits || []).map((t) => t.example)].filter(Boolean).join("\n");
}
function profileFor(a, priv) {
  return { personText: personText(a), traits: a.traits, values: a.values, topValues: a.topValues, workStyle: a.workStyle, qualification: a.qualification, experienceYears: a.experienceYears, private: priv };
}

// A plain job spec for CV Rewrite, written only from the Skills England data.
function roleSpec(o) {
  const lines = [`Role: ${o.title}${o.level ? ` (Level ${o.level})` : ""}`];
  if (o.overview) lines.push("", o.overview);
  if (o.duties && o.duties.length) lines.push("", "What the job involves:", ...o.duties.map((d) => `- ${d}`));
  if (o.skills && o.skills.length) lines.push("", "Skills needed:", ...o.skills.map((d) => `- ${d}`));
  if (o.knowledge && o.knowledge.length) lines.push("", "Knowledge needed:", ...o.knowledge.map((d) => `- ${d}`));
  if (o.behaviours && o.behaviours.length) lines.push("", "Behaviours:", ...o.behaviours.map((d) => `- ${d}`));
  lines.push("", "Source: Skills England occupational standard (Open Government Licence v3.0).");
  return lines.join("\n").slice(0, 30000);
}

function mount(app, { accountsOn }) {
  const signedIn = (req, res) => {
    if (accountsOn() && req.user && req.sb) return true;
    res.status(401).json({ error: "Please sign in to use Identify Your Options.", signIn: "/account/?next=" + encodeURIComponent("/options-app.html") });
    return false;
  };
  const fail = (res, e, what) => {
    console.error(`[options] ${what}:`, e.message);
    res.status(500).json({ error: "Something went wrong there. Your answers are still on this page, so please try again in a moment." });
  };
  async function load(req) {
    const { data, error } = await req.sb.from("options_profiles").select("answers, private_notes, chosen, updated_at").eq("user_id", req.user.id).maybeSingle();
    if (error) throw new Error(error.message);
    return { answers: cleanAnswers(data && data.answers), priv: cleanPrivate(data && data.private_notes), chosen: (data && data.chosen) || [], updatedAt: data && data.updated_at };
  }
  async function save(req, fields) {
    const now = new Date().toISOString();
    const row = { user_id: req.user.id, ...fields, updated_at: now };
    const { error } = await req.sb.from("options_profiles").upsert(row, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return now;
  }

  app.get("/api/options/cards", (req, res) => {
    res.json({
      traitGroups: TRAIT_GROUPS,
      traits: TRAITS.map(({ id, group, card, said, kinds, helps }) => ({ id, group, card, said, kinds, helps })),
      values: VALUES.map(({ id, label, plain }) => ({ id, label, plain })),
      workStyle: WORK_STYLE,
      data: careers.status(),
      aiLevel: aiLevel.levelOf(req),
      signedIn: !!(req.user && req.sb),
    });
  });

  // "Here's what we heard": likely answers picked out of their story with plain
  // word rules. No AI, so it works on every setting. The person keeps or removes each one.
  app.post("/api/options/heard", (req, res) => {
    if (!signedIn(req, res)) return;
    res.json({ heard: heard(str(req.body && req.body.story, 4000)) });
  });

  app.get("/api/options/profile", async (req, res) => {
    if (!signedIn(req, res)) return;
    try { const p = await load(req); res.set("Cache-Control", "no-store"); res.json({ answers: p.answers, private: p.priv, chosen: p.chosen, updatedAt: p.updatedAt }); }
    catch (e) { fail(res, e, "load"); }
  });

  app.post("/api/options/profile", async (req, res) => {
    if (!signedIn(req, res)) return;
    try {
      const fields = { answers: cleanAnswers(req.body && req.body.answers) };
      if (req.body && req.body.private) fields.private_notes = cleanPrivate(req.body.private);
      res.json({ ok: true, updatedAt: await save(req, fields) });
    } catch (e) { fail(res, e, "save"); }
  });

  app.post("/api/options/cv-text", (req, res, next) => (signedIn(req, res) ? next() : null), upload.single("cvFile"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Please choose a Word or PDF file." });
    try { const text = await extract.fromFile(req.file.path, req.file.mimetype, req.file.originalname); res.json({ text: str(text, 40000) }); }
    catch (e) { res.status(400).json({ error: "We couldn't read that file. Try a Word or PDF file, or paste the text instead." }); }
  });

  app.post("/api/options/match", async (req, res) => {
    if (!signedIn(req, res)) return;
    const d = careers.load();
    if (!d) return res.status(503).json({ error: "The career options aren't ready yet. We're still loading the official job data, so please come back soon. Your answers are saved.", notReady: true });
    try {
      const p = await load(req);
      const out = match.rank(d.occupations, profileFor(p.answers, null), { limit: 12 });
      res.json({ ...out, attribution: careers.ATTRIBUTION, onetUsed: out.options.some((o) => o.onetLinked) });
    } catch (e) { fail(res, e, "match"); }
  });

  app.post("/api/options/report", async (req, res) => {
    if (!signedIn(req, res)) return;
    const d = careers.load();
    const o = d && d.occupations.find((x) => x.code === String((req.body && req.body.code) || "").toUpperCase());
    if (!o) return res.status(404).json({ error: "We couldn't find that option. Please go back and pick it again." });
    try {
      const p = await load(req);
      const rep = await report.build(o, profileFor(p.answers, p.priv), aiLevel.levelOf(req));
      const chosen = [{ code: o.code, title: o.title }, ...p.chosen.filter((c) => c && c.code !== o.code)].slice(0, 10);
      await save(req, { chosen });
      res.json({ report: rep, aiLevel: aiLevel.levelOf(req) });
    } catch (e) { fail(res, e, "report"); }
  });

  app.post("/api/options/build-cv", async (req, res) => {
    if (!signedIn(req, res)) return;
    if (!aiLevel.gate(req, res, "core", "", GUIDE_CV)) return;
    const d = careers.load();
    const o = d && d.occupations.find((x) => x.code === String((req.body && req.body.code) || "").toUpperCase());
    if (!o) return res.status(404).json({ error: "We couldn't find that option. Please go back and pick it again." });
    try {
      const p = await load(req);
      const now = new Date().toISOString();
      const { data, error } = await req.sb.from("job_hunt").insert({
        user_id: req.user.id, title: str(o.title, 200), company: "", advert: roleSpec(o), cv_text: str(p.answers.cvText, 40000),
        notes: "Added from Identify Your Options.", updated_at: now,
      }).select("id").single();
      if (error) throw new Error(error.message);
      res.json({ url: `/app.html?job=${data.id}${p.answers.cvText ? "" : "&from=master"}` });
    } catch (e) { fail(res, e, "build-cv"); }
  });
}

module.exports = { mount, cleanAnswers, cleanPrivate, personText, roleSpec };
