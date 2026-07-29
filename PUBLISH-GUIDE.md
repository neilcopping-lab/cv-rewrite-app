# How to publish the CV Rewrite app — a plain-English guide

Written for a non-engineer. No coding. You will mostly copy, paste, and click
buttons. Take it one part at a time; you can stop and come back.

Total time: about 60–90 minutes the first time. Set aside a quiet hour.

---

## The big picture (read this once)

Your CV Rewrite app is a small program that runs on a computer in the cloud and
answers a web address. Three free services work together:

1. **GitHub** = a locker that holds the app's files.
2. **Render** = the computer in the cloud that runs the app and gives it a web
   address. This is the bit that "hosts" it.
3. **Cloudflare** = where your domain lives. You use it to point
   `cv.the-common-people.com` at Render.

So the journey of a click is:
`visitor → cv.the-common-people.com (Cloudflare) → Render (runs the app)`,
and Render got the app from GitHub.

You will also collect a few **keys** (like passwords) from three more services
the app uses: **Anthropic** (writes the CV), **Stripe** (takes the £12.50), and
**Resend** (sends the confirmation emails).

---

## What you need before you start

- [ ] The `cv-rewrite-app` folder (unzipped from `cv-rewrite-app.zip`).
- [ ] A card for Stripe/Render (Render can start free; Stripe is free to set up).
- [ ] About an hour.
- [ ] These accounts (all free to create): GitHub, Render, Anthropic, Stripe,
      Resend. Cloudflare you already have (your domain is there).

Decide your web address now. This guide uses **`cv.the-common-people.com`**. If
you want something else (e.g. `cvrewrite.the-common-people.com`), just use that
everywhere this guide says `cv.the-common-people.com`.

---

# PART 1 — Put the app on GitHub

We'll use **GitHub Desktop**, a free app with buttons, so you never touch the
command line.

1. Go to **https://desktop.github.com** and download **GitHub Desktop**. Install
   and open it.
2. When it asks you to sign in, click **Sign in to GitHub.com**. If you don't
   have a GitHub account, click **Create your free account** first, then come
   back and sign in.
3. In GitHub Desktop, click **File → New repository** (top menu).
   - **Name:** `cv-rewrite-app`
   - **Local path:** click **Choose** and pick where the `cv-rewrite-app` folder
     already lives. Important: GitHub Desktop will want to *create* a folder. To
     avoid a folder-inside-a-folder, instead do this simpler route below.

   **Simpler route (recommended):**
   - Click **File → Add local repository**.
   - Click **Choose** and select your existing `cv-rewrite-app` folder.
   - It may say "this directory does not appear to be a Git repository" with a
     button **create a repository**. Click that button. Leave the boxes as they
     are and click **Create repository**.
4. You'll now see a long list of files on the left ("changes"). At the bottom
   left, in the **Summary** box type `First version`, then click the blue
   **Commit to main** button.
5. Top right, click **Publish repository**.
   - Untick **Keep this code private** only if you're happy for the code to be
     public. Private is fine and recommended.
   - Click **Publish repository**.

Done. Your app is now on GitHub. You can close GitHub Desktop.

---

# PART 2 — Collect your keys

You'll paste these into Render in Part 4. Open a blank note to paste them into as
you go. **Treat them like passwords.**

### 2a. Anthropic (writes the CVs)
1. Go to **https://console.anthropic.com** and sign up / log in.
2. Add a small amount of credit (Billing → add ~£10 to start).
3. Go to **API Keys → Create Key**. Name it `cv-rewrite`. Copy the key
   (starts `sk-ant-…`) into your note as **ANTHROPIC_API_KEY**.

