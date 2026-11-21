// The Monday email: "Which two this week?"
//
//   * Only for people who tick the box for it (its own consent record), and
//     only while their job search is "looking".
//   * It shows the (up to) two jobs they picked for this week with the next
//     step for each, plus any polite chase that's due. If they haven't picked
//     two yet, it lists a few saved jobs and asks them to pick.
//   * No jobs on their list, no email. Nothing to sell, nothing made up: it
//     only shows what they saved themselves.
//   * Every email has a one-tap stop link and the standard one-click
//     unsubscribe header.
//
// Settings (Render -> Environment):
//   WEEKLY_EMAILS   on (default) | off

const { shell, P, esc, BTN, sendViaResend } = require("./emails");
const js = require("./jobsearch");
const { nextStep } = require("./jobhunt");

const DAY = 24 * 60 * 60 * 1000;
const LINK_LIFE = 45 * DAY;
const MIN_GAP = 5 * DAY;          // never twice in one week
const MAX_PER_RUN = 500;
const ACTIVE = ["saved", "applied", "interview"];

// Monday from 7am, UK time.
function isMondayMorningUK(now) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(new Date(now));
  const wd = (parts.find((x) => x.type === "weekday") || {}).value;
  const hr = Number((parts.find((x) => x.type === "hour") || {}).value);
  return wd === "Mon" && hr >= 7;
}

const jobLine = (j) => esc(j.title || "A job you saved") + (j.company ? ` at ${esc(j.company)}` : "");
const jobText = (j) => (j.title || "A job you saved") + (j.company ? ` at ${j.company}` : "");

// jobs: that person's active jobs (saved, applied, interview).
function weeklyEmail(name, jobs, links, now = Date.now()) {
  const first = name ? esc(name.split(/\s+/)[0]) : "";
  const hi = first ? `Hi ${first},` : "Hi,";
  const week = jobs.filter((j) => j.this_week).slice(0, 2);
  const chases = jobs.filter((j) => !j.this_week && nextStep(j, now).kind === "chase").slice(0, 3);
  const pickFrom = week.length ? [] : jobs.filter((j) => j.status === "saved").slice(0, 5);
  const huntUrl = `${js.ACCOUNT_URL()}#hunt-card`;
  const li = (inner) => `<li style="margin:0 0 10px">${inner}</li>`;
  const ul = (items) => `<ul style="padding-left:20px;margin:0 0 18px">${items.join("")}</ul>`;
  let html = P(hi), text = `${hi}\n\n`;

  if (week.length) {
    html += P(`Here ${week.length === 2 ? "are your two jobs" : "is your job"} for this week, and the next step for each.`) +
      ul(week.map((j) => li(`<strong>${jobLine(j)}</strong><br><span style="color:#5B5F66">${esc(nextStep(j, now).label)}</span>`)));
    text += `Here ${week.length === 2 ? "are your two jobs" : "is your job"} for this week, and the next step for each.\n\n` +
      week.map((j) => `* ${jobText(j)}: ${nextStep(j, now).label}`).join("\n") + "\n\n";
  } else if (pickFrom.length) {
    html += P(`You haven't picked your two for this week yet. Here's what's on your list:`) +
      ul(pickFrom.map((j) => li(`<strong>${jobLine(j)}</strong>`))) +
      P(`Pick the two you most want and give them your best shot.`);
    text += `You haven't picked your two for this week yet. Here's what's on your list:\n\n` +
      pickFrom.map((j) => `* ${jobText(j)}`).join("\n") + `\n\nPick the two you most want and give them your best shot.\n\n`;
  }
  if (chases.length) {
    html += P(`<strong>Heard nothing back?</strong> It's been 10 days or more since you applied for ${chases.length > 1 ? "these" : "this one"}. A short, polite chase is fine:`) +
      ul(chases.map((j) => li(jobLine(j))));
    text += `Heard nothing back? It's been 10 days or more since you applied for ${chases.length > 1 ? "these" : "this one"}. A short, polite chase is fine:\n\n` +
      chases.map((j) => `* ${jobText(j)}`).join("\n") + "\n\n";
  }
  const button = week.length || chases.length ? "Open my job hunt" : "Pick my two";
  html += `<p style="margin:8px 0 22px">${BTN(huntUrl, button, "#1F6B45")}</p>` +
    P(`Two good applications beat fifty. You've got this.`) +
    `<p style="font-size:13px;line-height:1.5;color:#5B5F66;margin:18px 0 0">You're getting this because you ticked the Monday email on your Comquat account. <a href="${links.stop}" style="color:#5B5F66">Stop these emails</a>.</p>`;
  text += `${button}: ${huntUrl}\n\nTwo good applications beat fifty. You've got this.\n\n` +
    `You're getting this because you ticked the Monday email on your Comquat account. Stop these emails: ${links.stop}\n\n` +
    `Comquat is part of The Com'mon People, run by Comquat Ventures UK Ltd.`;
  return {
    subject: week.length ? (first ? `Your two this week, ${first}` : "Your two this week") : "Which two this week?",
    html: shell("MONDAY", `<h1 style="font-size:24px;line-height:1.2;margin:0 0 14px">${week.length ? "Your two this week" : "Which two this week?"}</h1>` + html),
    text,
  };
}

