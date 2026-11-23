// Comquat account pages. Talks only to our own server (/api/account/...).
(function () {
  "use strict";
  var page = document.body.getAttribute("data-page");
  var msg = document.getElementById("msg");
  var params = new URLSearchParams(location.search);
  var next = params.get("next") || "";

  function say(text, ok) {
    if (!msg) return;
    msg.textContent = text || "";
    msg.className = "msg " + (ok ? "ok" : "err");
    if (text) msg.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function post(url, body) {
    return fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || "Something went wrong there. Please try again.");
        return j;
      });
    });
  }

  function busy(form, on) {
    var b = form.querySelector('button[type="submit"]');
    if (b) b.disabled = on;
  }

  function onSubmit(id, handler) {
    var form = document.getElementById(id);
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      say("");
      busy(form, true);
      new Promise(function (res) { res(handler(form, new FormData(form))); })
        .catch(function (err) { say(err.message, false); })
        .then(function () { busy(form, false); });
    });
  }

  // ---------------------------------------------------------------- sign in
  if (page === "signin") {
    var tabs = { signin: document.getElementById("tab-signin"), signup: document.getElementById("tab-signup") };
    var panels = {
      signin: document.getElementById("panel-signin"),
      signup: document.getElementById("panel-signup"),
      forgot: document.getElementById("panel-forgot"),
    };
    var show = function (which) {
      Object.keys(panels).forEach(function (k) { panels[k].classList.toggle("hidden", k !== which); });
      tabs.signin.setAttribute("aria-selected", String(which !== "signup"));
      tabs.signup.setAttribute("aria-selected", String(which === "signup"));
      document.getElementById("title").textContent = which === "signup" ? "Create your Comquat account" : "Your Comquat account";
      say("");
    };
    tabs.signin.addEventListener("click", function () { show("signin"); });
    tabs.signup.addEventListener("click", function () { show("signup"); });
    document.getElementById("show-forgot").addEventListener("click", function () { show("forgot"); });
    document.getElementById("back-signin").addEventListener("click", function () { show("signin"); });
    if (params.get("mode") === "signup") show("signup");
    if (params.get("error") === "link") say("That link has expired or has already been used. Please ask for a new one below.", false);

    // Already signed in? Go straight on.
    fetch("/api/account/me", { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.signedIn) location.replace(next || "/account/me.html");
      if (j && j.accountsOn === false) say("Accounts are being switched on. Please check back very soon.", false);
    }).catch(function () {});

    onSubmit("form-login", function (form, fd) {
      return post("/api/account/login", { email: fd.get("email"), password: fd.get("password"), next: next })
        .then(function (j) { location.assign(j.next || "/account/me.html"); });
    });
    onSubmit("form-link", function (form, fd) {
      return post("/api/account/email-link", { email: fd.get("email"), next: next })
        .then(function (j) { say(j.message, true); form.reset(); });
    });
    onSubmit("form-forgot", function (form, fd) {
      return post("/api/account/forgot", { email: fd.get("email") })
        .then(function (j) { say(j.message, true); form.reset(); });
    });
    onSubmit("form-signup", function (form, fd) {
      var subs = {};
      ["loudspeaker", "guides", "dispatches", "apprenticeships"].forEach(function (t) { subs[t] = fd.get(t) === "on"; });
      return post("/api/account/signup", {
        name: fd.get("name"), email: fd.get("email"), password: fd.get("password"),
        agree: fd.get("agree") === "on", over16: fd.get("over16") === "on", subscriptions: subs, next: next,
      }).then(function (j) {
        form.reset();
        // Swap the form for the message, so it's obvious the email has gone.
        panels.signup.classList.add("hidden");
        document.getElementById("title").textContent = "Check your email";
        say(j.message, true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  // ---------------------------------------------------------------- my account
  if (page === "me") {
    var subsForm = document.getElementById("form-subs");
    fetch("/api/account/me", { credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.signedIn) { location.replace("/account/?next=" + encodeURIComponent("/account/me.html")); return; }
        var first = (j.name || "").split(/\s+/)[0];
        document.getElementById("hello").textContent = first ? "Hello, " + first : "Your account";
        document.getElementById("email").textContent = j.email;
        document.getElementById("since").textContent = j.memberSince
          ? new Date(j.memberSince).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
        document.querySelector('#form-name input[name="name"]').value = j.name || "";
        Object.keys(j.subscriptions || {}).forEach(function (t) {
          var box = subsForm.querySelector('input[name="' + t + '"]');
          if (box) box.checked = Boolean(j.subscriptions[t]);
        });
        if (j.jobSearch && j.profileExtras) initSearch(j.jobSearch, j.profileExtras);
        var aiBox = document.querySelector('#form-ai input[value="' + (j.aiLevel || "essentials") + '"]');
        if (aiBox) aiBox.checked = true;
      })
      .catch(function () { say("We couldn't load your account just now. Please refresh the page.", false); });


    // ---- Your AI setting: Full help, Essentials only or Off
    var aiForm = document.getElementById("form-ai");
    if (aiForm) aiForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var picked = aiForm.querySelector('input[name="ai"]:checked');
      if (!picked) { say("Please choose one of the three settings.", false); return; }
      var names = { full: "Full help", essentials: "Essentials only", off: "Off" };
      post("/api/account/ai-level", { level: picked.value })
        .then(function () { say("Saved. Your AI setting is now " + names[picked.value] + ".", true); })
        .catch(function (err) { say((err && err.message) || "We couldn't save that just now. Please try again.", false); });
    });

    // ---- My job search: status, photo, the jobs I'm after, suggestions, check-in
    function initSearch(js, extras) {
      var card = document.getElementById("search-card");
      card.classList.remove("hidden");
      var roles = (extras.roles || []).slice();
      function showStatus(status, changedAt) {
        var pill = document.getElementById("search-pill");
        var paused = status === "paused";
        pill.textContent = paused ? "Paused" : "Looking";
        pill.className = "search-pill" + (paused ? " paused" : "");
        document.getElementById("search-looking").classList.toggle("hidden", paused);
        document.getElementById("search-paused").classList.toggle("hidden", !paused);
        document.getElementById("got-job-choices").classList.add("hidden");
        document.getElementById("paused-line").textContent = paused
          ? "Paused" + (changedAt ? " since " + new Date(changedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "") +
            ". Everything's kept for when you need it, and the check-ins have stopped."
          : "";
      }
      showStatus(js.status, js.changedAt);
      document.getElementById("got-job").addEventListener("click", function () {
        document.getElementById("got-job-choices").classList.remove("hidden");
      });
      function setStatus(status, btn) {
        btn.disabled = true;
        post("/api/account/search", { status: status })
          .then(function (r) { showStatus(r.status, new Date().toISOString()); say(r.message, true); })
          .catch(function (err) { say(err.message, false); })
          .then(function () { btn.disabled = false; });
      }
      document.getElementById("do-pause").addEventListener("click", function () { setStatus("paused", this); });
      document.getElementById("looking-again").addEventListener("click", function () { setStatus("looking", this); });

      // Photo: shrunk to a 600px square JPEG here, which also drops any
      // location tags the phone put in. The server checks and strips again.
      var img = document.getElementById("photo-img"), none = document.getElementById("photo-none"), del = document.getElementById("photo-del");
      function showPhoto(has) {
        img.classList.toggle("hidden", !has); none.classList.toggle("hidden", has); del.classList.toggle("hidden", !has);
        document.querySelector(".file-btn").firstChild.textContent = has ? "Change photo" : "Add a photo";
        if (has) img.src = "/api/account/photo?t=" + Date.now();
        else img.removeAttribute("src");
      }
      showPhoto(extras.hasPhoto);
      document.getElementById("photo-file").addEventListener("change", function () {
        var f = this.files && this.files[0];
        this.value = "";
        if (!f) return;
        if (f.size > 20 * 1024 * 1024) { say("That photo is too big. Please pick one under 20 MB.", false); return; }
        var url = URL.createObjectURL(f), pic = new Image();
        pic.onload = function () {
          var side = Math.min(pic.naturalWidth, pic.naturalHeight), size = Math.min(600, side);
          var c = document.createElement("canvas"); c.width = size; c.height = size;
          c.getContext("2d").drawImage(pic, (pic.naturalWidth - side) / 2, (pic.naturalHeight - side) / 2, side, side, 0, 0, size, size);
          URL.revokeObjectURL(url);
          c.toBlob(function (blob) {
            if (!blob) { say("We couldn't read that photo. Please try another.", false); return; }
            say("Saving your photo…", true);
            fetch("/api/account/photo", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "image/jpeg" }, body: blob })
              .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || "We couldn't save your photo."); return j; }); })
              .then(function (j) { showPhoto(true); say(j.message, true); })
              .catch(function (err) { say(err.message, false); });
          }, "image/jpeg", 0.85);
        };
        pic.onerror = function () { URL.revokeObjectURL(url); say("We couldn't read that photo. Please try a JPEG or PNG.", false); };
        pic.src = url;
      });
      del.addEventListener("click", function () {
        if (!del.dataset.sure) { del.dataset.sure = "1"; del.textContent = "Delete it for good?"; setTimeout(function () { if (del.isConnected) { delete del.dataset.sure; del.textContent = "Delete photo"; } }, 5000); return; }
        delete del.dataset.sure; del.textContent = "Delete photo";
        post("/api/account/photo/delete", {}).then(function (j) { showPhoto(false); say(j.message, true); }).catch(function (err) { say(err.message, false); });
      });

      // The jobs I'm after
      var chips = document.getElementById("role-chips");
      function saveRoles() {
        return post("/api/account/roles", { roles: roles }).then(function (r) { roles = r.roles; drawRoles(); });
      }
      function drawRoles() {
        chips.textContent = "";
        if (!roles.length) { var n = el("li", "none", "None yet. Add one below, or get some ideas from your CV."); chips.appendChild(n); }
        roles.forEach(function (r, i) {
          var li = el("li", null, r);
          var x = el("button", null, "×"); x.type = "button"; x.setAttribute("aria-label", "Remove " + r);
          x.addEventListener("click", function () { roles.splice(i, 1); saveRoles().catch(function (err) { say(err.message, false); }); });
          li.appendChild(x); chips.appendChild(li);
        });
        document.querySelectorAll("#role-ideas .add").forEach(function (b) { var on = roles.indexOf(b.dataset.role) > -1; b.disabled = on; b.textContent = on ? "Added" : "Add"; });
      }
      drawRoles();
      onSubmit("form-role", function () {
        var box = document.getElementById("role-new"), v = box.value.trim();
        if (!v) throw new Error("Type a job title first.");
        if (roles.length >= 8) throw new Error("That's eight already. Remove one to add another.");
        if (roles.indexOf(v) === -1) roles.push(v);
        box.value = "";
        return saveRoles();
      });
      var KIND = { now: "Fits now", sideways: "Sideways move", "step up": "Step up" };
      document.getElementById("suggest-roles").addEventListener("click", function () {
        var b = this, m = document.getElementById("suggest-msg"), list = document.getElementById("role-ideas");
        b.disabled = true; m.textContent = "Reading your CV…"; list.textContent = "";
        post("/api/master/write", { task: "roles" })
          .then(function (r) {
            m.textContent = "";
            r.roles.forEach(function (x) {
              var li = el("li"), txt = el("div");
              txt.appendChild(el("span", "kind", KIND[x.kind] || "Idea"));
              txt.appendChild(el("strong", null, x.role));
              txt.appendChild(el("p", null, x.why));
              if (x.check) txt.appendChild(el("p", "check-line", "Check first: " + x.check));
              var add = el("button", "btn btn-ghost small-btn add", "Add"); add.type = "button"; add.dataset.role = x.role;
              add.addEventListener("click", function () {
                if (roles.length >= 8) { say("That's eight already. Remove one to add another.", false); return; }
                if (roles.indexOf(x.role) === -1) roles.push(x.role);
                saveRoles().catch(function (err) { say(err.message, false); });
              });
              li.appendChild(txt); li.appendChild(add); list.appendChild(li);
            });
            document.getElementById("roles-warn").classList.remove("hidden");
            drawRoles();
          })
          .catch(function (err) { m.textContent = /build your cv|bit more/i.test(err.message) ? err.message + " " : err.message; if (/build your cv|bit more/i.test(err.message)) { var a = el("a", null, "Open the CV Builder"); a.href = "https://cv.the-common-people.com/cv-builder.html"; m.appendChild(a); } })
          .then(function () { b.disabled = false; });
      });

      // Monthly check-in (its own tick box and consent record)
      var cb = document.getElementById("checkin-box");
      cb.checked = Boolean(js.checkin);
      if (js.checkinWording) document.getElementById("checkin-wording").textContent = js.checkinWording.replace(/^Monthly check-in: /, "").replace(/^w/, "W");
      cb.addEventListener("change", function () {
        cb.disabled = true;
        post("/api/account/checkin", { on: cb.checked })
          .then(function (r) { say(r.message, true); })
          .catch(function (err) { cb.checked = !cb.checked; say(err.message, false); })
          .then(function () { cb.disabled = false; });
      });

      // Monday email (its own tick box and consent record). Hidden until the
      // database change is made.
      if (js.weekly !== null && js.weekly !== undefined) {
        var wb = document.getElementById("weekly-box");
        document.getElementById("weekly-wrap").classList.remove("hidden");
        wb.checked = Boolean(js.weekly);
        if (js.weeklyWording) document.getElementById("weekly-wording").textContent = js.weeklyWording.replace(/^Monday email: /, "").replace(/^w/, "W");
        wb.addEventListener("change", function () {
          wb.disabled = true;
          post("/api/account/weekly", { on: wb.checked })
            .then(function (r) { say(r.message, true); })
            .catch(function (err) { wb.checked = !wb.checked; say(err.message, false); })
            .then(function () { wb.disabled = false; });
        });
      }
    }

    // ---- Share Comquat: the person's own words, sent their own way.
    (function () {
      var LINK = "https://cv.the-common-people.com/account/?mode=signup";
      var ta = document.getElementById("share-text");
      if (!ta) return;
      var full = function () { return ta.value.trim() + " " + LINK; };
      function refresh() {
        document.getElementById("share-wa").href = "https://wa.me/?text=" + encodeURIComponent(full());
        document.getElementById("share-mail").href = "mailto:?subject=" + encodeURIComponent("Free CV and interview help") + "&body=" + encodeURIComponent(full());
      }
      ta.addEventListener("input", refresh); refresh();
      var nat = document.getElementById("share-native");
      if (navigator.share) {
        nat.classList.remove("hidden");
        nat.addEventListener("click", function () { navigator.share({ title: "Comquat", text: ta.value.trim(), url: LINK }).catch(function () {}); });
      }
      document.getElementById("share-copy").addEventListener("click", function () {
        var b = this;
        (navigator.clipboard ? navigator.clipboard.writeText(full()) : Promise.reject())
          .then(function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy link"; }, 2500); })
          .catch(function () { ta.select(); say("Press Ctrl+C (or long-press and Copy) to copy your message and link.", true); });
      });
    })();

    // ---- My documents
    var docsList = document.getElementById("docs-list");
    function el(tag, cls, text) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    }
    function niceDate(iso) {
      var d = new Date(iso);
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) +
        ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    }
    function showDocs(docs) {
      // My profile (tabs.js) shows saved candidate profiles on the page.
      try { document.dispatchEvent(new CustomEvent("cq:docs", { detail: docs })); } catch (_) {}
      document.getElementById("docs-loading").classList.add("hidden");
      document.getElementById("docs-empty").classList.toggle("hidden", docs.length > 0);
      docsList.textContent = "";
      // Newest first. Word and PDF copies saved in the same minute become one entry,
      // and older versions of the same document fold away under "Older versions".
      docs = docs.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      function whatOf(d) { return d.job_title && d.company ? d.job_title + " at " + d.company : (d.title || d.kind_label); }
      var saves = [], byKey = {};
      docs.forEach(function (d) {
        var key = d.kind_label + "|" + whatOf(d) + "|" + String(d.created_at).slice(0, 16);
        if (!byKey[key]) { byKey[key] = { kind: d.kind_label, what: whatOf(d), when: d.created_at, files: [] }; saves.push(byKey[key]); }
        byKey[key].files.push(d);
      });
      var titles = [], byTitle = {};
      saves.forEach(function (sv) {
        var t = sv.kind + "|" + sv.what;
        if (!byTitle[t]) { byTitle[t] = []; titles.push(t); }
        byTitle[t].push(sv);
      });
      function fmtOf(d) { return /pdf/.test(d.mime_type) ? "PDF" : /word/.test(d.mime_type) ? "Word" : "File"; }
      function row(sv, latest) {
        var li = el("li");
        var info = el("div");
        info.appendChild(el("span", "doc-kind", sv.kind + (latest ? " · Latest" : "")));
        info.appendChild(el("span", "doc-title", sv.what));
        info.appendChild(el("span", "doc-meta", "Saved " + niceDate(sv.when)));
        var actions = el("div", "doc-actions");
        sv.files.forEach(function (d) {
          var dl = el("a", "btn btn-ghost", "Download " + fmtOf(d));
          dl.href = "/api/account/documents/" + encodeURIComponent(d.id) + "/file";
          dl.setAttribute("download", d.file_name);
          actions.appendChild(dl);
        });
        // Delete sits apart from the downloads and needs two clicks, so nothing goes by accident.
        var del = el("button", "btn btn-link doc-del", "Delete");
        del.type = "button";
        del.setAttribute("aria-label", "Delete " + sv.what + ", saved " + niceDate(sv.when));
        del.addEventListener("click", function () {
          if (!del.dataset.sure) {
            del.dataset.sure = "1";
            del.textContent = "Delete for good?";
            del.classList.add("sure");
            setTimeout(function () { if (del.isConnected) { delete del.dataset.sure; del.textContent = "Delete"; del.classList.remove("sure"); } }, 5000);
            return;
          }
          del.disabled = true;
          sv.files.reduce(function (p, d) {
            return p.then(function () { return post("/api/account/documents/" + encodeURIComponent(d.id) + "/delete", {}); });
          }, Promise.resolve())
            .then(function (j) { say((j && j.message) || "Deleted.", true); loadDocs(); })
            .catch(function (err) { say(err.message, false); del.disabled = false; });
        });
        actions.appendChild(del);
        li.appendChild(info);
        li.appendChild(actions);
        return li;
      }
      titles.forEach(function (t) {
        var list = byTitle[t];
        docsList.appendChild(row(list[0], list.length > 1));
        if (list.length > 1) {
          var li = el("li", "doc-older");
          var det = document.createElement("details");
          var sum = document.createElement("summary");
          sum.textContent = "Older versions (" + (list.length - 1) + ")";
          det.appendChild(sum);
          var ul = el("ul", "docs");
          list.slice(1).forEach(function (sv) { ul.appendChild(row(sv, false)); });
          det.appendChild(ul);
          li.appendChild(det);
          docsList.appendChild(li);
        }
      });
    }
    function loadDocs() {
      fetch("/api/account/documents", { credentials: "same-origin", cache: "no-store" })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (j.documents) showDocs(j.documents); else throw new Error(j.error); })
        .catch(function () {
          document.getElementById("docs-loading").textContent = "We couldn't load your documents just now. Please refresh the page.";
        });
    }
    loadDocs();

    onSubmit("form-name", function (form, fd) {
      return post("/api/account/profile", { name: fd.get("name") }).then(function (j) {
        var first = (j.name || "").split(/\s+/)[0];
        document.getElementById("hello").textContent = first ? "Hello, " + first : "Your account";
        say("Name saved.", true);
      });
    });
    onSubmit("form-subs", function (form, fd) {
      var body = {};
      ["loudspeaker", "guides", "dispatches", "apprenticeships"].forEach(function (t) { body[t] = fd.get(t) === "on"; });
      return post("/api/account/subscriptions", body).then(function () { say("Your choices are saved.", true); });
    });
    onSubmit("form-password", function (form, fd) {
      return post("/api/account/password", { password: fd.get("password") }).then(function (j) { form.reset(); say(j.message, true); });
    });
    document.getElementById("show-delete").addEventListener("click", function () {
      document.getElementById("form-delete").classList.remove("hidden");
      document.querySelector('#form-delete input[name="confirm"]').focus();
    });
    onSubmit("form-delete", function (form, fd) {
      return post("/api/account/delete", { confirm: fd.get("confirm") }).then(function (j) {
        document.querySelector("main").innerHTML =
          '<h1>Account deleted</h1><p class="lede"></p><p><a class="btn btn-primary" href="https://the-common-people.com/">Back to The Com\'mon People</a></p>';
        document.querySelector("main .lede").textContent = j.message;
      });
    });
    document.getElementById("signout").addEventListener("click", function () {
      post("/api/account/logout").then(function () { location.assign("/account/"); });
    });
  }

  // ---------------------------------------------------------------- new password
  if (page === "reset") {
    onSubmit("form-reset", function (form, fd) {
      if (fd.get("password") !== fd.get("password2")) throw new Error("Those two passwords don't match. Please try again.");
      return post("/api/account/password", { password: fd.get("password") }).then(function () {
        say("Password saved. Taking you to your account…", true);
        setTimeout(function () { location.assign("/account/me.html"); }, 1200);
      });
    });
  }
})();
