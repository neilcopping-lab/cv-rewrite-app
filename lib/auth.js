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
  const token = db.createToken(addr);
  const link = `${BASE()}/auth?token=${token}`;
  if (email.hasKey()) {
    await email.sendMagicLink({ to: addr, link });
    return { sent: true };
  }
  // No email provider configured (e.g. local dev): return the link so it can be
  // logged / shown, rather than silently failing.
  console.log("[auth] magic link for", addr, "->", link);
  return { sent: false, link };
}

// Verify a clicked token; returns the email to log in, or null.
function verify(token) {
  return db.consumeToken(token);
}

module.exports = { requestLink, verify };
