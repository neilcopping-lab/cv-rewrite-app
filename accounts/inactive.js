// Closing Comquat accounts that haven't been used for 12 months.
//
// The privacy notice promises: "If you don't use your account for 12 months,
// we'll email you twice, a month before and a week before, and then close it
// and delete everything in it."
//
//   * "Used" means the latest of: when the account was made, the last sign-in,
//     the last day the person used CV Rewrite or Interview Prep while signed
//     in (recorded once a day by touch()), and any one-tap button they pressed
//     in a Comquat email (Keep my account, Still looking, I've got a job).
//   * A month before closing we send the first warning and note the date.
//   * A week before closing we send the second warning and note that date too.
//   * If they come back, both warnings are cleared and the clock starts again.
//   * An account only closes once BOTH warnings have gone, the first at least
//     30 days earlier and the second at least 7 days earlier, and 12 months
//     after it was last used. Then: saved documents, email choices, the
//     account itself, and a short "your account has closed" email.
//   * Both warnings have a Keep my account button that works without signing
//     in, and point to Download my data, so people can keep their CV.
//
// Safety catches, because a mistake here can't be undone:
//   * INACTIVE_ACCOUNTS=off stops everything, =warn-only sends warnings but
//     never closes anything. Anything else means on.
//   * Nobody is closed without both warnings sent, on time.
//   * No more than 50 closures in one run, and none at all if a run would
//     close more than a fifth of all accounts (that would point to a bug).

const { shell, P, esc, BTN, sendViaResend } = require("./emails");
const oneTap = require("./jobsearch");

const DAY = 24 * 60 * 60 * 1000;
const CLOSE_AFTER = 365 * DAY;
const NOTICE = 30 * DAY;          // first warning: a month before
const FINAL_NOTICE = 7 * DAY;     // second warning: a week before
const WARN_AFTER = CLOSE_AFTER - NOTICE;
const MAX_CLOSE_PER_RUN = 50;
const MAX_CLOSE_SHARE = 0.2;

const ACCOUNT_URL = "https://cv.the-common-people.com/account/";
const DATA_URL = "https://cv.the-common-people.com/account/me.html#your-data";
const SIGNUP_URL = "https://cv.the-common-people.com/account/?mode=signup";

const mode = () => String(process.env.INACTIVE_ACCOUNTS || "on").trim().toLowerCase();
const ts = (v) => (v ? new Date(v).getTime() : 0);
const ukDate = (ms) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });

// ---- the emails -------------------------------------------------------------------
// keepUrl: the one-tap Keep my account link (null if links can't be signed,
// in which case the button signs them in instead).
function warningEmail(name, closeOn, keepUrl, final) {
  const hi = name ? `Hi ${esc(name.split(/\s+/)[0])},` : "Hi,";
  const date = ukDate(closeOn);
  const keep = keepUrl || ACCOUNT_URL;
  const lead = final
    ? `A quick last reminder: your Comquat account closes on <strong>${date}</strong>, a week from now.`
    : `It's been nearly a year since you last used your Comquat account. We don't hang on to people's details for longer than we need to, so we close accounts that haven't been used for 12 months.`;
  const leadText = final
    ? `A quick last reminder: your Comquat account closes on ${date}, a week from now.`
    : `It's been nearly a year since you last used your Comquat account. We don't hang on to people's details for longer than we need to, so we close accounts that haven't been used for 12 months.`;
  return {
    subject: final ? `Last reminder: your Comquat account closes on ${date}` : `Your Comquat account will close on ${date}`,
    html: shell("ACCOUNT",
      `<h1 style="font-size:24px;line-height:1.2;margin:0 0 14px">${final ? "One week to go" : "We haven't seen you for a while"}</h1>` +
      P(hi) + P(lead) +
      (final ? "" : P(`Yours will close on <strong>${date}</strong>, and everything in it will be deleted, including your CV and any saved CVs, cover letters and prep reports.`)) +
      P(`<strong>Want to keep it?</strong> Tap the button. No need to sign in.`) +
      `<p style="margin:8px 0 24px">${BTN(keep, "Keep my account")}</p>` +
      P(`<strong>Happy for it to go?</strong> You don't need to do anything. If you'd like a copy of your CV and documents first, <a href="${DATA_URL}" style="color:#1F6B45">sign in and use Download my data</a>.`)
    ),
    text:
      `${hi}\n\n${leadText}\n\n` +
      (final ? "" : `Yours will close on ${date}, and everything in it will be deleted, including your CV and any saved CVs, cover letters and prep reports.\n\n`) +
      `Want to keep it? Use this link. No need to sign in: ${keep}\n\n` +
      `Happy for it to go? You don't need to do anything. If you'd like a copy of your CV and documents first, sign in and use Download my data: ${DATA_URL}\n\n` +
      `Comquat is part of The Com'mon People, run by Comquat Ventures UK Ltd.`,
  };
}

