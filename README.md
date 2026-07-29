# The Com'mon People — CV Rewrite App

A sister app to the Interview Prep Report. Paste your current CV and a job advert,
answer a few questions where we spot the gaps, and get back a CV **rewritten to align
with that specific role** — downloadable as **Word and PDF**, in a design you choose
from a library of 15. £12.50, one-off. No subscription, no upsell.

Same brand, same voice, same "real work, not a template" promise as the Interview
Prep Report. Built the same way: one Express app, one shared docx module, PDF riding
on the docx, real Stripe payment, Resend for email, deploy to Render.

---

## What it does (the flow)

1. **Paste your CV & the job advert** — upload PDF/DOCX or paste text; the advert can be a URL.
2. **Answer a few questions** — the skills-gap engine compares advert vs CV and asks only about genuine gaps. Type or record (voice is transcribed).
3. **We rewrite, then check it** — section by section in your own words, then a fabrication check strips anything not traceable to what you provided.
4. **Choose a design, download** — 15 designs, live preview, Word + PDF, plus an ATS-safe version.

---

## Architecture

```
server.js                 Express app + JSON API + Stripe webhook
lib/
  brand.js                Single source of truth for brand (colours, nav, price)
  prompts.js              CORE_RULES — the non-negotiable CV-writing rules (Section 8)
  anthropic.js            Anthropic wrapper (ask / askJSON)
  extractText.js          PDF/DOCX/URL text extraction — deletes files after extract
  transcribe.js           Voice -> text (OpenAI Whisper), same as Prep Report
  gapEngine.js            Skills-gap engine — PASS ONE (detect) + PASS TWO (questions)
  sourceOfTruth.js        Builds the session's source-of-truth record (Section 9)
  cvGenerator.js          Builds the seven-stop CV as structured data
  fabricationChecker.js   HARD GATE — per-sentence + per-number trace check
  reviewer.js             AI self-review pass (voice, honesty, overstatement)
  checks.js               Programmatic checks (UK spelling, banned punctuation, headings)
  designs.js              15 style configs (ONE engine, not 15 builds)
  docxExport.js           Shared docx generation module — human + ATS from one config
  pdfExport.js            docx -> PDF via LibreOffice (PDF rides on the docx)
  htmlPreview.js          On-screen preview so candidates compare designs before paying
  payment.js              Stripe £12.50 checkout + verification
  email.js                Resend — candidate confirmation + internal notification
public/                   Landing page (index.html), the 4-step flow (app.html), css, js, thumbnails
scripts/
  renderTest.js           Render-test EVERY design (docx + PDF) with realistic data
  makeThumbs.js           Generates the design thumbnails
  fakeData.js             Realistic, internally-consistent test CV
test/checks.test.js       Unit tests for the programmatic + fabrication checks
```

### The two intelligence passes (built as separate, testable passes)

- **Skills-gap engine** (`gapEngine.js`): pass one flags every advert requirement as
  covered / thin / missing against the CV; pass two asks short, specific questions for
  the genuine gaps only, plus one prompt per standard section for raw material.
- **Fabrication checker** (`fabricationChecker.js`): a hard gate that runs on its own
  after generation. Numbers get a deterministic trace check (every figure in the CV
  must appear in the candidate's source); employers/titles/dates/qualifications/skills/
  scope get a semantic trace. Fails are **stripped, not softened**, and queued to the
  `[MISSING]` list with a clarifying question. A CV with unresolved flags **cannot be
  downloaded**.

### 15 designs, one engine

`designs.js` holds 15 style configs (font, colour, layout family, emphasis). `docxExport.js`
renders them all, and produces an **ATS-safe** version from the *same* config: single
column, standard headings (Experience / Skills / Education), no tables, no icons, no
header/footer. Branding is baked into the document itself (header for the human version;
a plain body line for ATS) so it survives forwarding.

---

## Running locally

```bash
npm install
cp .env.example .env        # fill in keys (see below)
npm start                   # http://localhost:3000
```

The app **degrades gracefully with no keys**: pages serve, the flow runs, and the
render tests / unit tests pass. Model-backed steps (gap detection, generation,
fabrication semantic check, transcription, payment) activate when their key is present.

### Render tests (do this before shipping any template change)

```bash
npm run render-test         # builds docx + PDF for all 15 designs, human + ATS
npm test                    # programmatic + fabrication unit tests
```

`render-test` writes files to `render-test-output/` and asserts: valid docx, valid
multi-page PDF, and **zero tables in every ATS render**. PDF steps need LibreOffice
(`soffice`) on the PATH.

---

## Environment variables (set each on Render, same pattern as the Prep Report)

| Var | Purpose |
|---|---|
| `PORT`, `SESSION_SECRET`, `PUBLIC_BASE_URL` | Server basics |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Gap engine, generation, fabrication self-review |
| `OPENAI_API_KEY` | Voice transcription (Whisper) |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `CV_PRICE_GBP` | The £12.50 gate |
| `RESEND_API_KEY`, `RESEND_FROM`, `NOTIFY_EMAIL` | Candidate + internal emails |

---

## Deployment (Render)

**See [`DEPLOY.md`](./DEPLOY.md) for the full step-by-step.** In short:

- Deploys as a **Docker** service (the included `Dockerfile` bakes in LibreOffice
  so PDF export works with no extra setup). `render.yaml` is a ready Blueprint.
- Set the environment variables from the table in `DEPLOY.md`.
- Point a subdomain (e.g. `cv.the-common-people.com`) at the service and set
  `PUBLIC_BASE_URL` to match.
- Add the Stripe webhook `POST {PUBLIC_BASE_URL}/webhook/stripe`.
- Data handling: uploaded files are deleted the moment text is extracted; session
  data lives only for the session. For multi-instance hosting, swap the default
  in-memory session store for a shared store (e.g. Redis).

---

## Build principles carried over from the Interview Prep Report

- One shared docx module, branding embedded in the file (survives forwarding).
- PDF rides on the docx — no separate PDF pipeline.
- One parameterised template engine, 15 configs — not 15 one-off builds.
- Every template render-tested with realistic data before shipping.
- Real, tested Stripe payment gates the deliverable; two Resend emails per transaction.
- Ship in small, versioned increments (README updated each time), deploy via GitHub → Render.
- No dark patterns: the £12.50 is stated plainly up front, nothing auto-charged.

---

## Success criteria (Section 13) — status in this build

- [x] Paste CV + advert → tailored CV in a few minutes.
- [x] No two designs produce visually identical output (15 distinct layouts; render-tested).
- [x] Section 8 checks run before download (programmatic + AI self-review).
- [x] Section 9 fabrication checker blocks download until zero unresolved unqualified claims.
- [x] Word + PDF for every design, plus ATS-safe version.
- [x] All 15 templates render-tested (docx → PDF, visually checked; ATS = zero tables).
- [x] £12.50 gated by Stripe before download; confirmation + notification via Resend.

*(Payment and email require live keys + a real Stripe account to exercise end-to-end;
the code paths, gating and webhook are in place and wired.)*
