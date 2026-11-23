// Two-step sign-in (Supabase TOTP): who is held at the second step, and the
// set-up, check and turn-off calls, against a stand-in for Supabase.
const { test } = require("node:test");
const assert = require("node:assert");
const mfa = require("../accounts/mfa");

const jwt = (payload) => `x.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.y`;
function fakeSb({ aal = "aal1", factors = [], verifyOk = true } = {}) {
  const calls = [];
  const sb = { calls, auth: {
    getSession: async () => ({ data: { session: { access_token: jwt({ aal }) } } }),
    refreshSession: async () => ({}),
    mfa: {
      listFactors: async () => ({ data: { all: factors, totp: factors.filter((f) => f.status === "verified") } }),
      challengeAndVerify: async (a) => { calls.push(["verify", a]); return verifyOk ? { data: {} } : { error: { message: "Invalid TOTP code entered" } }; },
      enroll: async (a) => { calls.push(["enroll", a]); return { data: { id: "f-new", totp: { qr_code: "data:image/svg+xml;utf-8,<svg/>", secret: "ABCD", uri: "otpauth://totp/x" } } }; },
      unenroll: async (a) => { calls.push(["unenroll", a]); return {}; },
    } } };
  return sb;
}
const ON = [{ id: "f1", factor_type: "totp", status: "verified" }];

test("people without two-step are never held up", async () => {
  assert.equal(await mfa.pending(fakeSb(), { factors: [] }), false);
  assert.equal(await mfa.pending(fakeSb(), { factors: [{ factor_type: "totp", status: "unverified" }] }), false, "a set-up never finished doesn't count");
});

test("with it on, a password alone isn't enough", async () => {
  assert.equal(await mfa.pending(fakeSb({ aal: "aal1" }), { factors: ON }), true);
  assert.equal(await mfa.pending(fakeSb({ aal: "aal2" }), { factors: ON }), false);
  assert.equal(mfa.aalOf(jwt({ aal: "aal2" })), "aal2");
  assert.equal(mfa.aalOf("rubbish"), null);
});

test("the second step checks the code against their app", async () => {
  const sb = fakeSb({ factors: ON });
  assert.deepEqual(await mfa.verify(sb, "12 34 56"), { ok: true });
  assert.deepEqual(sb.calls[0], ["verify", { factorId: "f1", code: "123456" }]);
  assert.match((await mfa.verify(fakeSb({ factors: ON, verifyOk: false }), "123456")).error, /didn't match/);
  assert.match((await mfa.verify(sb, "12")).error, /six-digit/);
});

test("setting up clears an unfinished attempt first, and won't run twice", async () => {
  const sb = fakeSb({ factors: [{ id: "old", factor_type: "totp", status: "unverified" }] });
  const d = await mfa.enroll(sb);
  assert.equal(d.factorId, "f-new"); assert.match(d.qr, /^data:image\/svg/);
  assert.deepEqual(sb.calls.map((c) => c[0]), ["unenroll", "enroll"]);
  assert.match((await mfa.enroll(fakeSb({ factors: ON }))).error, /already on/);
});

test("turning it off needs a good code", async () => {
  const bad = fakeSb({ factors: ON, verifyOk: false });
  assert.ok((await mfa.turnOff(bad, "123456")).error);
  assert.ok(!bad.calls.some((c) => c[0] === "unenroll"));
  const good = fakeSb({ factors: ON });
  assert.deepEqual(await mfa.turnOff(good, "123456"), { ok: true });
  assert.ok(good.calls.some((c) => c[0] === "unenroll" && c[1].factorId === "f1"));
});
