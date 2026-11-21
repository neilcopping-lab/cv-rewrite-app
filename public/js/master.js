// The CV builder (master CV). Saves to the person's Comquat account as they
// type, shows the CV live beside the form, lets people talk instead of type,
// and can write things up in the style they pick.
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var cv = null, loaded = false, step = 1;
  var saveTimer = null, saving = false, again = false, dirty = false;
  var DESIGNS = { fresh: [], word: [], designer: [] }, kind = "word", writeUp = true, voice = true;
  var BANNED = [], BEHAVIOURS = [];
  // The three journeys (lib/journeys.js), the one they picked, and the health check.
  var CFG = { journeys: [], guide: {} }, J = null, HEALTH = null;

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
      else if (k === "html") e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  var asLines = function (v) { return Array.isArray(v) ? v.join("\n") : (v || ""); };
  var lineCount = function (v) { return asLines(v).split("\n").filter(function (l) { return l.trim(); }).length; };
  function status(text, err) { var s = $("status"); s.textContent = text; s.className = "save-status" + (err ? " err" : ""); }
  function say(text, ok) { var m = $("msg"); m.textContent = text || ""; m.className = "msg " + (ok ? "ok" : "err") + (text ? "" : " hidden"); }
  var toastTimer;
  function toast(text) {
    var t = $("toast"); t.textContent = text; t.classList.add("on");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("on"); }, 3200);
  }
  function confetti() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var box = $("confetti"), cols = ["#FF8A1F", "#F25C54", "#FFB547", "#1F6B45", "#2B7BE4", "#7C3AED", "#12A88A"];
    for (var i = 0; i < 46; i++) {
      var p = document.createElement("i");
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = cols[i % cols.length];
      p.style.animationDelay = Math.random() * 0.35 + "s";
      p.style.animationDuration = 1.2 + Math.random() * 0.9 + "s";
      box.appendChild(p);
    }
    setTimeout(function () { box.textContent = ""; }, 2600);
  }
  function postJSON(url, body) {
    return fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || "Something went wrong. Please try again."); return j; }); });
  }
  // A button that asks "are you sure?" on the first press.
  function sure(btn, question, base) {
    if (btn.dataset.sure) { delete btn.dataset.sure; btn.textContent = base; return true; }
    btn.dataset.sure = "1"; btn.textContent = question;
    setTimeout(function () { if (btn.isConnected && btn.dataset.sure) { delete btn.dataset.sure; btn.innerHTML = btn.dataset.base || base; } }, 5000);
    return false;
  }

  // ---- steps and progress -------------------------------------------------------
  // Each journey puts the same seven steps in its own order (lib/journeys.js).
  var STEP_DEFS = {
    about: { label: "About you", done: function () { var h = cv.header || {}, c = h.contacts || {}; return !!(h.name && (c.email || c.phone)); }, cheer: "Nice one. You're on the page." },
    story: { label: "Your story", done: function () { return (cv.personalStatement || "").trim().length >= 60; }, cheer: "Brilliant. Your story's on your CV." },
    strengths: { label: "Strengths", done: function () { return (cv.behaviours || []).length + (cv.skills || []).filter(function (s) { return s.skill && s.skill.trim(); }).length >= 3; }, cheer: "Great picks. Those are on your CV now." },
    experience: { label: "Experience", done: function () { return (cv.experience || []).some(function (r) { return (r.title || "").trim() || (r.company || "").trim(); }); }, cheer: "Experience added. That all counts." },
    education: { label: "Education", done: function () { return (cv.education || []).some(function (e) { return (e.qualification || "").trim() || (e.institution || "").trim(); }); }, cheer: "Education sorted." },
    interests: { label: "Interests", done: function () { return lineCount(cv.interests) >= 1; }, cheer: "Now they've got a reason to like you." },
    download: { label: "Look and download", done: function () { return false; } },
    video: { label: "Your 90 seconds", done: function () { var v = cv.videoPlan || {}; return !!((cv.header || {}).introVideo || (String(v.intro || "").trim() && String(v.story1 || "").trim() && String(v.close || "").trim())); } },
  };
  var STEPS = [];
  function buildSteps() {
    var order = (J && J.order) || ["about", "story", "strengths", "experience", "education", "interests", "video", "download"];
    STEPS = order.map(function (k, i) {
      var d = STEP_DEFS[k];
      return { n: i + 1, key: k, label: (J && J.labels && J.labels[k]) || d.label, done: d.done, cheer: d.cheer };
    });
    STEPS.forEach(function (st) {
      var sec = document.querySelector('.step[data-key="' + st.key + '"]'); if (!sec) return;
      var num = sec.querySelector(".snum"); if (num) num.textContent = String(st.n);
      var h = sec.querySelector("h2"); if (h && (st.key === "experience" || st.key === "education")) h.lastChild.textContent = " " + (st.key === "education" ? st.label + " and training" : st.label);
    });
  }
  var stepOf = function (key) { for (var i = 0; i < STEPS.length; i++) if (STEPS[i].key === key) return STEPS[i].n; return 1; };
  var wasDone = {};
  function renderSteps() {
    var nav = $("steps"); nav.textContent = "";
    var cnt = document.getElementById("stepCount");
    if (!cnt) { cnt = document.createElement("p"); cnt.id = "stepCount"; cnt.className = "step-count"; cnt.setAttribute("aria-live", "polite"); nav.parentNode.insertBefore(cnt, nav); }
    var curStep = STEPS[step - 1]; cnt.textContent = curStep ? "Step " + step + " of " + STEPS.length + ": " + curStep.label : "";
    STEPS.forEach(function (s) {
      var b = el("button", { type: "button", class: "stp" + (s.done() ? " done" : "") }, [el("span", { class: "n" }, [el("span", { text: String(s.n) })]), document.createTextNode(s.label)]);
      if (s.n === step) b.setAttribute("aria-current", "step");
      // Health check folded into the step tabs: a coloured dot for the worst stop on that step.
      if (HEALTH && HEALTH.stops && (filled() || cv.healthStart)) {
        var order = { red: 3, amber: 2, green: 1 }, worst = null;
        HEALTH.stops.forEach(function (st) { if (st.step === s.key && order[st.rag] && (!worst || order[st.rag] > order[worst.rag])) worst = st; });
        if (worst) { b.appendChild(el("i", { class: "hdot " + worst.rag, "aria-hidden": "true" })); b.title = worst.title + ": " + worst.note; b.setAttribute("aria-label", s.label + ", health check " + ((typeof RAG_WORD !== "undefined" && RAG_WORD[worst.rag]) || worst.rag)); }
      }
      b.addEventListener("click", function () { go(s.n); });
      nav.appendChild(b);
    });
  }
  function refreshProgress() {
    // Download and the optional video step don't count towards "done".
    var content = STEPS.filter(function (s) { return s.key !== "download" && s.key !== "video"; }), done = content.filter(function (s) { return s.done(); }).length;
    var pct = Math.round((done / content.length) * 100);
    $("ring-pct").textContent = pct + "%";
    $("ring-fg").style.strokeDashoffset = String(314.16 * (1 - pct / 100));
    content.forEach(function (s) {
      var now = s.done();
      if (loaded && now && !wasDone[s.key]) {
        toast(done === content.length ? "That's everything. Your CV is ready to download." : s.cheer);
        confetti();
      }
      wasDone[s.key] = now;
    });
    renderSteps();
  }
  function go(n) {
    step = Math.max(1, Math.min(STEPS.length, n));
    var key = STEPS[step - 1].key;
    document.querySelectorAll(".step").forEach(function (s) { s.classList.toggle("on", s.getAttribute("data-key") === key); });
    $("prev").style.visibility = step === 1 ? "hidden" : "visible";
    var nx = $("next");
    if (step === STEPS.length) nx.style.visibility = "hidden";
    else { nx.style.visibility = "visible"; nx.textContent = "Next: " + STEPS[step].label; }
    renderSteps();
    try { history.replaceState(null, "", "#step-" + step); } catch (e) { /* fine */ }
    var top = $("steps").getBoundingClientRect().top + window.scrollY - 8;
    if (window.scrollY > top) window.scrollTo({ top: top, behavior: "smooth" });
    var cur = document.querySelector(".stp[aria-current]"); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest", inline: "center" });
  }
  $("prev").addEventListener("click", function () { go(step - 1); });
  $("next").addEventListener("click", function () { go(step + 1); });

  // ---- saving ------------------------------------------------------------------
  function changed() { queueSave(); queuePreview(); refreshProgress(); resetConfirm(); }
  function queueSave() {
    dirty = true;
    status("Saving soon…");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 1200);
  }
  function save() {
    if (saving) { again = true; return Promise.resolve(); }
    saving = true; dirty = false;
    status("Saving…");
    return postJSON("/api/master", { cv: cv })
      .then(function (j) {
        var t = new Date(j.updatedAt);
        status("Saved " + t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
        if (j.health) { HEALTH = j.health; renderHealthAll(); }
      })
      .catch(function (e) { dirty = true; status("Not saved", true); say(e.message + " We'll try again when you next type.", false); })
      .then(function () { saving = false; if (again) { again = false; save(); } });
  }
  function flush() { clearTimeout(saveTimer); return dirty || saving ? save() : Promise.resolve(); }
  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  // ---- talk instead of type ----------------------------------------------------------
  // Records a voice answer, turns it into text, and adds it to the box.
  // opts.lines: each sentence goes on its own line (lists and notes).
  // One-line boxes get a smaller button, and the words go in without a full stop.
  function mic(ta, label, after, opts) {
    if (!voice) return el("span", { class: "hidden" });
    opts = opts || {};
    var single = ta.tagName === "INPUT";
    var btn = el("button", { type: "button", class: "btn-mic" + (single ? " mini" : ""), "aria-label": "Say it instead of typing" + (ta.id ? ": " + ((document.querySelector('label[for="' + ta.id + '"]') || {}).textContent || "").trim() : "") });
    var idle = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.9V22h2v-3.1A7 7 0 0019 12h-2z"/></svg>' + (label || "Say it instead");
    btn.innerHTML = idle;
    var st = el("span", { class: "mic-status" });
    var rec = null, stream = null, chunks = [], tick = null, t0 = 0;
    function stopAll() { clearInterval(tick); if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    btn.addEventListener("click", function () {
      if (rec && rec.state === "recording") { rec.stop(); return; }
      if (!navigator.mediaDevices || !window.MediaRecorder) { st.className = "mic-status err"; st.textContent = "This browser can't record. You can type instead."; return; }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
        stream = s; chunks = [];
        var types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
        var type = types.filter(function (t) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t); })[0];
        rec = type ? new MediaRecorder(s, { mimeType: type }) : new MediaRecorder(s);
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = function () {
          stopAll();
          btn.classList.remove("rec"); btn.innerHTML = idle; btn.disabled = true;
          st.className = "mic-status"; st.textContent = "Turning that into words…";
          var mime = (rec.mimeType || (chunks[0] && chunks[0].type) || "audio/webm").split(";")[0];
          var ext = mime.indexOf("mp4") > -1 ? "mp4" : mime.indexOf("ogg") > -1 ? "ogg" : "webm";
          var fd = new FormData(); fd.append("audio", new Blob(chunks, { type: mime }), "answer." + ext);
          fetch("/api/transcribe", { method: "POST", body: fd, credentials: "same-origin" })
            .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.text) throw new Error(j.error || "We couldn't hear that clearly."); return j.text; }); })
            .then(function (text) {
              var cur = ta.value.trim(), said = text.trim();
              if (single) {
                said = said.replace(/[.!?]+$/, "");
                ta.value = cur ? cur + " " + said : said;
              } else if (opts.lines) {
                var bits = said.split(/(?<=[.!?])\s+/).map(function (b) { return b.replace(/[.]+$/, "").trim(); }).filter(Boolean);
                ta.value = (cur ? cur + "\n" : "") + bits.join("\n");
              } else {
                ta.value = (cur ? cur + (/[.!?]$/.test(cur) ? " " : ". ") : "") + said;
              }
              ta.dispatchEvent(new Event("input", { bubbles: true }));
              st.textContent = "Got it. Have a read and change anything we misheard.";
              if (typeof after === "function") after();
            })
            .catch(function (e) { st.className = "mic-status err"; st.textContent = /type/i.test(e.message) ? e.message : e.message + " You can type instead."; })
            .then(function () { btn.disabled = false; });
        };
        rec.start(); t0 = Date.now();
        btn.classList.add("rec"); btn.innerHTML = "■ Stop";
        st.className = "mic-status"; st.textContent = "Listening… press Stop when you're done.";
        tick = setInterval(function () {
          var s2 = Math.round((Date.now() - t0) / 1000);
          st.textContent = "Listening… " + Math.floor(s2 / 60) + ":" + ("0" + (s2 % 60)).slice(-2) + ". Press Stop when you're done.";
          if (s2 >= 180 && rec.state === "recording") rec.stop();
        }, 500);
      }).catch(function () { st.className = "mic-status err"; st.textContent = "We couldn't use your microphone. Check your browser lets this page use it, or type instead."; });
    });
    return el("div", { class: "mic-row" + (single ? " mini" : "") }, [btn, st]);
  }

  // ---- simple fields -----------------------------------------------------------
  function fillFields() {
    document.querySelectorAll("[data-path]").forEach(function (input) {
      var path = input.getAttribute("data-path"), v = get(cv, path);
      input.value = path === "interests" ? asLines(v) : (v || "");
    });
  }
  function bindFields() {
    fillFields();
    document.querySelectorAll("[data-path]").forEach(function (input) {
      var path = input.getAttribute("data-path");
      input.addEventListener("input", function () {
        set(cv, path, input.value);
        // Some boxes appear twice (the video link is on step 1 and the video step).
        document.querySelectorAll('[data-path="' + path + '"]').forEach(function (o) { if (o !== input) o.value = input.value; });
        changed();
      });
    });
  }

  // ---- writing styles --------------------------------------------------------------
  var STYLES = [
    { id: "warm", name: "Warm and personable", desc: "Friendly and human, like you on a good day.", eg: "\"I love a busy shift, and I'm the one who remembers the regulars' orders.\"" },
    { id: "professional", name: "Professional and polished", desc: "Clear, credible and easy for recruiters to read.", eg: "\"Reliable café assistant, trusted to open up on my own.\"" },
    { id: "concise", name: "Concise and punchy", desc: "Short, sharp sentences. No filler.", eg: "\"Fast learner. Calm on busy shifts. Never late.\"" },
    { id: "senior", name: "Confident and senior", desc: "Authoritative, for people with a few years behind them.", eg: "\"I lead teams through busy service and train new starters.\"" },
  ];
  function renderStyles() {
    var box = $("styles"); box.textContent = "";
    STYLES.forEach(function (s) {
      var b = el("button", { type: "button", class: "style", role: "radio", "aria-checked": String(cv.writingStyle === s.id) }, [el("strong", { text: s.name }), el("span", { text: s.desc }), el("em", { text: s.eg })]);
      b.addEventListener("click", function () { cv.writingStyle = s.id; renderStyles(); queueSave(); toast("Got it: " + s.name.toLowerCase() + "."); });
      box.appendChild(b);
    });
  }

  // ---- personal statement: one question at a time ----------------------------------
  // Built on The Com'mon People CV guide ("be a person, not a press release").
  // Each journey has its own questions (lib/journeys.js); these are the
  // originals, used only until the journey's questions arrive.
  var QUESTIONS = [
    { id: "story", title: "Your story so far: how did you get here?",
      think: "Where are you right now, and what led you here? A first CV is a story that's just starting, and that's a strength.",
      ideas: ["Finishing school, college, an apprenticeship or a course", "Coming back after time caring for children or family", "Changing direction, and why", "A Saturday job, a family business or a hobby that got you hooked", "A teacher, relative or moment that made you want to do this"],
      starters: ["Right now I'm", "I got into this through", "It all started when", "After"],
      example: "Right now I'm finishing my Level 3 in hospitality, and I got hooked washing pots on Saturdays at my local pub." },
    { id: "proud", title: "What are you proud of?",
      think: "Something you did, made, fixed, organised, learned or stuck at. It doesn't need to be from a job.",
      ideas: ["Exams or a course you got through, especially if it was hard", "Looking after someone, or keeping going through a tough time", "A team, club or event you helped run", "Raising money, volunteering, helping someone out", "Teaching yourself something: a skill, a language, a game, an instrument"],
      starters: ["I'm proud that I", "The thing I'm proudest of is", "People can count on me to"],
      example: "I'm proud that I kept my grades up while helping look after my nan." },
    { id: "care", title: "What matters to you?",
      think: "How you treat people, what you'd stand up for, what annoys you when it's done badly.",
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
  var qi = 0;
  var spoken = function (q) { return !q.private; };
  var answered = function (q) { return !!(cv.statementAnswers && String(cv.statementAnswers[q.id] || "").trim()); };
  // ---- "Here's what I heard" and one follow-up question --------------------------------
  // After an answer, the AI plays back the facts it picked up and asks one short
  // question to draw out the detail a recruiter wants. It never answers for them.
  // Whatever they say to the follow-up is added to their own answer.
  var asked = {};
  function followUpPanel(opts) {
    // opts: { key, question, getAnswer, addToAnswer, context, focusAnswer, btn, box }
    var panel = opts.box;
    function run(auto) {
      var ans = String(opts.getAnswer() || "").trim();
      if (ans.split(/\s+/).length < 5) { if (!auto) { panel.textContent = ""; panel.appendChild(el("p", { class: "small", text: "Say a bit more first, then we'll ask you a follow-up." })); } return; }
      if (auto && asked[opts.key] === ans) return;
      asked[opts.key] = ans;
      panel.textContent = ""; panel.appendChild(el("p", { class: "small fu-wait", text: "Listening back to what you said…" }));
      if (opts.btn) opts.btn.disabled = true;
      postJSON("/api/master/write", { task: "followup", journey: cv.journey, questionId: opts.key, question: opts.question, answer: ans, context: opts.context || "" })
        .then(function (j) { show(j); })
        .catch(function (e) { panel.textContent = ""; panel.appendChild(el("p", { class: "small", text: e.message })); })
        .then(function () { if (opts.btn) opts.btn.disabled = false; });
    }
    function show(j) {
      panel.textContent = "";
      if ((j.heard || []).length) {
        var ul = el("ul"); j.heard.forEach(function (h) { ul.appendChild(el("li", { text: h })); });
        var yes = el("button", { type: "button", class: "chip", text: "That's right" });
        var no = el("button", { type: "button", class: "chip", text: "Not quite" });
        var acts = el("div", { class: "heard-acts" }, [yes, no]);
        yes.addEventListener("click", function () { acts.replaceWith(el("p", { class: "small ok", text: "Great. That's going on your CV." })); });
        no.addEventListener("click", function () { acts.replaceWith(el("p", { class: "small", text: "Change anything in your answer above, or talk again. It's your words that go on the CV, not ours." })); opts.focusAnswer(); });
        panel.appendChild(el("div", { class: "heard" }, [el("strong", { text: "Here's what I heard" }), ul, acts]));
      }
      if (j.followUp) {
        var fid = "fu-" + opts.key.replace(/[^\w-]/g, "");
        var fta = el("textarea", { id: fid, rows: "2", placeholder: voice ? "Type here, or press the microphone and just talk." : "Type your answer here." });
        var add = el("button", { type: "button", class: "btn btn-primary small-btn", text: "Add to my answer" });
        var skip = el("button", { type: "button", class: "linkbtn", text: "Skip this one" });
        add.addEventListener("click", function () {
          var t = fta.value.trim(); if (!t) { fta.focus(); return; }
          opts.addToAnswer(t);
          panel.textContent = ""; panel.appendChild(el("p", { class: "small ok", text: "Added. That's the kind of detail recruiters look for." }));
          toast("Added to your answer.");
        });
        skip.addEventListener("click", function () { panel.textContent = ""; });
        panel.appendChild(el("div", { class: "fq" }, [el("strong", { text: "One more thing" }), el("label", { for: fid, text: j.followUp }), fta, mic(fta), el("div", { class: "fq-acts" }, [add, skip])]));
      }
      if (!(j.heard || []).length && !j.followUp) panel.appendChild(el("p", { class: "small ok", text: "That's a really full answer. Nothing to add." }));
    }
    return run;
  }
  function addTo(cur, extra) {
    cur = String(cur || "").trim(); extra = String(extra || "").trim();
    if (!cur) return extra;
    return cur + (/[.!?]$/.test(cur) ? " " : ". ") + extra.charAt(0).toUpperCase() + extra.slice(1);
  }

  function renderQuestion() {
    var box = $("qcard"), q = QUESTIONS[qi];
    box.textContent = "";
    if (!cv.statementAnswers || typeof cv.statementAnswers !== "object") cv.statementAnswers = {};
    var dots = el("div", { class: "qdots" });
    QUESTIONS.forEach(function (qq, i) {
      var d = el("button", { type: "button", class: "qdot" + (answered(qq) ? " filled" : "") + (i === qi ? " cur" : ""), "aria-label": "Question " + (i + 1) + (answered(qq) ? ", answered" : "") });
      d.addEventListener("click", function () { qi = i; renderQuestion(); });
      dots.appendChild(d);
    });
    var id = "q-" + q.id;
    var ta = el("textarea", { id: id, rows: "3", placeholder: voice ? "Type here, or press the microphone and just talk." : "Type your answer here." });
    ta.value = cv.statementAnswers[q.id] || "";
    ta.addEventListener("input", function () {
      cv.statementAnswers[q.id] = ta.value; queueSave();
      var dot = dots.children[qi]; if (dot) dot.classList.toggle("filled", !!ta.value.trim());
    });
    var chips = el("div", { class: "chips" });
    q.starters.forEach(function (stt) {
      var c = el("button", { type: "button", class: "chip", text: stt + "…" });
      c.addEventListener("click", function () {
        var cur = ta.value.trim();
        ta.value = (cur ? cur.replace(/[.!?]?$/, ".") + " " : "") + stt + " ";
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
      });
      chips.appendChild(c);
    });
    var ideas = el("ul");
    q.ideas.forEach(function (t) { ideas.appendChild(el("li", { text: t })); });
    var prev = el("button", { type: "button", text: "← Previous question" });
    var next = el("button", { type: "button", text: qi === QUESTIONS.length - 1 ? "All done? Write it up below ↓" : "Next question →" });
    if (qi === 0) prev.disabled = true;
    prev.addEventListener("click", function () { qi--; renderQuestion(); });
    next.addEventListener("click", function () {
      if (qi < QUESTIONS.length - 1) { qi++; renderQuestion(); var t = $("q-" + QUESTIONS[qi].id); if (t) t.focus({ preventScroll: true }); }
      else $("write-stmt").scrollIntoView({ behavior: "smooth", block: "center" });
    });
    box.appendChild(el("div", { class: "qtop" }, [el("span", { class: "qcount", text: "Question " + (qi + 1) + " of " + QUESTIONS.length }), dots]));
    box.appendChild(el("h4", { text: q.title }));
    box.appendChild(el("p", { class: "think", text: q.think }));
    box.appendChild(el("details", {}, [el("summary", { text: "Need ideas?" }), ideas]));
    box.appendChild(el("p", { class: "small", text: "Tap a starter, then finish the sentence your way:" }));
    box.appendChild(chips);
    box.appendChild(el("label", { for: id, class: "sr-only", text: q.title }));
    box.appendChild(ta);
    var fuBox = el("div", { class: "fu", "aria-live": "polite" }), fuBtn = null, runFu = null;
    if (writeUp && !q.private) {
      fuBtn = el("button", { type: "button", class: "btn btn-ghost small-btn fu-btn", text: "What did you hear?" });
      runFu = followUpPanel({ key: q.id, question: q.title, box: fuBox, btn: fuBtn,
        getAnswer: function () { return ta.value; },
        addToAnswer: function (t) { ta.value = addTo(ta.value, t); ta.dispatchEvent(new Event("input", { bubbles: true })); },
        focusAnswer: function () { ta.focus(); } });
      fuBtn.addEventListener("click", function () { runFu(false); });
    }
    box.appendChild(el("div", { class: "ans-acts" }, [mic(ta, null, runFu ? function () { runFu(true); } : null), fuBtn]));
    box.appendChild(fuBox);
    if (q.private) box.appendChild(el("p", { class: "private-note", text: "Just for you. This answer stays in your account. It never goes on your CV and is never sent to the AI." }));
    box.appendChild(el("p", { class: "eg-line", text: "For example: \"" + q.example + "\"" }));
    box.appendChild(el("div", { class: "qnav" }, [prev, next]));
  }

  function tidySentence(t) {
    t = String(t || "").replace(/\s+/g, " ").replace(/[…]+$|\.\.\.$/, "").trim();
    if (!t) return "";
    var bare = QUESTIONS.some(function (q) { return q.starters.some(function (s) { return t.replace(/[,.\s]+$/, "") === s.replace(/[,.\s]+$/, ""); }); });
    if (bare) return "";
    t = t.charAt(0).toUpperCase() + t.slice(1);
    if (!/[.!?]$/.test(t)) t += ".";
    return t;
  }
  function putStatement(text, msg) {
    var box = $("f-profile");
    box.value = text; cv.personalStatement = text; changed(); checkStatement();
    $("build-msg").textContent = msg;
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  $("build").addEventListener("click", function () {
    var b = $("build"), parts = QUESTIONS.filter(spoken).map(function (q) { return tidySentence(cv.statementAnswers && cv.statementAnswers[q.id]); }).filter(Boolean);
    if (!parts.length) { $("build-msg").textContent = "Answer at least one question first."; return; }
    var text = parts.join(" "), cur = $("f-profile").value.trim();
    if (cur && cur !== text && !sure(b, "Replace my statement?", "Just join my answers together")) { $("build-msg").textContent = "This will replace what's in your statement box. Press again to go ahead."; return; }
    putStatement(text, parts.length < 3 ? "Done. Answer one or two more questions for a fuller statement." : "Done. Read it out loud, and change anything that doesn't sound like you.");
  });
  $("write-stmt").addEventListener("click", function () {
    var b = $("write-stmt"), base = b.innerHTML;
    if (!QUESTIONS.filter(spoken).some(answered) && !$("f-profile").value.trim()) { $("build-msg").textContent = "Answer at least one question first, by typing or talking."; return; }
    var cur = $("f-profile").value.trim();
    if (cur && !b.dataset.sure) { b.dataset.base = base; sure(b, "Replace my statement?", base); $("build-msg").textContent = "This will replace what's in your statement box. Press again to go ahead."; return; }
    delete b.dataset.sure;
    b.disabled = true; b.textContent = "Writing it up…"; $("build-msg").textContent = "";
    var ans = {}; Object.keys(cv.statementAnswers || {}).forEach(function (k) { if (!QUESTIONS.some(function (q) { return q.id === k && q.private; })) ans[k] = cv.statementAnswers[k]; });
    postJSON("/api/master/write", { task: "statement", journey: cv.journey, answers: ans, current: cur, targetRole: (cv.header || {}).targetRole || "", style: cv.writingStyle, styleSample: cv.styleSample || "" })
      .then(function (j) { putStatement(j.statement, "Here you go. Read it out loud: if anything doesn't sound like you, change it. It's your CV."); toast("Written up. Have a read."); })
      .catch(function (e) { $("build-msg").textContent = e.message; })
      .then(function () { b.disabled = false; b.innerHTML = base; });
  });

  function checkStatement() {
    var t = ($("f-profile").value || "").trim(), out = $("stmt-check");
    if (!t) { out.textContent = ""; out.className = "stmt-check"; return; }
    var words = t.split(/\s+/).length, sentences = t.split(/[.!?]+/).filter(function (x) { return x.trim(); }).length;
    var lower = t.toLowerCase();
    var found = BANNED.filter(function (p) { return lower.indexOf(p) !== -1; }).slice(0, 3);
    if (found.length) { out.className = "stmt-check warn"; out.textContent = "Sounds a bit like a press release: \"" + found.join("\", \"") + "\". Say what you actually do or did instead."; }
    else if (sentences > 5 || words > 120) { out.className = "stmt-check warn"; out.textContent = words + " words, " + sentences + " sentences. That's on the long side: three to five short sentences is plenty."; }
    else if (words < 20) { out.className = "stmt-check"; out.textContent = words + " words. A little more would help: answer another question above."; }
    else { out.className = "stmt-check ok"; out.textContent = words + " words, " + sentences + " sentences. Sounds like a real person. Read it out loud to be sure."; }
  }
  $("f-profile").addEventListener("input", checkStatement);

  // ---- key skills and behaviours ----------------------------------------------------
  function renderBehaviours(groups) {
    var box = $("behaviours"); box.textContent = "";
    var picked = new Set(cv.behaviours || []);
    function count() {
      var n = picked.size, c = $("beh-count");
      c.textContent = n === 0 ? "Nothing picked yet" : n < 8 ? n + " picked. Aim for eight to twelve." : n <= 12 ? n + " picked. Spot on." : n + " picked. That's a lot: keep the twelve that sound most like you.";
      c.className = "beh-count" + (n === 0 ? " none" : n > 12 ? " many" : "");
    }
    groups.forEach(function (g) {
      var grid = el("div", { class: "beh-grid" });
      g.items.forEach(function (it) {
        var input = el("input", { type: "checkbox", value: it.id });
        input.checked = picked.has(it.id);
        var label = el("label", { class: "beh" }, [input, el("span", { class: "box" }), el("span", { text: it.tick }, [el("small", { text: "On your CV: " + it.title })])]);
        input.addEventListener("change", function () {
          if (input.checked) picked.add(it.id); else picked.delete(it.id);
          cv.behaviours = [];
          groups.forEach(function (gg) { gg.items.forEach(function (ii) { if (picked.has(ii.id)) cv.behaviours.push(ii.id); }); });
          label.classList.remove("pop"); void label.offsetWidth; if (input.checked) label.classList.add("pop");
          count(); changed(); renderProofs();
        });
        grid.appendChild(label);
      });
      box.appendChild(el("div", { class: "beh-group" }, [el("h4", { text: g.title }), grid]));
    });
    count();
    renderProofs();
  }

  // "Now prove it": their own example behind each strength they ticked. It goes
  // on the CV in place of the ready-written line.
  var TITLES = {};
  function renderProofs() {
    BEHAVIOURS.forEach(function (g) { g.items.forEach(function (it) { TITLES[it.id] = it; }); });
    var ids = (cv.behaviours || []).filter(function (id) { return TITLES[id]; });
    $("proofs").classList.toggle("hidden", !ids.length);
    var box = $("proof-list"), had = {};
    box.querySelectorAll(".proof").forEach(function (r) { had[r.getAttribute("data-id")] = r; });
    if (!cv.behaviourProof || typeof cv.behaviourProof !== "object") cv.behaviourProof = {};
    box.textContent = "";
    ids.forEach(function (id) {
      if (had[id]) { box.appendChild(had[id]); return; }
      var it = TITLES[id], fid = "proof-" + id;
      var ta = el("textarea", { id: fid, rows: "2", placeholder: "When did you do that, and what happened? e.g. \"I spotted a mistake on a customer's bill before it went out\"" });
      ta.value = cv.behaviourProof[id] || "";
      ta.addEventListener("input", function () { cv.behaviourProof[id] = ta.value; changed(); });
      var out = el("span", { class: "small", "aria-live": "polite" });
      var tidyBtn = el("button", { type: "button", class: "btn btn-spark small-btn", text: "Tidy it into one line" });
      tidyBtn.addEventListener("click", function () {
        var words = ta.value.trim();
        if (words.split(/\s+/).length < 4) { out.textContent = "Tell us a bit more first: when did you do that, and what happened?"; return; }
        tidyBtn.disabled = true; out.textContent = "Writing it up…";
        postJSON("/api/master/write", { task: "proof", strength: it.title, words: words, style: cv.writingStyle, styleSample: cv.styleSample || "" })
          .then(function (j) { ta.value = j.proof; cv.behaviourProof[id] = j.proof; changed(); out.textContent = "Done. Check it says what you meant."; })
          .catch(function (e) { out.textContent = e.message; })
          .then(function () { tidyBtn.disabled = false; });
      });
      if (!writeUp) tidyBtn.classList.add("hidden");
      var row = el("div", { class: "proof", "data-id": id }, [
        el("label", { for: fid }, [el("strong", { text: it.title }), el("small", { text: " You ticked: \u201c" + it.tick + "\u201d" })]),
        ta,
        el("div", { class: "about-acts" }, [mic(ta, "Tell us"), tidyBtn, out]),
      ]);
      box.appendChild(row);
    });
  }

  // ---- repeating lists ---------------------------------------------------------
  var LISTS = {
    experience: {
      label: function (r, i) { return r.kind === "break" ? (r.title || "Career break") + (r.dates ? ", " + r.dates : "") : r.title || r.company ? [r.title, r.company].filter(Boolean).join(", ") : "Job or experience " + (i + 1); },
      breakFields: [
        ["title", "What to call it", "text", "e.g. Career break, or Time out to raise my family"], ["dates", "When", "text", "e.g. 2021 to 2025"],
        ["about", "What filled that time? Only share what you're happy to", "about", "Raising a family, caring, volunteering, a course, helping a friend's business…"],
        ["responsibilities", "What you did in that time", "lines", "One thing per line"],
        ["achievements", "Anything you're proud of from that time", "lines", "One per line. Leave it blank if you like"],
      ],
      blank: function () { return { title: "", company: "", location: "", dates: "", about: "", responsibilities: "", achievements: "", reasonForLeaving: "" }; },
      fields: [
        ["title", "Job title or role", "text", "e.g. Café assistant, or Volunteer"], ["company", "Where", "text", "e.g. The Corner Café"],
        ["dates", "When", "text", "e.g. March 2024 to now"], ["location", "Town", "text", "e.g. Hitchin"],
        ["about", "Tell us about it in your own words", "about", "What did you do there? Anything you're proud of, or were trusted with?"],
        ["responsibilities", "What you did", "lines", "One task per line"],
        ["achievements", "What came of it", "lines", "One result per line, with numbers if you have them"],
        ["reasonForLeaving", "Reason for leaving", "text", "e.g. Went back to college. Still there? Leave it blank"],
      ],
    },
    skills: {
      label: function (r, i) { return r.skill || "Skill " + (i + 1); },
      blank: function () { return { skill: "", proof: "" }; },
      fields: [["skill", "Skill", "text", "e.g. Cash handling"], ["proof", "Proof", "text", "One line that shows it"]],
    },
    education: {
      label: function (r, i) { return r.qualification || "Qualification " + (i + 1); },
      blank: function () { return { qualification: "", institution: "", dates: "", grade: "" }; },
      fields: [["qualification", "Qualification or course", "text", "e.g. Level 3 Diploma in Hospitality"], ["institution", "Where", "text", "e.g. Oaklands College"], ["dates", "When", "text", "e.g. 2024 to 2026"], ["grade", "Grade", "text", "Optional"]],
    },
  };

  function writeUpJob(row, i, btn, out) {
    var base = btn.innerHTML;
    if (!String(row.about || "").trim()) { out.textContent = "Tell us a bit about it first, by typing or talking."; return; }
    var has = lineCount(row.responsibilities) + lineCount(row.achievements) > 0;
    if (has && !btn.dataset.sure) { btn.dataset.base = base; sure(btn, "Replace my points?", base); out.textContent = "This replaces what's in What you did and What came of it. Press again to go ahead."; return; }
    delete btn.dataset.sure;
    btn.disabled = true; btn.textContent = "Writing it up…"; out.textContent = "";
    postJSON("/api/master/write", { task: "job", job: { title: row.title, company: row.company, dates: row.dates, about: row.about }, style: cv.writingStyle, styleSample: cv.styleSample || "" })
      .then(function (j) {
        row.responsibilities = (j.responsibilities || []).join("\n");
        row.achievements = (j.achievements || []).join("\n");
        renderList("experience"); changed();
        toast("Done. Check it says what you meant.");
      })
      .catch(function (e) { out.textContent = e.message; btn.disabled = false; btn.innerHTML = base; });
  }

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
      (row.kind === "break" && spec.breakFields ? spec.breakFields : spec.fields).forEach(function (f) {
        var id = name + "-" + i + "-" + f[0];
        var multi = f[2] === "lines" || f[2] === "about";
        var input = multi ? el("textarea", { id: id, rows: f[2] === "about" ? "3" : "4" }) : el("input", { type: "text", id: id });
        if (f[3]) input.setAttribute("placeholder", f[3]);
        input.value = multi ? asLines(row[f[0]]) : (row[f[0]] || "");
        input.addEventListener("input", function () {
          row[f[0]] = input.value;
          if (f[0] === spec.fields[0][0] || f[0] === spec.fields[1][0]) head.textContent = spec.label(row, i);
          changed();
        });
        if (f[2] === "about") {
          var out = el("span", { class: "small", "aria-live": "polite" });
          var wb = el("button", { type: "button", class: "btn btn-spark small-btn", html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6zM19 14l.9 2.6L22.5 17l-2.6.9L19 20.5l-.9-2.6-2.6-.9 2.6-.4z"/></svg>Turn this into CV points' });
          wb.addEventListener("click", function () { writeUpJob(row, i, wb, out); });
          if (!writeUp) wb.classList.add("hidden");
          var fuBox = el("div", { class: "fu", "aria-live": "polite" }), fuBtn = null, runFu = null;
          if (writeUp) {
            fuBtn = el("button", { type: "button", class: "btn btn-ghost small-btn fu-btn", text: "Ask me a follow-up" });
            runFu = followUpPanel({ key: "job-" + i + "-" + (row.title || ""), box: fuBox, btn: fuBtn,
              question: row.kind === "break" ? "Tell us about your time away, and what filled it" : "Tell us about your time as " + (row.title || "this role") + (row.company ? " at " + row.company : "") + ": what did you do, and what came of it?",
              context: row.kind === "break" ? "This is about a career break. Ask only about what they did or learned, never about why." : "",
              getAnswer: function () { return input.value; },
              addToAnswer: function (t) { input.value = addTo(input.value, t); input.dispatchEvent(new Event("input", { bubbles: true })); },
              focusAnswer: function () { input.focus(); } });
            fuBtn.addEventListener("click", function () { runFu(false); });
          }
          grid.appendChild(el("div", { class: "about-box" }, [el("label", { for: id, text: f[1] }), input, mic(input, null, runFu ? function () { runFu(true); } : null), el("div", { class: "about-acts" }, [wb, fuBtn, out]), fuBox]));
          return;
        }
        grid.appendChild(el("div", { class: multi ? "full" : "" }, [el("label", { for: id, text: f[1] }), input, mic(input, multi ? "Say it instead" : "Say it", null, { lines: f[2] === "lines" })]));
      });
      var item = el("div", { class: "item" }, [el("div", { class: "item-head" }, [head, tools]), grid]);
      tools.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () {
          if (b.classList.contains("del")) {
            if (!sure(b, "Remove for good?", "Remove")) return;
            items.splice(i, 1);
          } else {
            var j = b.textContent === "↑" ? i - 1 : i + 1;
            var tmp = items[i]; items[i] = items[j]; items[j] = tmp;
          }
          renderList(name); changed();
        });
      });
      box.appendChild(item);
    });
    if (focusIndex != null) { var first = box.querySelectorAll(".item")[focusIndex]; if (first) first.querySelector("input,textarea").focus(); }
  }
  $("add-break").addEventListener("click", function () {
    var row = LISTS.experience.blank(); row.kind = "break"; row.title = "Career break";
    cv.experience.unshift(row);
    renderList("experience", 0); changed();
    toast("Career break added at the top. Use the arrows to move it to the right place.");
  });
  document.querySelectorAll("[data-add]").forEach(function (b) {
    b.addEventListener("click", function () {
      var name = b.getAttribute("data-add");
      cv[name].push(LISTS[name].blank());
      renderList(name, cv[name].length - 1);
      changed();
    });
  });

  // ---- interests -------------------------------------------------------------------
  var INTEREST_IDEAS = ["Coaching a kids' sports team", "Volunteering at a food bank", "Playing football on Sundays", "Gaming with friends online", "Cooking for family and friends", "Running, the gym or swimming", "Playing or making music", "Going to gigs and festivals", "Looking after my dog", "Fixing or making things", "Reading crime novels", "Drawing, painting or photography", "Growing veg on the allotment", "Fundraising for a local charity", "Making videos or content", "Learning a language"];
  function renderInterestIdeas() {
    var box = $("interest-ideas"), ta = $("f-interests");
    box.textContent = "";
    ((J && J.interests) || INTEREST_IDEAS).forEach(function (t) {
      var c = el("button", { type: "button", class: "chip", text: "+ " + t });
      c.addEventListener("click", function () {
        var lines = ta.value.split("\n").filter(function (l) { return l.trim(); });
        if (lines.indexOf(t) === -1) lines.push(t);
        ta.value = lines.join("\n"); ta.dispatchEvent(new Event("input", { bubbles: true }));
        ta.focus();
      });
      box.appendChild(c);
    });
  }

  // ---- designs ---------------------------------------------------------------------
  var DOTS = { "f-sunrise": "linear-gradient(120deg,#FF8A1F,#F25C54)", "f-green": "#1F6B45", "f-bold": "#17191C", "f-sky": "#2B7BE4" };
  var isFresh = function (id) { return DESIGNS.fresh.some(function (d) { return d.id === id; }); };
  var allDesigns = function () { return DESIGNS.fresh.concat(DESIGNS.word, DESIGNS.designer); };
  function pick(id) {
    cv.design = id; queueSave();
    renderDesigns(); queuePreview(true);
  }
  function renderDesigns() {
    var id = cv.design;
    var fg = $("fresh-grid"); fg.textContent = "";
    DESIGNS.fresh.forEach(function (d) {
      var c = el("button", { type: "button", class: "fcard" + (d.id === id ? " sel" : ""), title: d.description }, [el("img", { src: "/img/thumbs/" + d.id + ".png", alt: "", loading: "lazy" }), el("span", { text: d.name })]);
      c.addEventListener("click", function () { pick(d.id); });
      fg.appendChild(c);
    });
    var pd = $("pv-designs"); pd.textContent = "";
    DESIGNS.fresh.forEach(function (d) {
      var b = el("button", { type: "button", class: "pvd", role: "radio", "aria-checked": String(d.id === id) }, [el("i"), document.createTextNode(d.name)]);
      b.firstChild.style.background = DOTS[d.id] || "#999";
      b.addEventListener("click", function () { pick(d.id); });
      pd.appendChild(b);
    });
    if (!isFresh(id)) {
      var cur = allDesigns().filter(function (d) { return d.id === id; })[0];
      if (cur) pd.appendChild(el("button", { type: "button", class: "pvd", role: "radio", "aria-checked": "true" }, [el("i", { style: "background:#999" }), document.createTextNode(cur.name)]));
    }
    var grid = $("design-grid"); grid.textContent = "";
    DESIGNS[kind].forEach(function (d) {
      var c = el("button", { type: "button", class: "dcard" + (d.id === id ? " sel" : ""), title: d.description || d.name }, [el("img", { src: "/img/thumbs/" + d.id + ".png", alt: "", loading: "lazy" }), el("span", { text: d.name })]);
      c.addEventListener("click", function () { pick(d.id); });
      grid.appendChild(c);
    });
    var designer = DESIGNS.designer.some(function (d) { return d.id === id; });
    document.querySelectorAll('[data-type="docx"]').forEach(function (b) { b.style.display = designer ? "none" : ""; });
  }
  document.querySelectorAll(".kind").forEach(function (b) {
    b.addEventListener("click", function () {
      kind = b.getAttribute("data-kind");
      document.querySelectorAll(".kind").forEach(function (x) { x.classList.toggle("on", x === b); });
      renderDesigns();
    });
  });

  // ---- live preview ----------------------------------------------------------------
  var pvTimer = null, pvBusy = false, pvAgain = false;
  var wide = function () { return window.matchMedia("(min-width:1101px)").matches; };
  var pvOpen = function () { return wide() || $("preview").classList.contains("open"); };
  function queuePreview(now) {
    clearTimeout(pvTimer);
    if (!pvOpen()) return;
    pvTimer = setTimeout(renderPreview, now ? 0 : 650);
  }
  function fitPreview() {
    var frame = $("pv-frame"), f = $("pv"), sc = $("pv-scale");
    var d = f.contentDocument; if (!d || !d.documentElement) return;
    var h = Math.max(1123, d.documentElement.scrollHeight);
    f.style.height = h + "px";
    var s = Math.min(1, (frame.clientWidth - 20) / 794);
    sc.style.transform = "scale(" + s + ")";
    sc.style.marginBottom = -(h * (1 - s)) + "px";
    sc.style.marginRight = -(794 * (1 - s)) + "px";
  }
  function renderPreview() {
    var id = cv.design, note = $("pv-note");
    if (!isFresh(id)) {
      $("pv-scale").classList.add("hidden");
      var img = $("pv-thumb"); img.src = "/img/thumbs/" + id + ".png"; img.classList.remove("hidden");
      note.textContent = "This design can't be shown live, so here's an example. Pick one of the four looks above to see your own CV.";
      return;
    }
    $("pv-thumb").classList.add("hidden"); $("pv-scale").classList.remove("hidden");
    note.textContent = "This is exactly how your PDF will look.";
    if (pvBusy) { pvAgain = true; return; }
    pvBusy = true;
    fetch("/api/master/preview", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cv: cv, design: id }) })
      .then(function (r) { if (!r.ok) throw new Error(); return r.text(); })
      .then(function (html) {
        var frame = $("pv-frame"), top = frame.scrollTop, f = $("pv");
        f.onload = function () { fitPreview(); frame.scrollTop = top; };
        f.srcdoc = html;
      })
      .catch(function () { note.textContent = "The preview couldn't update just now. Your work is still saved."; })
      .then(function () { pvBusy = false; if (pvAgain) { pvAgain = false; renderPreview(); } });
  }
  window.addEventListener("resize", function () { fitPreview(); if (pvOpen()) queuePreview(); });
  $("pv-fab").addEventListener("click", function () { $("preview").classList.add("open"); document.body.style.overflow = "hidden"; renderPreview(); });
  function closePreview() { $("preview").classList.remove("open"); document.body.style.overflow = ""; }
  $("pv-close").addEventListener("click", closePreview);
  $("preview").addEventListener("click", function (e) { if (e.target === $("preview")) closePreview(); });
  $("pv-more").addEventListener("click", function () { closePreview(); go(stepOf("download")); });

  // ---- "I've read it and it's true" box -------------------------------------------
  // Same rule as CV Rewrite: the download buttons stay greyed out until it's
  // ticked, and any change to the words unticks it so each version gets checked.
  // The server checks it too (confirmed=1) and keeps a dated record.
  var CONFIRM_NEEDED = "Please tick the box to confirm you've read your CV through and it's accurate.";
  function confirmed() { var c = $("confirmTrue"); return !!(c && c.checked); }
  function syncConfirm() {
    var ok = confirmed();
    document.querySelectorAll("#design-card [data-type]").forEach(function (b) {
      if (b.textContent !== "Making your file…") b.disabled = !ok;
    });
    var row = document.querySelector(".confirm-row"); if (row && ok) row.classList.remove("nudge");
  }
  function resetConfirm() { var c = $("confirmTrue"); if (c && c.checked) { c.checked = false; syncConfirm(); } }
  function nudgeConfirm() {
    if ($("preview").classList.contains("open")) closePreview();
    go(stepOf("download"));
    var row = document.querySelector(".confirm-row");
    if (row) { row.classList.remove("nudge"); void row.offsetWidth; row.classList.add("nudge"); if (row.scrollIntoView) row.scrollIntoView({ block: "center", behavior: "smooth" }); }
    say(CONFIRM_NEEDED, false); toast(CONFIRM_NEEDED);
  }
  if ($("confirmTrue")) {
    // Always start unticked. Browsers restore ticked boxes on reload or Back,
    // which would let someone skip the check without reading their CV.
    $("confirmTrue").checked = false;
    $("confirmTrue").addEventListener("change", syncConfirm);
  }
  window.addEventListener("pageshow", function (e) { if (e.persisted) resetConfirm(); });
  syncConfirm();

  // ---- downloads -------------------------------------------------------------------
  function download(type, btn) {
    if (!confirmed()) { nudgeConfirm(); return; }
    btn.disabled = true; say("");
    var old = btn.textContent; btn.textContent = "Making your file…";
    flush().then(function () {
      return fetch("/api/master/download?type=" + encodeURIComponent(type) + "&design=" + encodeURIComponent(cv.design) + "&confirmed=1", { credentials: "same-origin" });
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || "Couldn't make the file"); });
      var saved = r.headers.get("X-Comquat-Saved");
      var name = ((r.headers.get("Content-Disposition") || "").match(/filename="([^"]+)"/) || [])[1] || "CV";
      return r.blob().then(function (b) {
        var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        toast(saved ? "Downloaded. A copy is in My documents too." : "Downloaded.");
        confetti();
      });
    }).catch(function (e) { say(e.message, false); toast(e.message); })
      .then(function () { btn.disabled = false; btn.textContent = old; syncConfirm(); });
  }
  document.querySelectorAll("[data-type]").forEach(function (b) {
    b.addEventListener("click", function () { download(b.getAttribute("data-type"), b); });
  });

  $("tailor").addEventListener("click", function () { flush().then(function () { location.href = "/app.html?from=master"; }); });
  $("wipe").addEventListener("click", function () {
    var b = $("wipe");
    if (!sure(b, "Are you sure? Press again to delete it for good.", "Delete my CV")) return;
    clearTimeout(saveTimer); dirty = false;
    postJSON("/api/master/delete", {})
      .then(function () { location.href = "/master.html?deleted=1"; })
      .catch(function (e) { say(e.message, false); });
  });

  // ---- the health check: the seven stops in The CV That Gets Read --------------------
  var RAG_WORD = { green: "Sorted", amber: "Could be better", red: "Needs work", next: "Next step" };
  function renderHealth(box, health, opts) {
    opts = opts || {};
    box.textContent = "";
    if (!health) return;
    health.stops.forEach(function (st) {
      var fix = null;
      if (opts.fix !== false && st.rag !== "green") {
        fix = el("button", { type: "button", class: "linkbtn", text: st.rag === "next" ? "Tailor it for a job" : "Fix this" });
        fix.addEventListener("click", function () { if (st.rag === "next") { $("tailor").click(); return; } go(stepOf(st.step)); });
      }
      box.appendChild(el("div", { class: "hs " + st.rag }, [
        el("span", { class: "hs-dot", "aria-hidden": "true" }),
        el("div", { class: "hs-body" }, [
          el("strong", { text: st.n + ". " + st.title }), el("span", { class: "hs-rag", text: " " + RAG_WORD[st.rag] }),
          el("p", { text: st.note }),
          el("div", { class: "hs-acts" }, [fix, el("a", { href: st.url, target: "_blank", rel: "noopener", text: "Read Stop " + st.n + " in the guide" })]),
        ]),
      ]));
    });
  }
  function healthStrip() {
    var bar = $("hstrip"); if (!bar || !HEALTH) return;
    bar.textContent = "";
    return; // folded into the step tabs (UX review, Nov 2026)
    // Nothing to check yet: an all-red strip on an empty CV would just be off-putting.
    if (!filled() && !cv.healthStart) return;
    bar.appendChild(el("span", { class: "hstrip-lab", text: "Health check:" }));
    HEALTH.stops.forEach(function (st) {
      if (st.rag === "next") return;
      var b = el("button", { type: "button", class: "hchip " + st.rag, title: st.note }, [el("i"), document.createTextNode(st.title)]);
      b.addEventListener("click", function () { go(stepOf(st.step)); });
      bar.appendChild(b);
    });
  }
  function renderHealthAll() {
    if (!HEALTH) return;
    renderHealth($("health-live"), HEALTH);
    var scored = HEALTH.stops.length - 1, sum = $("health-sum");
    var line = HEALTH.greens + " of " + scored + " stops are green. ";
    if (cv.healthStart) line += "When you uploaded your CV it was " + cv.healthStart.greens + ". ";
    line += HEALTH.greens === scored ? "That's every one. Lovely work." : "Work through the red and amber ones: each takes you to the right step.";
    sum.textContent = line + " ";
    sum.appendChild(el("a", { href: "https://the-common-people.com/guide-cv.html", target: "_blank", rel: "noopener", text: "Based on The CV That Gets Read." }));
    healthStrip();
  }

  // ---- Your 90 seconds: talking notes for an intro video (Field Guide N°02) -------------
  var VIDEO = { parts: [], checks: [] };
  function vPlan() { if (!cv.videoPlan || typeof cv.videoPlan !== "object") cv.videoPlan = {}; return cv.videoPlan; }
  function renderVideo() {
    VIDEO = (CFG && CFG.video) || VIDEO;
    var vp = vPlan(), box = $("v-parts"); box.textContent = "";
    $("v-role").value = vp.role || (cv.header || {}).targetRole || "";
    $("v-company").value = vp.company || "";
    VIDEO.parts.forEach(function (pt, i) {
      var id = "v-" + pt.id;
      var ta = el("textarea", { id: id, rows: "4", placeholder: pt.placeholder });
      ta.value = vp[pt.id] || "";
      ta.addEventListener("input", function () { vPlan()[pt.id] = ta.value; changed(); });
      box.appendChild(el("div", { class: "v-part", "data-part": pt.id }, [
        el("div", { class: "v-head" }, [el("span", { class: "v-n", text: String(i + 1) }), el("strong", { text: pt.title }), el("span", { class: "v-time", text: pt.time })]),
        el("p", { class: "v-in" }, [el("b", { text: "Put in: " }), document.createTextNode(pt.putIn)]),
        el("p", { class: "v-out" }, [el("b", { text: "Leave out: " }), document.createTextNode(pt.leaveOut)]),
        el("label", { for: id, text: "Your notes, one per line" }), ta, mic(ta, "Say it instead", null, { lines: true }),
      ]));
    });
    var cb = $("v-checks"); cb.textContent = "";
    var ticked = new Set(cv.videoChecks || []);
    [["record", "Recording"], ["safe", "Staying safe"]].forEach(function (grp) {
      var list = el("div", { class: "v-check-grp" }, [el("h4", { text: grp[1] })]);
      VIDEO.checks.filter(function (c) { return c.group === grp[0]; }).forEach(function (c) {
        var input = el("input", { type: "checkbox" }); input.checked = ticked.has(c.id);
        input.addEventListener("change", function () {
          if (input.checked) ticked.add(c.id); else ticked.delete(c.id);
          cv.videoChecks = VIDEO.checks.filter(function (x) { return ticked.has(x.id); }).map(function (x) { return x.id; });
          queueSave();
        });
        list.appendChild(el("label", { class: "v-check" }, [input, el("span", { text: c.text })]));
      });
      cb.appendChild(list);
    });
    if (!writeUp) { $("v-plan").classList.add("hidden"); document.querySelector(".v-ai").classList.add("hidden"); }
  }
  $("v-role").addEventListener("input", function () { vPlan().role = $("v-role").value; queueSave(); });
  $("v-company").addEventListener("input", function () { vPlan().company = $("v-company").value; queueSave(); });
  $("v-plan").addEventListener("click", function () {
    var b = $("v-plan"), base = b.innerHTML, vp = vPlan();
    var has = VIDEO.parts.some(function (pt) { return String(vp[pt.id] || "").trim(); });
    if (has && !b.dataset.sure) { b.dataset.base = base; sure(b, "Replace my notes?", base); $("v-msg").textContent = "This replaces the notes below. Press again to go ahead."; return; }
    delete b.dataset.sure;
    b.disabled = true; b.textContent = "Planning your 90 seconds…"; $("v-msg").textContent = "";
    flush().then(function () { return postJSON("/api/master/write", { task: "video", role: $("v-role").value, company: $("v-company").value }); })
      .then(function (j) {
        var name = ((cv.header || {}).name || "").trim();
        VIDEO.parts.forEach(function (pt) {
          var lines = (j.plan[pt.id] || []).map(function (l) { return l.replace(/\[(FIRST_)?NAME\]/g, name ? (/\[FIRST_NAME\]/.test(l) ? name.split(" ")[0] : name) : "(your name)"); });
          vPlan()[pt.id] = lines.join("\n");
        });
        renderVideo(); changed();
        $("v-msg").textContent = "Done. Change anything that doesn't sound like you, and fill in anything in brackets.";
        toast("Your 90 seconds is planned.");
      })
      .catch(function (e) { $("v-msg").textContent = e.message; })
      .then(function () { b.disabled = false; b.innerHTML = base; });
  });

  // The practice timer: moves through the four parts; 90 seconds to aim for, two minutes tops.
  var tStart = 0, tTick = null;
  function tickVideo() {
    var sec = (Date.now() - tStart) / 1000, whole = Math.floor(sec);
    $("v-clock").textContent = Math.floor(whole / 60) + ":" + ("0" + (whole % 60)).slice(-2);
    $("v-fill").style.width = Math.min(100, (sec / 120) * 100) + "%";
    var part = VIDEO.parts.filter(function (pt) { return sec >= pt.from && sec < pt.to; })[0];
    document.querySelectorAll(".v-part").forEach(function (c) { c.classList.toggle("live", !!part && c.getAttribute("data-part") === part.id); });
    var now = $("v-now"), tm = document.querySelector(".v-timer");
    tm.classList.toggle("over", sec >= 120); tm.classList.toggle("wrap", sec >= 90 && sec < 120);
    now.textContent = part ? "Now: " + part.title.toLowerCase() + " (" + part.time + ")" : sec < 120 ? "Time to wrap up. You're past 90 seconds." : "Over two minutes. Stop here, and cut a sentence or two before the next go.";
  }
  function timerStart() { tStart = Date.now(); clearInterval(tTick); tTick = setInterval(tickVideo, 200); $("v-go").textContent = "Stop"; tickVideo(); }
  function timerStop() {
    if (!tTick) return;
    clearInterval(tTick); tTick = null; $("v-go").textContent = "Start the timer";
    document.querySelectorAll(".v-part").forEach(function (c) { c.classList.remove("live"); });
    var sec = Math.round((Date.now() - tStart) / 1000);
    $("v-now").textContent = sec + " seconds. " + (sec < 60 ? "A bit short: there's room for more detail in your stories." : sec <= 120 ? "Nicely inside two minutes. Try it again without looking at your notes." : "That's over two minutes. Cut a sentence or two and try again.");
  }
  $("v-go").addEventListener("click", function () { if (tTick) timerStop(); else timerStart(); });

  // Practise on camera. Recorded in the browser and kept on the device: nothing is uploaded.
  var camStream = null, camRec = null, camChunks = [], camUrl = null;
  function camOff() {
    if (camRec && camRec.state === "recording") camRec.stop();
    if (camStream) camStream.getTracks().forEach(function (t) { t.stop(); });
    camStream = null; $("v-live").classList.add("hidden"); $("v-rec").classList.add("hidden"); $("v-cam-off").classList.add("hidden"); $("v-cam-on").classList.remove("hidden");
  }
  $("v-cam-off").addEventListener("click", function () { camOff(); $("v-cam-msg").textContent = "Camera off."; });
  window.addEventListener("pagehide", camOff);
  $("v-cam-on").addEventListener("click", function () {
    var msg = $("v-cam-msg");
    if (!navigator.mediaDevices || !window.MediaRecorder) { msg.textContent = "This browser can't record video. You can still practise with the timer."; return; }
    navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true }).then(function (st) {
      camStream = st; var v = $("v-live"); v.srcObject = st; v.classList.remove("hidden");
      $("v-cam-on").classList.add("hidden"); $("v-rec").classList.remove("hidden"); $("v-cam-off").classList.remove("hidden");
      v.onloadedmetadata = function () { msg.textContent = v.videoHeight > v.videoWidth ? "Turn your phone sideways: landscape plays properly on a laptop." : "Look at the lens, not at yourself. Press record when you're ready."; };
    }).catch(function () { msg.textContent = "We couldn't use your camera. Check your browser lets this page use it."; });
  });
  $("v-rec").addEventListener("click", function () {
    if (camRec && camRec.state === "recording") { camRec.stop(); return; }
    if (!camStream) return;
    camChunks = [];
    // mp4 first: it plays on iPhones, Windows and in email. webm is the fallback.
    var types = ["video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"];
    var type = types.filter(function (t) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t); })[0];
    camRec = type ? new MediaRecorder(camStream, { mimeType: type }) : new MediaRecorder(camStream);
    camRec.ondataavailable = function (e) { if (e.data && e.data.size) camChunks.push(e.data); };
    camRec.onstop = function () {
      timerStop();
      var mime = (camRec.mimeType || "video/webm").split(";")[0];
      if (camUrl) URL.revokeObjectURL(camUrl);
      camUrl = URL.createObjectURL(new Blob(camChunks, { type: mime }));
      var p = $("v-play"); p.src = camUrl; p.classList.remove("hidden");
      var sv = $("v-save"); sv.href = camUrl; sv.setAttribute("download", "my-90-seconds." + (mime.indexOf("mp4") > -1 ? "mp4" : "webm")); sv.classList.remove("hidden");
      $("v-del").classList.remove("hidden");
      $("v-rec").textContent = "● Record another take";
      $("v-cam-msg").textContent = "Watch it back. Take two is usually the best one.";
    };
    camRec.start(); timerStart();
    $("v-rec").textContent = "■ Stop recording";
    $("v-cam-msg").textContent = "Recording. The timer above shows where you should be.";
  });
  $("v-del").addEventListener("click", function () {
    if (camUrl) URL.revokeObjectURL(camUrl); camUrl = null;
    var p = $("v-play"); p.removeAttribute("src"); p.classList.add("hidden");
    $("v-save").classList.add("hidden"); $("v-del").classList.add("hidden");
    $("v-cam-msg").textContent = "Deleted.";
  });

  // ---- the journeys: Create your 1st CV, Update your CV, Back to work -------------------
  var findJourney = function (id) { return CFG.journeys.filter(function (j) { return j.id === id; })[0] || null; };
  function hero(h) {
    $("hero-kicker").textContent = h ? h.kicker : "Your master CV";
    $("hero-title").textContent = h ? h.title : "Let's build your CV.";
    $("hero-lede").textContent = h ? h.lede : "Pick the one that sounds like you. Talk or type your answers, and watch your CV build itself as you go. It saves as you work, and only you can see it.";
  }
  // Does the builder have anything real in it yet?
  function filled() {
    var some = function (arr, keys) { return (arr || []).some(function (r) { return keys.some(function (k) { return String(r[k] || "").trim(); }); }); };
    return !!(String(cv.personalStatement || "").trim() || some(cv.experience, ["title", "company", "about"]) || some(cv.education, ["qualification", "institution"]) ||
      some(cv.skills, ["skill"]) || (cv.behaviours || []).length || lineCount(cv.interests) || Object.keys(cv.statementAnswers || {}).length);
  }
  function guideCards() {
    STEPS.forEach(function (st) {
      var sec = document.querySelector('.step[data-key="' + st.key + '"]'), g = CFG.guide && CFG.guide[st.key];
      if (!sec || !g) return;
      var old = sec.querySelector(".guide-card"); if (old) old.remove();
      var card = el("aside", { class: "guide-card" }, [
        el("span", { class: "gc-kick", text: "From the guide · " + g.stop }),
        el("strong", { text: g.title }), el("p", { text: g.line }),
        el("a", { href: g.url, target: "_blank", rel: "noopener", text: g.linkText || "Read the full stop in The CV That Gets Read" }),
      ]);
      var h = sec.querySelector("h2"); h.parentNode.insertBefore(card, h.nextSibling);
    });
    // Journey extras: Skills from life (Back to work), Your first step after school (1st CV).
    document.querySelectorAll(".journey-extra").forEach(function (x) { x.remove(); });
    var ex = (J && J.extras) || {};
    Object.keys(ex).forEach(function (key) {
      var sec = document.querySelector('.step[data-key="' + key + '"]'), x = ex[key];
      if (!sec || !x) return;
      var kids = [el("strong", { text: x.title }), el("p", { text: x.line })];
      if (x.items && x.items.length) kids.push(el("ul", {}, x.items.map(function (t) { return el("li", { text: t }); })));
      (x.links || []).forEach(function (l) { kids.push(el("p", {}, [el("a", { href: l.url, target: "_blank", rel: "noopener", text: l.text })])); });
      var card = el("aside", { class: "guide-card journey-extra" }, kids);
      var h = sec.querySelector("h2"); h.parentNode.insertBefore(card, h.nextSibling);
    });
  }
  function applyJourney() {
    J = findJourney(cv.journey);
    hero(J && J.hero);
    $("jname").textContent = J ? J.name : "";
    document.querySelectorAll("[data-tip]").forEach(function (t) { var k = t.getAttribute("data-tip"); t.textContent = (J && J.tips && J.tips[k]) || (J && k === "video" && J.video) || ""; });
    var et = document.querySelector('p[data-tip="experience"]'); if (et) et.classList.toggle("first-cv", !!(J && (J.counts || J.breaks)));
    $("add-break").classList.toggle("hidden", !(J && J.id !== "first"));
    if (J && J.questions && J.questions.length) { QUESTIONS = J.questions; qi = 0; }
    buildSteps(); renderInterestIdeas(); renderVideo(); guideCards();
    if (loaded) renderQuestion();
    $("up-title").textContent = J && J.upload ? J.upload.title : "Upload a CV you've got";
    $("up-text").textContent = J && J.upload ? J.upload.text : "";
    $("st-upload").classList.toggle("lead", !!(J && J.upload && J.upload.lead));
    $("st-fresh").className = "btn " + (J && J.upload && J.upload.lead ? "btn-ghost" : "btn-primary");
  }
  function showChooser() {
    hero(null);
    ["builder", "starter", "ring-wrap", "pv-fab"].forEach(function (id) { $(id).classList.add("hidden"); });
    var grid = $("ch-grid"); grid.textContent = "";
    CFG.journeys.forEach(function (jj, i) {
      var c = el("button", { type: "button", class: "ch-card c" + (i + 1) + (cv.journey === jj.id ? " sel" : "") }, [
        el("span", { class: "ch-kick", text: jj.who }), el("strong", { text: jj.name }), el("span", { class: "ch-text", text: jj.card }),
        el("span", { class: "ch-go", text: cv.journey === jj.id ? "Carry on →" : "This is me →" }),
      ]);
      c.addEventListener("click", function () { pickJourney(jj.id); });
      grid.appendChild(c);
    });
    $("chooser").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function pickJourney(id) {
    var changedJourney = cv.journey !== id;
    cv.journey = id;
    if (changedJourney) queueSave();
    $("chooser").classList.add("hidden");
    applyJourney();
    openBuilder();
    go(1);
    if (!filled()) showStarter();
    if (changedJourney && loaded) toast("Got it: " + J.name + ".");
  }
  function openBuilder() {
    ["builder", "ring-wrap", "pv-fab"].forEach(function (id) { $(id).classList.remove("hidden"); });
    refreshProgress(); queuePreview(true);
  }
  $("jchange").addEventListener("click", showChooser);

  // ---- start from a CV you've got --------------------------------------------------
  var pendingImport = null;
  function showStarter() {
    $("st-choose").classList.remove("hidden"); $("st-result").classList.add("hidden");
    $("starter").classList.remove("hidden");
    $("up-msg").textContent = "";
    $("starter").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("jupload").addEventListener("click", showStarter);
  $("st-fresh").addEventListener("click", function () { $("starter").classList.add("hidden"); go(1); });
  $("up-file").addEventListener("change", function () {
    var f = $("up-file").files[0];
    $("up-name").textContent = f ? f.name : "Choose my CV";
    $("up-go").disabled = !f;
  });
  $("up-go").addEventListener("click", function () {
    var f = $("up-file").files[0], b = $("up-go"); if (!f) return;
    if (!/\.(docx|pdf)$/i.test(f.name)) { $("up-msg").textContent = "Please choose a Word file (.docx) or a PDF."; return; }
    b.disabled = true; b.textContent = "Reading your CV…"; $("up-msg").textContent = "This usually takes under a minute.";
    var fd = new FormData(); fd.append("cvFile", f); fd.append("journey", cv.journey || "");
    fetch("/api/master/import", { method: "POST", body: fd, credentials: "same-origin" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || "We couldn't read that CV. Please try again."); return j; }); })
      .then(function (j) {
        pendingImport = j;
        renderHealth($("health-import"), j.health, { fix: false });
        var scored = j.health.stops.length - 1;
        $("st-sum").textContent = j.health.greens + " of " + scored + " stops are green already. " + (j.health.reds ? "The ones in red are the place to start." : "A few tweaks and it'll really work for you.");
        $("st-replace").hidden = !filled();
        $("st-choose").classList.add("hidden"); $("st-result").classList.remove("hidden");
        $("starter").scrollIntoView({ behavior: "smooth", block: "start" });
      })
      .catch(function (e) { $("up-msg").textContent = e.message; })
      .then(function () { b.disabled = false; b.textContent = "Read my CV"; });
  });
  $("st-cancel").addEventListener("click", function () { pendingImport = null; $("st-result").classList.add("hidden"); $("st-choose").classList.remove("hidden"); });
  $("st-use").addEventListener("click", function () {
    if (!pendingImport) return;
    var im = pendingImport.cv, h = cv.header || (cv.header = {}), ih = im.header || {};
    cv.header.contacts = cv.header.contacts || {};
    // Keep anything they've already typed at the top; fill in the gaps.
    if (!h.name && ih.name) h.name = ih.name;
    ["email", "phone", "location"].forEach(function (k) { if (!h.contacts[k] && ih.contacts && ih.contacts[k]) h.contacts[k] = ih.contacts[k]; });
    if (!h.linkedin && ih.linkedin) h.linkedin = ih.linkedin;
    if (im.personalStatement) cv.personalStatement = im.personalStatement;
    ["experience", "skills", "education"].forEach(function (n) {
      if ((im[n] || []).length) cv[n] = im[n].map(function (r) { var o = {}; Object.keys(r).forEach(function (k) { o[k] = Array.isArray(r[k]) ? r[k].join("\n") : r[k]; }); return o; });
    });
    if ((im.interests || []).length) cv.interests = im.interests.slice();
    cv.healthStart = { greens: pendingImport.health.greens, at: new Date().toISOString().slice(0, 10) };
    HEALTH = pendingImport.health; pendingImport = null;
    fillFields(); checkStatement();
    ["experience", "skills", "education"].forEach(function (n) { if (!cv[n].length) cv[n].push(LISTS[n].blank()); renderList(n); });
    $("starter").classList.add("hidden");
    changed(); renderHealthAll();
    var firstBad = HEALTH.stops.filter(function (st) { return st.rag === "red"; })[0] || HEALTH.stops.filter(function (st) { return st.rag === "amber"; })[0];
    go(firstBad ? stepOf(firstBad.step) : 1);
    toast("Your CV is in the builder. Start with the ones in red."); confetti();
  });

  // ---- start -------------------------------------------------------------------
  fetch("/api/master", { credentials: "same-origin", cache: "no-store" })
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
      BANNED = j.banned || []; BEHAVIOURS = j.behaviours || []; writeUp = j.writeUp !== false; voice = j.voice !== false;
      CFG = j.journeys || CFG; HEALTH = j.health || null;
      if (!cv.behaviourProof || typeof cv.behaviourProof !== "object") cv.behaviourProof = {};
      // Older entries kept their points as arrays; the boxes edit them as lines.
      cv.experience.forEach(function (r) { ["responsibilities", "achievements"].forEach(function (k) { if (Array.isArray(r[k])) r[k] = r[k].join("\n"); }); });
      DESIGNS.fresh = j.freshTemplates || []; DESIGNS.word = j.designs || []; DESIGNS.designer = j.designerTemplates || [];
      if (!allDesigns().some(function (d) { return d.id === cv.design; })) cv.design = (DESIGNS.fresh[0] || {}).id || "modern-minimal";
      if (!voice) document.querySelectorAll(".voice-only").forEach(function (x) { x.classList.add("hidden"); });
      if (!writeUp) { $("write-stmt").classList.add("hidden"); document.querySelector(".ai-note").classList.add("hidden"); }
      // A microphone on every box that asks for words (not email, phone or links).
      [["f-name"], ["f-role"], ["f-loc"], ["f-profile"], ["f-interests", { lines: true }], ["f-sample"], ["v-role"], ["v-company"]].forEach(function (x) {
        var f = $(x[0]); if (!f || f.dataset.mic) return;
        f.dataset.mic = "1";
        f.parentNode.insertBefore(mic(f, f.tagName === "INPUT" ? "Say it" : "Say it instead", null, x[1]), f.nextSibling);
      });
      J = findJourney(cv.journey);
      if (J && J.questions) QUESTIONS = J.questions;
      buildSteps();
      bindFields();
      renderStyles();
      renderQuestion(); checkStatement();
      renderBehaviours(BEHAVIOURS);
      ["experience", "skills", "education"].forEach(function (n) { renderList(n); });
      renderDesigns();
      STEPS.forEach(function (s) { wasDone[s.key] = s.done(); });
      $("loading").classList.add("hidden");
      var hs = el("div", { class: "hstrip", id: "hstrip" }); $("jbar").parentNode.insertBefore(hs, $("steps"));
      status(j.saved ? "All saved" : "Saves as you go");
      loaded = true;
      var asked4 = (/[?&]journey=(first|update|back)\b/.exec(location.search) || [])[1];
      if (asked4) pickJourney(asked4);
      else if (!cv.journey) showChooser();
      else {
        applyJourney(); openBuilder();
        var m = /step-(\d)/.exec(location.hash);
        if (!filled()) showStarter();
        go(m ? Number(m[1]) : 1);
      }
      renderHealthAll();
      if (/[?&]deleted=1/.test(location.search)) say("Your CV has been deleted. You can start a new one whenever you like.", true);
    })
    .catch(function () { $("loading").textContent = "We couldn't load your CV just now. Please refresh the page."; });
})();
