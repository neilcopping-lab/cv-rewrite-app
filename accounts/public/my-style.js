// "My writing style" on the account page.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  if (!$("my-style")) return;
  var MIN = 40;
  var words = function (s) { return String(s || "").trim().split(/\s+/).filter(Boolean).length; };
  var msg = function (t, ok) { var m = $("ms-msg"); m.textContent = t || ""; m.style.color = ok === false ? "#A12A1C" : ""; };
  var boxes = ["ms-1", "ms-2", "ms-3"].map($);

  function count() {
    var n = boxes.map(function (b) { return words(b.value); });
    var ready = n.filter(function (x) { return x >= MIN; }).length;
    $("ms-count").textContent = ready + " of 3 pieces ready (" + n.join(", ") + " words; each needs at least " + MIN + ").";
    $("ms-learn").disabled = ready < 3;
  }
  boxes.forEach(function (b) { b.addEventListener("input", count); });

  function show(style, linkOn) {
    $("ms-current").classList.toggle("hidden", !style);
    $("ms-form").classList.toggle("hidden", !!style);
    if (style) {
      $("ms-profile").textContent = style.profile;
      var from = style.source && style.source !== "comquat-job-seekers" ? " (from your " + (style.source === "comquat-for-recruiters" ? "Comquat for Recruiters" : style.source === "opportunity-engine" ? "Opportunity Engine" : "other Comquat") + " account)" : "";
      $("ms-when").textContent = style.learnedAt ? "learned " + new Date(style.learnedAt).toLocaleDateString("en-GB") + from : from;
    }
    $("ms-import").classList.toggle("hidden", !linkOn);
  }

  function load() {
    fetch("/api/my-style", { credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j.signedIn) show(j.style, j.linkOn); })
      .catch(function () {});
  }

  function call(method, url, body) {
    return fetch(url, { method: method, credentials: "same-origin", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "Something went wrong."); return j; }); });
  }

  $("ms-form").addEventListener("submit", function (e) {
    e.preventDefault();
    $("ms-learn").disabled = true;
    msg("Reading your writing…");
    call("POST", "/api/my-style/learn", { samples: boxes.map(function (b) { return b.value; }) })
      .then(function (j) { boxes.forEach(function (b) { b.value = ""; }); show(j.style, true); msg("Learned. Pick My writing style in CV Rewrite or the CV Builder to use it.", true); })
      .catch(function (err) { msg(err.message, false); count(); });
  });
  $("ms-redo").addEventListener("click", function () { $("ms-form").classList.remove("hidden"); count(); boxes[0].focus(); });
  $("ms-del").addEventListener("click", function () {
    if (!window.confirm("Delete your writing style from this account?")) return;
    call("DELETE", "/api/my-style").then(function () { show(null, true); msg("Deleted.", true); count(); }).catch(function (err) { msg(err.message, false); });
  });
  $("ms-import").addEventListener("click", function () {
    msg("Looking…");
    call("POST", "/api/my-style/import").then(function (j) {
      if (!j.found) return msg("We couldn't find a writing style in your other Comquat apps for this email.", false);
      show(j.style, true);
      msg(j.kept ? "The style saved here is already the newest." : "Done. Your writing style is now set here too.", true);
    }).catch(function (err) { msg(err.message, false); });
  });
  count();
  load();
})();
