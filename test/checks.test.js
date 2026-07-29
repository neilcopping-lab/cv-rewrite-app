const test = require("node:test");
const assert = require("node:assert");
const checks = require("../lib/checks");
const { checkNumbers } = require("../lib/fabricationChecker");
const { extractNumbers } = require("../lib/sourceOfTruth");

test("banned punctuation (em dash) is a hard fail", () => {
  const cv = { personalStatement: "I lead teams — big ones.", experience: [], skills: [], education: [], interests: [] };
  const r = checks.run(cv);
  assert.ok(!r.ok, "should not pass with an em dash");
  assert.ok(r.fails.some((f) => /em dash/.test(f.detail)));
});

test("US spelling is flagged", () => {
  const cv = { personalStatement: "I organize events and optimize budgets.", experience: [], skills: [], education: [], interests: [] };
  const r = checks.run(cv);
  assert.ok(r.issues.some((i) => /organize/.test(i.detail)));
  assert.ok(r.issues.some((i) => /optimize/.test(i.detail)));
});

test("clean UK CV passes programmatic checks", () => {
  const cv = { personalStatement: "I run events. I like honest teams. My dog agrees.", skills: [{ skill: "Events", proof: "Ran 40 events." }], experience: [{ title: "Manager", company: "X", dates: "2020 to now", responsibilities: ["Ran the team."], achievements: ["Grew revenue by 20%."] }], education: [], interests: ["Trail running"] };
  const r = checks.run(cv);
  assert.ok(r.ok, JSON.stringify(r.fails));
});

test("personal statement over 3 sentences is flagged", () => {
  const cv = { personalStatement: "One. Two. Three. Four.", experience: [], skills: [], education: [], interests: [] };
  const r = checks.run(cv);
  assert.ok(r.issues.some((i) => /max 3/.test(i.detail)));
});

test("number extraction finds metrics, currency, percentages, years", () => {
  const nums = extractNumbers("Grew revenue by £1.4m, cut churn from 18% to 9% since 2019 across 14 accounts.");
  assert.ok(nums.some((n) => n.includes("1.4m")));
  assert.ok(nums.some((n) => n.includes("18")));
  assert.ok(nums.some((n) => n.includes("2019")));
});

test("fabrication number check catches an invented metric", () => {
  const sot = { numbers: extractNumbers("Managed a team and grew revenue by £1.4m."), corpusLower: "managed a team and grew revenue by £1.4m." };
  const cv = { personalStatement: "Increased sales by 30% and grew revenue by £1.4m.", experience: [], skills: [], education: [], interests: [] };
  const flags = checkNumbers(cv, sot);
  assert.ok(flags.some((f) => /30/.test(f.value)), "should flag the invented 30%");
  assert.ok(!flags.some((f) => /1\.4/.test(f.value)), "should NOT flag the genuine £1.4m");
});

test("fabrication number check passes when every number traces to source", () => {
  const sot = { numbers: extractNumbers("Grew revenue by £1.4m over 2 years managing 14 accounts."), corpusLower: "grew revenue by £1.4m over 2 years managing 14 accounts." };
  const cv = { personalStatement: "Grew revenue by £1.4m across 14 accounts.", experience: [], skills: [], education: [], interests: [] };
  const flags = checkNumbers(cv, sot);
  assert.strictEqual(flags.length, 0, JSON.stringify(flags));
});