function closedEmail(name) {
  const hi = name ? `Hi ${esc(name.split(/\s+/)[0])},` : "Hi,";
  return {
    subject: "Your Comquat account has been closed",
    html: shell("ACCOUNT",
      `<h1 style="font-size:24px;line-height:1.2;margin:0 0 14px">Your account has been closed</h1>` +
      P(hi) +
      P(`As we said in our last two emails, your Comquat account hadn't been used for 12 months, so we've closed it and deleted everything in it, including your CV and saved documents. We've also taken you off the Comquat emails you'd ticked.`) +
      P(`You're always welcome back. You can make a new free account whenever you like.`) +
      `<p style="margin:8px 0 8px">${BTN(SIGNUP_URL, "Make a new account")}</p>`
    ),
    text:
      `${hi}\n\nAs we said in our last two emails, your Comquat account hadn't been used for 12 months, so we've closed it and deleted everything in it, including your CV and saved documents. We've also taken you off the Comquat emails you'd ticked.\n\n` +
      `You're always welcome back. You can make a new free account whenever you like: ${SIGNUP_URL}\n\nComquat is part of The Com'mon People, run by Comquat Ventures UK Ltd.`,
  };
}

function keepLink(userId, closeOn, now) {
  try { return oneTap.linkFor(oneTap.sign(userId, "keep", Math.max(closeOn - now, 0) + 2 * DAY, now)); }
  catch (_) { return null; }
}

// ---- recording use -------------------------------------------------------------
// Called on every signed-in request; writes at most once a day per person.
const lastTouch = new Map();
function touch(admin, userId, now = Date.now()) {
  if (!admin || !userId) return;
  if (now - (lastTouch.get(userId) || 0) < DAY) return;
  lastTouch.set(userId, now);
  admin.from("profiles").update({ last_seen_at: new Date(now).toISOString(), inactivity_warned_at: null, inactivity_final_warned_at: null }).eq("id", userId)
    .then(({ error }) => { if (error) { lastTouch.delete(userId); console.error("[inactive] touch:", error.message); } })
    .catch(() => lastTouch.delete(userId));
}

// ---- one pass ---------------------------------------------------------------------
async function listAllUsers(admin) {
  const users = [];
  for (let page = 1; page < 200; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const batch = (data && data.users) || [];
    users.push(...batch);
    if (batch.length < 1000) break;
  }
  return users;
}

