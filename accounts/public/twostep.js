// My account > Settings > Two-step sign-in: switch it on with an
// authenticator app, or off with a code from it.
(function () {
  "use strict";
  var box = document.getElementById("ts-box");
  if (!box) return;
  function post(url, body) {
    return fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "Something went wrong. Please try again."); return j; }); });
  }
  function h(html) { box.innerHTML = html; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function err(m) { var e = document.getElementById("ts-err"); if (e) e.textContent = m; }
  var LOST = '<p class="small">Lost your phone? Email <a href="mailto:customer.service@the-common-people.com">customer.service@the-common-people.com</a> from the address you use for Comquat, and we\'ll help you back in.</p>';

  function off() {
    h('<p class="small">Add a second step when you sign in: after your password or emailed link, a six-digit code from an authenticator app on your phone (Microsoft Authenticator, Google Authenticator or 1Password, for example). It keeps your CVs and documents safe even if someone gets hold of your password.</p>' +
      '<button class="btn btn-ghost" type="button" id="ts-start">Set up two-step sign-in</button><p class="small" id="ts-err" role="alert"></p>');
    document.getElementById("ts-start").addEventListener("click", function (e) {
      e.target.disabled = true;
      post("/api/account/mfa/enroll").then(setup).catch(function (x) { err(x.message); e.target.disabled = false; });
    });
  }
  function setup(d) {
    var qr = /^data:image\/svg\+xml/.test(d.qr || "") ? '<img src="' + esc(d.qr) + '" alt="QR code to scan with your authenticator app" width="180" height="180" style="background:#fff;padding:6px;border-radius:12px">'
      : /^<svg/.test(d.qr || "") ? '<img src="data:image/svg+xml;utf8,' + encodeURIComponent(d.qr) + '" alt="QR code to scan with your authenticator app" width="180" height="180" style="background:#fff;padding:6px;border-radius:12px">' : "";
    h('<ol class="small"><li>Open your authenticator app and add an account.</li><li>Scan this code. On your phone already? <a href="' + esc(d.uri) + '">Tap here to add it</a>, or type the key.</li><li>Type the six-digit code the app shows.</li></ol>' +
      '<div class="row" style="align-items:flex-start;gap:20px;flex-wrap:wrap">' + qr +
      '<div><p class="small" style="margin:0">Key, if you type it in:</p><p style="font:700 15px/1.5 monospace;margin:4px 0 12px;word-break:break-all">' + esc((d.secret || "").replace(/(.{4})/g, "$1 ").trim()) + '</p>' +
      '<form id="ts-form" novalidate><label>Code from the app<input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label>' +
      '<button class="btn btn-primary" type="submit">Switch it on</button></form><p class="small" id="ts-err" role="alert"></p></div></div>');
    document.getElementById("ts-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var b = e.target.querySelector("button"); b.disabled = true;
      post("/api/account/mfa/confirm", { factorId: d.factorId, code: new FormData(e.target).get("code") })
        .then(function () { on(true); }).catch(function (x) { err(x.message); b.disabled = false; });
    });
  }
  function on(justNow) {
    h('<p><strong>' + (justNow ? "Done. " : "") + 'Two-step sign-in is on.</strong> When you sign in, we\'ll ask for a code from your app after your password or emailed link.</p>' + LOST +
      '<details><summary class="small">Turn it off</summary><form id="ts-off" novalidate><label>Code from your app<input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label>' +
      '<button class="btn btn-ghost" type="submit">Turn two-step sign-in off</button></form><p class="small" id="ts-err" role="alert"></p></details>');
    document.getElementById("ts-off").addEventListener("submit", function (e) {
      e.preventDefault();
      var b = e.target.querySelector("button"); b.disabled = true;
      post("/api/account/mfa/off", { code: new FormData(e.target).get("code") })
        .then(function () { off(); }).catch(function (x) { err(x.message); b.disabled = false; });
    });
  }
  fetch("/api/account/mfa", { credentials: "same-origin", cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { if (!j) { box.parentNode.classList.add("hidden"); return; } if (j.on) on(false); else off(); })
    .catch(function () { box.parentNode.classList.add("hidden"); });
})();