### 2b. Stripe (takes the £12.50)
1. Go to **https://dashboard.stripe.com** and sign up / log in.
2. Leave it in **Test mode** for now (toggle, top right).
3. Go to **Developers → API keys**. Copy:
   - **Secret key** (`sk_test_…`) → note as **STRIPE_SECRET_KEY**
   - **Publishable key** (`pk_test_…`) → note as **STRIPE_PUBLISHABLE_KEY**
   (We'll get the webhook secret in Part 6.)

### 2c. Resend (sends emails)
1. Go to **https://resend.com** and sign up / log in.
2. **API Keys → Create API Key**. Copy it (`re_…`) → note as **RESEND_API_KEY**.
3. Later, verify your domain in Resend so emails come from
   `cv@the-common-people.com`. To start, you can leave the default and fix this
   after launch.

You should now have 4 keys written down. Keep the note safe.

---

# PART 3 — Deploy on Render

1. Go to **https://render.com**, click **Get Started**, and **sign up with
   GitHub** (easiest — it links the two automatically).
2. On the dashboard, click **New +** (top right) → **Blueprint**.
3. Under "Connect a repository", find **cv-rewrite-app** and click **Connect**.
   If you don't see it, click **Configure account** and give Render access to
   the repo, then come back.
4. Render reads the app's built-in setup file and shows a service called
   **common-people-cv-rewrite**. Click **Apply** (or **Create**).
5. Render now builds the app. This first build takes a few minutes (it's
   installing the PDF engine). You can watch the log scroll. Wait for
   **"Live"** or a green tick.

If it asks you to pick a plan: **Starter** (about £7/month) is recommended so the
app stays awake and responds instantly. The Free plan works but "sleeps" after
inactivity and is slow to wake — fine for testing, not ideal for paying
customers.

---

# PART 4 — Add your keys to Render

1. In Render, click your service **common-people-cv-rewrite** → **Environment**
   (left menu).
2. You'll see a list of variable names. Click each one and paste the matching
   value from your note. Fill in:
   - `ANTHROPIC_API_KEY` → your Anthropic key
   - `STRIPE_SECRET_KEY` → your `sk_test_…`
   - `STRIPE_PUBLISHABLE_KEY` → your `pk_test_…`
   - `RESEND_API_KEY` → your `re_…`
   - `NOTIFY_EMAIL` → your own email (where you want to hear about each sale)
   - `PUBLIC_BASE_URL` → for now put the Render web address (top of the page,
     ends in `.onrender.com`). We'll change it to your subdomain in Part 5.
   - Leave `STRIPE_WEBHOOK_SECRET` blank for now (Part 6).
   - The others (`ANTHROPIC_MODEL`, `CV_PRICE_GBP`, `RESEND_FROM`,
     `SESSION_SECRET`) are already filled — leave them.
3. Click **Save Changes**. Render restarts the app (about a minute).
4. Check it works: open your Render web address (the `.onrender.com` one) in a
   browser. You should see the dark, gold-accented landing page.

Quick health check: add `/health` to the end of the Render address in your
browser (e.g. `https://…onrender.com/health`). You want to see `"ok":true` and
`"libreoffice":true`.

---

# PART 5 — Connect your subdomain in Cloudflare

This makes `cv.the-common-people.com` show your app.

**First, tell Render about the domain:**
1. In Render → your service → **Settings** → scroll to **Custom Domains** →
   **Add Custom Domain**.
2. Type `cv.the-common-people.com` and click **Save**.
3. Render shows you a target address to point at, like
   `common-people-cv-rewrite.onrender.com`. Keep this tab open — you'll copy it.

**Then, add the signpost in Cloudflare:**
4. Go to **https://dash.cloudflare.com**, log in, and click your domain
   **the-common-people.com**.
5. Left menu → **DNS** → **Records** → **Add record**.
6. Fill it in:
   - **Type:** `CNAME`
   - **Name:** `cv`   (just `cv`, not the whole address)
   - **Target:** paste the Render target from step 3
     (e.g. `common-people-cv-rewrite.onrender.com`)
   - **Proxy status:** click the orange cloud so it turns **grey** ("DNS only").
     This avoids a common certificate clash and is the simplest reliable setup.
   - **Save**.
7. Go back to the Render tab. Within a few minutes (sometimes up to an hour)
   Render will show the domain as **Verified** with a padlock (it sets up HTTPS
   automatically).
8. Back in Render → **Environment**, change `PUBLIC_BASE_URL` to
   `https://cv.the-common-people.com` and **Save Changes**.

Now visit **https://cv.the-common-people.com** — your app should load.

---

# PART 6 — Tell Stripe where to confirm payments

1. In Stripe (still **Test mode**) go to **Developers → Webhooks → Add endpoint**.
2. **Endpoint URL:** `https://cv.the-common-people.com/webhook/stripe`
3. **Select events:** search and tick **`checkout.session.completed`**.
4. Click **Add endpoint**.
5. On the new endpoint's page, find **Signing secret**, click **Reveal**, and
   copy it (`whsec_…`).
6. In Render → **Environment** → paste it into `STRIPE_WEBHOOK_SECRET` → **Save
   Changes**.

---

# PART 7 — Test everything (before real money)

Visit `https://cv.the-common-people.com` and run through it as a customer:

1. Paste any CV text and any job advert text. Click through the questions.
2. Let it write the CV and pick a design.
3. At payment, use Stripe's **test card**:
   - Card number: `4242 4242 4242 4242`
   - Expiry: any future date (e.g. `12/34`)
   - CVC: any 3 digits (e.g. `123`)
   - Postcode: any (e.g. `SG4 0NR`)
4. After paying, download the **Word**, **PDF**, and **ATS-safe PDF**. Open each.
5. Check your inbox for the confirmation email and the internal "you got a sale"
   email.

If all that works, you're ready for real customers.

---

# PART 8 — Go live and link it from the main site

1. **Stripe live keys:** in Stripe, switch **Test mode → off** (live). Go to
   **Developers → API keys**, copy the **live** `sk_live_…` and `pk_live_…`,
   and paste them into the matching Render variables. Redo the webhook (Part 6)
   in live mode and update `STRIPE_WEBHOOK_SECRET`.
2. **Test once for real:** buy one yourself with a real card, then refund
   yourself in Stripe. Confirms live money works.
3. **Add the link to your main site nav**, next to Interview Prep Report:
   ```html
   <a href="https://cv.the-common-people.com">CV Rewrite</a>
   ```
   (Full details and an optional promo card are in `PASTE-THESE.md`.)

You're live. 🎉

---

# If something goes wrong

- **Landing page won't load / "Bad Gateway":** the app may still be building.
  Wait 5 minutes, refresh. Check Render → your service → **Logs** for red errors.
- **`/health` shows `anthropic:false`:** the `ANTHROPIC_API_KEY` isn't saved.
  Re-paste it in Render → Environment, Save.
- **Subdomain won't verify in Render:** double-check the Cloudflare CNAME
  **Name** is exactly `cv`, the **Target** matches Render's, and the cloud is
  **grey** (DNS only). DNS can take up to an hour.
- **PDF won't download:** open `/health` — `libreoffice` should be `true`. It's
  built into the app, so this should always be true on Render.
- **Payment page errors:** make sure `STRIPE_SECRET_KEY` and
  `PUBLIC_BASE_URL` are set, and that `PUBLIC_BASE_URL` starts with `https://`.
- **Stuck?** Copy the red error line from Render → Logs and send it to me; I'll
  tell you the fix.

---

# What it costs to run

- **Render:** free to test; ~£7/month Starter to keep it awake for customers.
- **Anthropic / Stripe / Resend:** pay per use. Stripe takes a small fee per
  sale; the others are pennies per CV. At £12.50 a CV you're comfortably ahead.
- **GitHub, Cloudflare:** free.

To update the app later: open GitHub Desktop, and any changes get a **Commit**
then **Push**; Render redeploys automatically.
