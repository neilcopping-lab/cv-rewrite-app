// Resend - two transactional emails per transaction (Section 12): one to the
// candidate confirming, one internal notification so nothing is silently lost.
const brand = require("./brand");
let resend = null;
function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) { const { Resend } = require("resend"); resend = new Resend(process.env.RESEND_API_KEY); }
  return resend;
}
const FROM = process.env.RESEND_FROM || "The Com'mon People <cv@the-common-people.com>";
const NOTIFY = process.env.NOTIFY_EMAIL || "neil.copping@thecommonpeople.co.uk";

async function sendConfirmation({ to, name, role, designName, attachments }) {
  const r = getResend();
  if (!r || !to) return { skipped: true };
  const hasFiles = attachments && attachments.length;
  const msg = {
    from: FROM, to,
    subject: "Your rewritten CV" + (hasFiles ? " (attached)" : " is ready"),
    text:
`Hi ${name || "there"},

Your CV has been rewritten to align with the ${role || "role"} you gave us, in the ${designName || "chosen"} design.${hasFiles ? "\n\nYour Word and PDF versions are attached to this email." : ""}

You can also download it again any time from the app while you're signed in. If anything reads like it isn't quite you, tweak the Word file, it's yours.

The Com'mon People
Built on mutual aid.`
  };
  if (hasFiles) msg.attachments = attachments; // [{ filename, content(base64) }]
  return r.emails.send(msg);
}

async function sendInternalNotice({ email, role, designId }) {
  const r = getResend();
  if (!r) return { skipped: true };
  return r.emails.send({
    from: FROM, to: NOTIFY,
    subject: `CV Rewrite purchase - ${role || "role"}`,
    text: `A CV Rewrite was generated and paid for.\nCandidate email: ${email || "n/a"}\nTarget role: ${role || "n/a"}\nDesign: ${designId || "n/a"}\nTime: ${new Date().toISOString()}`
  });
}

// Passwordless sign-in: a 6-digit code to type into the page (keeps you on the
// same screen so nothing is lost), plus a backup one-click link.
async function sendMagicLink({ to, link, code }) {
  const r = getResend();
  if (!r || !to) return { skipped: true };
  return r.emails.send({
    from: FROM, to,
    subject: `${code ? code + " is your " : "Your "}sign-in code - The Com'mon People CV Rewrite`,
    text:
`Hi,

Your sign-in code is:

    ${code || "(see link below)"}

Type it into the page to sign in and keep your rewritten CV exactly where it is.
The code expires in 30 minutes.

Prefer one click? You can also sign in with this link (opens a new tab):
${link}

If you didn't ask to sign in, you can ignore this email.

The Com'mon People`
  });
}

// New feedback notification (to the internal address).
async function sendFeedbackNotice({ stars, comment, email, role }) {
  const r = getResend();
  if (!r) return { skipped: true };
  const s = Math.max(0, Math.min(5, parseInt(stars, 10) || 0));
  return r.emails.send({
    from: FROM, to: NOTIFY,
    subject: `CV Rewrite feedback - ${"★".repeat(s)}${"☆".repeat(5 - s)} (${s}/5)`,
    text: `New feedback from the CV Rewrite app.

Rating: ${s}/5
Comment: ${comment || "(none)"}
From: ${email || "anonymous"}
Role: ${role || "n/a"}
Time: ${new Date().toISOString()}`
  });
}

module.exports = { sendConfirmation, sendInternalNotice, sendFeedbackNotice, sendMagicLink, hasKey: () => !!process.env.RESEND_API_KEY };
