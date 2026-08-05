// Passwordless (magic-link) login. The user enters an email; we email them a
// one-time sign-in link. Clicking it logs them in (session.userEmail). No
// passwords are stored. Uses the db for tokens/users and Resend for the email.
const db = require("./db");
const email = require("./email");

const BASE = () => process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

// Create a user (if new) + token, and email the sign-in link.
// Returns { sent: true } or, when email isn't configured, { link } for dev.
async function requestLink(rawEmail) {
  const addr = String(rawEmail || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) throw new Error("Please enter a valid email address.");
  db.upsertUser(addr);
  const { token, code } = db.createToken(addr);
  const link = `${BASE()}/auth?token=${token}`;
  if (email.hasKey()) {
    await email.sendMagicLink({ to: addr, link, code });
    return { sent: true };
  }
  // No email provider configured (e.g. local dev): return the link + code so it
  // can be logged / shown, rather than silently failing.
  console.log("[auth] sign-in code for", addr, "->", code, "| link:", link);
  return { sent: false, link, code };
}

// Verify a clicked token; returns the email to log in, or null.
function verify(token) {
  return db.consumeToken(token);
}

// Verify a typed 6-digit code for an email; returns the email, or null.
function verifyCode(rawEmail, code) {
  const addr = String(rawEmail || "").trim().toLowerCase();
  return db.consumeCode(addr, code);
}

module.exports = { requestLink, verify, verifyCode };
