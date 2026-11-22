// Save a profile from Comquat for Recruiters into the signed-in person's
// account. The link carries a one-time key (t). Nothing is saved until the
// person presses Save.
(function () {
  var t = new URLSearchParams(location.search).get("t") || "";
  var $ = function (id) { return document.getElementById(id); };
  var msg = function (text, bad) { var m = $("msg"); m.textContent = text; m.className = "msg" + (bad ? " err" : " ok"); };
  var show = function (id) { ["signed-out", "signed-in", "done"].forEach(function (x) { $(x).classList.toggle("hidden", x !== id); }); };
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(t)) { msg("This link isn't complete. Please use the button in your recruiter's email again.", true); return; }
  var back = "/account/save-profile.html?t=" + encodeURIComponent(t);
  $("go-signin").href = "/account/?next=" + encodeURIComponent(back);
  fetch("/api/account/me", { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (me) {
    if (!me.signedIn) return show("signed-out");
    $("who").textContent = me.email || "";
    show("signed-in");
  }).catch(function () { show("signed-out"); });
  $("save").addEventListener("click", function () {
    var b = this; b.disabled = true; b.textContent = "Saving...";
    fetch("/api/account/save-profile", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ t: t }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        if (!x.ok) throw new Error(x.d.error || "That didn't work. Please try again.");
        msg(x.d.already ? "This profile was already in your account." : "Saved to My documents.");
        show("done");
      })
      .catch(function (e) { b.disabled = false; b.textContent = "Save my profile"; msg(e.message, true); });
  });
})();
