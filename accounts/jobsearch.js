// My job search: the status on the account page, "I've got a job!", the
// monthly check-in email, and the one-tap buttons in Comquat's emails.
//
//   * Status is "looking" or "paused". Paused means "I've got a job": nothing
//     is deleted, check-ins stop, and "I'm looking again" brings it all back.
//   * The check-in is a short monthly email, only for people who tick the box
//     for it, and only while they're looking. It has three buttons: Still
//     looking, I've got a job!, and Stop these emails. No promotion goes in it.
//   * Buttons in emails carry a signed link that does ONE thing (for example,
//     pause the search). It can't sign anyone in, open the account or show the
//     CV, and it expires. Opening the link shows a page with a button: nothing
//     changes until that button is pressed, so email security scanners that
//     open links can't press it by accident. The one exception is the standard
//     one-click unsubscribe (RFC 8058), which email apps send as a POST.
//
// Settings (Render -> Environment):
//   ACCOUNT_LINK_SECRET   signs the one-tap links (falls back to one derived
//                         from SUPABASE_SECRET_KEY)
//   CHECKIN_EMAILS        on (default) | off

const crypto = require("crypto");
const express = require("express");
const { shell, P, esc, BTN, sendViaResend } = require("./emails");

const DAY = 24 * 60 * 60 * 1000;
const CHECKIN_EVERY = 30 * DAY;
const CHECKIN_LINK_LIFE = 45 * DAY;
const MAX_CHECKINS_PER_RUN = 500;

const BASE = () => (process.env.ACCOUNT_BASE_URL || "https://cv.the-common-people.com").trim().replace(/\/+$/, "");
const ACCOUNT_URL = () => `${BASE()}/account/me.html`;
const SHARE_URL = "https://cv.the-common-people.com/account/?mode=signup";

const CHECKIN_WORDING = "Monthly check-in: while I'm looking for work, send me a short email once a month asking how it's going, with one tap to say I've found a job.";
const WEEKLY_WORDING = "Monday email: while I'm looking for work, send me a short email each Monday with the two jobs I've picked for the week and any follow-ups that are due.";

