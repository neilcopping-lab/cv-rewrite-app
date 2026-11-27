// Identify Your Options: tests for every target market (27 Nov 2026).
// Returners, long-term carers, people living with a long-term illness,
// neurodivergent people (no label needed), career changers, NEETs and people
// struggling to decide. Uses TEST FIXTURE occupations and made-up people.
const test = require("node:test");
const assert = require("node:assert");
const { OCCUPATIONS, PERSONAS, profileOf } = require("./fixtures/optionsPersonas");
const match = require("../lib/options/match");
const report = require("../lib/options/report");
const ai = require("../lib/anthropic");

const run = (p, extra = {}) => match.rank(OCCUPATIONS, { ...profileOf(p), ...extra }, { limit: 12 });
const persona = (id) => PERSONAS.find((p) => p.id === id);
const titles = (r, n = 3) => r.options.slice(0, n).map((o) => o.title.replace("TEST FIXTURE: ", ""));
const LABELS = /\b(adhd|autis\w*|asperger|dyslexi\w*|neurodiver\w*|disab\w*|diagnos\w*|illness|depress\w*|anxiety|condition|carer status)\b/i;
const ME = /\bME\b/; // the illness, in capitals; "me" is just a word

test("every target market gets at least three options", () => {
  for (const p of PERSONAS) assert.ok(run(p).options.length >= 3, p.market);
});

test("people with no CV at all (carers, NEETs) still get real options", () => {
  for (const id of ["carer", "neet"]) {
    const r = run(persona(id));
    assert.ok(r.options.length >= 3, id);
    assert.ok(r.options[0].fit >= 40, `${id} top fit ${r.options[0].fit}`);
  }
});

test("each market's top options make sense for them", () => {
  assert.strictEqual(titles(run(persona("carer")), 1)[0], "Care worker");
  assert.strictEqual(titles(run(persona("neet")), 1)[0], "Junior content producer");
  assert.strictEqual(titles(run(persona("ill")), 1)[0], "Business administrator");
  assert.strictEqual(titles(run(persona("changer")), 1)[0], "Operations manager");
  const nd = titles(run(persona("neurodivergent")));
  assert.ok(nd.some((t) => ["Data technician", "Quality inspector", "Warehouse operative"].includes(t)), nd.join(", "));
  const ret = titles(run(persona("returner")));
  assert.ok(ret.some((t) => ["Customer service practitioner", "Care worker", "Teaching assistant"].includes(t)), ret.join(", "));
});

test("levels suit each person", () => {
  const changer = run(persona("changer"));
  assert.ok(changer.options.every((o) => o.level >= 3), "a head chef with 15 years isn't offered Level 2 roles");
  const lower = changer.options.find((o) => o.level < changer.level);
  assert.ok(lower && /a way in to something new/.test(lower.levelNote), "lower-level roles are framed as a way in, not as 'in line with your experience'");
  const neet = run(persona("neet"));
  assert.ok(neet.options.every((o) => o.level <= 3), "a NEET isn't offered management roles");
  assert.ok(neet.options.some((o) => /step up/.test(o.levelNote)), "a step up with training is offered");
});

test("unpaid experience counts: years of caring lift the level like paid work", () => {
  const carer = run(persona("carer"));
  const noYears = run(persona("carer"), { experienceYears: 0 });
  assert.ok(carer.level > noYears.level);
});

test("everyday words count as work skills", () => {
  const plain = match.specMatch(OCCUPATIONS.find((o) => o.code === "OCC9213"), "Trained apprentices, ran the rota, managed budgets and staff.");
  assert.ok(plain.percent >= 40, `got ${plain.percent}%`);
});

test("fairness: telling us about health, caring, age or gender never lowers a score", () => {
  const disclosures = [
    "I was off for two years with depression and I'm 58.",
    "I'm a single dad and I've been a carer for my wife.",
    "I'm autistic and I use a wheelchair.",
  ];
  for (const p of PERSONAS) {
    const base = new Map(run(p).options.map((o) => [o.code, o.fit]));
    for (const d of disclosures) {
      const pp = JSON.parse(JSON.stringify(p));
      pp.profile.life = { ...(pp.profile.life || {}), doing: [pp.profile.life && pp.profile.life.doing, d].filter(Boolean).join(" ") };
      for (const o of run(pp).options) if (base.has(o.code)) assert.ok(o.fit >= base.get(o.code), `${p.market}: "${d}" lowered ${o.title} from ${base.get(o.code)} to ${o.fit}`);
    }
  }
});

