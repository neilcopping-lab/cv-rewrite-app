"""Sign-in journeys for Beyond the Obvious, driven in a real browser against the real app.
Each test starts signed out unless it says otherwise."""
import json, urllib.request, urllib.parse
from playwright.sync_api import sync_playwright
import os
CHROME = {'executable_path': '/usr/bin/google-chrome'} if os.path.exists('/usr/bin/google-chrome') else {}

B = "http://localhost:3401"
PW = "test-password-123"
results = []

def token(email):
    return json.load(urllib.request.urlopen(f"http://localhost:3402/token?email={urllib.parse.quote(email)}"))["token"]
def last_redirect():
    return json.load(urllib.request.urlopen("http://localhost:3402/log"))["redirects"][-1]["to"]

def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))

def app_loaded(pg):
    # The real app, not bounced back to sign-in: the step bar and a first question show.
    pg.wait_for_selector(".yo-panel h2", timeout=6000)
    return pg.url.split("?")[0].endswith("/options-app.html") and "/account/" not in pg.url

def sign_in(pg, email):
    pg.wait_for_selector("#form-login")
    pg.fill('#form-login input[name="email"]', email)
    pg.fill('#form-login input[name="password"]', PW)
    pg.click('#form-login button[type="submit"]')

with sync_playwright() as p:
    br = p.chromium.launch(**CHROME, args=["--no-sandbox"])
    def fresh():
        ctx = br.new_context(viewport={"width": 390, "height": 844})
        ctx.route("**/savri.io/**", lambda r: r.abort())
        ctx.route("**/fonts.googleapis.com/**", lambda r: r.abort())
        def to_local(route):
            try:
                req = route.request
                resp = route.fetch(url=req.url.replace(B, LOCAL), max_redirects=0)
                h = {k: v for k, v in resp.headers.items()}
                if "location" in h: h["location"] = h["location"].replace(LOCAL, B)
                cookies = [x["value"] for x in resp.headers_array() if x["name"].lower() == "set-cookie"]
                h.pop("set-cookie", None)
                route.fulfill(status=resp.status, headers=h, body=resp.body())
                for c in cookies:
                    name, val = c.split(";")[0].split("=", 1)
                    route.request.frame.page.context.add_cookies([{"name": name, "value": val, "url": B}]) if val else route.request.frame.page.context.clear_cookies(name=name)
            except Exception as e:
                try: route.abort()
                except Exception: pass
        return ctx, ctx.new_page()

    def run(label, fn):
        try:
            fn()
        except Exception as e:
            pages = [pg for c in br.contexts for pg in c.pages]
            where = pages[-1].url if pages else "?"
            msg = ""
            try: msg = pages[-1].inner_text("#msg") if pages else ""
            except Exception: pass
            results.append((label, False, f"stopped at {where} msg={msg!r} err={str(e).splitlines()[0]}"))
        for c in list(br.contexts): c.close()
    def t0():
        ctx, pg = fresh()
        pg.goto(B + "/options.html"); pg.click("text=Find my options")
        pg.wait_for_url("**/account/**")
        sent_to_signin = "next=%2Foptions-app.html" in pg.url
        sign_in(pg, "plain@test.local")
        pg.wait_for_url("**/options-app.html**", timeout=6000)
        check("Landing page > Find my options > sign in with password > lands in Beyond the Obvious", sent_to_signin and app_loaded(pg), pg.url)
    run('# 1. Landing page button, signed out, sign in with password', t0)

    def t1():
        ctx, pg = fresh()
        pg.goto(B + "/account/"); sign_in(pg, "plain@test.local"); pg.wait_for_url("**/account/me.html**", timeout=6000)
        pg.goto(B + "/account/?next=" + urllib.parse.quote("/options-app.html"))
        pg.wait_for_url("**/options-app.html**", timeout=6000)
        check("Already signed in > sign-in page skips straight to Beyond the Obvious", app_loaded(pg), pg.url)
    run('# 2. Already signed in: sign-in page sends them straight on', t1)

    def t2():
        ctx, pg = fresh()
        pg.goto(B + "/account/"); sign_in(pg, "plain@test.local"); pg.wait_for_url("**/account/me.html**", timeout=6000)
        pg.goto(B + "/options.html"); pg.click("text=Find my options")
        pg.wait_for_url("**/options-app.html**", timeout=6000)
        check("Already signed in > Find my options goes straight in", app_loaded(pg), pg.url)
        ctx.close()
    run('# 3. Already signed in: landing button goes straight into the app, no sign-in page', t2)

    def t3():
        ctx, pg = fresh()
        pg.goto(B + "/options-app.html")
        pg.wait_for_url("**/account/**", timeout=6000)
        check("Signed out > opening the app sends you to sign in, remembering where you were going", "next=%2Foptions-app.html" in pg.url, pg.url)
        ctx.close()
    run('# 4. Opening the app directly while signed out', t3)

    def t4():
        ctx, pg = fresh()
        pg.goto(B + "/options-app.html"); pg.wait_for_url("**/account/**")
        pg.fill('#form-link input[name="email"]', "plain@test.local"); pg.click('#form-link button[type="submit"]')
        pg.wait_for_selector("#msg.ok", timeout=6000)
        link = last_redirect()
        good_link = urllib.parse.unquote(link).endswith("next=https://cv.the-common-people.com/options-app.html")
        q = urllib.parse.urlparse(link).query
        pg.goto(B + "/auth/confirm?" + q + "&type=magiclink&token_hash=" + token("plain@test.local"))
        pg.wait_for_url("**/options-app.html**", timeout=6000)
        check("Signed out > Email me a link > click the link > lands in Beyond the Obvious", good_link and app_loaded(pg), link)
        ctx.close()

    def t5():
        ctx, pg = fresh()
        pg.goto(B + "/options-app.html"); pg.wait_for_url("**/account/**")
        pg.click("#tab-signup")
        pg.fill('#form-signup input[name="name"]', "New Person")
        pg.fill('#form-signup input[name="email"]', "new@test.local")
        pg.fill('#form-signup input[name="password"]', PW)
        pg.check('#form-signup input[name="over16"]'); pg.check('#form-signup input[name="agree"]')
        pg.click('#form-signup button[type="submit"]')
        pg.wait_for_selector("#msg.ok", timeout=6000)
        link = last_redirect()
        good_link = urllib.parse.unquote(link).endswith("next=https://cv.the-common-people.com/options-app.html")
        q = urllib.parse.urlparse(link).query
        pg.goto(B + "/auth/confirm?" + q + "&type=signup&token_hash=" + token("new@test.local"))
        pg.wait_for_url("**/options-app.html**", timeout=6000)
        check("New account from the app > confirm email > lands in Beyond the Obvious", good_link and app_loaded(pg), link)
        ctx.close()

    def t6():
        ctx, pg = fresh()
        pg.goto(B + "/options-app.html"); pg.wait_for_url("**/account/**")
        sign_in(pg, "twostep@test.local")
        pg.wait_for_selector("#panel-mfa:not(.hidden)", timeout=6000)
        pg.fill('#form-mfa input[name="code"]', "123456"); pg.click('#form-mfa button[type="submit"]')
        pg.wait_for_url("**/options-app.html**", timeout=6000)
        check("Two-step sign-in > password then app code > lands in Beyond the Obvious", app_loaded(pg), pg.url)
        ctx.close()
    run('# 7. Two-step sign-in', t6)

    def t7():
        ctx, pg = fresh()
        pg.goto(B + "/auth/confirm?type=magiclink&token_hash=" + token("twostep@test.local") + "&next=" + urllib.parse.quote(B + "/options-app.html"))
        pg.wait_for_selector("#panel-mfa:not(.hidden)", timeout=6000)
        pg.fill('#form-mfa input[name="code"]', "123456"); pg.click('#form-mfa button[type="submit"]')
        pg.wait_for_url("**/options-app.html**", timeout=6000)
        check("Two-step with an emailed link > app code > lands in Beyond the Obvious", app_loaded(pg), pg.url)
        ctx.close()

    def t8():
        ctx, pg = fresh()
        pg.goto(B + "/options-app.html"); pg.wait_for_url("**/account/**")
        pg.fill('#form-login input[name="email"]', "plain@test.local"); pg.fill('#form-login input[name="password"]', "wrong-password")
        pg.click('#form-login button[type="submit"]'); pg.wait_for_selector("#msg.err", timeout=6000)
        first_ok = "next=%2Foptions-app.html" in pg.url
        sign_in(pg, "plain@test.local"); pg.wait_for_url("**/options-app.html**", timeout=6000)
        check("Wrong password, then right one > still lands in Beyond the Obvious", first_ok and app_loaded(pg), pg.url)
        ctx.close()
    run('# 9. Wrong password: stays on sign-in with a message, still remembers the app', t8)

    def t9():
        ctx, pg = fresh()
        pg.goto(B + "/options-app.html"); pg.wait_for_url("**/account/**"); sign_in(pg, "plain@test.local")
        pg.wait_for_url("**/options-app.html**"); app_loaded(pg)
        ctx.clear_cookies()
        pg.evaluate("fetch('/api/options/profile').then(r=>r.json()).then(d=>{ if (d.signIn) location.href=d.signIn })")
        pg.wait_for_url("**/account/**", timeout=6000)
        bounced = "next=%2Foptions-app.html" in pg.url
        sign_in(pg, "plain@test.local"); pg.wait_for_url("**/options-app.html**", timeout=6000)
        check("Signed out mid-journey > sign in again > back in Beyond the Obvious", bounced and app_loaded(pg), pg.url)
        ctx.close()
    run('# 10. Session ends mid-journey: next save bounces to sign-in and back to the app', t9)

    def t10():
        ctx, pg = fresh()
        pg.goto(B + "/account/"); sign_in(pg, "plain@test.local")
        pg.wait_for_url("**/account/me.html**", timeout=6000)
        href = pg.get_attribute('a.tool[href*="options"]', "href")
        check("Plain sign-in > My account, whose Beyond the Obvious card points to the app", href and href.endswith("/options.html"), f"{pg.url} card={href}")
        ctx.close()
    run('# 11. Signing in from the plain sign-in page (no app chosen) goes to My account', t10)

    def t11():
        ctx, pg = fresh()
        pg.goto(B + "/account/?next=" + urllib.parse.quote("https://evil.example/steal")); sign_in(pg, "plain@test.local")
        pg.wait_for_url("**/account/me.html**", timeout=6000)
        check("Sign-in link pointing at another website > safely sent to My account instead", "evil" not in pg.url, pg.url)
        ctx.close()
    run('# 12. A link that tries to send people to another website after sign-in is ignored', t11)
    try: br.close()
    except Exception: pass

w = max(len(n) for n, _, _ in results)
for n, ok, d in results:
    print(("PASS " if ok else "FAIL ") + n + ("" if ok else "   [" + d + "]"))
print(f"\n{sum(ok for _, ok, _ in results)} of {len(results)} passed")