// ---- signed one-tap links -----------------------------------------------------
const ACTIONS = {
  still: "Still looking",
  gotjob: "I've got a job",
  stopcheckin: "Stop the monthly check-in",
  stopweekly: "Stop the Monday email",
  keep: "Keep my account open",
};
const b64 = (buf) => Buffer.from(buf).toString("base64url");
function secret() {
  const own = (process.env.ACCOUNT_LINK_SECRET || "").trim();
  if (own) return own;
  const sb = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!sb) return "";
  return crypto.createHash("sha256").update("comquat-one-tap-links:" + sb).digest("hex");
}
function sign(userId, action, life, now = Date.now()) {
  const key = secret();
  if (!key || !ACTIONS[action]) throw new Error("can't sign links");
  const body = b64(JSON.stringify({ u: userId, a: action, e: now + life }));
  const mac = b64(crypto.createHmac("sha256", key).update(body).digest());
  return body + "." + mac;
}
function verify(token, now = Date.now()) {
  const key = secret();
  const [body, mac] = String(token || "").split(".");
  if (!key || !body || !mac) return { error: "broken" };
  const want = crypto.createHmac("sha256", key).update(body).digest();
  const got = Buffer.from(mac, "base64url");
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return { error: "broken" };
  let p;
  try { p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch (_) { return { error: "broken" }; }
  if (!p || typeof p.u !== "string" || !ACTIONS[p.a] || !Number.isFinite(p.e)) return { error: "broken" };
  if (now > p.e) return { error: "expired", action: p.a };
  return { userId: p.u, action: p.a };
}
const linkFor = (token) => `${BASE()}/account/do?t=${encodeURIComponent(token)}`;
const unsubFor = (token) => `${BASE()}/account/unsub?t=${encodeURIComponent(token)}`;

// ---- the check-in email -------------------------------------------------------
function checkinEmail(name, links) {
  const first = name ? esc(name.split(/\s+/)[0]) : "";
  const hi = first ? `Hi ${first},` : "Hi,";
  return {
    subject: first ? `How's the job hunt going, ${first}?` : "How's the job hunt going?",
    html: shell("CHECK-IN",
      `<h1 style="font-size:24px;line-height:1.2;margin:0 0 14px">How's it going?</h1>` +
      P(hi) +
      P(`It's your monthly check-in. Just tap whichever fits. No forms, no sign-in.`) +
      `<p style="margin:8px 0 10px">${BTN(links.still, "Still looking", "#1F6B45")}</p>` +
      `<p style="margin:0 0 22px">${BTN(links.gotjob, "I've got a job!", "#E2611B")}</p>` +
      P(`Got a job? Brilliant. We'll pause your account and stop these emails. Your CV and documents stay put, ready for next time.`) +
      P(`Still looking? Your CV and documents are in your account whenever you need them: <a href="${ACCOUNT_URL()}" style="color:#1F6B45">sign in here</a>.`) +
      `<p style="font-size:13px;line-height:1.5;color:#5B5F66;margin:18px 0 0">You're getting this because you ticked the monthly check-in on your Comquat account. <a href="${links.stop}" style="color:#5B5F66">Stop these emails</a>.</p>`
    ),
    text:
      `${hi}\n\nIt's your monthly check-in. Just tap whichever fits. No forms, no sign-in.\n\n` +
      `Still looking: ${links.still}\nI've got a job!: ${links.gotjob}\n\n` +
      `Got a job? Brilliant. We'll pause your account and stop these emails. Your CV and documents stay put, ready for next time.\n\n` +
      `Your account: ${ACCOUNT_URL()}\n\n` +
      `You're getting this because you ticked the monthly check-in on your Comquat account. Stop these emails: ${links.stop}\n\n` +
      `Comquat is part of The Com'mon People, run by Comquat Ventures UK Ltd.`,
  };
}

// ---- the monthly run ------------------------------------------------------------
// deps: { admin, now, send(to, msg, headers) }
async function runCheckins(deps) {
  const out = { due: 0, sent: 0, started: 0, failed: 0, skipped: [] };
  if (String(process.env.CHECKIN_EMAILS || "on").trim().toLowerCase() === "off") { out.skipped.push("off"); return out; }
  if (!secret()) { out.skipped.push("no link secret"); return out; }
  const { admin } = deps;
  const now = deps.now || Date.now();
  const { data: subs, error } = await admin.from("subscriptions").select("user_id").eq("checkin", true);
  if (error) throw new Error(error.message);
  if (!subs || !subs.length) return out;
  const ids = subs.map((s) => s.user_id);
  const profiles = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error: e } = await admin.from("profiles").select("id, full_name, search_status, checkin_clock_at").in("id", ids.slice(i, i + 200));
    if (e) throw new Error(e.message);
    profiles.push(...(data || []));
  }
  for (const p of profiles) {
    if (p.search_status !== "looking") continue;
    if (!p.checkin_clock_at) {
      // Ticked before the clock existed: start it now, first email in a month.
      await admin.from("profiles").update({ checkin_clock_at: new Date(now).toISOString() }).eq("id", p.id);
      out.started++;
      continue;
    }
    if (now - new Date(p.checkin_clock_at).getTime() < CHECKIN_EVERY) continue;
    out.due++;
    if (out.sent + out.failed >= MAX_CHECKINS_PER_RUN) { out.skipped.push("cap"); break; }
    try {
      const { data: u, error: ue } = await admin.auth.admin.getUserById(p.id);
      if (ue || !u || !u.user || !u.user.email) throw new Error((ue && ue.message) || "no email");
      const stop = sign(p.id, "stopcheckin", CHECKIN_LINK_LIFE, now);
      const links = {
        still: linkFor(sign(p.id, "still", CHECKIN_LINK_LIFE, now)),
        gotjob: linkFor(sign(p.id, "gotjob", CHECKIN_LINK_LIFE, now)),
        stop: linkFor(stop),
      };
      await deps.send(u.user.email, checkinEmail(p.full_name || "", links), {
        "List-Unsubscribe": `<${unsubFor(stop)}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      });
      await admin.from("profiles").update({ checkin_clock_at: new Date(now).toISOString() }).eq("id", p.id);
      out.sent++;
    } catch (e) {
      console.error("[checkin] send failed:", e.message);
      out.failed++;
    }
  }
  return out;
}

function start({ admin, send = sendViaResend, firstRunMs = 15 * 60 * 1000, everyMs = 12 * 60 * 60 * 1000 }) {
  if (!admin) return null;
  const run = () => runCheckins({ admin, send })
    .then((r) => { if (r.sent || r.failed || r.started || r.skipped.length) console.log("[checkin]", JSON.stringify(r)); })
    .catch((e) => console.error("[checkin] run failed:", e.message));
  const first = setTimeout(run, firstRunMs);
  const every = setInterval(run, everyMs);
  first.unref && first.unref();
  every.unref && every.unref();
  return { stop: () => { clearTimeout(first); clearInterval(every); } };
}

// ---- doing what a one-tap button asks -----------------------------------------
async function setCheckin(admin, userId, on, source) {
  const { data: before } = await admin.from("subscriptions").select("checkin").eq("user_id", userId).maybeSingle();
  const was = Boolean(before && before.checkin);
  const { error } = await admin.from("subscriptions").upsert({ user_id: userId, checkin: on }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
  if (was !== on) {
    await admin.from("consent_log").insert({ user_id: userId, topic: "checkin", granted: on, source, wording: CHECKIN_WORDING });
    // The first check-in comes a month after ticking the box.
    if (on) await admin.from("profiles").update({ checkin_clock_at: new Date().toISOString() }).eq("id", userId);
  }
  return was !== on;
}
async function setWeekly(admin, userId, on, source) {
  const { data: before, error: be } = await admin.from("subscriptions").select("weekly_two").eq("user_id", userId).maybeSingle();
  if (be) throw new Error(be.message);
  const was = Boolean(before && before.weekly_two);
  const { error } = await admin.from("subscriptions").upsert({ user_id: userId, weekly_two: on }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
  if (was !== on) await admin.from("consent_log").insert({ user_id: userId, topic: "weekly_two", granted: on, source, wording: WEEKLY_WORDING });
  return was !== on;
}
async function setStatus(admin, userId, status) {
  const { error } = await admin.from("profiles").update({ search_status: status, search_changed_at: new Date().toISOString() }).eq("id", userId);
  if (error) throw new Error(error.message);
}
// Any of these buttons counts as using the account, so it keeps it open too.
async function markUsed(admin, userId) {
  await admin.from("profiles").update({ last_seen_at: new Date().toISOString(), inactivity_warned_at: null, inactivity_final_warned_at: null }).eq("id", userId);
}

async function perform(admin, userId, action) {
  const { data: u } = await admin.auth.admin.getUserById(userId);
  if (!u || !u.user) return { gone: true };
  if (action === "still") {
    await admin.from("profiles").update({ checkin_clock_at: new Date().toISOString() }).eq("id", userId);
  } else if (action === "gotjob") {
    await setStatus(admin, userId, "paused");
  } else if (action === "stopcheckin") {
    await setCheckin(admin, userId, false, "email");
  } else if (action === "stopweekly") {
    await setWeekly(admin, userId, false, "email");
  }
  if (action !== "stopcheckin" && action !== "stopweekly") await markUsed(admin, userId);
  return { ok: true };
}

// ---- the little pages the buttons open ----------------------------------------
const PAGES = {
  still: { ask: "Still looking?", sub: "Thanks for letting us know. We'll check in again in a month.", button: "Yes, I'm still looking",
    done: "Got it. We'll check in again in a month. Good luck out there.", },
  gotjob: { ask: "You've got a job?", sub: "Brilliant. We'll pause your account: the monthly check-ins stop, and your CV and documents stay put for next time. Any other Comquat emails you've ticked carry on until you untick them.", button: "Yes, pause my account",
    done: "Congratulations! Your account is paused and the check-ins have stopped. When you're looking again, sign in and press I'm looking again.", },
  stopcheckin: { ask: "Stop the monthly check-in?", sub: "You won't get the monthly check-in email any more. Your account and everything in it stay as they are.", button: "Yes, stop these emails",
    done: "Done. No more check-ins. You can switch them back on from your account page whenever you like.", },
  stopweekly: { ask: "Stop the Monday email?", sub: "You won't get the Monday email about your two jobs for the week any more. Your job hunt and everything else in your account stay as they are.", button: "Yes, stop these emails",
    done: "Done. No more Monday emails. You can switch them back on from your account page whenever you like.", },
  keep: { ask: "Keep your account open?", sub: "Your account and everything in it will stay, and the 12 month clock starts again from today.", button: "Yes, keep my account",
    done: "Done. Your account stays open, and nothing will close for at least another 12 months.", },
};
function page(title, inner) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)} | Comquat</title>
<link rel="stylesheet" href="/account/fresh.css"><link rel="stylesheet" href="/account/account.css"></head>
<body><main class="narrow" style="padding-top:40px"><section class="card one-tap">
<p><img src="/img/comquat-logo-email.png" width="150" height="39" alt="Comquat"></p>${inner}</section></main></body></html>`;
}
function askPage(token, action) {
  const p = PAGES[action];
  return page(p.ask, `<h1>${esc(p.ask)}</h1><p>${esc(p.sub)}</p>
<form method="post" action="/account/do"><input type="hidden" name="t" value="${esc(token)}">
<button class="btn btn-primary" type="submit">${esc(p.button)}</button></form>
<p class="small"><a href="${ACCOUNT_URL()}">Go to my account instead</a></p>`);
}
const donePage = (action) => page("Done", `<h1>${esc(PAGES[action].done.split(".")[0])}.</h1><p>${esc(PAGES[action].done.split(". ").slice(1).join(". "))}</p><p><a class="btn btn-ghost" href="${ACCOUNT_URL()}">Go to my account</a></p>`);
const oopsPage = (why) => page("Link not working", `<h1>That link isn't working</h1><p>${why === "expired"
  ? "It's expired: these links only last a few weeks. Sign in to your account to make the change there."
  : why === "gone" ? "We couldn't find that account. It may have been closed or deleted."
  : "It looks incomplete. Try copying the whole link from the email, or sign in to make the change there."}</p><p><a class="btn btn-ghost" href="${ACCOUNT_URL()}">Go to my account</a></p>`);

// ---- routes ---------------------------------------------------------------------
const UNSUB = new Set(["stopcheckin", "stopweekly"]);
// helpers: { adminClient, enabled, needUser, writeLimit, requireJson, linkLimit }
function mount(app, api, h) {
  const form = express.urlencoded({ extended: false, limit: "4kb" });
  const send = (res, code, html) => { res.status(code).set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }).type("html").send(html); };

  app.get("/account/do", h.linkLimit, (req, res) => {
    const v = verify(req.query.t);
    if (v.error) return send(res, 400, oopsPage(v.error));
    send(res, 200, askPage(String(req.query.t), v.action));
  });
  app.post("/account/do", h.linkLimit, form, async (req, res) => {
    const v = verify(req.body && req.body.t);
    if (v.error) return send(res, 400, oopsPage(v.error));
    const admin = h.enabled() && h.adminClient();
    if (!admin) return send(res, 503, oopsPage("broken"));
    try {
      const r = await perform(admin, v.userId, v.action);
      if (r.gone) return send(res, 404, oopsPage("gone"));
      send(res, 200, donePage(v.action));
    } catch (e) {
      console.error("[one-tap]", v.action, e.message);
      send(res, 500, page("Something went wrong", `<h1>Something went wrong</h1><p>Please try the button again in a minute, or sign in to make the change on your account page.</p><p><a class="btn btn-ghost" href="${ACCOUNT_URL()}">Go to my account</a></p>`));
    }
  });
  // Standard one-click unsubscribe from email apps (RFC 8058), and the same
  // link opened in a browser.
  app.get("/account/unsub", h.linkLimit, (req, res) => {
    const v = verify(req.query.t);
    if (v.error || !UNSUB.has(v.action)) return send(res, 400, oopsPage(v.error || "broken"));
    send(res, 200, askPage(String(req.query.t), v.action));
  });
  app.post("/account/unsub", h.linkLimit, form, async (req, res) => {
    const v = verify(req.query.t || (req.body && req.body.t));
    if (v.error || !UNSUB.has(v.action)) return res.status(400).send("Link not valid");
    const admin = h.enabled() && h.adminClient();
    if (!admin) return res.status(503).send("Try again later");
    try { await perform(admin, v.userId, v.action); res.status(200).send("Unsubscribed"); }
    catch (e) { console.error("[unsub]", e.message); res.status(500).send("Try again later"); }
  });

  // ---- from the account page (signed in) ----
  api.post("/search", h.writeLimit, h.requireJson, h.needUser, async (req, res) => {
    const status = req.body.status === "paused" ? "paused" : req.body.status === "looking" ? "looking" : "";
    if (!status) return res.status(400).json({ error: "Please choose looking or paused." });
    const admin = h.adminClient();
    if (!admin) return res.status(503).json({ error: "This isn't switched on yet." });
    try {
      await setStatus(admin, req.user.id, status);
      // Back to looking: the next check-in (if they want them) is a month away.
      if (status === "looking") await admin.from("profiles").update({ checkin_clock_at: new Date().toISOString() }).eq("id", req.user.id);
      res.json({ ok: true, status, message: status === "paused"
        ? "Congratulations! Your account is paused. Check-ins have stopped and everything's kept for next time."
        : "Welcome back. Your account is active again." });
    } catch (e) {
      console.error("[search]", e.message);
      res.status(500).json({ error: "We couldn't save that just now. Please try again." });
    }
  });
  api.post("/weekly", h.writeLimit, h.requireJson, h.needUser, async (req, res) => {
    const admin = h.adminClient();
    if (!admin) return res.status(503).json({ error: "This isn't switched on yet." });
    try {
      const on = Boolean(req.body.on);
      await setWeekly(admin, req.user.id, on, "account");
      res.json({ ok: true, on, message: on ? "Done. Your first Monday email comes next Monday, while you're looking." : "Done. No more Monday emails." });
    } catch (e) {
      console.error("[weekly]", e.message);
      res.status(500).json({ error: "We couldn't save that just now. Please try again." });
    }
  });
  api.post("/checkin", h.writeLimit, h.requireJson, h.needUser, async (req, res) => {
    const admin = h.adminClient();
    if (!admin) return res.status(503).json({ error: "This isn't switched on yet." });
    try {
      const on = Boolean(req.body.on);
      await setCheckin(admin, req.user.id, on, "account");
      res.json({ ok: true, on, message: on ? "Done. Your first check-in comes in a month, while you're looking." : "Done. No more check-ins." });
    } catch (e) {
      console.error("[checkin]", e.message);
      res.status(500).json({ error: "We couldn't save that just now. Please try again." });
    }
  });
}

// What the account page needs to show the card. Returns null if the database
// change hasn't been made yet, so the page simply hides the card.
async function stateFor(admin, userId) {
  if (!admin) return null;
  const [p, s] = await Promise.all([
    admin.from("profiles").select("search_status, search_changed_at").eq("id", userId).maybeSingle(),
    admin.from("subscriptions").select("checkin").eq("user_id", userId).maybeSingle(),
  ]);
  if (p.error || s.error) return null;
  // The Monday email needs its own database change. Until it's made, the
  // tick box stays hidden and the check-in carries on as normal.
  const w = await admin.from("subscriptions").select("weekly_two").eq("user_id", userId).maybeSingle();
  const weekly = w.error ? null : Boolean(w.data && w.data.weekly_two);
  return {
    weekly,
    weeklyWording: WEEKLY_WORDING,
    status: (p.data && p.data.search_status) || "looking",
    changedAt: (p.data && p.data.search_changed_at) || null,
    checkin: Boolean(s.data && s.data.checkin),
    checkinWording: CHECKIN_WORDING,
    shareUrl: SHARE_URL,
  };
}

module.exports = { sign, verify, checkinEmail, runCheckins, start, mount, stateFor, perform, setWeekly, linkFor, unsubFor, ACCOUNT_URL, CHECKIN_WORDING, WEEKLY_WORDING, CHECKIN_EVERY, ACTIONS };