test("fairness: swapping mum for dad, or he for she, changes nothing", () => {
  const p = persona("carer");
  const swapped = JSON.parse(JSON.stringify(p).replace(/\bmum\b/g, "dad").replace(/\bher\b/g, "his").replace(/\bshe\b/g, "he"));
  assert.deepStrictEqual(run(p).options.map((o) => [o.code, o.fit]), run(swapped).options.map((o) => [o.code, o.fit]));
});

test("no labels or health words ever appear in options or reasons", () => {
  for (const p of PERSONAS) {
    const pp = JSON.parse(JSON.stringify(p));
    pp.profile.life = { ...(pp.profile.life || {}), doing: "I have ADHD and anxiety and I'm disabled." };
    for (const o of run(pp).options) {
      const words = [o.levelNote, ...o.reasons].join(" ");
      assert.ok(!LABELS.test(words) && !ME.test(words), `${p.market}: "${words}"`);
    }
  }
});

test("private notes stay private: not in matching, not in the report unless ticked", async () => {
  const p = persona("ill");
  assert.ok(!profileOf(p).personText.includes("ME"), "private notes are not in the matching text");
  const o = OCCUPATIONS.find((x) => x.code === "OCC9205");
  const r = await report.build(o, profileOf(p), "essentials");
  assert.strictEqual(r.howYouWorkBest, null);
  assert.ok(!JSON.stringify(r).includes("I have ME"));
});

test("Full help: health details are stripped before anything goes to the AI", async () => {
  const sent = [];
  const orig = { askJSON: ai.askJSON, hasKey: ai.hasKey };
  ai.askJSON = async (req) => { sent.push(req.prompt); return { answers: [], plan: [] }; };
  ai.hasKey = () => true;
  try {
    for (const p of PERSONAS) {
      const pp = JSON.parse(JSON.stringify(p));
      pp.profile.traits = pp.profile.traits.map((t) => ({ ...t, example: t.example + " I did this while managing my depression and ADHD, between hospital appointments." }));
      await report.build(OCCUPATIONS.find((x) => x.code === "OCC9205"), profileOf(pp), "full");
    }
  } finally { ai.askJSON = orig.askJSON; ai.hasKey = orig.hasKey; }
  assert.ok(sent.length === PERSONAS.length, "coaching was requested for each person");
  for (const prompt of sent) {
    assert.ok(!/depression|adhd|hospital|appointments|medication/i.test(prompt), prompt);
    assert.ok(prompt.includes("[private]"));
  }
});

test("AI set to Off: every market still gets options and a report, with no AI", async () => {
  const orig = ai.askJSON; let called = false;
  ai.askJSON = async () => { called = true; return {}; };
  try {
    for (const p of PERSONAS) {
      const r = run(p);
      assert.ok(r.options.length >= 3);
      const rep = await report.build(OCCUPATIONS.find((x) => x.code === r.options[0].code), profileOf(p), "off");
      assert.ok(rep.match.total > 0);
      assert.deepStrictEqual(rep.ideas, []);
      assert.ok(rep.nextStep.includes("specialist recruiter"));
    }
  } finally { ai.askJSON = orig; }
  assert.strictEqual(called, false);
});

test("health words are taken out of the text used for matching", () => {
  const routes = require("../lib/options/routes");
  const a = routes.cleanAnswers({ story: "I worked in a garden centre while managing my depression and ADHD.", life: { doing: "Hospital appointments for my diabetes." } });
  const text = require("../lib/options/report").noHealth(routes.personText(a));
  assert.ok(!/depression|adhd|hospital|diabetes|appointments/i.test(text), text);
  assert.ok(/garden centre/.test(text));
});
