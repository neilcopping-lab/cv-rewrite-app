// A saved profile's readable copy: only headings and lines, capped, tidy.
const { test } = require("node:test");
const assert = require("node:assert");
const { cleanView } = require("../accounts/documents");

test("keeps headings, paragraphs and lines, and drops empty sections", () => {
  const v = cleanView({ name: "Priya", roleTitle: "Head Chef", headline: "Calm head chef", sections: [
    { heading: "Introduction", paras: ["Runs a busy kitchen.", ""], items: [] },
    { heading: "Strengths", paras: [], items: ["Coaching: trains new cooks", null] },
    { heading: "Empty", paras: [], items: [] },
    { heading: "", paras: ["no heading"] },
  ], extra: "<script>" });
  assert.deepEqual(v.sections.map((s) => s.heading), ["Introduction", "Strengths"]);
  assert.deepEqual(v.sections[1].items, ["Coaching: trains new cooks"]);
  assert.equal(v.extra, undefined);
});

test("anything that isn't a profile view is refused", () => {
  assert.equal(cleanView(null), null);
  assert.equal(cleanView({ sections: "nope" }), null);
  assert.equal(cleanView({ sections: [{ heading: "x" }] }), null);
});
