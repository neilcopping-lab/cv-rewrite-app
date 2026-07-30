// ─── The Com'mon People · CV Rewrite App · server ───────────────────────────
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const multer = require("multer");

const brand = require("./lib/brand");
const extract = require("./lib/extractText");
const { transcribe } = require("./lib/transcribe");
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
const payment = require("./lib/payment");
const email = require("./lib/email");
const db = require("./lib/db");
const auth = require("./lib/auth");

const app = express();
const upload = multer({ dest: path.join(__dirname, "tmp") });
const BASE = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

// Stripe webhook needs the raw body — register BEFORE json parser.
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

const S = (req) => (req.session.cv = req.session.cv || {});
const currentEmail = (req) => req.session.userEmail || null;

// Margin guard: cap how many AI rewrites one session can run for free, so a
// user can't rack up the AI bill by hammering "Regenerate" without ever paying.
const GEN_CAP = parseInt(process.env.REGEN_CAP || "8", 10);
function overGenCap(st) {
  st.genCount = (st.genCount || 0) + 1;
  return st.genCount > GEN_CAP;
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
  return cv;
}

// ─── Health ────────────────────────────────────────────────────────────────
app.get("/health", (req, res) =>
  res.json({
    ok: true,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    stripe: payment.hasKey(),
    resend: email.hasKey(),
    libreoffice: libreAvailable(),
    designs: designs.length
  })
);

