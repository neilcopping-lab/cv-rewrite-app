# Paste-these — GitHub + nav link

Everything you need to copy-paste for the deploy. Replace `<you>` with your
GitHub username and `cv.the-common-people.com` with your final subdomain if
different.

---

## 1. Git commands (push the repo)

Run these from inside the unzipped `cv-rewrite-app` folder:

```bash
cd cv-rewrite-app
git init
git add .
git commit -m "CV Rewrite app v1 — tailored CV rewriter, 15 designs, fabrication gate"
git branch -M main
git remote add origin https://github.com/<you>/cv-rewrite-app.git
git push -u origin main
```

Create the empty GitHub repo first (github.com → New repository → name it
`cv-rewrite-app`, leave it empty, don't add a README), then run the above.

Later updates:

```bash
git add .
git commit -m "describe the change"
git push
```

Render auto-deploys on every push to `main`.

---

## 2. GitHub repo details (paste into the New-repository form)

**Repository name**
```
cv-rewrite-app
```

**Description** (the one-line field)
```
The Com'mon People CV Rewrite — paste a CV and a job advert, get back a tailored CV as Word + PDF in 15 designs. Honesty-checked, no invented claims. £12.50, one-off.
```

**Topics** (optional, the tags field)
```
recruitment  cv  express  nodejs  docx  pdf  stripe  the-common-people
```

Keep the repo **private** if you'd rather not show the source publicly — Render
deploys fine from a private repo.

---

## 3. Nav link for the main site

Add a `CV Rewrite` link to the main site's top nav, next to `Interview Prep
Report`. Matches the existing nav pattern (plain anchor, Oswald uppercase styling
is inherited from your nav CSS):

```html
<a href="https://cv.the-common-people.com">CV Rewrite</a>
```

Place it right after the Interview Prep Report link in the nav on every page,
e.g.:

```html
<a href="https://the-common-people.com/prep-report.html">Interview Prep Report</a>
<a href="https://cv.the-common-people.com">CV Rewrite</a>
```

On the CV Rewrite page itself, the app already marks its own nav item active
(gold) via `class="active"`.

---

## 4. Optional — a promo card for the resources / prep-report page

If you want to cross-sell it the way the Interview Prep Report is promoted, drop
this block in (restyle to match your section wrappers):

```html
<section class="promo">
  <p class="eyebrow">New — CV Rewrite</p>
  <h2>A CV that fits the job. Not a template with your name in it.</h2>
  <p>Paste your CV and the advert. We spot the gaps, rewrite it in your own
     words, and check every claim traces back to something you actually did.
     Word and PDF, 15 designs, ATS-safe version on request.</p>
  <p><a class="btn" href="https://cv.the-common-people.com">Rewrite my CV — £12.50</a></p>
</section>
```

No dark patterns: the price is stated up front, nothing auto-charges, and the
link is a plain click-through, consistent with the rest of the site.
```
