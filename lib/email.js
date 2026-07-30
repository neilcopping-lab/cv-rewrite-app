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

async function sendConfirmation({ to, name, role, designName }) {
  const r = getResend();
  if (!r || !to) return { skipped: true };
  return r.emails.send({
    from: FROM, to,
    subject: "Your rewritten CV is ready",
    text:
`Hi ${name || "there"},

Your CV has been rewritten to align with the ${role || "role"} you gave us, in the ${designName || "chosen"} design. You can download the Word and PDF versions from the app in this session, and regenerate or re-download as many times as you need.

No subscription, nothing else to pay. If anything reads like it isn't quite you, tweak the Word file, it's yours.

The Com'mon People
Built on mutual aid. Free, always (this one bit excepted).`
  });
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

// Passwordless sign-in link.
async function sendMagicLink({ to, link }) {
  const r = getResend();
  if (!r || !to) return { skipped: true };
  return r.emails.send({
    from: FROM, to,
    subject: "Your sign-in link — The Com'mon People CV Rewrite",
    text:
`Hi,

Click this link to sign in to your CV Rewrite account:

${link}

The link works once and expires in 30 minutes. If you didn't ask to sign in, you can ignore this email.

The Com'mon People`
  });
}

module.exports = { sendConfirmation, sendInternalNotice, sendMagicLink, hasKey: () => !!process.env.RESEND_API_KEY };
