const test = require("node:test");
const assert = require("node:assert");
const ai = require("../lib/aiLevel");
const welcome = require("../accounts/welcome");

const fakeRes = () => {
  const r = { code: 200, body: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};

test("everyone starts on Essentials only", () => {
  assert.strictEqual(ai.levelOf({}), "essentials");
  assert.strictEqual(ai.levelOf({ user: { aiLevel: "nonsense" } }), "essentials");
  assert.strictEqual(ai.levelOf({ user: { aiLevel: "full" } }), "full");
});

test("what each setting allows", () => {
  assert.ok(ai.allows("full", "extra") && ai.allows("full", "core"));
  assert.ok(ai.allows("essentials", "core") && !ai.allows("essentials", "extra"));
  assert.ok(!ai.allows("off", "core") && !ai.allows("off", "extra"));
});

test("the gate explains itself in plain words, without dashes", () => {
  const res = fakeRes();
  assert.strictEqual(ai.gate({ user: { aiLevel: "off" } }, res, "core", "", "https://the-common-people.com/guide-cv.html"), false);
  assert.strictEqual(res.code, 403);
  assert.match(res.body.error, /AI setting is Off/);
  assert.doesNotMatch(res.body.error, /—/);
  const res2 = fakeRes();
  assert.strictEqual(ai.gate({ user: { aiLevel: "essentials" } }, res2, "extra", "Suggesting jobs your CV could suit"), false);
  assert.match(res2.body.error, /Full help extra/);
  assert.strictEqual(ai.gate({ user: { aiLevel: "essentials" } }, fakeRes(), "core"), true);
});

test("welcome email has no em dashes and links the AI promise", () => {
  const m = welcome.build("Sam Jones");
  assert.match(m.subject, /in charge of the AI/);
  assert.match(m.text, /^Hi Sam,/);
  assert.match(m.html, /ai-promise\.html/);
  assert.doesNotMatch(m.html + m.text + m.subject, /—/);
  assert.strictEqual(welcome.build("").text.split("\n")[0], "Hi there,");
});
