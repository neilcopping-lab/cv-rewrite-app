// Tiny persistent store. A single JSON file on disk (set DB_PATH; defaults to
// ./data/app.json locally, /data/app.json on Render's disk). Pure JS, no native
// modules. Fine for this scale: one instance, modest traffic, simple records.
//
// Records: users { email -> { email, credits, createdAt } }
//          tokens { token -> { email, expires } }         (magic-link login)
//          purchases { stripeSessionId -> { email, credits, at } } (idempotency)
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "app.json");

function ensureDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

let cache = null;
function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch (_) {
    cache = { users: {}, tokens: {}, purchases: {} };
  }
  cache.users = cache.users || {};
  cache.tokens = cache.tokens || {};
  cache.purchases = cache.purchases || {};
  return cache;
}
function save() {
  ensureDir();
  const tmp = DB_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(cache));
  fs.renameSync(tmp, DB_PATH); // atomic replace
}

const normEmail = (e) => String(e || "").trim().toLowerCase();

// ---- users ----------------------------------------------------------------
function getUser(email) {
  return load().users[normEmail(email)] || null;
}
function upsertUser(email) {
  const db = load();
  const key = normEmail(email);
  if (!db.users[key]) {
    db.users[key] = { email: key, credits: 0, createdAt: Date.now() };
    save();
  }
  return db.users[key];
}
function addCredits(email, n) {
  const db = load();
  const u = db.users[normEmail(email)] || upsertUser(email);
  u.credits = (u.credits || 0) + n;
  save();
  return u.credits;
}
function spendCredit(email) {
  const db = load();
  const u = db.users[normEmail(email)];
  if (!u || (u.credits || 0) < 1) return false;
  u.credits -= 1;
  save();
  return true;
}
function credits(email) {
  const u = getUser(email);
  return u ? u.credits || 0 : 0;
}

// ---- magic-link tokens + email codes --------------------------------------
// A single sign-in request creates BOTH a long token (for the magic link) and a
// short 6-digit code (typed into the same tab). Either one signs the user in.
function createToken(email) {
  const db = load();
  const addr = normEmail(email);
  const token = crypto.randomBytes(24).toString("hex");
  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
  const expires = Date.now() + 1000 * 60 * 30; // 30 min
  db.tokens[token] = { email: addr, code, expires };
  save();
  return { token, code };
}
function consumeToken(token) {
  const db = load();
  const t = db.tokens[token];
  if (!t) return null;
  delete db.tokens[token];
  save();
  if (t.expires < Date.now()) return null;
  return t.email;
}
// Verify a typed 6-digit code for an email. Consumes the matching token so a
// code can't be reused. Returns the email on success, or null.
function consumeCode(email, code) {
  const db = load();
  const addr = normEmail(email);
  const want = String(code || "").trim();
  if (!/^\d{6}$/.test(want)) return null;
  for (const [tok, t] of Object.entries(db.tokens)) {
    if (t.email === addr && t.code === want) {
      delete db.tokens[tok];
      save();
      return t.expires < Date.now() ? null : t.email;
    }
  }
  return null;
}

// ---- purchases (idempotent credit grants) ---------------------------------
function grantOnce(stripeSessionId, email, creditsToAdd) {
  const db = load();
  if (db.purchases[stripeSessionId]) return { added: false, balance: creditsFor(email) };
  db.purchases[stripeSessionId] = { email: normEmail(email), credits: creditsToAdd, at: Date.now() };
  save();
  const balance = addCredits(email, creditsToAdd);
  return { added: true, balance };
}
function creditsFor(email) { return credits(email); }

module.exports = {
  DB_PATH, getUser, upsertUser, addCredits, spendCredit, credits,
  createToken, consumeToken, consumeCode, grantOnce
};
