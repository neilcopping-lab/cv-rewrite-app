#!/usr/bin/env bash
# Weekly checks for Beyond the Obvious (weekly until the end of February 2027, then monthly).
# Runs from a clone of cv-rewrite-app. Needs node, python3 with playwright, and Chrome.
# Uses stand-ins for the login service and the job data, with TEST data only.
#   1. The app's automated tests (npm test), including the seven target-group tests.
#   2. Colour contrast of every piece of text on the landing page and the app,
#      on five screen sizes, with the job data both loaded and still loading.
#   3. Sign-in journeys: password, emailed link, new account, two-step, already signed in,
#      wrong password, signed out mid-way, and links to other websites being refused.
# Prints a summary and exits non-zero if anything failed.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$(cd "$HERE/../.." && pwd)"
OUT="${OUT:-/tmp/iyo-checks}"; mkdir -p "$OUT"
FAILED=0
stop() { pkill -f "$HERE/options-standin.js" 2>/dev/null; pkill -f "$HERE/signin-standin.js" 2>/dev/null; sleep 1; }
trap stop EXIT
[ -d "$APP/node_modules" ] || (cd "$APP" && npm ci --no-audit --no-fund >/dev/null)

echo "== 1. Automated tests"
(cd "$APP" && npm test >"$OUT/npm-test.txt" 2>&1); grep -E "^# (tests|pass|fail)" "$OUT/npm-test.txt"
grep -qE "^# fail 0" "$OUT/npm-test.txt" || { FAILED=1; echo "FAILED tests:"; grep -B2 -A8 "^not ok" "$OUT/npm-test.txt" | head -60; }

echo; echo "== 2. Colour contrast"
for mode in loaded loading; do
  stop
  if [ "$mode" = loading ]; then (NO_DATA=1 setsid nohup node "$HERE/options-standin.js" >"$OUT/standin-$mode.log" 2>&1 </dev/null &)
  else (setsid nohup node "$HERE/options-standin.js" >"$OUT/standin-$mode.log" 2>&1 </dev/null &); fi
  sleep 3
  for page in options.html options-app.html; do
    python3 "$HERE/contrast.py" "http://localhost:3399/$page" >"$OUT/contrast-$mode-$page.txt" 2>/dev/null
    python3 - "$OUT/contrast-$mode-$page.txt" "$mode" "$page" <<'EOF' || FAILED=1
import json, sys
s = open(sys.argv[1]).read()
try:
    d = json.loads(s[s.index("{"):])
except Exception:
    print(f"  {sys.argv[3]} (job data {sys.argv[2]}): COULD NOT RUN"); sys.exit(1)
print(f"  {sys.argv[3]} (job data {sys.argv[2]}): {d['checked']} checked, {d['failed']} failed")
seen = set()
for r in d["fails"]:
    k = (r["text"][:40], r["text_colour"], r["worst_bg"])
    if k in seen: continue
    seen.add(k)
    print(f"    FAIL {r['width']}: '{r['text'][:50]}' {r['ratio']}:1 (needs {r['need']}:1), {r['text_colour']} on {r['worst_bg']}")
sys.exit(1 if d["failed"] else 0)
EOF
  done
done

echo; echo "== 3. Sign-in journeys"
stop
(cd "$HERE" && setsid nohup node "$HERE/signin-standin.js" >"$OUT/signin.log" 2>&1 </dev/null &)
sleep 4
python3 "$HERE/signin-journeys.py" 2>/dev/null | grep -E "^(PASS|FAIL)|passed" | tee "$OUT/journeys.txt"
grep -q "^FAIL" "$OUT/journeys.txt" && FAILED=1
grep -q "passed" "$OUT/journeys.txt" || { FAILED=1; echo "  COULD NOT RUN"; }
python3 "$HERE/signin-emaillinks.py" 2>/dev/null | tee "$OUT/emaillinks.txt"
grep -q "^FAIL" "$OUT/emaillinks.txt" && FAILED=1
grep -q "passed" "$OUT/emaillinks.txt" || { FAILED=1; echo "  COULD NOT RUN"; }

echo; [ "$FAILED" = 0 ] && echo "ALL CLEAR" || echo "SOMETHING NEEDS A LOOK"
exit $FAILED
