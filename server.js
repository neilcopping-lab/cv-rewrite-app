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

const app = express();
const upload = multer({ dest: path.join(__dirname, "tmp") });
const BASE = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

// Stripe webhook needs the raw body — register BEFORE json parser.
app.post("/webhook/stripe", express.raw({ type: "application/json" }), (req, res) => {
  try {
    const event = payment.verifyWebhook(req.body, req.headers["stripe-signature"]);
    if (event.type === "checkout.session.completed") {
      // Payment confirmation is also re-checked at download time via isPaid.
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

// ─── Step 1 — inputs: extract CV + advert text ──────────────────────────────
app.post(
  "/api/extract",
  upload.fields([{ name: "cvFile" }, { name: "advertFile" }]),
  async (req, res) => {
    try {
      const st = S(req);
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
    const text = await transcribe(req.file.path);
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
    st.answers = req.body.answers || st.answers || [];
    st.linksConfirmed = req.body.linksConfirmed || {};

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

    // Programmatic Section 8 checks + AI self-review (judgement).
    const prog = checks.run(cv);
    const review = await reviewer.selfReview(cv, { advertText: st.advertText });

    st.cv = cv;
    st.checkReport = { fabrication: fab, programmatic: prog, review };

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
    // Drop any remaining missing the candidate explicitly accepted leaving out.
    cv.missing = (cv.missing || []).filter((m) => !acceptLeaveOut.has(m.item));

    const prog = checks.run(cv);
    const review = await reviewer.selfReview(cv, { advertText: st.advertText });
    st.cv = cv;
    st.checkReport = { fabrication: fab, programmatic: prog, review };

    const blocked = cv.missing && cv.missing.length > 0;
    res.json({ ok: true, cv, missing: cv.missing, downloadBlocked: blocked, programmatic: prog, review });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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

// Create Stripe checkout — gates the real deliverable.
app.post("/api/checkout", async (req, res) => {
  try {
    const st = S(req);
    if (!st.cv) return res.status(400).json({ error: "Generate a CV first." });
    if (st.cv.missing && st.cv.missing.length) return res.status(400).json({ error: "Resolve the flagged gaps before paying." });
    st.designId = req.body.designId || st.designId || designs[0].id;
    st.email = req.body.email || st.email;
    if (!payment.hasKey()) return res.status(503).json({ error: "Payment not configured (STRIPE_SECRET_KEY missing)." });
    const cs = await payment.createCheckoutSession({
      sessionId: req.sessionID,
      email: st.email,
      successUrl: `${BASE}/app.html?paid=1&cs={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${BASE}/app.html?canceled=1`
    });
    st.checkoutSessionId = cs.id;
    res.json({ ok: true, url: cs.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Confirm payment then unlock downloads for the session.
app.post("/api/confirm-payment", async (req, res) => {
  try {
    const st = S(req);
    const csId = req.body.cs || st.checkoutSessionId;
    if (!csId) return res.status(400).json({ error: "No checkout session." });
    const paid = await payment.isPaid(csId);
    st.paid = paid;
    if (paid && !st.emailed) {
      st.emailed = true;
      const d = byId(st.designId);
      email.sendConfirmation({ to: st.email, name: st.cv?.header?.name, role: st.cv?.header?.targetRole, designName: d.name }).catch(() => {});
      email.sendInternalNotice({ email: st.email, role: st.cv?.header?.targetRole, designId: st.designId }).catch(() => {});
    }
    res.json({ ok: true, paid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Download: gated by real payment. type = docx | pdf | ats-pdf
app.get("/api/download", async (req, res) => {
  try {
    const st = S(req);
    if (!st.cv) return res.status(400).json({ error: "Nothing generated yet." });
    if (st.cv.missing && st.cv.missing.length) return res.status(403).json({ error: "Resolve flagged gaps first." });
    // Bypass only in explicit dev mode with no Stripe key configured.
    const devOpen = !payment.hasKey() && process.env.NODE_ENV !== "production";
    if (!st.paid && !devOpen) return res.status(402).json({ error: "Payment required." });

    const type = (req.query.type || "docx").toLowerCase();
    const design = byId(req.query.design || st.designId || designs[0].id);
    const ats = type === "ats-pdf" || type === "ats";
    const buf = await buildDocx(st.cv, design, { ats });
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
