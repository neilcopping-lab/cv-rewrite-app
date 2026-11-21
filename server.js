// ─── Comquat CV Rewrite (from The Com'mon People) · server ───────────────────────────
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const multer = require("multer");

const brand = require("./lib/brand");
const extract = require("./lib/extractText");
const { transcribe, transcribeWords } = require("./lib/transcribe");
const gapEngine = require("./lib/gapEngine");
const cvGenerator = require("./lib/cvGenerator");
const sourceOfTruth = require("./lib/sourceOfTruth");
const fabrication = require("./lib/fabricationChecker");
const checks = require("./lib/checks");
const reviewer = require("./lib/reviewer");
const { designs, byId } = require("./lib/designs");
const { buildDocx } = require("./lib/docxExport");
const { docxToPdf, libreAvailable } = require("./lib/pdfExport");
const htmlPreview = require("./lib/htmlPreview");
const { DESIGNER_TEMPLATES, isDesigner, renderDesignerHtml } = require("./lib/htmlDesigner");
const { renderPdf: renderHtmlPdf, available: weasyAvailable } = require("./lib/htmlToPdf");
const { sanitizeForOutput, hasContent } = require("./lib/sanitize");
const coverLetter = require("./lib/coverLetter");
const { buildCoverDocx } = require("./lib/coverLetterDoc");
const resolveDesign = (id) => DESIGNER_TEMPLATES.find((t) => t.id === id) || byId(id);
const payment = require("./lib/payment");
const email = require("./lib/email");
const matchReport = require("./lib/matchReport");
const db = require("./lib/db");
const auth = require("./lib/auth");
const cliches = require("./lib/cliches");
const { watermark } = require("./lib/watermark");

// Silently strip mechanical AI clichés from the CV's free-text fields, so the
// finished CV never reads like a machine wrote it (belt-and-braces with the
// prompt-level ban).
function scrubCv(cv) {
  if (!cv || typeof cv !== "object") return cv;
  if (cv.personalStatement) cv.personalStatement = cliches.scrub(cv.personalStatement);
  (cv.skills || []).forEach((s) => { if (s && s.proof) s.proof = cliches.scrub(s.proof); });
  (cv.experience || []).forEach((r) => {
    if (!r) return;
    r.responsibilities = (r.responsibilities || []).map((b) => cliches.scrub(b));
    r.achievements = (r.achievements || []).map((a) => cliches.scrub(a));
  });
  (cv.skillsMatch || []).forEach((m) => { if (m && m.proof) m.proof = cliches.scrub(m.proof); });
  return cv;
}

const app = express();
// Render sits behind a proxy: trust it so rate limits see each visitor's real IP.
app.set("trust proxy", 1);
const upload = multer({ dest: path.join(__dirname, "tmp") });
const BASE = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

// Stripe webhook needs the raw body, register BEFORE json parser.
app.post("/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const event = payment.verifyWebhook(req.body, req.headers["stripe-signature"]);
    if (event.type === "checkout.session.completed") {
      // Grant the account its credits (idempotent).
      await payment.grantForSession(event.data.object.id);
    }
    res.json({ received: true });
  } catch (e) {
    res.status(400).send(`Webhook error: ${e.message}`);
  }
});

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 3 } // 3h session, matches regeneration allowance
  })
);
app.use(express.static(path.join(__dirname, "public")));

// ─── Identity shield ─────────────────────────────────────────────────────────
// Every AI call made while handling this request has the person's name, email,
// phone, address, links and date of birth swapped for placeholders first (see
// lib/identityShield.js and lib/anthropic.js). This tells the shield where to
// find those details: read fresh at each AI call.
const identityShield = require("./lib/identityShield");
app.use((req, res, next) => identityShield.run(() => {
  const st = (req.session && req.session.cv) || {};
  const links = st.links && typeof st.links === "object" ? Object.values(st.links).filter((v) => typeof v === "string") : [];
  return {
    texts: [st.cvText, st.styleSample],
    emails: [req.session && req.session.userEmail, req.user && req.user.email],
    links,
  };
}, next));

// ─── Comquat accounts (one login for CV Rewrite + Interview Prep) ───────────
// Lives in ./accounts. Switched off until SUPABASE_URL and keys are set, in
// which case the older email-code sign-in below keeps working as before.
const { mountAccounts, enabled: accountsOn, startInactiveAccountJob, adminClient: accountsAdmin } = require("./accounts");
mountAccounts(app);
// The 12 month clean-up of unused accounts and the monthly check-in run here, and only here.
startInactiveAccountJob();
// The automatic bias test of the CV Builder's write-ups: after any change to
// the AI instructions, and quarterly. The report is emailed (lib/biasTest.js).
if (require.main === module && accountsOn()) require("./lib/biasTest").start({ admin: accountsAdmin() });

// ─── Newsletter signup ──────────────────────────────────────────────────────
// The static site at the-common-people.com posts here to add a subscriber to
// the Resend audience. Reuses RESEND_API_KEY (already set for purchase emails).
const SUBSCRIBE_ORIGINS = new Set([
  "https://the-common-people.com",
  "https://www.the-common-people.com",
]);
function subscribeCors(req, res) {
  const origin = req.headers.origin;
  if (origin && SUBSCRIBE_ORIGINS.has(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
  }
}
app.options("/api/subscribe", (req, res) => {
  subscribeCors(req, res);
  res.sendStatus(204);
});
app.post("/api/subscribe", async (req, res) => {
  subscribeCors(req, res);
  const email = String((req.body && req.body.email) || "").trim().toLowerCase();
  const honeypot = String((req.body && req.body.company) || "");
  if (honeypot) return res.json({ message: "Thanks." }); // ignore bots
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Signup isn't configured yet. Please try again later." });
  }
  const audienceId = process.env.RESEND_AUDIENCE_ID || "c01541fc-f17e-4ef2-a3f1-f5d068f98df1";
  try {
    const r = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, unsubscribed: false }),
    });
    if (!r.ok) {
      const t = (await r.text()).toLowerCase();
      const alreadyExists = r.status === 409 || r.status === 422 || t.includes("already");
      if (alreadyExists) return res.json({ message: "You're already on the list. Thanks." });
      return res.status(502).json({ error: "Couldn't subscribe right now. Please try again." });
    }
  } catch (e) {
    return res.status(502).json({ error: "Couldn't subscribe right now. Please try again." });
  }
  // Welcome email (best-effort: never fail the signup if this errors).
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "The Com'mon People <cv@the-common-people.com>",
        to: email,
        subject: "You're on the list. The Com'mon People",
        text:
          "Thanks for subscribing to the Loudspeaker.\n\n" +
          "Once a month you'll get an editor's view from the recruitment frontline, plus a heads-up when new free guides and dispatches land. No spam, no selling your details, and you can unsubscribe any time from the link in every email.\n\n" +
          "The Com'mon People\nFree, always.",
      }),
    });
  } catch (e) {
    // ignore welcome-email errors
  }
  return res.json({ message: "You're on the list. Welcome aboard." });
});

const S = (req) => (req.session.cv = req.session.cv || {});
// With Comquat accounts switched on, the signed-in account is the only source
// of truth. Credits stay keyed by email, so existing customers keep theirs.
const currentEmail = (req) => accountsOn() ? ((req.user && req.user.email) || null) : (req.session.userEmail || null);

// Margin guard: cap how many AI rewrites one session can run for free, so a
// user can't rack up the AI bill by hammering "Regenerate" without ever paying.
const GEN_CAP = parseInt(process.env.REGEN_CAP || "8", 10);
// FREE MODE (Sept 2026): CV Rewrite is free, always. Downloads and cover letters
// no longer spend credits. Set FREE_MODE=off in Render to switch payments back on.
const FREE_MODE = process.env.FREE_MODE !== "off";
function overGenCap(st) {
  st.genCount = (st.genCount || 0) + 1;
  return st.genCount > GEN_CAP;
}

