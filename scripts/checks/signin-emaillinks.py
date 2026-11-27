"""Emailed-link journeys, checked against the real server set up as it is live
(ACCOUNT_BASE_URL https://cv.the-common-people.com). Follows each step by hand."""
import json, urllib.request, urllib.parse, http.cookiejar
L = "http://localhost:3401"; LIVE = "https://cv.the-common-people.com"
class NoRedir(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
def session():
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(NoRedir, urllib.request.HTTPCookieProcessor(jar))
def call(op, path, body=None):
    req = urllib.request.Request(L + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json"} if body is not None else {})
    try: r = op.open(req); return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e: return e.code, dict(e.headers), e.read()
tok = lambda e: json.load(urllib.request.urlopen("http://localhost:3402/token?email=" + urllib.parse.quote(e)))["token"]
last = lambda: json.load(urllib.request.urlopen("http://localhost:3402/log"))["redirects"][-1]["to"]
res = []
def check(n, ok, d=""): res.append((n, ok, d))
WANT = LIVE + "/options-app.html"

for kind, email, ep, body in [
    ("Email me a link", "plain@test.local", "/api/account/email-link", {"email": "plain@test.local", "next": "/options-app.html"}),
    ("New account", "new2@test.local", "/api/account/signup", {"name": "New", "email": "new2@test.local", "password": "test-password-123", "agree": True, "over16": True, "next": "/options-app.html"}),
]:
    op = session()
    s, h, b = call(op, ep, body)
    link = last()
    in_email = urllib.parse.parse_qs(urllib.parse.urlparse(link).query).get("next", [""])[0]
    q = urllib.parse.urlparse(link).query + "&type=" + ("signup" if kind == "New account" else "magiclink") + "&token_hash=" + tok(email)
    s2, h2, _ = call(op, "/auth/confirm?" + q)
    s3, _, b3 = call(op, "/api/options/cards")
    signed = json.loads(b3).get("signedIn")
    check(f"{kind}: link in the email points back to the app", link.startswith(LIVE + "/auth/confirm") and in_email == WANT, link)
    check(f"{kind}: clicking it signs you in and sends you to the app", s2 == 302 and h2.get("Location") == WANT and signed, f"{s2} {h2.get('Location')} signedIn={signed}")

# Two-step person using an emailed link
op = session()
s, h, _ = call(op, "/auth/confirm?type=magiclink&token_hash=" + tok("twostep@test.local") + "&next=" + urllib.parse.quote(WANT))
loc = h.get("Location", "")
asks_code = loc.startswith("/account/?mfa=1&next=") and urllib.parse.unquote(loc.split("next=")[1]) == WANT
s2, _, b2 = call(op, "/api/options/cards"); locked = json.loads(b2).get("signedIn") is False
s3, _, b3 = call(op, "/api/account/mfa/verify", {"code": "123456", "next": urllib.parse.unquote(loc.split("next=")[1])})
nxt = json.loads(b3).get("next")
s4, _, b4 = call(op, "/api/options/cards")
check("Two-step + emailed link: asks for the app code first, app stays locked until then", asks_code and locked, loc)
check("Two-step + emailed link: after the code, sent to the app and signed in", nxt == WANT and json.loads(b4).get("signedIn"), f"next={nxt}")

# Someone else's website in the link is refused
op = session()
s, h, _ = call(op, "/auth/confirm?type=magiclink&token_hash=" + tok("plain@test.local") + "&next=" + urllib.parse.quote("https://evil.example/x"))
check("Emailed link pointing at another website: sent to My account instead", h.get("Location") == "/account/me.html", h.get("Location"))

for n, ok, d in res: print(("PASS " if ok else "FAIL ") + n + ("" if ok else "   [" + str(d) + "]"))
print(f"\n{sum(o for _, o, _ in res)} of {len(res)} passed")
