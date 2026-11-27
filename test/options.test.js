// Identify Your Options: matching, report and data-reading tests.
// The occupations below are TEST FIXTURES ONLY, shaped like Skills England data.
// They are never shown to job seekers.
const test = require("node:test");
const assert = require("node:assert");
const { TRAITS, VALUES } = require("../lib/options/cards");
const match = require("../lib/options/match");
const report = require("../lib/options/report");
const careers = require("../lib/options/careerData");

const FIX = [
  { code: "OCC9001", title: "Test quality inspector", overview: "Checks products meet the standard.", level: 3, route: "Test route",
    jobTitles: ["Test inspector"], keywords: ["quality", "inspection"], duties: ["Inspect products against the standard"],
    skills: ["Inspect products for faults and record results accurately", "Use measuring equipment to check accuracy"],
    knowledge: ["Health and safety rules for the workplace"], behaviours: ["Attention to detail"], products: ["Apprenticeship standard"], onet: null },
  { code: "OCC9002", title: "Test outdoor landscaper", overview: "Builds and looks after gardens.", level: 2, route: "Test route",
    jobTitles: ["Test landscaper"], keywords: ["outdoor", "horticulture"], duties: ["Plant and maintain gardens outdoors"],
    skills: ["Use hand tools to build garden features", "Maintain lawns and planting"], knowledge: ["Plant care"], behaviours: ["Works safely"], products: [], onet: null },
  { code: "OCC9003", title: "Test senior manager", overview: "Leads a large business.", level: 7, route: "Test route",
    jobTitles: [], keywords: [], duties: [], skills: ["Set strategy"], knowledge: [], behaviours: [], products: [], onet: null },
];

test("the approved card counts are intact", () => {
  assert.strictEqual(TRAITS.length, 36);
  assert.strictEqual(VALUES.length, 24);
  assert.strictEqual(new Set(TRAITS.map((t) => t.id)).size, 36);
});

test("no em-dashes in any card wording", () => {
  const all = JSON.stringify({ TRAITS, VALUES });
  assert.ok(!all.includes("—"));
});

test("traits without a real example don't count", () => {
  const r1 = match.rank(FIX, { personText: "", traits: [{ id: "detail", example: "" }], values: {}, qualification: "gcse" });
  const r2 = match.rank(FIX, { personText: "", traits: [{ id: "detail", example: "I found the mistakes in the stock count at the shop every week." }], values: {}, qualification: "gcse" });
  const f1 = r1.options.find((o) => o.code === "OCC9001").fit;
  const f2 = r2.options.find((o) => o.code === "OCC9001").fit;
  assert.ok(f2 > f1);
});

test("a detail person ranks the inspector above the landscaper", () => {
  const r = match.rank(FIX, {
    personText: "I inspect stock, record results accurately and check faults.",
    traits: [{ id: "detail", example: "I spotted errors in the weekly stock sheets that saved the shop money." }],
    values: { routine: "must" }, workStyle: { where: "Indoors" }, qualification: "gcse", experienceYears: 2,
  });
  assert.strictEqual(r.options[0].code, "OCC9001");
  assert.ok(r.options[0].reasons.length > 0);
});

test("an outdoors person ranks the landscaper first", () => {
  const r = match.rank(FIX, {
    personText: "I look after my garden and use hand tools.",
    traits: [{ id: "outdoors", example: "I spend every weekend on my allotment, building beds and planting." }],
    values: { outdoors: "must" }, topValues: ["outdoors"], workStyle: { where: "Outdoors", hands: "Hands-on, on my feet" }, qualification: "gcse",
  });
  assert.strictEqual(r.options[0].code, "OCC9002");
});

test("roles far above the person's level are not suggested", () => {
  const r = match.rank(FIX, { personText: "", traits: [], values: {}, qualification: "gcse" });
  assert.ok(!r.options.some((o) => o.code === "OCC9003"));
});

test("the % match explains itself and counts gaps", () => {
  const m = match.specMatch(FIX[0], "I inspect products for faults and record results accurately.");
  assert.ok(m.percent > 0 && m.percent <= 100);
  assert.ok(m.how.includes("estimate"));
  assert.strictEqual(m.strong.length + m.partial.length + m.gaps.length, m.total);
});

test("Off gives gaps without ideas; Essentials adds practical ideas; nothing private by default", async () => {
  const p = { personText: "I like gardening.", traits: [{ id: "detail", example: "I check every order twice before it goes out." }], private: { howIWorkBest: "private note", include: false } };
  const off = await report.build(FIX[0], p, "off");
  const ess = await report.build(FIX[0], p, "essentials");
  assert.ok(off.gaps.length > 0 && off.ideas.length === 0);
  assert.ok(ess.ideas.length > 0);
  assert.strictEqual(ess.howYouWorkBest, null);
  assert.ok(ess.nextStep.includes("specialist recruiter"));
  assert.ok(!JSON.stringify(ess).includes("—"));
});

