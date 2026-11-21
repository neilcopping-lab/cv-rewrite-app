// The Loudspeaker, sent automatically.
//
// On the last Friday of each month at 9am (UK time), or the last Friday
// before Christmas in December, this finds the newest
// Loudspeaker edition on the-common-people.com and, if it hasn't been emailed
// before, sends it to The Loudspeaker segment in Resend as a broadcast.
//
// On the Wednesday before, Neil gets a preview of exactly what will go out
// (or a note saying there's no new edition, so nothing will be sent).
//
// Safety:
//   - An edition is only ever sent once. Resend's own list of broadcasts is
//     the record, so a restart or redeploy can't cause a double send.
//   - Set LOUDSPEAKER_AUTOSEND=off in Render to stop it completely.
//   - If anything can't be read from the site, nothing is sent and Neil is told.

const { SPAM_HTML, SPAM_TEXT } = require("./spamNote");

const SITE = "https://the-common-people.com";
const API = "https://api.resend.com";
const SEGMENT = () => process.env.RESEND_AUDIENCE_ID || "c01541fc-f17e-4ef2-a3f1-f5d068f98df1";
const FROM = () => process.env.LOUDSPEAKER_FROM || "Neil Copping, The Loudspeaker <neil.copping@the-common-people.com>";
const PREVIEW_TO = () => process.env.NOTIFY_EMAIL || "neil.c.copping@outlook.com";
const SEND_HOUR = 9;
const enabled = () => String(process.env.LOUDSPEAKER_AUTOSEND || "on").trim().toLowerCase() !== "off";

// ---- dates (always UK time) --------------------------------------------------
function ukParts(d = new Date()) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", hour12: false, weekday: "short" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour % 24, weekday: p.weekday };
}
// Day of the month of the last Friday, for a given year and month (1-12).
function lastFriday(year, month) {
  const last = new Date(Date.UTC(year, month, 0)); // last day of the month
  const back = (last.getUTCDay() - 5 + 7) % 7;
  return last.getUTCDate() - back;
}
// The day it goes out. Normally the last Friday of the month, but December
// goes on the last Friday on or before the 23rd, so it lands before Christmas
// rather than on Christmas Day or between Christmas and New Year.
function sendDay(year, month) {
  if (month !== 12) return lastFriday(year, month);
  const d23 = new Date(Date.UTC(year, 11, 23));
  return 23 - ((d23.getUTCDay() - 5 + 7) % 7);
}

// ---- reading the site ----------------------------------------------------------
const strip = (h) => String(h || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&middot;/g, "·")
  .replace(/&rsquo;|&#39;|&#x27;/g, "'").replace(/&lsquo;/g, "'").replace(/&ldquo;|&rdquo;|&quot;/g, '"').replace(/\s+/g, " ").trim();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function getText(url) {
  const r = await fetch(url, { headers: { "User-Agent": "TheLoudspeakerSender/1.0" } });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.text();
}

async function latestEditionNumber() {
  const xml = await getText(`${SITE}/sitemap.xml`);
  const nums = [...xml.matchAll(/loudspeaker-edition-(\d+)</g)].map((m) => parseInt(m[1], 10));
  if (!nums.length) throw new Error("no editions found in the sitemap");
  return Math.max(...nums);
}

