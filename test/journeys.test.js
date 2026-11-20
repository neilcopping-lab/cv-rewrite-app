const test = require("node:test");
const assert = require("node:assert");
const journeys = require("../lib/journeys");
const masterCv = require("../lib/masterCv");
const health = require("../lib/healthCheck");
const { headerFrom } = require("../lib/masterImport");

test("three journeys, each with all seven steps and its own questions", () => {
  assert.deepStrictEqual(journeys.IDS, ["first", "update", "back"]);
  for (const id of journeys.IDS) {
    const j = journeys.JOURNEYS[id];
    assert.deepStrictEqual([...j.order].sort(), [...journeys.STEP_KEYS].sort(), id);
    assert.ok(j.questions.length >= 6, id);
  }
  assert.strictEqual(journeys.JOURNEYS.first.order.indexOf("education") < journeys.JOURNEYS.first.order.indexOf("experience"), true);
});

test("no em or en dashes anywhere people will read", () => {
  assert.ok(!/[–—]/.test(JSON.stringify(journeys.forPage())));
});

test("private answers are kept but never labelled for the write-up", () => {
  const cv = masterCv.normalise({ journey: "back", statementAnswers: { needs: "School hours", before: "Office manager" } });
  assert.strictEqual(cv.statementAnswers.needs, "School hours");
  assert.ok(!("needs" in journeys.labelsFor("back")));
  assert.deepStrictEqual(journeys.privateKeys("back"), ["needs"]);
});

test("own proof line replaces the ready-written one; career breaks have no reason for leaving", () => {
  const cv = masterCv.normalise({ behaviours: ["detail"], behaviourProof: { detail: "Caught a billing error before it went out", reliable: "dropped" }, experience: [{ kind: "break", title: "Career break", dates: "2021 to 2025", reasonForLeaving: "x" }] });
  assert.deepStrictEqual(Object.keys(cv.behaviourProof), ["detail"]);
  assert.strictEqual(masterCv.forFresh(cv).strengths[0].proof, "Caught a billing error before it went out");
  assert.strictEqual(cv.experience[0].reasonForLeaving, "");
});

test("health check: seven stops, first CVs aren't marked down for no jobs", () => {
  const empty = health.check(masterCv.normalise({}), { journey: "first" });
  assert.strictEqual(empty.stops.length, 7);
  assert.strictEqual(empty.stops.find((s) => s.id === "history").rag, "amber");
  assert.strictEqual(health.check(masterCv.normalise({}), { journey: "update" }).stops.find((s) => s.id === "history").rag, "red");
  const press = health.check(masterCv.normalise({ personalStatement: "A results-driven professional with a proven track record of delivering excellence across a range of busy teams and settings in the leisure and hospitality sector." }));
  assert.strictEqual(press.stops.find((s) => s.id === "statement").rag, "amber");
});

test("contact details come from the CV text, not the AI", () => {
  const h = headerFrom("SAM TAYLOR\nsam@example.com | 07700 900456 | linkedin.com/in/samtaylor\nPROFILE");
  assert.strictEqual(h.name, "Sam Taylor");
  assert.strictEqual(h.contacts.email, "sam@example.com");
  assert.strictEqual(h.contacts.phone, "07700 900456");
  assert.ok(h.linkedin.startsWith("https://"));
});