// ─── Background jobs ────────────────────────────────────────────────────────
// Writing a CV can take longer than a proxy will hold a single connection open
// (hence the 524 timeouts). So the slow work runs as a background job: the
// browser starts it, gets a jobId straight back, then polls /api/job/:id every
// couple of seconds until it's done. No single request stays open long enough
// to time out, however long the AI takes.
const crypto = require("crypto");
const jobs = new Map(); // jobId -> { status:'running'|'done'|'error', payload?, error?, ts }

function pruneJobs() {
  const cutoff = Date.now() - 15 * 60 * 1000; // 15 min
  for (const [id, j] of jobs) if (j.ts < cutoff) jobs.delete(id);
}

// Start `worker` (an async fn that mutates st and returns the JSON payload).
// The session is saved BEFORE the job is marked done, so any follow-up request
// (preview, download) is guaranteed to see the finished CV.
function startJob(req, worker) {
  pruneJobs();
  const id = crypto.randomBytes(12).toString("hex");
  jobs.set(id, { status: "running", ts: Date.now() });
  Promise.resolve()
    .then(worker)
    .then(
      (payload) =>
        new Promise((resolve) =>
          req.session.save(() => {
            jobs.set(id, { status: "done", payload, ts: Date.now() });
            resolve();
          })
        )
    )
    .catch((e) => {
      jobs.set(id, { status: "error", error: e.message || String(e), ts: Date.now() });
    });
  return id;
}

app.get("/api/job/:id", (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j) return res.status(404).json({ status: "unknown" });
  if (j.status === "running") return res.json({ status: "running" });
  jobs.delete(req.params.id);
  if (j.status === "error") return res.json({ status: "error", error: j.error });
  return res.json({ status: "done", ...j.payload });
});

// Build the CV (Word + PDF) and email them as attachments, so the person also
// receives their CV by email. Fire-and-forget from the download route.
async function emailCvFiles(userEmail, cv, design, photo) {
  if (!email.hasKey()) return;
  const nameSafe = (cv.header?.name || "cv").replace(/[^\w]+/g, "_");
  const attachments = [];
  try {
    if (isDesigner(design.id)) {
      // Designer templates are PDF-only.
      const pdf = await renderHtmlPdf(renderDesignerHtml(cv, design.id));
      attachments.push({ filename: `${nameSafe}_${design.id}.pdf`, content: pdf.toString("base64") });
    } else {
      const docx = await buildDocx(cv, design, { ats: false, photo });
      attachments.push({ filename: `${nameSafe}_${design.id}.docx`, content: docx.toString("base64") });
      if (libreAvailable()) {
        const pdf = await docxToPdf(docx);
        attachments.push({ filename: `${nameSafe}_${design.id}.pdf`, content: pdf.toString("base64") });
      }
    }
  } catch (_) { /* still send the note even if a file fails */ }
  return email.sendConfirmation({
    to: userEmail, name: cv.header?.name, role: cv.header?.targetRole,
    designName: design.name, attachments
  });
}

// The user's own confirmed links (LinkedIn, portfolio, website, GitHub) are
// applied straight onto the CV header AFTER the honesty check, so they always
// appear and are never mistaken for something the model invented.
function applyUserLinks(cv, st) {
  if (!cv || !cv.header || !st.links) return cv;
  const L = st.links;
  if (L.linkedin) cv.header.linkedin = L.linkedin;
  if (L.portfolio) cv.header.portfolio = L.portfolio;
  if (L.github) cv.header.github = L.github;
  if (L.website) cv.header.website = L.website;
  if (L.youtube) cv.header.introVideo = L.youtube;
  return cv;
}

// ─── Health ────────────────────────────────────────────────────────────────
app.get("/health", (req, res) =>
  res.json({
    ok: true,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    voice: !!process.env.OPENAI_API_KEY,
    stripe: payment.hasKey(),
    resend: email.hasKey(),
    libreoffice: libreAvailable(),
    weasyprint: weasyAvailable(),
    designs: designs.length,
    designerTemplates: DESIGNER_TEMPLATES.length
  })
);