// deps: { admin, now, send(to, msg, headers) }
async function runWeekly(deps) {
  const out = { sent: 0, failed: 0, empty: 0, skipped: [] };
  if (String(process.env.WEEKLY_EMAILS || "on").trim().toLowerCase() === "off") { out.skipped.push("off"); return out; }
  const now = deps.now || Date.now();
  if (!isMondayMorningUK(now)) { out.skipped.push("not monday"); return out; }
  const { admin } = deps;
  const { data: subs, error } = await admin.from("subscriptions").select("user_id, weekly_sent_at").eq("weekly_two", true);
  if (error) { out.skipped.push("not set up"); return out; } // the database change hasn't been made yet
  const due = (subs || []).filter((s) => !s.weekly_sent_at || now - Date.parse(s.weekly_sent_at) >= MIN_GAP);
  for (const s of due) {
    if (out.sent + out.failed >= MAX_PER_RUN) { out.skipped.push("cap"); break; }
    try {
      const { data: p } = await admin.from("profiles").select("full_name, search_status").eq("id", s.user_id).maybeSingle();
      if (!p || p.search_status !== "looking") continue;
      const { data: jobs, error: je } = await admin.from("job_hunt")
        .select("title, company, status, this_week, applied_at, interview_at, heard_at, chased_at, thanked_at")
        .eq("user_id", s.user_id).in("status", ACTIVE).order("updated_at", { ascending: false }).limit(50);
      if (je) throw new Error(je.message);
      const list = jobs || [];
      const hasSomething = list.some((j) => j.this_week || j.status === "saved" || nextStep(j, now).kind === "chase");
      if (!hasSomething) { out.empty++; continue; }
      const { data: u, error: ue } = await admin.auth.admin.getUserById(s.user_id);
      if (ue || !u || !u.user || !u.user.email) throw new Error((ue && ue.message) || "no email");
      const stop = js.sign(s.user_id, "stopweekly", LINK_LIFE, now);
      await deps.send(u.user.email, weeklyEmail(p.full_name || "", list, { stop: js.linkFor(stop) }, now), {
        "List-Unsubscribe": `<${js.unsubFor(stop)}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      });
      await admin.from("subscriptions").update({ weekly_sent_at: new Date(now).toISOString() }).eq("user_id", s.user_id);
      out.sent++;
    } catch (e) {
      console.error("[weekly] send failed:", e.message);
      out.failed++;
    }
  }
  return out;
}

function start({ admin, send = sendViaResend, firstRunMs = 20 * 60 * 1000, everyMs = 60 * 60 * 1000 }) {
  if (!admin) return null;
  const run = () => runWeekly({ admin, send })
    .then((r) => { if (r.sent || r.failed) console.log("[weekly]", JSON.stringify(r)); })
    .catch((e) => console.error("[weekly] run failed:", e.message));
  const first = setTimeout(run, firstRunMs);
  const every = setInterval(run, everyMs);
  first.unref && first.unref();
  every.unref && every.unref();
  return { stop: () => { clearTimeout(first); clearInterval(every); } };
}

module.exports = { weeklyEmail, runWeekly, start, isMondayMorningUK };