test("private notes only appear when the person ticks to include them", async () => {
  const p = { personText: "", traits: [], private: { howIWorkBest: "Quiet room please", helps: { detail: "Written instructions" }, include: true } };
  const r = await report.build(FIX[0], p, "essentials");
  assert.ok(r.howYouWorkBest && r.howYouWorkBest.notes === "Quiet room please");
});

test("reading Skills England answers without relying on exact field names", () => {
  const raw = { Occupation: { OccupationCode: "occ0135", OccupationTitle: "Chef de partie", Overview: "<p>Runs a section</p>",
    MapHierarchy: { TechnicalLevel: "Level 3", Route: { Name: "Catering and hospitality" } },
    TypicalJobTitles: [{ Title: "Chef" }, { Title: "Section chef" }],
    DutiesKSB: { Skills: [{ Detail: "Prepare dishes" }], Knowledge: [{ Detail: "Food safety" }], Behaviours: [{ Detail: "Team working" }] } } };
  const o = careers.normaliseOccupation(raw);
  assert.strictEqual(o.code, "OCC0135");
  assert.strictEqual(o.title, "Chef de partie");
  assert.strictEqual(o.level, 3);
  assert.strictEqual(o.route, "Catering and hospitality");
  assert.deepStrictEqual(o.jobTitles, ["Chef", "Section chef"]);
  assert.deepStrictEqual(o.skills, ["Prepare dishes"]);
  assert.strictEqual(o.overview, "Runs a section");
});

test("occupation codes are found anywhere in a routes answer", () => {
  const codes = careers.occupationCodes({ routes: [{ occupations: [{ code: "OCC0001" }, { links: { x: "OCC0002" } }] }] });
  assert.deepStrictEqual([...codes].sort(), ["OCC0001", "OCC0002"]);
});

test("O*NET links are only kept when the job titles are close", () => {
  const occ = [{ title: "Chef de partie", jobTitles: ["Chef"], onet: null }, { title: "Rail engineering technician", jobTitles: [], onet: null }];
  careers.linkOnet(occ, [{ code: "35-1011.00", title: "Chefs and Head Cooks", titles: ["Chefs and Head Cooks", "Chef"], styles: { "Attention to Detail": 0.8 }, values: {} }]);
  assert.ok(occ[0].onet && occ[0].onet.code === "35-1011.00");
  assert.strictEqual(occ[1].onet, null);
});

test("what we heard: picks likely answers out of a story, one per question, no AI", () => {
  const { heard } = require("../lib/options/cards");
  const h = heard("A busy Saturday at the garden centre, helping customers outside. My manager showed me how.");
  const byId = Object.fromEntries(h.map((x) => [x.id, x.answer]));
  assert.strictEqual(byId.noise, "Somewhere with a buzz");
  assert.strictEqual(byId.where, "Outdoors");
  assert.strictEqual(new Set(h.map((x) => x.id)).size, h.length);
  assert.deepStrictEqual(heard(""), []);
});

test("the story and 'tell us why' notes count in matching; private notes never do", () => {
  const { cleanAnswers, personText } = require("../lib/options/routes");
  const a = cleanAnswers({ story: "Fixing bikes in the shed", workNotes: { where: "I love fresh air", bogus: "x" }, heard: [{ id: "where", answer: "Outdoors", label: "Out in the fresh air" }, { id: "where", answer: "Moon" }] });
  assert.ok(personText(a).includes("Fixing bikes") && personText(a).includes("fresh air"));
  assert.deepStrictEqual(Object.keys(a.workNotes), ["where"]);
  assert.strictEqual(a.heard.length, 1);
});

test("strengths read as what others would say, with no em-dashes", () => {
  for (const t of TRAITS) { assert.ok(/^(You|People|Routine)\b/.test(t.said), t.said); assert.ok(!/\b(I|my|me|myself)\b/.test(t.said), t.said); }
});

test("private notes are only kept with explicit consent, and unticking deletes them", () => {
  const { cleanPrivate } = require("../lib/options/routes");
  const none = cleanPrivate({ howIWorkBest: "I have ME", helps: { detail: "Quiet room" }, include: true });
  assert.strictEqual(none.howIWorkBest, ""); assert.deepStrictEqual(none.helps, {}); assert.strictEqual(none.include, false); assert.strictEqual(none.consent.given, false);
  const yes = cleanPrivate({ howIWorkBest: "Quiet room", helps: { detail: "Written instructions" }, include: true, consent: { given: true, at: "2026-11-27T09:00:00Z", version: "2026-11-27" } });
  assert.strictEqual(yes.howIWorkBest, "Quiet room"); assert.strictEqual(yes.consent.version, "2026-11-27");
  const withdrawn = cleanPrivate({ ...yes, consent: { given: false } });
  assert.strictEqual(withdrawn.howIWorkBest, "");
});
