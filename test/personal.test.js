// Bias test fix (20 Nov 2026): personal details an employer doesn't need never
// go into a write-up, even when the person mentions them.
const test = require("node:test");
const assert = require("node:assert");
const w = require("../lib/masterWriter");

test("age, health, religion, origin and family are caught", () => {
  for (const t of [
    "I'm a 58-year-old general manager at the Fox.",
    "I'm 34 and I run a busy pub.",
    "I'm dyslexic, so I plan with voice notes.",
    "I help out at the food bank my mosque runs.",
    "I help out at the food bank my church runs.",
    "I moved here from Ghana when I was twelve.",
    "My two kids keep me busy.",
  ]) assert.ok(w.personal(t, "update").length, t);
});

test("ordinary CV lines are left alone", () => {
  for (const t of [
    "I cut wage cost from 36 to 31 percent in a year.",
    "I manage a team of 18 people.",
    "I'm 18 percent ahead of budget.",
    "I took over a pub that was losing staff every few weeks.",
  ]) assert.deepStrictEqual(w.personal(t, "update"), [], t);
});

test("back to work: the break can be named in their own words", () => {
  assert.deepStrictEqual(w.personal("I came back after three years raising my family.", "back"), []);
  assert.ok(w.personal("I came back after three years raising my family.", "update").length);
  assert.ok(w.personal("I'm a 58-year-old returner.", "back").length, "age is still left out");
});

test("a sentence with a personal detail is dropped, the rest kept", () => {
  assert.strictEqual(w.dropPersonal("I run the Fox. I'm a 58-year-old manager. I love it.", "update"), "I run the Fox. I love it.");
});

test("an 18-strong team, not a 18-strong team", () => {
  assert.strictEqual(w.articles("a 18-strong team and a 80-person wedding"), "an 18-strong team and an 80-person wedding");
  assert.strictEqual(w.articles("a 28 seat restaurant"), "a 28 seat restaurant");
});
