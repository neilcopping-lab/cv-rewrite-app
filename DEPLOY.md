# Deploy — The Com'mon People CV Rewrite

Drop-in deploy to Render as a Docker service on a subdomain (e.g.
`cv.the-common-people.com`). Same hosting family as the Interview Prep Report.
LibreOffice is baked into the image so PDF export works out of the box.

Work top to bottom. Tick each box.

---

## 0. Accounts you'll need

- [ ] **GitHub** — to hold the repo Render deploys from.
- [ ] **Render** — the host (render.com).
- [ ] **Anthropic** — `ANTHROPIC_API_KEY` (the CV rewrite engine).
- [ ] **Stripe** — the £5.00 payment (start in **test mode**).
- [ ] **Resend** — confirmation + internal emails.
- [ ] **OpenAI** — optional, only for voice-answer transcription.
- [ ] Access to **the-common-people.com DNS** to add the subdomain.

---

## 1. Push to GitHub

From the unzipped `cv-rewrite-app` folder:

```bash
git init
git add .
git commit -m "CV Rewrite app v1"
git branch -M main
git remote add origin https://github.com/<you>/cv-rewrite-app.git
git push -u origin main
```

`.gitignore` already excludes `node_modules`, `.env`, `tmp`, and test output.

---

## 2. Create the Render service

**Option A — Blueprint (uses `render.yaml`, recommended):**
1. Render Dashboard → **New** → **Blueprint**.
2. Connect the GitHub repo. Render reads `render.yaml` and proposes the service
   `common-people-cv-rewrite` (Docker runtime).
3. Click **Apply**. It builds the Dockerfile (installs LibreOffice, `npm install`).

**Option B — Manual:**
1. **New** → **Web Service** → connect the repo.
2. Runtime **Docker**. Render auto-detects the `Dockerfile`. Health check path
   `/health`. Create.

First build takes a few minutes (LibreOffice install). When live, visit the
Render URL and check `/health` returns `"ok": true` with `"libreoffice": true`.

---

## 3. Environment variables

Set these in **Render → the service → Environment** (Blueprint pre-creates the
keys marked *sync:false* as blanks — fill them in). Never commit real keys.

| Variable | Value / notes |
|---|---|
| `PUBLIC_BASE_URL` | Final URL, e.g. `https://cv.the-common-people.com` (used in Stripe redirects) |
| `SESSION_SECRET` | Long random string (Blueprint auto-generates) |
| `ANTHROPIC_API_KEY` | Your Anthropic key |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` (default is fine) |
| `STRIPE_SECRET_KEY` | `sk_test_…` first, then `sk_live_…` |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_…` / `pk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | From step 5 |
| `DB_PATH` | `/data/app.json` — where accounts + credit balances live (on the disk). The Blueprint sets this and the disk automatically. |
| `RESEND_API_KEY` | Your Resend key — **required** now, because sign-in links are emailed |
| `RESEND_FROM` | `The Com'mon People <cv@the-common-people.com>` (verify the domain in Resend) |
| `NOTIFY_EMAIL` | Where internal purchase notices go (e.g. your inbox) |
| `OPENAI_API_KEY` | Optional — enables voice-answer transcription |

Save → Render redeploys automatically.

---

## 4. Subdomain + DNS

1. Render → service → **Settings → Custom Domains** → add
   `cv.the-common-people.com`.
2. Render shows a target host. In the-common-people.com DNS, add a **CNAME**:
   `cv` → the Render target (e.g. `common-people-cv-rewrite.onrender.com`).
3. Wait for DNS + Render's automatic TLS certificate to go green.
4. Set `PUBLIC_BASE_URL` to `https://cv.the-common-people.com` and redeploy.

Link it from the main site's nav the same way the Interview Prep Report is
linked, so it reads as a sibling product.

---

## 5. Stripe webhook

1. Stripe Dashboard (test mode) → **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://cv.the-common-people.com/webhook/stripe`.
3. Event to send: `checkout.session.completed`.
4. Copy the **Signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`, redeploy.

Payment is also re-verified server-side at download time, so the webhook is a
belt-and-braces confirmation, not the only check.

---

## 6. Smoke test (do this before going live)

- [ ] `/health` → `ok:true`, `libreoffice:true`, `anthropic:true`, `stripe:true`, `resend:true`.
- [ ] Landing page renders with the brand (dark navy, gold, Anton/Oswald/Arvo, sticker logo).
- [ ] Run the full flow: paste a CV + advert → questions → generate → resolve/skip flags → pick a design.
- [ ] **Sign in:** on the design step, enter your email, click the sign-in link in your inbox, come back — the top bar should show your email and "0 CV credits".
- [ ] **Buy a pack** with the **Stripe test card** `4242 4242 4242 4242` (any future expiry/CVC). After returning, the bar should show your new credit balance (4 or 10).
- [ ] **Download** Word, PDF and ATS-safe of the same CV → your balance drops by exactly **one** (all three formats share one credit).
- [ ] **Regenerate**, then download → balance drops by another one.
- [ ] When credits hit 0, downloading a new CV should prompt you to buy another pack.
- [ ] Confirm you received the confirmation email and the internal notification (Resend).
- [ ] Deliberately give a CV with no metric and confirm the fabrication gate blocks
      download until the flagged items are resolved or left out.

**Accounts + credits notes:**
- Accounts are **passwordless** — people sign in with a link emailed to them, so
  `RESEND_API_KEY` must be set for sign-in to work.
- Balances are stored in a small JSON file on the Render **disk** (`/data`), so they
  survive redeploys. Keep the service on a single instance (the default).
- Credits are granted by the Stripe **webhook**; the app also re-checks on return
  from Stripe, so a delayed webhook won't lose a purchase.

When all green, switch Stripe to **live** keys and repeat the payment test with a
real card (refund yourself).

---

## 7. Good to know

- **PDF export** relies on LibreOffice, installed in the image — no extra setup.
- **Data policy:** uploaded files are deleted the moment their text is extracted.
- **Sessions:** the app uses an in-memory session store, fine for a single
  Render instance. If you scale to multiple instances, add a shared store
  (e.g. Redis) — one small change in `server.js`.
- **Regeneration:** candidates can regenerate and re-download within their
  session, same as the Interview Prep Report.
- **Costs:** Render service + per-use Anthropic/Stripe/Resend. No other spend.
- **Redeploy:** push to `main`; Render auto-deploys. Roll back from the Render
  **Events** tab.

---

## 8. Local check before you push (optional)

```bash
npm install
npm test          # unit tests (fabrication + checks)
npm run test:e2e  # full pipeline over HTTP with a mock model, no keys needed
npm run render-test   # renders all 15 designs to docx + PDF
```
