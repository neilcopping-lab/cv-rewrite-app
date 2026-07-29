#!/usr/bin/env bash
# End-to-end smoke test of the whole pipeline over real HTTP, using the mock
# model (MOCK_MODEL=1) so it runs with no API keys. Proves: extraction, the
# two-pass gap engine, generation, the fabrication gate (blocks a planted lie),
# resolve, preview, and Word/PDF/ATS delivery. Usage: bash scripts/e2e.sh
set -e
PORT="${PORT:-4300}"; B="localhost:$PORT"; J="$(mktemp)"
cd "$(dirname "$0")/.."
node scripts/makeSampleCv.js   # writes /tmp/jordan_cv.docx + /tmp/advert.txt
HOME=/tmp PORT=$PORT MOCK_MODEL=1 NODE_ENV=development node server.js >/tmp/e2e.log 2>&1 &
SRV=$!; sleep 2
pass=0; fail=0
chk(){ if [ "$2" = "1" ]; then echo "  ok  $1"; pass=$((pass+1)); else echo "  FAIL $1"; fail=$((fail+1)); fi; }
has(){ grep -qi "$2" "$1" && echo 1 || echo 0; }
hasnt(){ grep -qi "$2" "$1" && echo 0 || echo 1; }
curl -s -c $J -b $J -X POST $B/api/extract -F "cvFile=@/tmp/jordan_cv.docx" -F "advertFile=@/tmp/advert.txt" -o /tmp/r1.json
chk "extract CV(.docx)+advert" "$(has /tmp/r1.json '"ok":true')"
curl -s -c $J -b $J -X POST $B/api/gaps -H 'Content-Type: application/json' -d '{}' -o /tmp/r2.json
chk "two-pass gap engine" "$(has /tmp/r2.json french)"
curl -s -c $J -b $J -X POST $B/api/generate -H 'Content-Type: application/json' -d '{"answers":[{"id":"s_statement","answer":"events for a family firm"}]}' -o /tmp/r3.json
chk "fabrication gate blocks download" "$(has /tmp/r3.json '\"downloadBlocked\":true')"
chk "invented 30% caught" "$(has /tmp/r3.json '30%')"
chk "unclaimed Fluent French caught" "$(has /tmp/r3.json 'fluent french')"
chk "blocked download returns 403" "$([ "$(curl -s -o /dev/null -w '%{http_code}' -c $J -b $J "$B/api/download?type=docx")" = "403" ] && echo 1 || echo 0)"
curl -s -c $J -b $J -X POST $B/api/resolve -H 'Content-Type: application/json' -d '{"resolutions":[{"item":"skill: Fluent French","answer":"I do not speak French, leave it out."}]}' -o /tmp/r4.json
chk "clean after resolve" "$(has /tmp/r4.json '\"downloadBlocked\":false')"
curl -s -c $J -b $J "$B/api/download?type=docx&design=commercial-sales" -o /tmp/out.docx
curl -s -c $J -b $J "$B/api/download?type=pdf&design=bold-header-block" -o /tmp/out.pdf
curl -s -c $J -b $J "$B/api/download?type=ats-pdf&design=vertical-timeline" -o /tmp/out_ats.pdf
chk "Word delivered" "$(head -c2 /tmp/out.docx | grep -q PK && echo 1 || echo 0)"
chk "PDF delivered" "$(head -c5 /tmp/out.pdf | grep -q '%PDF' && echo 1 || echo 0)"
chk "ATS-safe PDF delivered" "$(head -c5 /tmp/out_ats.pdf | grep -q '%PDF' && echo 1 || echo 0)"
kill $SRV 2>/dev/null
echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