// ─── Accounts (passwordless magic-link login) ───────────────────────────────
app.post("/api/auth/request", async (req, res) => {
  if (accountsOn()) return res.status(409).json({ error: "Please sign in with your Comquat account.", signIn: "/account/" });
  try {
    const out = await auth.requestLink(req.body.email);
    // Remember which email we're expecting a code from (so the user only types
    // the 6 digits, and so a code can't be checked against the wrong address).
    req.session.pendingEmail = String(req.body.email || "").trim().toLowerCase();
    // In dev (no email provider) we return the link + code so it can be used.
    res.json({ ok: true, sent: out.sent, devLink: out.link || null, devCode: out.code || null });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Verify a typed 6-digit code, signs the user in WITHOUT reloading the page,
// so their finished CV stays exactly where it is. This is the primary flow.
app.post("/api/auth/verify-code", (req, res) => {
  const addr = (req.body.email || req.session.pendingEmail || "").trim().toLowerCase();
  const emailAddr = auth.verifyCode(addr, req.body.code);
  if (!emailAddr) return res.status(400).json({ ok: false, error: "That code isn't right or has expired. Check the email or send a new code." });
  req.session.userEmail = emailAddr;
  req.session.pendingEmail = null;
  req.session.save(() => res.json({ ok: true, signedIn: true, email: emailAddr, credits: db.credits(emailAddr), free: FREE_MODE }));
});

app.get("/auth", (req, res) => {
  const emailAddr = auth.verify(req.query.token);
  if (!emailAddr) return res.redirect("/app.html?signin=expired");
  req.session.userEmail = emailAddr;
  res.redirect("/app.html?signin=ok");
});

// Session snapshot, lets the front-end restore a user's finished CV after a
// reload or a magic-link sign-in (which reloads the page), so nothing is lost.
app.get("/api/state", (req, res) => {
  const st = S(req);
  const e = currentEmail(req);
  res.json({
    signedIn: !!e, email: e || null, credits: e ? db.credits(e) : 0, free: FREE_MODE,
    hasCv: !!st.cv, designId: st.designId || null, coverLetter: !!st.coverLetter
  });
});

// Rebuild the step-3 "review" payload from the session, so the rewritten CV can
// be re-displayed after a reload / sign-in even though the browser lost its
// in-memory copy. Same shape the /api/generate result uses.
app.get("/api/draft", (req, res) => {
  const st = S(req);
  if (!st.cv) return res.json({ ok: false, hasCv: false });
  const cr = st.checkReport || {};
  const fab = cr.fabrication || {};
  const missing = st.cv.missing || [];
  const blocked = fab.pass === false || missing.length > 0;
  res.json({
    ok: true, hasCv: true, cv: st.cv, missing,
    programmatic: cr.programmatic || null, review: cr.review || {},
    matchReport: st.matchReport || matchReport.build(st.cv, st.gaps),
    downloadBlocked: blocked,
    message: blocked
      ? "We found gaps or claims we couldn't trace to what you told us. Answer these before downloading, or tell us to leave them out."
      : "Clean. Pick a design and download."
  });
});

app.get("/api/auth/me", (req, res) => {
  const e = currentEmail(req);
  res.set("Cache-Control", "no-store");
  res.json({ signedIn: !!e, email: e, credits: e ? db.credits(e) : 0, free: FREE_MODE, accountsOn: accountsOn() });
});

// ─── Feedback (star rating + comment) ───────────────────────────────────────
// Stored to the DB and emailed to the internal address. Viewable at
// /admin/feedback?key=ADMIN_KEY (set ADMIN_KEY in the environment to enable).
app.post("/api/feedback", (req, res) => {
  const stars = parseInt(req.body.stars, 10);
  if (!(stars >= 1 && stars <= 5)) return res.status(400).json({ error: "Please choose a star rating." });
  const st = S(req);
  const entry = db.addFeedback({
    stars, comment: req.body.comment,
    email: currentEmail(req) || st.softEmail || null,
    role: st.cv?.header?.targetRole || null,
    context: req.body.context || "post-download"
  });
  email.sendFeedbackNotice(entry).catch(() => {});
  res.json({ ok: true });
});

app.get("/admin/feedback", (req, res) => {
  const key = process.env.ADMIN_KEY;
  if (!key) return res.status(503).send("Feedback admin is disabled. Set ADMIN_KEY in the environment to enable it.");
  if (req.query.key !== key) return res.status(401).send("Not authorised. Add ?key=YOUR_ADMIN_KEY to the URL.");
  const items = db.listFeedback();
  const avg = items.length ? (items.reduce((a, b) => a + (b.stars || 0), 0) / items.length).toFixed(2) : ", ";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const rows = items.map((f) =>
    `<tr><td>${"★".repeat(f.stars)}${"☆".repeat(5 - f.stars)}</td><td>${esc(f.comment) || "<i>(no comment)</i>"}</td><td>${esc(f.email) || "anon"}</td><td>${esc(f.role) || ""}</td><td>${esc(f.at)}</td></tr>`
  ).join("");
  res.setHeader("Content-Type", "text/html");
  res.send(`<!doctype html><meta charset="utf-8"><title>CV Rewrite feedback</title>
    <style>body{font-family:system-ui,Arial,sans-serif;margin:30px;color:#1a1a1a}h1{margin:0 0 4px}
    .sum{color:#555;margin-bottom:18px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px 10px;text-align:left;vertical-align:top;font-size:14px}
    th{background:#f4f4f4}td:first-child{white-space:nowrap;color:#B8860B}</style>
    <h1>CV Rewrite, feedback</h1>
    <p class="sum">${items.length} responses · average ${avg} / 5</p>
    <table><tr><th>Rating</th><th>Comment</th><th>From</th><th>Role</th><th>When</th></tr>${rows || '<tr><td colspan="5">No feedback yet.</td></tr>'}</table>`);
});

app.post("/api/auth/logout", async (req, res) => {
  req.session.userEmail = null;
  if (req.sb) await req.sb.auth.signOut().catch(() => {});
  res.json({ ok: true });
});

// Local-only helper to grant credits for testing (never in production).
app.post("/api/dev/grant", (req, res) => {
  if (process.env.NODE_ENV === "production") return res.status(404).json({ error: "not found" });
  const e = currentEmail(req);
  if (!e) return res.status(401).json({ error: "sign in first" });
  const n = parseInt(req.body.credits || "4", 10);
  res.json({ ok: true, balance: db.addCredits(e, n) });
});

// ─── Step 1, inputs: extract CV + advert text ──────────────────────────────
app.post(
  "/api/extract",
  upload.fields([{ name: "cvFile" }, { name: "advertFile" }, { name: "photo" }]),
  async (req, res) => {
    try {
      const st = S(req);
      // Optional photo, kept in the session as bytes, shown only on the human
      // version of the CV (never on the ATS version). Deleted from disk at once.
      if (req.files?.photo?.[0]) {
        const p = req.files.photo[0];
        try {
          st.photo = { data: fs.readFileSync(p.path).toString("base64"), type: (p.mimetype || "image/jpeg") };
        } finally { try { fs.unlinkSync(p.path); } catch (_) {} }
      }
      if (req.body.removePhoto === "1") st.photo = null;
      // Links the user confirms are live (LinkedIn, portfolio, website, GitHub).
      if (req.body.links) { try { st.links = JSON.parse(req.body.links); } catch (_) {} }
      // Optional writing style + a sample of the candidate's own writing to mirror.
      if (req.body.writingStyle) st.writingStyle = req.body.writingStyle;
      // A job card from Your job hunt this CV is for.
      if (typeof req.body.jobId === "string" && /^[0-9a-f-]{36}$/i.test(req.body.jobId)) st.jobId = req.body.jobId;
      if (typeof req.body.styleSample === "string") st.styleSample = req.body.styleSample.slice(0, 4000);
      // CV
      if (req.files?.cvFile?.[0]) {
        const f = req.files.cvFile[0];
        st.cvText = await extract.fromFile(f.path, f.mimetype, f.originalname);
      } else if (req.body.cvText) {
        st.cvText = req.body.cvText.trim();
      }
      // Advert: file, URL, or pasted text. A failed URL should not blow up the
      // whole request, tell the user to paste the text instead.
      let advertUrlFailed = false;
      if (req.files?.advertFile?.[0]) {
        const f = req.files.advertFile[0];
        st.advertText = await extract.fromFile(f.path, f.mimetype, f.originalname);
      } else if (req.body.advertUrl) {
        try {
          const fetched = await extract.fromURL(req.body.advertUrl.trim());
          if (fetched && fetched.length > 60) st.advertText = fetched;
          else advertUrlFailed = true;
        } catch (_) {
          advertUrlFailed = true;
        }
      } else if (req.body.advertText) {
        st.advertText = req.body.advertText.trim();
      }

      if (!st.cvText) {
        return res.status(400).json({ error: "Please add your CV (upload a file or paste the text)." });
      }
      if (!st.advertText) {
        return res.status(400).json({
          error: advertUrlFailed
            ? "We couldn't read that job advert link (many sites block automatic reading). Please copy the advert text and paste it into the box instead."
            : "Please add the job advert (upload a file, paste a link, or paste the text)."
        });
      }
      // Return the extracted text so the page can show it in the boxes.
      res.json({
        ok: true,
        cvText: st.cvText,
        advertText: st.advertText,
        cvChars: st.cvText.length,
        advertChars: st.advertText.length
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

// ─── Step 2, the skills-gap engine (two passes) ────────────────────────────
const { fitVerdict } = require("./lib/fit");

// Save this job to the person's job hunt, so the CV and advert carry into
// Interview Prep. Signed-in people only; quietly skipped if it can't be done.
async function saveJobCard(req, st) {
  if (!req.user || !req.sb || !st.advertText) return;
  try {
    let cvText = "";
    try { cvText = masterCv.toText(st.cv) || ""; } catch (_) {}
    const role = (st.cv && st.cv.header && st.cv.header.targetRole && !/\[[A-Z_ ]+\]/.test(st.cv.header.targetRole)) ? st.cv.header.targetRole : "";
    const row = { advert: String(st.advertText).slice(0, 30000), cv_text: cvText.slice(0, 40000), updated_at: new Date().toISOString() };
    if (role) row.title = role.slice(0, 200);
    if (st.fit) { row.fit = st.fit.level; row.fit_note = st.fit.note.slice(0, 2000); }
    if (st.jobId) {
      const { data } = await req.sb.from("job_hunt").update(row).eq("id", st.jobId).eq("user_id", req.user.id).select("id").maybeSingle();
      if (data) return;
    }
    const { data } = await req.sb.from("job_hunt").insert({ ...row, title: row.title || "A job I'm applying for", user_id: req.user.id }).select("id").single();
    if (data) st.jobId = data.id;
  } catch (e) { console.error("[jobhunt] save:", e.message); }
}

app.post("/api/gaps", async (req, res) => {
  try {
    const st = S(req);
    if (!st.cvText || !st.advertText) return res.status(400).json({ error: "Add your CV and the advert first." });
    st.gaps = await gapEngine.detectGaps({ cvText: st.cvText, advertText: st.advertText });
    st.questions = await gapEngine.buildQuestions({ cvText: st.cvText, advertText: st.advertText, gaps: st.gaps });
    st.fit = fitVerdict(st.gaps.requirements || []);
    res.json({
      fit: st.fit,
      ok: true,
      requirements: st.gaps.requirements || [],
      gapQuestions: st.questions.gapQuestions || [],
      sectionQuestions: st.questions.sectionQuestions || [],
      note: st.gaps.note
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Voice answer -> text (same mechanism as Interview Prep Report)
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No audio uploaded." });
    const text = await transcribe(req.file.path, req.file.originalname, req.file.mimetype);
    res.json({ ok: true, text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Step 3, generate + fabrication gate ───────────────────────────────────
// The slow pipeline, run as a background job (see startJob).
async function generateWork(st) {
  // Build source-of-truth BEFORE generating (Section 9).
  st.sot = await sourceOfTruth.build({ cvText: st.cvText, answers: st.answers });

  // Generate the draft.
  let cv = await cvGenerator.generate({
    cvText: st.cvText, advertText: st.advertText, gaps: st.gaps,
    answers: st.answers, linksConfirmed: st.linksConfirmed,
    writingStyle: st.writingStyle, styleSample: st.styleSample
  });
  // Private skills match report, built before the honesty gate reshapes the CV.
  st.matchReport = matchReport.build(cv, st.gaps);

  // HARD GATE (fabrication) and the advisory self-review don't depend on each
  // other, so run them together to save a whole round-trip. The gate stays on
  // the strong model; the review runs on the faster model inside reviewer.js.
  const [fab, review] = await Promise.all([
    fabrication.check(cv, st.sot),
    reviewer.selfReview(cv, { advertText: st.advertText })
  ]);
  cv = fab.cleanedCV;
  applyUserLinks(cv, st); // the user's own links, added after the gate

  scrubCv(cv); // strip mechanical AI clichés before checks/preview

  // Programmatic Section 8 checks.
  const prog = checks.run(cv);

  st.cv = cv;
  st.checkReport = { fabrication: fab, programmatic: prog, review };
  // New finished CV: it hasn't had a credit spent on it yet.
  st.cvVersion = (st.cvVersion || 0) + 1;
  st.paidVersion = null;

  const blocked = !fab.pass || (cv.missing && cv.missing.length > 0);
  return {
    ok: true,
    cv,
    missing: cv.missing || [],
    fabricationPass: fab.pass,
    fabricationFlags: fab.flags,
    programmatic: prog,
    matchReport: st.matchReport,
    review,
    downloadBlocked: blocked,
    message: blocked
      ? "We found gaps or claims we couldn't trace to what you told us. Answer these before downloading, or tell us to leave them out."
      : "Clean. Pick a design and download."
  };
}

app.post("/api/generate", (req, res) => {
  const st = S(req);
  if (!st.cvText || !st.advertText) return res.status(400).json({ error: "Add your CV and the advert first." });
  if (overGenCap(st)) return res.status(429).json({ error: "rewrite-limit" });
  st.answers = req.body.answers || st.answers || [];
  st.linksConfirmed = req.body.linksConfirmed || req.body.links || st.linksConfirmed || {};
  if (req.body.links) st.links = req.body.links;
  const jobId = startJob(req, () => generateWork(st));
  res.status(202).json({ jobId });
});

// Candidate resolves [MISSING]/flagged items (answer, or accept leaving out).
async function resolveWork(st, { resolutions, acceptLeaveOutArr }) {
  const acceptLeaveOut = new Set(acceptLeaveOutArr || []);
  // Fold answers back into the answer set and regenerate for a clean pass.
  st.answers = (st.answers || []).concat(
    resolutions.filter((r) => r.answer).map((r) => ({ question: r.item, answer: r.answer }))
  );
  st.sot = await sourceOfTruth.build({ cvText: st.cvText, answers: st.answers });

  let cv = await cvGenerator.generate({
    cvText: st.cvText, advertText: st.advertText, gaps: st.gaps,
    answers: st.answers, linksConfirmed: st.linksConfirmed,
    writingStyle: st.writingStyle, styleSample: st.styleSample
  });
  st.matchReport = matchReport.build(cv, st.gaps);
  const [fab, review] = await Promise.all([
    fabrication.check(cv, st.sot),
    reviewer.selfReview(cv, { advertText: st.advertText })
  ]);
  cv = fab.cleanedCV;
  applyUserLinks(cv, st);
  // Drop any remaining missing the candidate explicitly accepted leaving out.
  cv.missing = (cv.missing || []).filter((m) => !acceptLeaveOut.has(m.item));

  scrubCv(cv); // strip mechanical AI clichés
  const prog = checks.run(cv);
  st.cv = cv;
  saveJobCard(req, st);
  st.checkReport = { fabrication: fab, programmatic: prog, review };
  st.cvVersion = (st.cvVersion || 0) + 1;
  st.paidVersion = null;

  const blocked = cv.missing && cv.missing.length > 0;
  return { ok: true, cv, missing: cv.missing, downloadBlocked: blocked, programmatic: prog, review, matchReport: st.matchReport };
}

// Candidate resolves [MISSING]/flagged items (answer, or accept leaving out).
app.post("/api/resolve", (req, res) => {
  try {
    const st = S(req);
    if (!st.cv) return res.status(400).json({ error: "Generate a draft first." });
    if (overGenCap(st)) return res.status(429).json({ error: "rewrite-limit" });
    const resolutions = req.body.resolutions || [];
    const acceptLeaveOutArr = req.body.acceptLeaveOut || [];
    const jobId = startJob(req, () => resolveWork(st, { resolutions, acceptLeaveOutArr }));
    res.status(202).json({ jobId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// "Leave them all out", drop the outstanding flags WITHOUT re-running the AI
// (the fabricated content was already stripped; this just clears the questions),
// so the user can proceed straight to choosing a design. No cost, no new flags.
app.post("/api/drop-flags", (req, res) => {
  const st = S(req);
  if (!st.cv) return res.status(400).json({ error: "Generate a draft first." });
  st.cv.missing = [];
  res.json({ ok: true, cv: st.cv, downloadBlocked: false });
});

// ─── Step 4, designs, preview, pay, download ───────────────────────────────
app.get("/api/designs", (req, res) => res.json({ designs, designerTemplates: DESIGNER_TEMPLATES }));

app.post("/api/preview", (req, res) => {
  const st = S(req);
  const cv = st.cv || req.body.cv;
  if (!cv) return res.status(400).json({ error: "No CV to preview yet." });
  st.designId = req.body.designId || st.designId || designs[0].id;
  const clean = sanitizeForOutput(cv);
  if (isDesigner(st.designId)) {
    // Full HTML document, the front-end shows it in an iframe.
    return res.json({ ok: true, designId: st.designId, designer: true, html: renderDesignerHtml(clean, st.designId) });
  }
  res.json({ ok: true, designId: st.designId, html: htmlPreview.preview(clean, st.designId) });
});

// True-to-download preview: render the SELECTED design's real PDF (Word via
// LibreOffice, designer via weasyprint) and stream it inline for an <iframe>,
// so the preview looks exactly like the downloaded file. No credit is spent.
// A small in-memory cache keyed by CV version + design keeps re-selecting fast.
const _previewCache = new Map();
function _pvGet(k) { return _previewCache.get(k); }
function _pvSet(k, buf) { _previewCache.set(k, buf); if (_previewCache.size > 48) _previewCache.delete(_previewCache.keys().next().value); }
app.get("/api/preview-pdf", async (req, res) => {
  try {
    const st = S(req);
    if (!st.cv) return res.status(400).send("No CV to preview yet.");
    const reqId = req.query.design || st.designId || designs[0].id;
    const clean = sanitizeForOutput(st.cv);
    const key = `${st.cvVersion || 0}:${reqId}`;
    let buf = _pvGet(key);
    if (!buf) {
      if (isDesigner(reqId)) {
        if (!weasyAvailable()) return res.status(503).send("Preview renderer unavailable.");
        buf = await renderHtmlPdf(renderDesignerHtml(clean, reqId));
      } else {
        if (!libreAvailable()) return res.status(503).send("Preview renderer unavailable.");
        const docx = await buildDocx(clean, byId(reqId), { ats: false, photo: st.photo });
        buf = await docxToPdf(docx);
      }
      buf = await watermark(buf); // stamp "PREVIEW" so an un-paid preview is unusable
      _pvSet(key, buf);
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=preview.pdf");
    res.setHeader("Cache-Control", "private, no-store");
    res.send(buf);
  } catch (e) {
    res.status(500).send("Preview error.");
  }
});

// Buy a credit pack (£5 = 4 CVs, £10 = 10 CVs). Must be signed in.
app.get("/api/packs", (req, res) => res.json({ packs: payment.PACKS }));

app.post("/api/checkout", async (req, res) => {
  try {
    const userEmail = currentEmail(req);
    if (!userEmail) return res.status(401).json({ error: "Please sign in first." });
    if (!payment.hasKey()) return res.status(503).json({ error: "Payment not configured (STRIPE_SECRET_KEY missing)." });
    if (!payment.pack(req.body.packId)) return res.status(400).json({ error: "Choose a pack." });
    const cs = await payment.createCheckoutSession({
      packId: req.body.packId,
      userEmail,
      successUrl: `${BASE}/app.html?paid=1&cs={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${BASE}/app.html?canceled=1`
    });
    res.json({ ok: true, url: cs.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Confirm a checkout on return from Stripe and grant credits (idempotent).
app.post("/api/confirm-payment", async (req, res) => {
  try {
    const csId = req.body.cs;
    if (!csId) return res.status(400).json({ error: "No checkout session." });
    const r = await payment.grantForSession(csId);
    const userEmail = currentEmail(req);
    const st = S(req);
    res.json({ ok: true, paid: r.paid, designId: st.designId || null, balance: userEmail ? db.credits(userEmail) : (r.balance || 0) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Download: costs 1 credit per finished CV. All formats of the SAME finished CV
// are free (paidVersion matches cvVersion). Regenerating makes a new CV that
// costs another credit. Must be signed in.
// ─── "I've checked it" confirmation before any download ─────────────────────
// The person must tick a box saying they've read the document and it's true.
// We keep a note of it in their session, and for Comquat account holders a
// dated record in their consent history (once per version of the document).
const CONFIRM_WORDING = {
  cv: "I've read this CV from top to bottom. Everything in it is true and accurate, and I'll fix anything that isn't before I send it to anyone.",
  cover: "I've read this cover letter from top to bottom. Everything in it is true and accurate, and I'll fix anything that isn't before I send it to anyone.",
  master: "I've read this CV from top to bottom. Everything in it is true and accurate, and I'll fix anything that isn't before I send it to anyone.",
};
// The CV Builder uses the same topic as CV Rewrite (the database accepts it); the
// source "cv-builder" tells the two apart.
const CONFIRM_TOPIC = { cv: "cv_confirm", cover: "cover_confirm", master: "cv_confirm" };
const CONFIRM_SOURCE = { cv: "cv-rewrite", cover: "cv-rewrite", master: "cv-builder" };
const CONFIRM_NEEDED = "Please tick the box to confirm you've read it through and it's accurate.";
// `version` is optional: the CV Builder passes the master CV's last-saved time,
// so each saved version of it is confirmed (and recorded) once.
async function recordConfirmation(req, kind, version) {
  const st = S(req);
  if (version === undefined) version = kind === "cv" ? st.cvVersion || 0 : `${st.coverLetterVersion || 0}.${st.coverLetterGen || 0}`;
  const key = `${kind}:${version}`;
  st.confirmations = st.confirmations || {};
  if (st.confirmations[key]) return;
  st.confirmations[key] = new Date().toISOString();
  if (accountsOn() && req.user && req.sb) {
    const { error } = await req.sb.from("consent_log").insert({
      user_id: req.user.id, topic: CONFIRM_TOPIC[kind],
      granted: true, source: CONFIRM_SOURCE[kind], wording: CONFIRM_WORDING[kind],
    });
    if (error) console.error("[confirm] could not record:", error.message);
  }
}

// Comquat accounts: a copy of every CV and cover letter a signed-in person
// downloads is kept in "My documents" on their account page. A failed save
// never stops the download; the page is told whether it worked.
const { sourceKey: docKey } = require("./accounts/documents");
async function keepCopy(req, res, kind, buf, fileName, made) {
  if (!accountsOn() || !req.user || typeof req.saveDocument !== "function") return;
  // The job title: from the CV if it's settled, otherwise from the advert.
  const st = S(req);
  const real = (v) => { const t = String(v || "").trim(); return !t || /\[[A-Z_ ]+\]/.test(t) ? "" : t; };
  const fromAdvert = (txt) => {
    const t = String(txt || "");
    const labelled = t.match(/^\s*(?:job\s*title|role|position)\s*[:\-]\s*(.{3,60})$/im);
    if (labelled) return labelled[1].trim();
    const m = t.match(/\b(?:seeking|hiring|for)\s+(?:an?\s+)?([A-Z][A-Za-z/ ]{3,40}?)(?:\s+to\b|[.,\n])/);
    return m ? m[1].trim() : "";
  };
  const role = real(made && made.header && made.header.targetRole) || real(st.cv && st.cv.header && st.cv.header.targetRole) || real(fromAdvert(st.advertText));
  const r = await req.saveDocument({
    kind,
    title: (kind === "cv" ? "CV" : "Cover letter") + (role ? ` for ${role}` : ""),
    jobTitle: role,
    fileName,
    mimeType: /\.pdf$/i.test(fileName) ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    data: buf,
    sourceKey: docKey(kind, made, fileName.slice(fileName.lastIndexOf("_"))),
  });
  if (r && r.saved) res.setHeader("X-Comquat-Saved", "1");
}

// ---- Master CV: one full CV kept in a Comquat account -----------------------------
// Signed-in people only. Stored in Supabase as the person themselves, so only
// they can reach it. Nothing here goes to the AI unless they press "Write it up
// for me" or tailor it for a job, and then the identity shield applies as usual.
const aiHasKey = () => require("./lib/anthropic").hasKey();
const masterCv = require("./lib/masterCv");
const fresh = require("./lib/freshCv");
const masterWriter = require("./lib/masterWriter");
const journeys = require("./lib/journeys");
const healthCheck = require("./lib/healthCheck");
const masterImport = require("./lib/masterImport");
// AI calls from the builder hide the person's own name, email, phone and links
// as well as anything in the text being sent (lib/identityShield.js).
async function masterShield(req, texts, fn) {
  let h = {};
  try { const m = await loadMaster(req); h = (m && m.cv.header) || {}; } catch (_) { /* shield what we can */ }
  const c = h.contacts || {};
  return identityShield.run(() => ({
    texts: (texts || []).filter(Boolean),
    names: [h.name].filter(Boolean),
    emails: [c.email, req.user && req.user.email].filter(Boolean),
    phones: [c.phone].filter(Boolean),
    links: [h.linkedin, h.portfolio, h.introVideo].filter(Boolean),
  }), fn);
}
// A Fresh design downloaded as Word uses the nearest editable Word design.
const FRESH_WORD = { "f-sunrise": "warm-operational", "f-green": "two-column-sidebar", "f-bold": "bold-header-block", "f-sky": "graduate-entry" };
const freshClean = (cv) => sanitizeForOutput(masterCv.forFresh(cv));
function needAccount(req, res) {
  if (accountsOn() && req.user && req.sb) return true;
  res.status(401).json({ error: "Please sign in to use your master CV.", signIn: "/account/?next=" + encodeURIComponent("/account/me.html") });
  return false;
}
async function loadMaster(req) {
  const { data, error } = await req.sb.from("master_cvs").select("data, updated_at").eq("user_id", req.user.id);
  if (error) throw new Error(error.message);
  return data && data[0] ? { cv: masterCv.normalise(data[0].data), updatedAt: data[0].updated_at } : null;
}
const masterFail = (res, e, what) => {
  console.error(`[master] ${what}:`, e.message);
  res.status(500).json({ error: "Something went wrong there. Your work is still on this page, so please try again in a moment." });
};

app.get("/api/master", async (req, res) => {
  if (!needAccount(req, res)) return;
  try {
    const m = await loadMaster(req);
    const cv = m ? m.cv : masterCv.normalise({});
    res.set("Cache-Control", "no-store");
    res.json({ cv, saved: !!m, updatedAt: m ? m.updatedAt : null, progress: masterCv.progress(cv), behaviours: require("./lib/behaviours").catalogue(),
      designs: designs.map((d) => ({ id: d.id, name: d.name, category: d.category, description: d.description })),
      designerTemplates: DESIGNER_TEMPLATES.map((d) => ({ id: d.id, name: d.name, category: d.category, description: d.description })),
      freshTemplates: fresh.FRESH_TEMPLATES.map((d) => ({ id: d.id, name: d.name, category: d.category, description: d.description })),
      writeUp: aiHasKey(),
      voice: !!process.env.OPENAI_API_KEY,
      banned: cliches.BANNED_PHRASES,
      journeys: journeys.forPage(),
      health: healthCheck.check(cv) });
  } catch (e) { masterFail(res, e, "load"); }
});

app.post("/api/master", async (req, res) => {
  if (!needAccount(req, res)) return;
  if (!req.is("application/json")) return res.status(415).json({ error: "Please send JSON." });
  try {
    const cv = masterCv.normalise(req.body && req.body.cv);
    const now = new Date().toISOString();
    const { data, error } = await req.sb.from("master_cvs").update({ data: cv, updated_at: now }).eq("user_id", req.user.id).select("user_id");
    if (error) throw new Error(error.message);
    if (!data || !data.length) {
      const { error: e2 } = await req.sb.from("master_cvs").insert({ user_id: req.user.id, data: cv, updated_at: now });
      if (e2) throw new Error(e2.message);
    }
    res.json({ ok: true, updatedAt: now, progress: masterCv.progress(cv), health: healthCheck.check(cv) });
  } catch (e) { masterFail(res, e, "save"); }
});

// Plain text, to drop into CV Rewrite's "paste your CV" box.
app.get("/api/master/text", async (req, res) => {
  if (!needAccount(req, res)) return;
  try {
    const m = await loadMaster(req);
    res.set("Cache-Control", "no-store");
    res.json({ text: m && masterCv.hasContent(m.cv) ? masterCv.toText(m.cv) : "", writingStyle: m ? m.cv.writingStyle : null, styleSample: m ? m.cv.styleSample || "" : "" });
  } catch (e) { masterFail(res, e, "text"); }
});

app.get("/api/master/download", async (req, res) => {
  if (!needAccount(req, res)) return;
  try {
    const m = await loadMaster(req);
    if (!m || !masterCv.hasContent(m.cv)) return res.status(400).json({ error: "There's nothing in your master CV yet. Add a few details first." });
    // Same rule as CV Rewrite: no file until they've ticked the "it's all true" box.
    if (req.query.confirmed !== "1") return res.status(400).json({ error: CONFIRM_NEEDED });
    await recordConfirmation(req, "master", m.updatedAt || "");
    const clean = sanitizeForOutput(masterCv.forOutput(m.cv));
    // Same designs and formats as CV Rewrite: Word/ATS templates (Word, PDF or
    // ATS-safe PDF) and Designer templates (PDF only).
    const reqId = String(req.query.design || "modern-minimal");
    const type = String(req.query.type || "docx").toLowerCase();
    const nameSafe = (clean.header.name || "My").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "My";
    let buf, ext, label;
    if (fresh.isFresh(reqId) && (type === "pdf" || type === "")) {
      if (!weasyAvailable()) return res.status(503).json({ error: "The PDF isn't available just now. Please try Word instead." });
      buf = await renderHtmlPdf(fresh.renderFresh(freshClean(m.cv), reqId)); ext = "pdf"; label = reqId.replace(/^f-/, "");
    } else if (fresh.isFresh(reqId)) {
      const ats = type === "ats" || type === "ats-pdf";
      const docx = await buildDocx(clean, byId(FRESH_WORD[reqId]), { ats });
      label = ats ? "ATS" : reqId.replace(/^f-/, "");
      if (type === "docx") { buf = docx; ext = "docx"; }
      else {
        if (!libreAvailable()) return res.status(503).json({ error: "The ATS-safe PDF isn't available just now. Please try Word instead." });
        buf = await docxToPdf(docx); ext = "pdf";
      }
    } else if (isDesigner(reqId)) {
      if (type === "docx") return res.status(400).json({ error: "Designer templates download as PDF. For an editable Word file, choose a Word template." });
      if (type === "ats" || type === "ats-pdf") {
        if (!libreAvailable()) return res.status(503).json({ error: "The ATS-safe PDF isn't available just now. Please try Word instead." });
        buf = await docxToPdf(await buildDocx(clean, byId("modern-minimal"), { ats: true })); ext = "pdf"; label = "ATS";
      } else {
        if (!weasyAvailable()) return res.status(503).json({ error: "Designer PDFs aren't available just now. Please pick a Word template." });
        buf = await renderHtmlPdf(renderDesignerHtml(clean, reqId)); ext = "pdf"; label = reqId;
      }
    } else {
      const design = byId(reqId) || byId("modern-minimal");
      const ats = type === "ats" || type === "ats-pdf";
      const docx = await buildDocx(clean, design, { ats });
      label = ats ? "ATS" : design.id;
      if (type === "docx") { buf = docx; ext = "docx"; }
      else {
        if (!libreAvailable()) return res.status(503).json({ error: "PDF isn't available just now. Please download Word instead." });
        buf = await docxToPdf(docx); ext = "pdf";
      }
    }
    const fileName = `${nameSafe}_Master_CV_${label}.${ext}`;
    const mime = ext === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    const saved = await req.saveDocument({
      kind: "cv", title: "Master CV", jobTitle: clean.header.targetRole || "",
      fileName, mimeType: mime, data: buf, sourceKey: docKey("master", m.cv, label, ext),
    });
    if (saved && saved.saved) res.setHeader("X-Comquat-Saved", "1");
    res.send(buf);
  } catch (e) { masterFail(res, e, "download"); }
});

// The live preview beside the builder: the Fresh design, exactly as the PDF
// will look, made from what's on the page right now (saved or not).
app.post("/api/master/preview", (req, res) => {
  if (!needAccount(req, res)) return;
  if (!req.is("application/json")) return res.status(415).json({ error: "Please send JSON." });
  try {
    const cv = masterCv.normalise(req.body && req.body.cv);
    const id = fresh.isFresh(req.body && req.body.design) ? req.body.design : "f-sunrise";
    res.set("Cache-Control", "no-store");
    res.type("html").send(fresh.renderFresh(freshClean(cv), id, { forScreen: true }));
  } catch (e) { masterFail(res, e, "preview"); }
});

// "Write it up for me": their answers or their words about a job, written up
// in the style they picked. Only uses what they told us (lib/masterWriter.js).
const writeCounts = new Map();
function writeAllowed(userId) {
  const day = new Date().toISOString().slice(0, 10), key = userId + day;
  const n = (writeCounts.get(key) || 0) + 1;
  if (writeCounts.size > 5000) writeCounts.clear();
  writeCounts.set(key, n);
  return n <= 40;
}
// Captions for a practice video. Only the sound of the take arrives here,
// never the picture. It goes to OpenAI to be turned into timed words and the
// file is deleted straight after. Nothing is kept.
const captionUpload = multer({ dest: path.join(__dirname, "tmp"), limits: { fileSize: 20 * 1024 * 1024, files: 1 } });
app.post("/api/master/captions", (req, res, next) => captionUpload.single("audio")(req, res, (err) => {
  if (err) return res.status(413).json({ error: "That take is too long for captions. Keep it under three minutes." });
  next();
}), async (req, res) => {
  const drop = () => { if (req.file) try { fs.unlinkSync(req.file.path); } catch (_) {} };
  if (!needAccount(req, res)) return drop();
  if (!req.file) return res.status(400).json({ error: "No sound came through. Please try again." });
  if (!writeAllowed(req.user.id)) { drop(); return res.status(429).json({ error: "You've made a lot of captions today. Try again tomorrow." }); }
  try {
    const words = await transcribeWords(req.file.path, req.file.originalname, req.file.mimetype);
    if (!words.length) return res.status(422).json({ error: "We couldn't hear any words in that take. Check your microphone and try again." });
    res.json({ ok: true, words });
  } catch (e) {
    drop();
    console.error("[master] captions:", e.message);
    res.status(502).json({ error: "We couldn't make captions just now. Please try again in a moment." });
  }
});

app.post("/api/master/write", async (req, res) => {
  if (!needAccount(req, res)) return;
  if (!req.is("application/json")) return res.status(415).json({ error: "Please send JSON." });
  if (!aiHasKey()) return res.status(503).json({ error: "Writing it up isn't available just now. You can still build it from your answers." });
  if (!writeAllowed(req.user.id)) return res.status(429).json({ error: "You've written up a lot today. Have a go at editing it yourself, and try again tomorrow." });
  const b = req.body || {};
  try {
    const style = String(b.style || ""), styleSample = String(b.styleSample || "").slice(0, 3000);
    const journey = journeys.isJourney(b.journey) ? b.journey : "";
    const run = (texts, work) => new Promise((resolve, reject) => { masterShield(req, texts, () => work().then(resolve, reject)); });
    if (b.task === "statement") {
      // Private answers (such as the hours someone needs) never leave the account.
      const answers = { ...(b.answers || {}) };
      for (const k of journeys.privateKeys(journey)) delete answers[k];
      const out = await run([b.current], () => masterWriter.statement({ answers, current: String(b.current || "").slice(0, 2500), targetRole: String(b.targetRole || "").slice(0, 120), style, styleSample, journey }));
      return res.json({ ok: true, ...out });
    }
    if (b.task === "job") {
      const out = await run([], () => masterWriter.job({ job: b.job || {}, style, styleSample }));
      return res.json({ ok: true, ...out });
    }
    if (b.task === "proof") {
      const out = await run([], () => masterWriter.proof({ strength: String(b.strength || ""), words: String(b.words || ""), style, styleSample }));
      return res.json({ ok: true, ...out });
    }
    if (b.task === "video") {
      // Planned from the saved master CV, so the page saves first.
      const m = await loadMaster(req);
      if (!m) return res.status(400).json({ error: "Add a bit more to your CV first, then we can plan your 90 seconds." });
      const out = await run([], () => masterWriter.videoPlan({ cv: m.cv, company: String(b.company || "").slice(0, 120), role: String(b.role || "").slice(0, 120) }));
      return res.json({ ok: true, plan: out });
    }
    if (b.task === "videotext") {
      // The words on screen for a styled video, from the saved notes and CV.
      const m = await loadMaster(req);
      if (!m) return res.status(400).json({ error: "Plan your 90 seconds first, then we can write the words for your video." });
      const out = await run([], () => masterWriter.videoText({ cv: m.cv, role: String(b.role || "").slice(0, 120) }));
      return res.json({ ok: true, text: out });
    }
    if (b.task === "roles") {
      // Jobs the saved master CV could suit, for the account page.
      const m = await loadMaster(req);
      if (!m) return res.status(400).json({ error: "Build your CV first, then we can suggest jobs it could suit." });
      const out = await run([], () => masterWriter.roles({ cv: m.cv }));
      return res.json({ ok: true, roles: out });
    }
    if (b.task === "followup") {
      if (journeys.privateKeys(journey).includes(String(b.questionId || ""))) return res.json({ ok: true, heard: [], followUp: "" });
      const out = await run([], () => masterWriter.followUp({ question: String(b.question || ""), answer: String(b.answer || ""), journey, context: String(b.context || "").slice(0, 300) }));
      return res.json({ ok: true, ...out });
    }
    res.status(400).json({ error: "Unknown request." });
  } catch (e) {
    if (e.status && e.status < 500) return res.status(e.status).json({ error: e.message });
    console.error("[master] write:", e.message);
    res.status(502).json({ error: e.status === 502 ? e.message : "We couldn't write that up just now. Please try again in a moment." });
  }
});

// "Upload my CV": an existing CV read into the builder's sections, plus its
// health check. Nothing is saved here: the page shows it and the person
// chooses to use it. The file is deleted as soon as its text is read.
app.post("/api/master/import", (req, res, next) => { if (needAccount(req, res)) next(); }, upload.single("cvFile"), async (req, res) => {
  const f = req.file;
  const drop = () => { if (f) try { fs.unlinkSync(f.path); } catch (_) {} };
  if (!f) return res.status(400).json({ error: "Please choose your CV file first." });
  if (!/\.(docx|pdf|txt)$/i.test(f.originalname || "") || f.size > 8 * 1024 * 1024) { drop(); return res.status(400).json({ error: "Please upload your CV as a Word file (.docx) or a PDF, under 8MB." }); }
  if (!aiHasKey()) { drop(); return res.status(503).json({ error: "Reading CVs isn't available just now. You can start from scratch instead." }); }
  if (!writeAllowed(req.user.id)) { drop(); return res.status(429).json({ error: "You've done a lot today. Please try again tomorrow." }); }
  try {
    const text = await extract.fromFile(f.path, f.mimetype, f.originalname);
    const header = masterImport.headerFrom(text);
    const cv = await new Promise((resolve, reject) => {
      identityShield.run(() => ({ texts: [text], names: [header.name].filter(Boolean), emails: [header.contacts.email, req.user.email].filter(Boolean), phones: [header.contacts.phone].filter(Boolean), links: [header.linkedin].filter(Boolean) }),
        () => masterImport.read(text).then(resolve, reject));
    });
    res.json({ ok: true, cv, health: healthCheck.check(cv, { journey: journeys.isJourney(req.body.journey) ? req.body.journey : "" }) });
  } catch (e) {
    drop();
    if (e.status && e.status < 500) return res.status(e.status).json({ error: e.message });
    console.error("[master] import:", e.message);
    res.status(502).json({ error: e.status === 502 ? e.message : "We couldn't read that CV just now. Please try again, or start from scratch." });
  }
});

app.post("/api/master/delete", async (req, res) => {
  if (!needAccount(req, res)) return;
  if (!req.is("application/json")) return res.status(415).json({ error: "Please send JSON." });
  try {
    const { error } = await req.sb.from("master_cvs").delete().eq("user_id", req.user.id);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (e) { masterFail(res, e, "delete"); }
});

app.get("/api/download", async (req, res) => {
  try {
    const st = S(req);
    if (!st.cv) return res.status(400).json({ error: "Nothing generated yet." });
    // Clean any leftover "[MISSING]" placeholders and drop empty entries, so the
    // file is a tidy CV with unanswered gaps simply left out (the fabricated
    // content was already stripped during the honesty check).
    const cleanCv = sanitizeForOutput(st.cv);
    if (!hasContent(cleanCv)) return res.status(400).json({ error: "There isn't enough content to build a CV yet. Please generate one first." });

    const userEmail = currentEmail(req);
    if (!userEmail) return res.status(401).json({ error: "Please sign in to download." });
    if (req.query.confirmed !== "1") return res.status(400).json({ error: CONFIRM_NEEDED });
    await recordConfirmation(req, "cv");

    const alreadyPaid = st.paidVersion && st.paidVersion === st.cvVersion;
    if (!alreadyPaid) {
      if (!FREE_MODE) {
        if (db.credits(userEmail) < 1) return res.status(402).json({ error: "no-credits" });
        if (!db.spendCredit(userEmail)) return res.status(402).json({ error: "no-credits" });
      }
      st.paidVersion = st.cvVersion;
      // On first paid download: email the CV (Word + PDF attached) + notify.
      const d0 = resolveDesign(req.query.design || st.designId || designs[0].id);
      emailCvFiles(userEmail, cleanCv, d0, st.photo).catch(() => {});
      email.sendInternalNotice({ email: userEmail, role: cleanCv.header?.targetRole, designId: d0.id }).catch(() => {});
    }

    const reqId = req.query.design || st.designId || designs[0].id;
    const type = (req.query.type || "docx").toLowerCase();
    const nameSafe = (cleanCv.header?.name || "cv").replace(/[^\w]+/g, "_");

    // ── Designer templates: PDF only (rendered by weasyprint). ──
    if (isDesigner(reqId)) {
      if (type === "docx") {
        return res.status(400).json({ error: "Designer templates download as PDF. For an editable Word file, choose a Word/ATS template." });
      }
      if (type === "ats" || type === "ats-pdf") {
        // ATS-safe fallback: a plain single-column render via the docx engine.
        if (!libreAvailable()) return res.status(503).json({ error: "ATS PDF unavailable (LibreOffice not installed)." });
        const atsBuf = await buildDocx(cleanCv, byId("modern-minimal"), { ats: true });
        const atsPdf = await docxToPdf(atsBuf);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${nameSafe}_ATS.pdf"`);
        await keepCopy(req, res, "cv", atsPdf, `${nameSafe}_ATS.pdf`, cleanCv);
        return res.send(atsPdf);
      }
      if (!weasyAvailable()) return res.status(503).json({ error: "The designer PDF renderer isn't available on the server yet." });
      const dpdf = await renderHtmlPdf(renderDesignerHtml(cleanCv, reqId));
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${nameSafe}_${reqId}.pdf"`);
      await keepCopy(req, res, "cv", dpdf, `${nameSafe}_${reqId}.pdf`, cleanCv);
      return res.send(dpdf);
    }

    // ── Word / ATS templates (docx engine). ──
    const design = byId(reqId);
    const ats = type === "ats-pdf" || type === "ats";
    const buf = await buildDocx(cleanCv, design, { ats, photo: ats ? null : st.photo });
    const suffix = ats ? "ATS" : design.id;

    if (type === "docx") {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${nameSafe}_${suffix}.docx"`);
      await keepCopy(req, res, "cv", buf, `${nameSafe}_${suffix}.docx`, cleanCv);
      return res.send(buf);
    }
    if (!libreAvailable()) return res.status(503).json({ error: "PDF conversion unavailable (LibreOffice not installed)." });
    const pdf = await docxToPdf(buf);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${nameSafe}_${suffix}.pdf"`);
    await keepCopy(req, res, "cv", pdf, `${nameSafe}_${suffix}.pdf`, cleanCv);
    res.send(pdf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Cover letter (optional add-on, costs 1 credit) ─────────────────────────
// Generates a personalised, honest cover letter from the finished CV + advert.
// One credit per letter; re-downloading the same letter (Word/PDF) is free.
// The (optional) questions we ask before writing the letter, tailored to the
// advert so the letter is built from the candidate's real reasons.
app.get("/api/cover-letter/questions", (req, res) => {
  const st = S(req);
  res.json({ questions: coverLetter.buildQuestions({ advertText: st.advertText, cv: st.cv }) });
});

app.post("/api/cover-letter", async (req, res) => {
  try {
    const st = S(req);
    if (!st.cv) return res.status(400).json({ error: "Generate your CV first." });
    const userEmail = currentEmail(req);
    if (!userEmail) return res.status(401).json({ error: "Please sign in to add a cover letter." });

    const answers = Array.isArray(req.body.answers) ? req.body.answers : (st.coverAnswers || []);
    const alreadyPaid = st.coverLetter && st.coverLetterVersion === st.cvVersion;
    const wantsRegen = req.body.regenerate === true || (Array.isArray(req.body.answers) && req.body.answers.length > 0);

    // Already paid for this CV version: regenerating with new answers is free;
    // otherwise just hand back the letter we already wrote.
    if (alreadyPaid && !wantsRegen) {
      return res.json({ ok: true, coverLetter: st.coverLetter, alreadyPaid: true, balance: db.credits(userEmail) });
    }
    // First letter for this CV version costs one credit.
    if (!alreadyPaid && !FREE_MODE) {
      if (db.credits(userEmail) < 1) return res.status(402).json({ error: "no-credits" });
      if (!db.spendCredit(userEmail)) return res.status(402).json({ error: "no-credits" });
    }

    st.coverAnswers = answers;
    const cleanCv = sanitizeForOutput(st.cv);
    const letter = await coverLetter.generate({
      cv: cleanCv, advertText: st.advertText, writingStyle: st.writingStyle, styleSample: st.styleSample, answers
    });
    st.coverLetter = letter;
    st.coverLetterVersion = st.cvVersion;
    st.coverLetterGen = (st.coverLetterGen || 0) + 1;

    // Email a copy on first creation (best-effort).
    if (email.hasKey()) {
      try {
        const docx = await buildCoverDocx(letter, cleanCv);
        const nameSafe = (cleanCv.header?.name || "cover").replace(/[^\w]+/g, "_");
        const attachments = [{ filename: `${nameSafe}_CoverLetter.docx`, content: docx.toString("base64") }];
        if (libreAvailable()) attachments.push({ filename: `${nameSafe}_CoverLetter.pdf`, content: (await docxToPdf(docx)).toString("base64") });
        email.sendConfirmation({ to: userEmail, name: cleanCv.header?.name, role: cleanCv.header?.targetRole, designName: "Cover letter", attachments }).catch(() => {});
      } catch (_) {}
    }
    res.json({ ok: true, coverLetter: letter, balance: db.credits(userEmail) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/cover-letter/download", async (req, res) => {
  try {
    const st = S(req);
    if (!st.coverLetter) return res.status(400).json({ error: "No cover letter yet, add one first." });
    if (!currentEmail(req)) return res.status(401).json({ error: "Please sign in to download." });
    if (req.query.confirmed !== "1") return res.status(400).json({ error: CONFIRM_NEEDED });
    await recordConfirmation(req, "cover");
    const cleanCv = sanitizeForOutput(st.cv || {});
    const buf = await buildCoverDocx(st.coverLetter, cleanCv);
    const nameSafe = (cleanCv.header?.name || "cover").replace(/[^\w]+/g, "_");
    const type = (req.query.type || "docx").toLowerCase();
    if (type === "docx") {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${nameSafe}_CoverLetter.docx"`);
      await keepCopy(req, res, "cover", buf, `${nameSafe}_CoverLetter.docx`, st.coverLetter);
      return res.send(buf);
    }
    if (!libreAvailable()) return res.status(503).json({ error: "PDF conversion unavailable (LibreOffice not installed)." });
    const pdf = await docxToPdf(buf);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${nameSafe}_CoverLetter.pdf"`);
    await keepCopy(req, res, "cover", pdf, `${nameSafe}_CoverLetter.pdf`, st.coverLetter);
    res.send(pdf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Soft email capture (before the CV is revealed) ─────────────────────────
// Lead capture, not a hard gate: store the email on the session, send a
// passwordless sign-in link so they can download when ready, and notify us.
app.post("/api/soft-email", async (req, res) => {
  try {
    const st = S(req);
    const em = (req.body.email || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return res.status(400).json({ error: "Please enter a valid email." });
    st.softEmail = em;
    try { await auth.requestLink(em); } catch (_) {}   // emails a sign-in link for later download
    try { email.sendInternalNotice({ email: em, role: st.cv?.header?.targetRole, designId: "lead-soft-email" }); } catch (_) {}
    res.json({ ok: true, sent: email.hasKey() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CV Rewrite app on ${BASE} (port ${PORT})`));
module.exports = app;
