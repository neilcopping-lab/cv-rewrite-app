const test = require("node:test");
const assert = require("node:assert");
const { fitVerdict } = require("../lib/fit");
const { nextStep, draft } = require("../accounts/jobhunt");

const reqs = (c, t, m) => [...Array(c).fill({ status: "covered" }), ...Array(t).fill({ status: "thin" }), ...Array(m).fill({ status: "missing", requirement: "Forklift licence" })];

test("is it worth applying: green, amber, red", () => {
  assert.equal(fitVerdict(reqs(9, 1, 0)).level, "green");
  assert.equal(fitVerdict(reqs(6, 2, 2)).level, "amber");
  const red = fitVerdict(reqs(3, 1, 6));
  assert.equal(red.level, "red");
  assert.match(red.note, /Forklift licence/);
  assert.equal(fitVerdict([]), null);
  for (const v of [fitVerdict(reqs(9, 1, 0)), fitVerdict(reqs(6, 2, 2)), red]) assert.ok(!/—/.test(v.note), "no em dashes");
});

test("job hunt: one next step at a time, and only when it's due", () => {
  const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
  assert.equal(nextStep({ status: "saved" }).kind, "apply");
  assert.equal(nextStep({ status: "applied", applied_at: ago(3) }).kind, "wait");
  assert.equal(nextStep({ status: "applied", applied_at: ago(11) }).kind, "chase");
  assert.equal(nextStep({ status: "applied", applied_at: ago(11), chased_at: ago(1) }).kind, "wait");
  assert.equal(nextStep({ status: "interview", interview_at: ago(-2) }).kind, "prep");
  assert.equal(nextStep({ status: "interview", interview_at: ago(1) }).kind, "thanks");
  assert.equal(nextStep({ status: "no" }).kind, "feedback");
});

test("follow-up kit: polite messages with nothing made up", () => {
  const j = { title: "Kitchen Porter", company: "The Crown", applied_at: "2026-11-01T10:00:00Z" };
  for (const k of ["chase", "thanks", "feedback"]) {
    const d = draft(k, j, "Sam Patel");
    assert.ok(d.subject && d.body.includes("Sam Patel"));
    assert.ok(!/—/.test(d.body + d.subject), "no em dashes");
  }
  assert.match(draft("chase", j, "").body, /1 November/);
  assert.match(draft("thanks", j, "").body, /\[Your name\]/);
  assert.equal(draft("nonsense", j, ""), null);
});
