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
        ["reasonForLeaving", "Reason for leaving", "text", "e.g. Went back to college, or Still here"],
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

  // ---- personal statement: guided questions -------------------------------------
  // Built on The Com'mon People CV guide ("be a person, not a press release")
  // and CV Rewrite's own statement question. Each answer starts with a sentence
  // starter, so the person finishes the sentence in their own words. Nothing is
  // written by AI.
  var QUESTIONS = [
    { id: "story", title: "Your story so far: how did you get here?",
      think: "Where are you right now, and what led you here? A first CV is a story that's just starting, and that's a strength.",
      ideas: ["Finishing school, college, an apprenticeship or a course", "Coming back after time caring for children or family", "Changing direction, and why", "A Saturday job, a family business or a hobby that got you hooked", "A teacher, relative or moment that made you want to do this"],
      starters: ["Right now I'm", "I got into this through", "It all started when", "After"],
      example: "Right now I'm finishing my Level 3 in hospitality, and I got hooked on the industry washing pots on Saturdays at my local pub." },
    { id: "proud", title: "What are you proud of?",
      think: "Something you did, made, fixed, organised, learned or stuck at. It doesn't need to be from a job.",
      ideas: ["Exams or a course you got through, especially if it was hard", "Looking after someone, or keeping going through a tough time", "A team, club or event you helped run", "Raising money, volunteering, helping someone out", "Teaching yourself something: a skill, a language, a game, an instrument"],
      starters: ["I'm proud that I", "The thing I'm proudest of is", "People can count on me to"],
      example: "I'm proud that I kept my grades up while helping look after my nan." },
    { id: "care", title: "What matters to you?",
      think: "Your values. How you treat people, what you'd stand up for, what annoys you when it's done badly.",
      ideas: ["Doing a job properly, even when nobody's checking", "Being kind to customers, or to the new person", "Honesty, fairness, turning up when you say you will", "Making someone's day a bit better", "Getting things right first time"],
      starters: ["I care about", "What matters most to me is", "I believe"],
      example: "I care about doing things properly, even when nobody's checking." },
    { id: "best", title: "Where do you do your best work?",
      think: "The kind of place and people that bring out your best, and how you like to be managed.",
      ideas: ["Busy and buzzing, or calm and steady", "In a team, or getting on with it on your own", "Clear instructions, or freedom to work it out", "A manager who explains why, trusts you, or checks in often", "Indoors, outdoors, on your feet, with people, with things"],
      starters: ["I do my best work", "I work best with a manager who", "I'm happiest when"],
      example: "I do my best work in a busy team where everyone mucks in, with a manager who tells it straight." },
    { id: "next", title: "What do you want next, and why?",
      think: "The kind of job you're after, what you want to learn, or where you'd like to be in a couple of years. \"I'm not sure yet\" is fine: say what you'd like to try.",
      ideas: ["Your first job in a particular kind of place", "An apprenticeship so you can earn and learn", "A step up: more responsibility, a supervisor role, a qualification", "Getting back to work in hours that fit around family", "Trying something new and finding out what you're good at"],
      starters: ["Next, I want to", "I'm looking for my first job in", "I'd love to learn"],
      example: "I'm looking for my first job in a kitchen where I can learn from good chefs." },
    { id: "real", title: "The real you: what does your life revolve around?",
      think: "One real, specific thing. It makes you memorable, and it's often what an interviewer asks about first.",
      ideas: ["Your dog, your allotment, your football team", "Gaming, music, making videos, drawing", "Family, cooking Sunday dinner, looking after your little brother", "A sport you play or coach", "A cause you volunteer for"],
      starters: ["Outside work,", "Most weekends you'll find me", "My life revolves around"],
      example: "Most weekends you'll find me on the touchline coaching my brother's under-9s." },
  ];
  var BANNED = [];

  function renderQuestions() {
    var box = $("qs");
    box.textContent = "";
    if (!cv.statementAnswers || typeof cv.statementAnswers !== "object") cv.statementAnswers = {};
    QUESTIONS.forEach(function (q, i) {
      var id = "q-" + q.id;
      var ta = el("textarea", { id: id, rows: "2" });
      ta.value = cv.statementAnswers[q.id] || "";
      ta.addEventListener("input", function () { cv.statementAnswers[q.id] = ta.value; queueSave(); });
      var chips = el("div", { class: "chips" });
      q.starters.forEach(function (st) {
        var c = el("button", { type: "button", class: "chip", text: st + "…" });
        c.addEventListener("click", function () {
          var cur = ta.value.trim();
          ta.value = (cur ? cur.replace(/[.!?]?$/, ".") + " " : "") + st + " ";
          cv.statementAnswers[q.id] = ta.value; queueSave();
          ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
        });
        chips.appendChild(c);
      });
      var ideas = el("ul", { class: "ideas-list" });
      q.ideas.forEach(function (t) { ideas.appendChild(el("li", { text: t })); });
      box.appendChild(el("div", { class: "q" }, [
        el("h4", { text: (i + 1) + ". " + q.title }),
        el("p", { class: "think", text: q.think + " Ideas:" }),
        ideas,
        el("p", { class: "small", text: "Start with one of these, then finish the sentence in your own words:" }),
        chips,
        el("label", { for: id, class: "sr-only", text: q.title }),
        ta,
        el("p", { class: "eg-line", text: "For example: \"" + q.example + "\"" }),
      ]));
    });
  }

  function tidySentence(t) {
    t = String(t || "").replace(/\s+/g, " ").replace(/[…]+$|\.\.\.$/, "").trim();
    if (!t) return "";
    // A starter on its own, with nothing added, isn't a sentence yet.
    var bare = QUESTIONS.some(function (q) { return q.starters.some(function (st) { return t.replace(/[,.\s]+$/, "") === st.replace(/[,.\s]+$/, ""); }); });
    if (bare) return "";
    t = t.charAt(0).toUpperCase() + t.slice(1);
    if (!/[.!?]$/.test(t)) t += ".";
    return t;
  }

  $("build").addEventListener("click", function () {
    var parts = QUESTIONS.map(function (q) { return tidySentence(cv.statementAnswers && cv.statementAnswers[q.id]); }).filter(Boolean);
    var msg = $("build-msg"), box = $("f-profile"), b = $("build");
    if (!parts.length) { msg.textContent = "Answer at least one question first."; return; }
    var text = parts.join(" ");
    if (box.value.trim() && box.value.trim() !== text && !b.dataset.sure) {
      b.dataset.sure = "1"; b.textContent = "Replace my statement?";
      msg.textContent = "This will replace what's in the box below.";
      setTimeout(function () { if (b.isConnected) { delete b.dataset.sure; b.textContent = "Build my statement"; msg.textContent = ""; } }, 6000);
      return;
    }
    delete b.dataset.sure; b.textContent = "Build my statement";
    box.value = text; cv.personalStatement = text; queueSave(); checkStatement();
    msg.textContent = parts.length < 3 ? "Done. Answer one or two more questions for a fuller statement." : "Done. Read it out loud, and change anything that doesn't sound like you.";
  });

  function checkStatement() {
    var t = ($("f-profile").value || "").trim(), out = $("stmt-check");
    if (!t) { out.textContent = ""; out.className = "stmt-check"; return; }
    var words = t.split(/\s+/).length, sentences = t.split(/[.!?]+/).filter(function (x) { return x.trim(); }).length;
    var lower = t.toLowerCase();
    var found = BANNED.filter(function (p) { return lower.indexOf(p) !== -1; }).slice(0, 3);
    if (found.length) {
      out.className = "stmt-check warn";
      out.textContent = "Sounds a bit like a press release: \"" + found.join("\", \"") + "\". Say what you actually do or did instead.";
    } else if (sentences > 5 || words > 120) {
      out.className = "stmt-check warn";
      out.textContent = words + " words, " + sentences + " sentences. That's on the long side: three to five short sentences is plenty.";
    } else if (words < 20) {
      out.className = "stmt-check";
      out.textContent = words + " words. A little more would help: answer another question above.";
    } else {
      out.className = "stmt-check ok";
      out.textContent = words + " words, " + sentences + " sentences. Sounds like a real person. Read it out loud to be sure.";
    }
  }
  $("f-profile").addEventListener("input", checkStatement);

  // ---- interests: ideas to tap ---------------------------------------------------
  var INTEREST_IDEAS = ["Coaching a kids' sports team", "Volunteering at a food bank", "Playing football on Sundays", "Gaming with friends online", "Cooking for family and friends", "Running, the gym or swimming", "Playing or making music", "Going to gigs and festivals", "Looking after my dog", "Fixing or making things", "Reading crime novels", "Drawing, painting or photography", "Growing veg on the allotment", "Fundraising for a local charity", "Making videos or content", "Learning a language"];
  function renderInterestIdeas() {
    var box = $("interest-ideas"), ta = $("f-interests");
    INTEREST_IDEAS.forEach(function (t) {
      var c = el("button", { type: "button", class: "chip", text: "+ " + t });
      c.addEventListener("click", function () {
        var lines = ta.value.split("\n").filter(function (l) { return l.trim(); });
        if (lines.indexOf(t) === -1) lines.push(t);
        ta.value = lines.join("\n"); set(cv, "interests", ta.value); queueSave();
        ta.focus();
      });
      box.appendChild(c);
    });
  }

  // ---- designs and download ------------------------------------------------------
  var DESIGNS = { word: [], designer: [] }, kind = "word", designId = "modern-minimal";
  function renderDesigns() {
    var grid = $("design-grid");
    grid.textContent = "";
    DESIGNS[kind].forEach(function (d) {
      var img = el("img", { src: "/img/thumbs/" + d.id + ".png", alt: "", loading: "lazy" });
      var c = el("button", { type: "button", class: "dcard" + (d.id === designId ? " sel" : ""), title: d.description || d.name }, [img, el("span", { text: d.name })]);
      c.addEventListener("click", function () { designId = d.id; renderDesigns(); });
      grid.appendChild(c);
    });
    var cur = DESIGNS.word.concat(DESIGNS.designer).filter(function (d) { return d.id === designId; })[0];
    $("design-picked").textContent = cur ? "Picked: " + cur.name + (cur.description ? ". " + cur.description : "") : "";
    document.querySelector('[data-type="docx"]').style.display = kind === "designer" ? "none" : "";
    document.querySelector('[data-type="pdf"]').className = "btn " + (kind === "designer" ? "btn-primary" : "btn-ghost");
  }
  document.querySelectorAll(".kind").forEach(function (b) {
    b.addEventListener("click", function () {
      kind = b.getAttribute("data-kind");
      document.querySelectorAll(".kind").forEach(function (x) { x.classList.toggle("on", x === b); });
      designId = (DESIGNS[kind][0] || {}).id;
      renderDesigns();
    });
  });
  function download(type, btn) {
    btn.disabled = true; say("");
    flush().then(function () {
      return fetch("/api/master/download?type=" + encodeURIComponent(type) + "&design=" + encodeURIComponent(designId), { credentials: "same-origin" });
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || "Couldn't make the file"); });
      var saved = r.headers.get("X-Comquat-Saved");
      var name = ((r.headers.get("Content-Disposition") || "").match(/filename="([^"]+)"/) || [])[1] || "Master_CV";
      return r.blob().then(function (b) {
        var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        say(saved ? "Downloaded. A copy is saved in My documents on your account." : "Downloaded.", true);
      });
    }).catch(function (e) { say(e.message, false); })
      .then(function () { btn.disabled = false; });
  }
  document.querySelectorAll("[data-type]").forEach(function (b) {
    b.addEventListener("click", function () { download(b.getAttribute("data-type"), b); });
  });

  // ---- key skills and behaviours (tick boxes) -----------------------------------
  function renderBehaviours(groups) {
    var box = $("behaviours");
    box.textContent = "";
    var picked = new Set(cv.behaviours || []);
    function count() {
      var n = picked.size, c = $("beh-count");
      c.textContent = n === 0 ? "Nothing ticked yet" : n + " ticked" + (n > 12 ? ". That's a lot for one CV: try keeping the twelve that sound most like you." : "");
      c.className = "beh-count" + (n > 12 ? " many" : "");
    }
    groups.forEach(function (g) {
      var grid = el("div", { class: "beh-grid" });
      g.items.forEach(function (it) {
        var input = el("input", { type: "checkbox", value: it.id });
        input.checked = picked.has(it.id);
        input.addEventListener("change", function () {
          if (input.checked) picked.add(it.id); else picked.delete(it.id);
          // keep the list order, so the CV reads the same way every time
          cv.behaviours = [];
          groups.forEach(function (gg) { gg.items.forEach(function (ii) { if (picked.has(ii.id)) cv.behaviours.push(ii.id); }); });
          count(); queueSave();
        });
        var text = el("span", { text: it.tick }, [el("small", { text: "On your CV: " + it.title })]);
        grid.appendChild(el("label", { class: "beh" }, [input, text]));
      });
      box.appendChild(el("div", { class: "beh-group" }, [el("h4", { text: g.title }), grid]));
    });
    count();
  }

  // ---- actions -----------------------------------------------------------------
  $("dl").addEventListener("click", function () {
    $("design-card").scrollIntoView({ behavior: "smooth", block: "start" });
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
        ["experience", "skills", "education", "behaviours"].forEach(function (n) { if (!Array.isArray(cv[n])) cv[n] = []; });
        // Every section opens with a blank entry ready to fill in.
        ["experience", "skills", "education"].forEach(function (n) { if (!cv[n].length) cv[n].push(LISTS[n].blank()); });
        bindFields();
        ["experience", "skills", "education"].forEach(function (n) { renderList(n); });
        renderBehaviours(j.behaviours || []);
        BANNED = j.banned || [];
        renderQuestions(); checkStatement();
        renderInterestIdeas();
        DESIGNS.word = j.designs || []; DESIGNS.designer = j.designerTemplates || [];
        renderDesigns();
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