// deps: { admin, now, send(to, msg), closeAccount(user) }
async function runOnce(deps) {
  const m = mode();
  const out = { mode: m, accounts: 0, warned: 0, finalWarned: 0, cleared: 0, closed: 0, skipped: [] };
  if (m === "off") return out;
  const { admin } = deps;
  const now = deps.now || Date.now();

  const users = await listAllUsers(admin);
  out.accounts = users.length;
  if (!users.length) return out;
  const { data: profiles, error } = await admin.from("profiles").select("id, full_name, last_seen_at, inactivity_warned_at, inactivity_final_warned_at");
  if (error) throw new Error(error.message);
  const byId = new Map((profiles || []).map((p) => [p.id, p]));

  const toWarn = [], toFinal = [], toClose = [];
  for (const u of users) {
    if (!u.email) continue;
    const p = byId.get(u.id) || {};
    const lastUse = Math.max(ts(u.created_at), ts(u.last_sign_in_at), ts(p.last_seen_at));
    const warnedAt = ts(p.inactivity_warned_at), finalAt = ts(p.inactivity_final_warned_at);
    if ((warnedAt && lastUse > warnedAt) || (!warnedAt && finalAt)) {
      // They came back after we warned them: start the clock again.
      await admin.from("profiles").update({ inactivity_warned_at: null, inactivity_final_warned_at: null }).eq("id", u.id);
      out.cleared++;
      continue;
    }
    // Always at least a full month's notice from the first email.
    const closeOn = warnedAt ? Math.max(lastUse + CLOSE_AFTER, warnedAt + NOTICE) : Math.max(lastUse + CLOSE_AFTER, now + NOTICE);
    if (!warnedAt) { if (now - lastUse >= WARN_AFTER) toWarn.push({ u, p, closeOn }); continue; }
    if (!finalAt) { if (now >= closeOn - FINAL_NOTICE) toFinal.push({ u, p, closeOn: Math.max(closeOn, now + FINAL_NOTICE) }); continue; }
    if (now - warnedAt >= NOTICE && now - finalAt >= FINAL_NOTICE && now - lastUse >= CLOSE_AFTER) toClose.push({ u, p });
  }

  for (const [list, final, col] of [[toWarn, false, "inactivity_warned_at"], [toFinal, true, "inactivity_final_warned_at"]]) {
    for (const { u, p, closeOn } of list) {
      try {
        await deps.send(u.email, warningEmail(p.full_name || "", closeOn, keepLink(u.id, closeOn, now), final));
        const { error: e } = await admin.from("profiles").upsert({ id: u.id, [col]: new Date(now).toISOString() });
        if (e) throw new Error(e.message);
        out[final ? "finalWarned" : "warned"]++;
      } catch (e) {
        console.error("[inactive] warning failed:", e.message);
        out.skipped.push("warn-failed");
      }
    }
  }

  if (m === "warn-only") { if (toClose.length) out.skipped.push(`warn-only: ${toClose.length} not closed`); return out; }
  if (toClose.length > MAX_CLOSE_PER_RUN || toClose.length > Math.max(1, users.length * MAX_CLOSE_SHARE)) {
    console.error(`[inactive] refusing to close ${toClose.length} of ${users.length} accounts in one run; check before switching back on`);
    out.skipped.push(`too-many: ${toClose.length}`);
    return out;
  }
  for (const { u, p } of toClose) {
    try {
      await deps.closeAccount(u);
      out.closed++;
      deps.send(u.email, closedEmail(p.full_name || "")).catch((e) => console.error("[inactive] closed email:", e.message));
    } catch (e) {
      console.error("[inactive] close failed:", e.message);
      out.skipped.push("close-failed");
    }
  }
  return out;
}

// ---- the schedule ---------------------------------------------------------------
// Started by one app only (CV Rewrite). First pass ten minutes after start-up,
// then every twelve hours. Everything it does is safe to repeat.
function start({ admin, closeAccount, send = sendViaResend, firstRunMs = 10 * 60 * 1000, everyMs = 12 * 60 * 60 * 1000 }) {
  if (!admin || mode() === "off") return null;
  const run = () => runOnce({ admin, closeAccount, send })
    .then((r) => { if (r.warned || r.finalWarned || r.closed || r.cleared || r.skipped.length) console.log("[inactive]", JSON.stringify(r)); })
    .catch((e) => console.error("[inactive] run failed:", e.message));
  const first = setTimeout(run, firstRunMs);
  const every = setInterval(run, everyMs);
  first.unref && first.unref();
  every.unref && every.unref();
  return { stop: () => { clearTimeout(first); clearInterval(every); } };
}

module.exports = { runOnce, start, touch, warningEmail, closedEmail, DAY, CLOSE_AFTER, WARN_AFTER, NOTICE, FINAL_NOTICE };
