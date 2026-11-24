// Sharing "My writing style" between the Comquat apps by confirmed email:
// Comquat Job Seekers (this app), Comquat for Recruiters and the Comquat
// Opportunity Engine. Only the description of the voice moves, never the
// samples. The newest one wins. Off unless COMQUAT_LINK_SECRET (32+
// characters) and COMQUAT_LINK_PEERS (comma-separated style addresses of
// the other apps) are set.

const crypto = require("crypto");

const SECRET = () => (process.env.COMQUAT_LINK_SECRET || "").trim();
const PEERS = () => (process.env.COMQUAT_LINK_PEERS || "").split(",").map((s) => s.trim()).filter((s) => /^https:\/\//i.test(s));
const SOURCE = "comquat-job-seekers";
const enabled = () => SECRET().length >= 32 && PEERS().length > 0;

function secretOk(given) {
  const s = SECRET();
  if (s.length < 32 || !given) return false;
  const a = Buffer.from(String(given)), b = Buffer.from(s);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function post(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-comquat-link": SECRET() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(6000),
  });
  return r.ok ? r.json() : null;
}

/** Tell the other apps about a newly learned style. Best effort, never throws. */
async function push(email, style) {
  if (!enabled() || !email || !style || !style.profile) return;
  await Promise.all(PEERS().map((u) => post(u, { action: "style_push", email, style: { profile: style.profile, learned_at: style.learnedAt, source: style.source || SOURCE } }).catch((e) => console.error("[style-link push]", u, e.message))));
}

/** The newest style any other app holds for this email, or null. */
async function pull(email) {
  if (!enabled() || !email) return null;
  const got = await Promise.all(PEERS().map((u) => post(u, { action: "style_get", email }).catch(() => null)));
  const best = got
    .filter((d) => d && d.found && d.style && d.style.profile)
    .map((d) => d.style)
    .sort((x, y) => new Date(y.learned_at || 0) - new Date(x.learned_at || 0))[0];
  return best ? { profile: String(best.profile).slice(0, 2000), learnedAt: best.learned_at || new Date().toISOString(), source: best.source || "comquat" } : null;
}

module.exports = { enabled, secretOk, push, pull, SOURCE };