function parseEdition(html, num) {
  const nn = String(num).padStart(2, "0");
  const meta = (p) => ((html.match(new RegExp(`<meta[^>]+property="${p}"[^>]+content="([^"]*)"`)) || [])[1] || "");
  const title = strip((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1]) || `The Loudspeaker, Edition ${nn}`;
  const description = strip(meta("og:description"));
  const image = meta("og:image");
  // The editor's note: the paragraphs after "From the editor", up to the pull quote.
  let editor = [];
  const ei = html.indexOf("From the editor");
  if (ei > -1) {
    const chunk = html.slice(ei, ei + 8000).split(/<blockquote|<\/section>/)[0];
    editor = [...chunk.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => strip(m[1])).filter((t) => t.length > 40).slice(0, 2);
  }
  // Story headlines: the h3s inside story cards.
  const stories = [...html.matchAll(/<article class="story[^"]*"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => strip(m[1])).filter(Boolean).slice(0, 10);
  return { num, nn, title, description, image, editor, stories, url: `${SITE}/loudspeaker-edition-${nn}` };
}

async function fetchEdition(num) {
  const nn = String(num).padStart(2, "0");
  return parseEdition(await getText(`${SITE}/loudspeaker-edition-${nn}`), num);
}

// ---- the email -------------------------------------------------------------------
function renderEmail(ed) {
  const intro = ed.editor.length ? ed.editor : [ed.description];
  const btn = (href, label) => `<a href="${esc(href)}" style="display:inline-block;background:#1F6B45;color:#FFF3E2;text-decoration:none;font-weight:bold;font-size:16px;padding:13px 24px;border-radius:6px">${esc(label)}</a>`;
  const html = `<div style="background:#FFF3E2;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#17191C">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #E9DCC8;border-radius:16px;overflow:hidden">
    <div style="background:#17191C;color:#FFF3E2;padding:18px 28px">
      <p style="margin:0;font-size:12px;letter-spacing:3px;font-weight:bold">THE COM'MON PEOPLE</p>
      <p style="margin:6px 0 0;font-size:26px;font-weight:bold;line-height:1.15">The Loudspeaker</p>
      <p style="margin:4px 0 0;font-size:14px;opacity:.85">${esc(ed.title.replace(/^The Loudspeaker[,\s\-·|]*/i, ""))}</p>
    </div>
    ${ed.image ? `<a href="${esc(ed.url)}"><img src="${esc(ed.image)}" width="600" alt="${esc(ed.title)}" style="display:block;width:100%;height:auto;border:0"></a>` : ""}
    <div style="padding:26px 28px 8px">
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:2px;font-weight:bold;color:#1F6B45">FROM THE EDITOR</p>
      ${intro.map((p) => `<p style="font-size:16px;line-height:1.6;margin:0 0 14px">${esc(p)}</p>`).join("")}
      ${ed.stories.length ? `<p style="margin:20px 0 8px;font-size:12px;letter-spacing:2px;font-weight:bold;color:#1F6B45">IN THIS EDITION</p>
      <ul style="margin:0 0 18px;padding-left:20px">${ed.stories.map((s) => `<li style="font-size:15px;line-height:1.5;margin:0 0 8px">${esc(s)}</li>`).join("")}</ul>` : ""}
      <p style="margin:8px 0 24px">${btn(ed.url, "Read the full edition")}</p>
      <p style="font-size:15px;line-height:1.55;margin:0 0 4px">Neil</p>
    </div>
    <div style="padding:0 28px 26px;border-top:1px solid #E9DCC8">
      ${SPAM_HTML}
      <p style="font-size:13px;line-height:1.5;color:#5B5F66;margin:12px 0 0">You're getting this because you signed up to The Loudspeaker from The Com'mon People. It's free, monthly, and we never sell your details. <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#5B5F66">Unsubscribe</a></p>
      <p style="font-size:12px;line-height:1.5;color:#5B5F66;margin:10px 0 0">The Com'mon People is run by Comquat Ventures UK Ltd, 102 Stevenage Road, Hitchin, SG4 9DQ.</p>
    </div>
  </div>
</div>`;
  const text = [
    `THE LOUDSPEAKER`, ed.title, "",
    "FROM THE EDITOR", ...intro.map((p) => p + "\n"),
    ...(ed.stories.length ? ["IN THIS EDITION", ...ed.stories.map((s) => `- ${s}`), ""] : []),
    `Read the full edition: ${ed.url}`, "", "Neil", "", SPAM_TEXT, "",
    "You're getting this because you signed up to The Loudspeaker from The Com'mon People. Unsubscribe: {{{RESEND_UNSUBSCRIBE_URL}}}",
    "The Com'mon People is run by Comquat Ventures UK Ltd, 102 Stevenage Road, Hitchin, SG4 9DQ.",
  ].join("\n");
  const subject = `${ed.title.replace(/&middot;|·/g, ",").replace(/\s+,/g, ",")}`;
  return { subject, html, text };
}

// ---- Resend -----------------------------------------------------------------------
async function resend(method, path, body) {
  const r = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Resend ${method} ${path} -> ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}
const broadcastName = (ed) => `The Loudspeaker, Edition ${ed.nn}`;
async function existingBroadcast(ed) {
  const j = await resend("GET", "/broadcasts");
  return (j.data || []).find((b) => b.name === broadcastName(ed)) || null;
}
async function sendPlain(to, subject, html, text) {
  return resend("POST", "/emails", { from: FROM(), to: [to], subject, html, text });
}

// ---- the two jobs -----------------------------------------------------------------
async function sendPreview(now) {
  const num = await latestEditionNumber();
  const ed = await fetchEdition(num);
  const fri = `Friday ${sendDay(now.year, now.month)} ${new Date(Date.UTC(now.year, now.month - 1, 1)).toLocaleString("en-GB", { month: "long", timeZone: "UTC" })}`;
  if (await existingBroadcast(ed)) {
    return sendPlain(PREVIEW_TO(), `The Loudspeaker: nothing new to send on ${fri}`,
      `<p>Hi Neil,</p><p>Edition ${ed.nn} has already been emailed, and there's no newer edition on the website yet. So nothing will go out on ${fri}.</p><p>Publish the next edition on the site before 9am that day and it'll be picked up and sent automatically.</p>`,
      `Edition ${ed.nn} has already been emailed and there's no newer edition on the website yet, so nothing will go out on ${fri}. Publish the next edition before 9am that day and it'll be sent automatically.`);
  }
  const mail = renderEmail(ed);
  return sendPlain(PREVIEW_TO(), `Preview: this goes to Loudspeaker subscribers on ${fri} at 9am`,
    `<p style="font-family:Arial,sans-serif">Hi Neil, this is exactly what will go to everyone on The Loudspeaker list on ${fri} at 9am. If you publish a newer edition before then, that one goes instead. To stop it, set LOUDSPEAKER_AUTOSEND to off in Render.</p>${mail.html}`,
    `This is what will go out on ${fri} at 9am.\n\n${mail.text}`);
}

async function sendEdition() {
  const num = await latestEditionNumber();
  const ed = await fetchEdition(num);
  const existing = await existingBroadcast(ed);
  if (existing && existing.status !== "draft") return { skipped: `edition ${ed.nn} already ${existing.status}` };
  if (!ed.editor.length && !ed.description) throw new Error(`couldn't read edition ${ed.nn} from the site`);
  if (existing) { await resend("POST", `/broadcasts/${existing.id}/send`, {}); return { sent: ed.nn, resumed: true }; }
  const mail = renderEmail(ed);
  await resend("POST", "/broadcasts", {
    segment_id: SEGMENT(), name: broadcastName(ed), from: FROM(),
    subject: mail.subject, html: mail.html, text: mail.text, send: true,
  });
  return { sent: ed.nn };
}

// ---- the clock ----------------------------------------------------------------------
const done = new Set(); // in-memory guard against repeating within one run
async function tick(clock = () => new Date()) {
  if (!enabled() || !process.env.RESEND_API_KEY) return;
  const now = ukParts(clock());
  if (now.hour < SEND_HOUR) return;
  const lf = sendDay(now.year, now.month);
  const monthKey = `${now.year}-${now.month}`;
  try {
    if (now.day === lf - 2 && !done.has(`preview ${monthKey}`)) {
      done.add(`preview ${monthKey}`);
      await sendPreview(now);
      console.log("[loudspeaker] preview sent");
    }
    if (now.day === lf && !done.has(`send ${monthKey}`)) {
      done.add(`send ${monthKey}`);
      const r = await sendEdition();
      console.log("[loudspeaker]", JSON.stringify(r));
    }
  } catch (e) {
    console.error("[loudspeaker] failed:", e.message);
    sendPlain(PREVIEW_TO(), "The Loudspeaker didn't go out automatically",
      `<p>Hi Neil,</p><p>Something stopped this month's Loudspeaker being sent automatically, so nothing went to subscribers. The error was: ${esc(e.message)}</p><p>Nothing needs doing in a hurry. Pass this on and it can be sorted and sent by hand.</p>`,
      `Something stopped this month's Loudspeaker being sent automatically, so nothing went to subscribers. Error: ${e.message}`).catch(() => {});
  }
}

function start() {
  if (!enabled()) { console.log("[loudspeaker] autosend is off"); return; }
  setTimeout(() => tick(), 60 * 1000);
  setInterval(() => tick(), 15 * 60 * 1000);
  console.log("[loudspeaker] autosend on: last Friday of each month at 9am UK time");
}

module.exports = { start, tick, lastFriday, sendDay, ukParts, parseEdition, renderEmail, sendEdition, sendPreview };
