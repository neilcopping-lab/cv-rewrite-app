// Runs the REAL cv-rewrite-app server (accounts, sign-in page, Beyond the Obvious)
// with only Supabase swapped for an in-memory stand-in, so sign-in journeys can be
// driven end to end in a browser. Test data only.
const APP = require("path").resolve(__dirname, "../..");
const crypto = require("crypto");
process.env.SUPABASE_URL = "https://fake.supabase.test";
process.env.SUPABASE_PUBLISHABLE_KEY = "fake-publishable";
process.env.SUPABASE_SECRET_KEY = "fake-secret";
process.env.ACCOUNT_BASE_URL = "https://cv.the-common-people.com";
process.env.PORT = "3401";
delete process.env.ANTHROPIC_API_KEY;

const COOKIE = "sb-fake-auth-token";
const PASSWORD = "test-password-123";
const USERS = {
  "plain@test.local": { id: "u-plain", email: "plain@test.local", user_metadata: { welcome_sent: true }, factors: [] },
  "twostep@test.local": { id: "u-2fa", email: "twostep@test.local", user_metadata: { welcome_sent: true }, factors: [{ id: "f1", factor_type: "totp", status: "verified" }] },
};
const sessions = new Map(); // sid -> { user, aal }
const tokens = new Map();   // token_hash -> email
const log = { redirects: [] };
global.__fake = { USERS, sessions, tokens, log, PASSWORD };

const jwt = (aal) => "x." + Buffer.from(JSON.stringify({ aal })).toString("base64url") + ".y";
function chain() {
  let one = false;
  const c = new Proxy(function () {}, {
    get(_, k) {
      if (k === "then") return (res) => res({ data: one ? null : [], error: null, count: 0 });
      return () => { if (k === "maybeSingle" || k === "single") one = true; return c; };
    },
    apply() { return c; },
  });
  return c;
}
function fakeClient(cookies) {
  const sid = () => ((cookies && cookies.getAll()) || []).find((x) => x.name === COOKIE)?.value;
  const start = (user) => { const id = crypto.randomUUID(); sessions.set(id, { user, aal: "aal1" }); cookies.setAll([{ name: COOKIE, value: id, options: { path: "/" } }]); };
  return {
    auth: {
      getUser: async () => ({ data: { user: (sessions.get(sid()) || {}).user || null } }),
      getSession: async () => { const s = sessions.get(sid()); return { data: { session: s ? { access_token: jwt(s.aal) } : null } }; },
      signInWithPassword: async ({ email, password }) => {
        const user = USERS[email];
        if (!user || password !== PASSWORD) return { data: null, error: { message: "Invalid login credentials" } };
        start(user); return { data: { user }, error: null };
      },
      signInWithOtp: async ({ email, options }) => { log.redirects.push({ kind: "email-link", email, to: options.emailRedirectTo }); return { data: {}, error: null }; },
      signUp: async ({ email, options }) => {
        USERS[email] = { id: "u-" + email, email, user_metadata: { full_name: "New Person" }, factors: [] };
        log.redirects.push({ kind: "signup", email, to: options.emailRedirectTo }); return { data: {}, error: null };
      },
      verifyOtp: async ({ token_hash }) => { const user = USERS[tokens.get(token_hash)]; if (!user) return { data: null, error: { message: "expired" } }; start(user); return { data: { user }, error: null }; },
      signOut: async () => { sessions.delete(sid()); return { error: null }; },
      exchangeCodeForSession: async () => ({ data: null, error: { message: "expired" } }),
      updateUser: async () => ({ data: {}, error: null }),
      mfa: {
        listFactors: async () => { const s = sessions.get(sid()); return { data: { all: s ? s.user.factors : [] }, error: null }; },
        challengeAndVerify: async ({ code }) => { if (code !== "123456") return { error: { message: "bad" } }; sessions.get(sid()).aal = "aal2"; return { error: null }; },
      },
    },
    from: () => chain(),
    storage: { from: () => chain() },
  };
}
function stub(mod, override) {
  const p = require.resolve(mod, { paths: [APP + "/accounts", APP] });
  const real = require(p);
  require.cache[p].exports = { ...real, ...override };
}
stub("@supabase/ssr", { createServerClient: (url, key, opts) => fakeClient(opts.cookies) });
stub("@supabase/supabase-js", { createClient: () => fakeClient(null) });

require(APP + "/server.js");

// Test-only helper: mint an emailed sign-in token for an address, as Supabase would.
const express = require(APP + "/node_modules/express");
const h = express();
h.get("/token", (req, res) => { const t = crypto.randomUUID(); tokens.set(t, String(req.query.email)); res.json({ token: t }); });
h.get("/log", (req, res) => res.json(log));
h.listen(3402);
