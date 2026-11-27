// Beyond the Obvious: the hand-checked library of roles people don't often think of.
const test = require("node:test");
const assert = require("node:assert");
const { TRAITS, VALUES } = require("../lib/options/cards");
const beyond = require("../lib/options/beyond");
const report = require("../lib/options/report");
const routes = require("../lib/options/routes");

const TRAIT_IDS = new Set(TRAITS.map((t) => t.id));
const VALUE_IDS = new Set(VALUES.map((v) => v.id));
const WORLD_IDS = new Set(beyond.WORLDS.map((w) => w.id));

test("every role is complete, sourced and uses real card ids", () => {
  assert.ok(beyond.ROLES.length >= 15);
  assert.strictEqual(new Set(beyond.ROLES.map((r) => r.id)).size, beyond.ROLES.length);
  for (const r of beyond.ROLES) {
    assert.ok(r.title && r.what && r.whyMissed, r.id);
    assert.ok(r.sources.length >= 1, `${r.id} needs a source`);
    for (const s of [...r.sources, ...r.networks]) assert.match(s.url, /^https:\/\//, `${r.id}: ${s.name}`);
    assert.ok(r.waysIn.length >= 1, r.id);
    r.traits.forEach((t) => assert.ok(TRAIT_IDS.has(t), `${r.id}: trait ${t}`));
    r.values.forEach((v) => assert.ok(VALUE_IDS.has(v), `${r.id}: value ${v}`));
    r.worlds.forEach((w) => assert.ok(WORLD_IDS.has(w), `${r.id}: world ${w}`));
    assert.match(r.checked, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("Rachel's two examples are in the library", () => {
  const titles = beyond.ROLES.map((r) => [r.title, ...r.aka, r.what].join(" ").toLowerCase()).join("\n");
  assert.ok(titles.includes("arts-based knowledge translation"));
  assert.ok(titles.includes("participatory arts"));
});

test("no em-dashes and no pay figures anywhere in the library", () => {
  const all = JSON.stringify({ R: beyond.ROLES, W: beyond.WORLDS, N: report.BEYOND_NEXT });
  assert.ok(!all.includes("—"), "em-dash found");
  assert.ok(!/£\s?\d/.test(all), "pay figure found");
});

test("mixing art and health brings creative health roles to the top", () => {
  const ranked = beyond.rank({ personText: "I paint in my spare time and help at a community group.", mixText: "art and health", traits: [], values: {}, topValues: [] });
  const top = ranked.slice(0, 4).map((x) => x.role.id);
  assert.ok(top.includes("creative-health-practitioner"), top.join(","));
  const ch = ranked.find((x) => x.role.id === "creative-health-practitioner");
  assert.ok(ch.reasons[0].includes("two worlds"));
  assert.ok(!ch.reasons[0].includes("making and health"));
});

test("a gardener who wants to help people sees green care roles", () => {
  const ranked = beyond.rank({ personText: "I spend every weekend on my allotment growing veg.", mixText: "gardening and helping people", traits: [{ id: "outdoors", example: "I'm out in the garden whatever the weather" }], values: { outdoors: "must" }, topValues: ["outdoors"], workStyle: { where: "Outdoors" } });
  const top = ranked.slice(0, 3).map((x) => x.role.id);
  assert.ok(top.includes("therapeutic-horticulture"), top.join(","));
});

test("strengths without a real example don't count", () => {
  const a = beyond.rank({ personText: "", traits: [{ id: "write", example: "" }], values: {} }).find((x) => x.role.id === "trusts-fundraiser");
  const b = beyond.rank({ personText: "", traits: [{ id: "write", example: "I wrote our school's newsletter for two years" }], values: {} }).find((x) => x.role.id === "trusts-fundraiser");
  assert.ok(b.score > a.score);
});

test("spread gives batches of four, every role once, mixing worlds", () => {
  const batches = beyond.spread(beyond.rank({ personText: "", values: {} }), 4);
  const flat = batches.flat().map((x) => x.role.id);
  assert.strictEqual(flat.length, beyond.ROLES.length);
  assert.strictEqual(new Set(flat).size, beyond.ROLES.length);
  assert.ok(batches.slice(0, -1).every((b) => b.length === 4));
  for (const b of batches.slice(0, -1)) {
    const n = new Map(); b.forEach((x) => n.set(x.worlds[0], (n.get(x.worlds[0]) || 0) + 1));
    assert.ok([...n.values()].every((c) => c <= 2), "a batch has three roles from one world");
  }
});

test("health words never reach the matching through the mix question", () => {
  const a = routes.cleanAnswers({ life: { mix: "art and my anxiety therapy" } });
  assert.strictEqual(a.life.mix, "art and my anxiety therapy");
  const { noHealth } = report;
  assert.ok(!/anxiety|therapy/.test(noHealth(a.life.mix)));
});

test("the report for a library role has no % match, and lists sources and next steps", () => {
  const role = beyond.find("BTO:knowledge-mobilisation");
  assert.ok(role);
  const rep = report.buildBeyond(role, ["A reason"], { private: { include: false } });
  assert.strictEqual(rep.kind, "beyond");
  assert.strictEqual(rep.match, undefined);
  assert.ok(rep.sources.length && rep.nextSteps.length && rep.noMatchNote);
  assert.strictEqual(rep.howYouWorkBest, null);
  assert.ok(beyond.roleSpec(role).includes("Sources:"));
  assert.strictEqual(beyond.find("OCC123"), null);
});