// ─── Accounts (passwordless magic-link login) ───────────────────────────────
app.post("/api/auth/request", async (req, res) => {
  try {
    const out = await auth.requestLink(req.body.email);
    // In dev (no email provider) we return the link so it can be clicked.
    res.json({ ok: true, sent: out.sent, devLink: out.link || null });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/auth", (req, res) => {
  const emailAddr = auth.verify(req.query.token);
  if (!emailAddr) return res.redirect("/app.html?signin=expired");
  req.session.userEmail = emailAddr;
  res.redirect("/app.html?signin=ok");
});

app.get("/api/auth/me", (req, res) => {
  const e = currentEmail(req);
  res.json({ signedIn: !!e, email: e, credits: e ? db.credits(e) : 0 });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.userEmail = null;
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

// ─── Step 1 — inputs: extract CV + advert text ──────────────────────────────
app.post(
  "/api/extract",
  upload.fields([{ name: "cvFile" }, { name: "advertFile" }, { name: "photo" }]),
  async (req, res) => {
    try {
      const st = S(req);
      // Optional photo — kept in the session as bytes, shown only on the human
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
      // CV
      if (req.files?.cvFile?.[0]) {
        const f = req.files.cvFile[0];
        st.cvText = await extract.fromFile(f.path, f.mimetype, f.originalname);
      } else if (req.body.cvText) {
        st.cvText = req.body.cvText.trim();
      }
      // Advert: file, URL, or pasted text. A failed URL should not blow up the
      // whole request — tell the user to paste the text instead.
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

// ─── Step 2 — the skills-gap engine (two passes) ────────────────────────────
app.post("/api/gaps", async (req, res) => {
  try {
    const st = S(req);
    if (!st.cvText || !st.advertText) return res.status(400).json({ error: "Add your CV and the advert first." });
    st.gaps = await gapEngine.detectGaps({ cvText: st.cvText, advertText: st.advertText });
    st.questions = await gapEngine.buildQuestions({ cvText: st.cvText, advertText: st.advertText, gaps: st.gaps });
    res.json({
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

// ─── Step 3 — generate + fabrication gate ───────────────────────────────────
app.post("/api/generate", async (req, res) => {
  try {
    const st = S(req);
    if (!st.cvText || !st.advertText) return res.status(400).json({ error: "Add your CV and the advert first." });
    if (overGenCap(st)) return res.status(429).json({ error: "rewrite-limit" });
    st.answers = req.body.answers || st.answers || [];
    st.linksConfirmed = req.body.linksConfirmed || req.body.links || st.linksConfirmed || {};
    if (req.body.links) st.links = req.body.links;

    // Build source-of-truth BEFORE generating (Section 9).
    st.sot = await sourceOfTruth.build({ cvText: st.cvText, answers: st.answers });

    // Generate the draft.
    let cv = await cvGenerator.generate({
      cvText: st.cvText, advertText: st.advertText, gaps: st.gaps,
      answers: st.answers, linksConfirmed: st.linksConfirmed
    });

    // HARD GATE: fabrication checker as its own pass.
    const fab = await fabrication.check(cv, st.sot);
    cv = fab.cleanedCV;
    applyUserLinks(cv, st); // the user's own links, added after the gate

    // Programmatic Section 8 checks + AI self-review (judgement).
    const prog = checks.run(cv);
    const review = await reviewer.selfReview(cv, { advertText: st.advertText });

    st.cv = cv;
    st.checkReport = { fabrication: fab, programmatic: prog, review };
    // New finished CV: it hasn't had a credit spent on it yet.
    st.cvVersion = (st.cvVersion || 0) + 1;
    st.paidVersion = null;

    const blocked = !fab.pass || (cv.missing && cv.missing.length > 0);
    res.json({
      ok: true,
      cv,
      missing: cv.missing || [],
      fabricationPass: fab.pass,
      fabricationFlags: fab.flags,
      programmatic: prog,
      review,
      downloadBlocked: blocked,
      message: blocked
        ? "We found gaps or claims we couldn't trace to what you told us. Answer these before downloading, or tell us to leave them out."
        : "Clean. Pick a design and download."
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Candidate resolves [MISSING]/flagged items (answer, or accept leaving out).
app.post("/api/resolve", async (req, res) => {
  try {
    const st = S(req);
    if (!st.cv) return res.status(400).json({ error: "Generate a draft first." });
    if (overGenCap(st)) return res.status(429).json({ error: "rewrite-limit" });
    // resolutions: [{ item, answer }] ; acceptLeaveOut: [item,...]
    const resolutions = req.body.resolutions || [];
    const acceptLeaveOut = new Set(req.body.acceptLeaveOut || []);

    // Fold answers back into the answer set and regenerate for a clean pass.
    st.answers = (st.answers || []).concat(
      resolutions.filter((r) => r.answer).map((r) => ({ question: r.item, answer: r.answer }))
    );
    st.sot = await sourceOfTruth.build({ cvText: st.cvText, answers: st.answers });

    let cv = await cvGenerator.generate({
      cvText: st.cvText, advertText: st.advertText, gaps: st.gaps,
      answers: st.answers, linksConfirmed: st.linksConfirmed
    });
    const fab = await fabrication.check(cv, st.sot);
    cv = fab.cleanedCV;
    applyUserLinks(cv, st);
    // Drop any remaining missing the candidate explicitly accepted leaving out.
    cv.missing = (cv.missing || []).filter((m) => !acceptLeaveOut.has(m.item));

    const prog = checks.run(cv);
    const review = await reviewer.selfReview(cv, { advertText: st.advertText });
    st.cv = cv;
    st.checkReport = { fabrication: fab, programmatic: prog, review };
    st.cvVersion = (st.cvVersion || 0) + 1;
    st.paidVersion = null;

    const blocked = cv.missing && cv.missing.length > 0;
    res.json({ ok: true, cv, missing: cv.missing, downloadBlocked: blocked, programmatic: prog, review });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// "Leave them all out" — drop the outstanding flags WITHOUT re-running the AI
// (the fabricated content was already stripped; this just clears the questions),
// so the user can proceed straight to choosing a design. No cost, no new flags.
app.post("/api/drop-flags", (req, res) => {
  const st = S(req);
  if (!st.cv) return res.status(400).json({ error: "Generate a draft first." });
  st.cv.missing = [];
  res.json({ ok: true, cv: st.cv, downloadBlocked: false });
});

// ─── Step 4 — designs, preview, pay, download ───────────────────────────────
app.get("/api/designs", (req, res) => res.json({ designs }));

app.post("/api/preview", (req, res) => {
  const st = S(req);
  const cv = st.cv || req.body.cv;
  if (!cv) return res.status(400).json({ error: "No CV to preview yet." });
  st.designId = req.body.designId || st.designId || designs[0].id;
  res.json({ ok: true, designId: st.designId, html: htmlPreview.preview(cv, st.designId) });
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
    res.json({ ok: true, paid: r.paid, balance: userEmail ? db.credits(userEmail) : (r.balance || 0) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Download: costs 1 credit per finished CV. All formats of the SAME finished CV
// are free (paidVersion matches cvVersion). Regenerating makes a new CV that
// costs another credit. Must be signed in.
app.get("/api/download", async (req, res) => {
  try {
    const st = S(req);
    if (!st.cv) return res.status(400).json({ error: "Nothing generated yet." });
    if (st.cv.missing && st.cv.missing.length) return res.status(403).json({ error: "Resolve flagged gaps first." });

    const userEmail = currentEmail(req);
    if (!userEmail) return res.status(401).json({ error: "Please sign in to download." });

    const alreadyPaid = st.paidVersion && st.paidVersion === st.cvVersion;
    if (!alreadyPaid) {
      if (db.credits(userEmail) < 1) return res.status(402).json({ error: "no-credits" });
      if (!db.spendCredit(userEmail)) return res.status(402).json({ error: "no-credits" });
      st.paidVersion = st.cvVersion;
      // Send confirmation + internal notice on the first paid download of this CV.
      const d0 = byId(req.query.design || st.designId || designs[0].id);
      email.sendConfirmation({ to: userEmail, name: st.cv.header?.name, role: st.cv.header?.targetRole, designName: d0.name }).catch(() => {});
      email.sendInternalNotice({ email: userEmail, role: st.cv.header?.targetRole, designId: d0.id }).catch(() => {});
    }

    const type = (req.query.type || "docx").toLowerCase();
    const design = byId(req.query.design || st.designId || designs[0].id);
    const ats = type === "ats-pdf" || type === "ats";
    const buf = await buildDocx(st.cv, design, { ats, photo: ats ? null : st.photo });
    const nameSafe = (st.cv.header?.name || "cv").replace(/[^\w]+/g, "_");
    const suffix = ats ? "ATS" : design.id;

    if (type === "docx") {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${nameSafe}_${suffix}.docx"`);
      return res.send(buf);
    }
    // pdf or ats-pdf
    if (!libreAvailable()) return res.status(503).json({ error: "PDF conversion unavailable (LibreOffice not installed)." });
    const pdf = await docxToPdf(buf);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${nameSafe}_${suffix}.pdf"`);
    res.send(pdf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CV Rewrite app on ${BASE} (port ${PORT})`));
module.exports = app;
