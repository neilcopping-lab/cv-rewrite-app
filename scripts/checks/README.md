# Identify Your Options: weekly checks

Run from a clone of this repo: `bash scripts/checks/identify-your-options.sh`

It uses stand-ins for the login service and the job data (TEST data only, nothing live), and checks:

1. **The app's automated tests** (`npm test`), including the seven target-group fairness tests.
2. **Colour contrast** of every piece of text on the landing page and the app, at five screen sizes, with the job data loaded and still loading. WCAG AA: 4.5:1 for normal text, 3:1 for large text.
3. **Sign-in journeys**: password, emailed link, new account, two-step sign-in, already signed in, wrong password, signed out part way, and links to other websites being refused. Every journey must end inside Identify Your Options.

The sign-in stand-in uses the real 10-tries-in-15-minutes limit, so running it twice in a row in quick succession can trip it: restart the script rather than rerunning only the journeys.

A scheduled task runs this every Monday until the end of February 2027 and emails Neil the result. After that, Identify Your Options is covered by the monthly accessibility check (comquat-recruiter/scripts/a11y) and these checks move to monthly.

Started 27 November 2026.
