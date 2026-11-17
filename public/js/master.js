// Master CV builder. Saves to the person's Comquat account as they type.
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var cv = null;
  var saveTimer = null, saving = false, again = false, dirty = false;

  // ---- helpers -----------------------------------------------------------------
  function get(obj, path) { return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, obj); }
  function set(obj, path, val) {
    var ks = path.split("."), o = obj;
    for (var i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null || typeof o[ks[i]] !== "object") o[ks[i]] = {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = val;
  }
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") e.textContent = attrs[k];
      else if (k === "class") e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  var asLines = function (v) { return Array.isArray(v) ? v.join("\n") : (v || ""); };
  function status(text, err) { var s = $("status"); s.textContent = text; s.className = "mcv-status" + (err ? " err" : ""); }
  function say(text, ok) { var m = $("msg"); m.textContent = text || ""; m.className = "msg " + (ok ? "ok" : "err") + (text ? "" : " hidden"); }

  // ---- progress ----------------------------------------------------------------
  function showProgress(p) {
    if (!p) return;
    $("prog-text").innerHTML = "<strong>" + p.done + " of " + p.total + "</strong> done";
    $("prog-bar").style.width = Math.round((p.done / p.total) * 100) + "%";
    var still = $("still-to-add");
    if (p.missing.length) { still.textContent = "Still to add: " + p.missing.join(", ") + "."; still.classList.remove("hidden"); }
    else { still.textContent = "That's everything a strong master CV needs. Nice work."; still.classList.remove("hidden"); }
  }

  // ---- saving ------------------------------------------------------------------
  function queueSave() {
    dirty = true;
    status("Unsaved changes");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 1200);
  }
  function save() {
    if (saving) { again = true; return Promise.resolve(); }
    saving = true; dirty = false;
    status("Saving…");
    return fetch("/api/master", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cv: cv }),
    }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "Couldn't save"); return j; }); })
      .then(function (j) {
        var t = new Date(j.updatedAt);
        status("Saved " + t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
        showProgress(j.progress);
      })
      .catch(function (e) { dirty = true; status("Not saved", true); say(e.message + " We'll try again when you next type.", false); })
      .then(function () { saving = false; if (again) { again = false; save(); } });
  }
  function flush() { clearTimeout(saveTimer); return dirty || saving ? save() : Promise.resolve(); }
  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  // ---- simple fields -----------------------------------------------------------
  function bindFields() {
    document.querySelectorAll("[data-path]").forEach(function (input) {
      var path = input.getAttribute("data-path");
      var v = get(cv, path);
      input.value = path === "interests" ? asLines(v) : (v || "");
      input.addEventListener("input", function () { set(cv, path, input.value); queueSave(); });
    });
  }

  // ---- repeating lists ---------------------------------------------------------
  var LISTS = {
    experience: {
      label: function (r, i) { return r.title || r.company ? [r.title, r.company].filter(Boolean).join(", ") : "Job " + (i + 1); },
      blank: function () { return { title: "", company: "", location: "", dates: "", responsibilities: "", achievements: "" }; },
      fields: [
        ["title", "Job title", "text"], ["company", "Employer", "text"],
        ["dates", "Dates", "text", "e.g. March 2021 to now"], ["location", "Where", "text", "e.g. Hitchin"],
        ["responsibilities", "What you did", "lines", "One task per line"],
        ["achievements", "What you achieved", "lines", "One result per line, with numbers if you have them"],
      ],
    },
    skills: {
      label: function (r, i) { return r.skill || "Skill " + (i + 1); },
      blank: function () { return { skill: "", proof: "" }; },
      fields: [["skill", "Skill", "text"], ["proof", "Proof", "text", "One line that shows it"]],
    },
    education: {
      label: function (r, i) { return r.qualification || "Qualification " + (i + 1); },
      blank: function () { return { qualification: "", institution: "", dates: "", grade: "" }; },
      fields: [["qualification", "Qualification or course", "text"], ["institution", "Where", "text"], ["dates", "When", "text"], ["grade", "Grade", "text", "Optional"]],
    },
  };

  function renderList(name, focusIndex) {
    var spec = LISTS[name], box = $("list-" + name), items = cv[name];
    box.textContent = "";
    items.forEach(function (row, i) {
      var head = el("strong", { text: spec.label(row, i) });
      var tools = el("div", { class: "item-tools" }, [
        i > 0 ? el("button", { type: "button", class: "icon-btn", "aria-label": "Move up", text: "↑" }) : null,
        i < items.length - 1 ? el("button", { type: "button", class: "icon-btn", "aria-label": "Move down", text: "↓" }) : null,
        el("button", { type: "button", class: "icon-btn del", text: "Remove" }),
      ]);
      var grid = el("div", { class: "mcv-grid" });
      spec.fields.forEach(function (f) {
        var id = name + "-" + i + "-" + f[0];
        var input = f[2] === "lines" ? el("textarea", { id: id, rows: "4" }) : el("input", { type: "text", id: id });
        if (f[3]) input.setAttribute("placeholder", f[3]);
        input.value = f[2] === "lines" ? asLines(row[f[0]]) : (row[f[0]] || "");
        input.addEventListener("input", function () {
          row[f[0]] = input.value;
          if (f[0] === spec.fields[0][0] || f[0] === spec.fields[1][0]) head.textContent = spec.label(row, i);
          queueSave();
        });
        grid.appendChild(el("div", { class: f[2] === "lines" ? "full" : "" }, [el("label", { for: id, text: f[1] }), input]));
      });
      var item = el("div", { class: "item" }, [el("div", { class: "item-head" }, [head, tools]), grid]);
      tools.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () {
          if (b.classList.contains("del")) {
            if (!b.dataset.sure) {
              b.dataset.sure = "1"; b.textContent = "Remove for good?";
              setTimeout(function () { if (b.isConnected) { delete b.dataset.sure; b.textContent = "Remove"; } }, 4000);
              return;
            }
            items.splice(i, 1);
          } else {
            var j = b.textContent === "↑" ? i - 1 : i + 1;
            var tmp = items[i]; items[i] = items[j]; items[j] = tmp;
          }
          renderList(name); queueSave();
        });
      });
      box.appendChild(item);
    });
    if (focusIndex != null) { var first = box.querySelectorAll(".item")[focusIndex]; if (first) first.querySelector("input,textarea").focus(); }
  }

  document.querySelectorAll("[data-add]").forEach(function (b) {
    b.addEventListener("click", function () {
      var name = b.getAttribute("data-add");
      cv[name].push(LISTS[name].blank());
      renderList(name, cv[name].length - 1);
      queueSave();
    });
  });

  // ---- actions -----------------------------------------------------------------
  $("dl").addEventListener("click", function () {
    var btn = $("dl"); btn.disabled = true; say("");
    flush().then(function () {
      return fetch("/api/master/download", { credentials: "same-origin" });
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || "Couldn't make the Word file"); });
      var saved = r.headers.get("X-Comquat-Saved");
      var name = ((r.headers.get("Content-Disposition") || "").match(/filename="([^"]+)"/) || [])[1] || "Master_CV.docx";
      return r.blob().then(function (b) {
        var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        say(saved ? "Downloaded. A copy is saved in My documents on your account." : "Downloaded.", true);
      });
    }).catch(function (e) { say(e.message, false); })
      .then(function () { btn.disabled = false; });
  });

  $("tailor").addEventListener("click", function () {
    flush().then(function () { location.href = "/app.html?from=master"; });
  });

  $("wipe").addEventListener("click", function () {
    var b = $("wipe");
    if (!b.dataset.sure) {
      b.dataset.sure = "1"; b.textContent = "Are you sure? Click again to delete it for good.";
      setTimeout(function () { if (b.isConnected) { delete b.dataset.sure; b.textContent = "Delete my master CV"; } }, 6000);
      return;
    }
    clearTimeout(saveTimer); dirty = false;
    fetch("/api/master/delete", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then(function (r) { if (!r.ok) throw new Error("Couldn't delete it just now. Please try again."); location.href = "/master.html?deleted=1"; })
      .catch(function (e) { say(e.message, false); });
  });

  // ---- start -------------------------------------------------------------------
  function load() {
    return fetch("/api/master", { credentials: "same-origin", cache: "no-store" })
      .then(function (r) {
        if (r.status === 401) { $("loading").classList.add("hidden"); $("signed-out").classList.remove("hidden"); return null; }
        return r.json().then(function (j) { if (!r.ok) throw new Error(j.error); return j; });
      })
      .then(function (j) {
        if (!j) return;
        cv = j.cv;
        ["experience", "skills", "education"].forEach(function (n) { if (!Array.isArray(cv[n])) cv[n] = []; });
        if (!cv.experience.length) cv.experience.push(LISTS.experience.blank());
        bindFields();
        ["experience", "skills", "education"].forEach(function (n) { renderList(n); });
        showProgress(j.progress);
        status(j.saved ? "All saved" : "Not started yet");
        $("loading").classList.add("hidden");
        $("builder").classList.remove("hidden");
        if (/[?&]deleted=1/.test(location.search)) say("Your master CV has been deleted. You can start a new one below whenever you like.", true);
      })
      .catch(function () { $("loading").textContent = "We couldn't load your master CV just now. Please refresh the page."; });
  }
  load();
})();
