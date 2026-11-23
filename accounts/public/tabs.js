// My account, one section at a time.
//
// A sub menu at the top (My profile, Tools, Job search, My documents,
// Settings) shows one group of cards at a time, so the page isn't one long
// scroll. Links to a card (me.html#ai, #docs-card) open the right group.
// Other scripts still show and hide their own cards with the "hidden" class;
// the menu uses "tab-off", so the two never fight.
//
// It also fills in My profile: the latest candidate profile saved from a
// recruiter, shown on the page, with a Download PDF button.
(function () {
  "use strict";
  var nav = document.getElementById("acct-tabs");
  if (!nav) return;
  var KEY = "cq-acct-tab";
  var buttons = [].slice.call(nav.querySelectorAll("button[data-tab]"));
  var cards = function () { return [].slice.call(document.querySelectorAll("main section[data-tab]")); };
  var current = null;

  // A group with nothing to show (all its cards hidden) keeps its button out of the way.
  function refresh() {
    buttons.forEach(function (b) {
      var any = cards().some(function (c) { return c.dataset.tab === b.dataset.tab && !c.classList.contains("hidden"); });
      b.classList.toggle("hidden", !any);
    });
    if (current && nav.querySelector('button[data-tab="' + current + '"].hidden')) show(first(), true);
  }
  function first() {
    var b = buttons.filter(function (x) { return !x.classList.contains("hidden"); })[0];
    return b ? b.dataset.tab : "tools";
  }
  function show(tab, quiet) {
    current = tab;
    cards().forEach(function (c) { c.classList.toggle("tab-off", c.dataset.tab !== tab); });
    buttons.forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.tab === tab ? "true" : "false"); });
    if (!quiet) { try { sessionStorage.setItem(KEY, tab); } catch (_) {} nav.scrollIntoView({ block: "nearest" }); }
  }
  buttons.forEach(function (b) { b.addEventListener("click", function () { show(b.dataset.tab); if (history.replaceState) history.replaceState(null, "", location.pathname + location.search); }); });

  // Open the group a link points at, then go to the card.
  function fromHash() {
    var id = (location.hash || "").slice(1);
    var target = id && document.getElementById(id);
    var sec = target && target.closest && target.closest("section[data-tab]");
    if (!sec) return false;
    sec.classList.remove("hidden");
    show(sec.dataset.tab, true);
    setTimeout(function () { target.scrollIntoView({ block: "start" }); }, 50);
    return true;
  }
  window.addEventListener("hashchange", fromHash);

  // Watch the cards other scripts reveal after sign-in checks finish.
  if (window.MutationObserver) {
    var mo = new MutationObserver(function () { refresh(); });
    cards().forEach(function (c) { mo.observe(c, { attributes: true, attributeFilter: ["class"] }); });
    // The job hunt cards arrive a moment later.
    setTimeout(function () { cards().forEach(function (c) { mo.observe(c, { attributes: true, attributeFilter: ["class"] }); }); refresh(); }, 600);
  }
  refresh();
  var saved = null; try { saved = sessionStorage.getItem(KEY); } catch (_) {}
  if (!fromHash()) show(saved && nav.querySelector('button[data-tab="' + saved + '"]:not(.hidden)') ? saved : first(), true);

  // ---- My profile ------------------------------------------------------------
  var card = document.getElementById("profile-card");
  var body = document.getElementById("prof-body");
  var pick = document.getElementById("prof-pick");
  var opened = false;
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function niceDate(iso) { return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }
  function render(d) {
    document.getElementById("prof-from").textContent = [d.job_title ? "For " + d.job_title : "", d.company ? "with " + d.company : "", "saved " + niceDate(d.created_at)].filter(Boolean).join(", ");
    var dl = document.getElementById("prof-dl");
    dl.href = "/api/account/documents/" + encodeURIComponent(d.id) + "/file";
    dl.setAttribute("download", d.file_name || "Profile.pdf");
    body.textContent = "";
    body.appendChild(el("p", "small", "Loading your profile…"));
    fetch("/api/account/documents/" + encodeURIComponent(d.id) + "/view", { credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        body.textContent = "";
        if (j && j.view) {
          var v = j.view;
          if (v.headline) body.appendChild(el("p", "prof-headline", v.headline));
          // The sub menu inside the profile: jump to any section.
          if (v.sections.length > 3) {
            var jump = el("div", "prof-jump");
            v.sections.forEach(function (s, i) {
              var b = el("button", null, s.heading); b.type = "button";
              b.addEventListener("click", function () { var t = document.getElementById("prof-s" + i); if (t) { t.open = true; t.scrollIntoView({ block: "start", behavior: "smooth" }); } });
              jump.appendChild(b);
            });
            body.appendChild(jump);
          }
          v.sections.forEach(function (s, i) {
            var det = el("details", "prof-sec"); det.id = "prof-s" + i;
            if (i < 2) det.open = true;
            det.appendChild(el("summary", null, s.heading));
            s.paras.forEach(function (p) { det.appendChild(el("p", null, p)); });
            if (s.items.length) { var ul = el("ul"); s.items.forEach(function (x) { ul.appendChild(el("li", null, x)); }); det.appendChild(ul); }
            body.appendChild(det);
          });
        } else {
          // Saved before profiles came with a readable copy: show the PDF itself.
          var f = el("iframe", "prof-pdf");
          f.title = "Your profile";
          f.src = "/api/account/documents/" + encodeURIComponent(d.id) + "/file?inline=1";
          body.appendChild(f);
          body.appendChild(el("p", "small", "If it doesn't show on your phone, press Download PDF."));
        }
      })
      .catch(function () { body.textContent = ""; body.appendChild(el("p", "small", "We couldn't show it just now. Press Download PDF to read it.")); });
  }
  document.addEventListener("cq:docs", function (e) {
    var profiles = (e.detail || []).filter(function (d) { return d.kind === "profile" && /pdf/.test(d.mime_type || ""); })
      .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    card.classList.toggle("hidden", !profiles.length);
    pick.textContent = "";
    pick.classList.toggle("hidden", profiles.length < 2);
    if (!profiles.length) return;
    if (profiles.length > 1) profiles.forEach(function (d, i) {
      var b = el("button", "btn btn-ghost small-btn", d.job_title || d.title || ("Profile " + (i + 1)));
      b.type = "button"; b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
      b.addEventListener("click", function () { [].forEach.call(pick.children, function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); render(d); });
      pick.appendChild(b);
    });
    render(profiles[0]);
    // First visit after saving one: open straight on it.
    if (!opened && !location.hash) { opened = true; var s = null; try { s = sessionStorage.getItem(KEY); } catch (_) {} if (!s) show("profile", true); }
    refresh();
  });
})();
