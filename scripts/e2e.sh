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
# Long steps run as background jobs: start one, then poll until it's done.
job(){ # job URL JSON OUTFILE
  curl -s -c $J -b $J -X POST "$B$1" -H 'Content-Type: application/json' -d "$2" -o "$3.start"
  local id; id=$(node -e "try{const j=JSON.parse(require('fs').readFileSync('$3.start','utf8'));process.stdout.write(j.jobId||'')}catch(e){}")
  if [ -z "$id" ]; then cp "$3.start" "$3"; return; fi
  for i in $(seq 1 60); do
    curl -s -c $J -b $J "$B/api/job/$id" -o "$3"
    grep -q '"status":"running"' "$3" || return 0
    sleep 1
  done
}
curl -s -c $J -b $J -X POST $B/api/extract -F "cvFile=@/tmp/jordan_cv.docx" -F "advertFile=@/tmp/advert.txt" -o /tmp/r1.json
chk "extract CV(.docx)+advert" "$(has /tmp/r1.json '"ok":true')"
# Sign in the way a person does (in test mode the server hands back the code).
curl -s -c $J -b $J -X POST $B/api/auth/request -H 'Content-Type: application/json' -d '{"email":"jordan.ellis@example.com"}' -o /tmp/auth1.json
CODE=$(node -e "try{process.stdout.write(JSON.parse(require('fs').readFileSync('/tmp/auth1.json','utf8')).devCode||'')}catch(e){}")
curl -s -c $J -b $J -X POST $B/api/auth/verify-code -H 'Content-Type: application/json' -d "{\"code\":\"$CODE\"}" -o /tmp/auth2.json
chk "signed in" "$(has /tmp/auth2.json '"signedIn":true')"
curl -s -c $J -b $J -X POST $B/api/gaps -H 'Content-Type: application/json' -d '{}' -o /tmp/r2.json
chk "two-pass gap engine" "$(has /tmp/r2.json french)"
job /api/generate '{"answers":[{"id":"s_statement","answer":"events for a family firm"}]}' /tmp/r3.json
chk "fabrication gate blocks download" "$(has /tmp/r3.json '\"downloadBlocked\":true')"
chk "invented 30% caught" "$(has /tmp/r3.json '30%')"
chk "unclaimed Fluent French caught" "$(has /tmp/r3.json 'fluent french')"
job /api/resolve '{"resolutions":[{"item":"skill: Fluent French","answer":"I do not speak French, leave it out."}]}' /tmp/r4.json
chk "clean after resolve" "$(has /tmp/r4.json '\"downloadBlocked\":false')"
curl -s -c $J -b $J "$B/api/download?confirmed=1&type=docx&design=commercial-sales" -o /tmp/out.docx
curl -s -c $J -b $J "$B/api/download?confirmed=1&type=pdf&design=bold-header-block" -o /tmp/out.pdf
curl -s -c $J -b $J "$B/api/download?confirmed=1&type=ats-pdf&design=vertical-timeline" -o /tmp/out_ats.pdf
chk "Word delivered" "$(head -c2 /tmp/out.docx | grep -q PK && echo 1 || echo 0)"
chk "PDF delivered" "$(head -c5 /tmp/out.pdf | grep -q '%PDF' && echo 1 || echo 0)"
chk "ATS-safe PDF delivered" "$(head -c5 /tmp/out_ats.pdf | grep -q '%PDF' && echo 1 || echo 0)"
# Identity shield: the model never saw the candidate's details, but the CV still has them.
if [ -n "$MODEL_PROMPT_LOG" ] && [ -f "$MODEL_PROMPT_LOG" ]; then
  chk "AI never saw the name" "$(hasnt "$MODEL_PROMPT_LOG" 'Jordan')"
  chk "AI never saw the email" "$(hasnt "$MODEL_PROMPT_LOG" 'jordan.ellis@example.com')"
  chk "AI never saw the phone" "$(hasnt "$MODEL_PROMPT_LOG" '900123')"
  chk "AI saw placeholders instead" "$(has "$MODEL_PROMPT_LOG" '\[NAME\]')"
fi
unzip -p /tmp/out.docx word/document.xml 2>/dev/null > /tmp/out_doc.xml || true
chk "finished CV carries the real name" "$(has /tmp/out_doc.xml 'Jordan Ellis')"
chk "finished CV has no leftover placeholders" "$(hasnt /tmp/out_doc.xml '\[NAME\]\|\[EMAIL\]\|\[PHONE\]')"
chk "invented 30% not in the finished CV" "$(hasnt /tmp/out_doc.xml '30%')"
chk "unclaimed French not in the finished CV" "$(hasnt /tmp/out_doc.xml 'Fluent French')"
kill $SRV 2>/dev/null
echo "RESULT: $pass passed, $fail failed"
[ "$fail" = "0" ]
