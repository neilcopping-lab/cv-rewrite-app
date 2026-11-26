// Identify Your Options: the seven-step journey (Nov 2026).
// Calm pages, one step at a time, saved to the person's account as they go.
(function () {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const STEPS = ["Start", "How you work", "Your strengths", "What matters", "Your life", "Your options", "Pick and build"];
  const QUALS = [["", "Choose one"], ["none", "No qualifications yet"], ["gcse", "GCSEs"], ["level2", "A Level 2 qualification (like an NVQ 2)"], ["alevel", "A levels"], ["level3", "A Level 3 qualification (like a BTEC or NVQ 3)"], ["level4", "Level 4 (like an HNC)"], ["hnd", "HND or foundation degree"], ["degree", "A degree"], ["masters", "A master's degree"], ["phd", "A doctorate"]];
  let C = null, A = null, P = null, chosen = [], options = null, step = 1, saveTimer = null;

  async function api(url, opts = {}) {
    const r = await fetch(url, { credentials: "same-origin", cache: "no-store", ...opts });
    let d = {}; try { d = await r.json(); } catch (_) {}
    if (r.status === 401 && d.signIn) { location.href = d.signIn; throw new Error("Please sign in"); }
    if (!r.ok) { const e = new Error(d.error || "Something went wrong. Please try again."); e.data = d; throw e; }
    return d;
  }
  const post = (url, body) => api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });

  function savedNote(t) { const n = $("#saved"); if (n) n.textContent = t; }
  function save(now) {
    clearTimeout(saveTimer);
    const go = async () => {
      try { A.step = step; await post("/api/options/profile", { answers: A, private: P }); savedNote("Saved."); }
      catch (e) { savedNote("Not saved yet: " + e.message); }
    };
    if (now) return go();
    savedNote("Saving...");
    saveTimer = setTimeout(go, 900);
  }

  function stepsBar() {
    $("#steps").innerHTML = STEPS.map((s, i) => `<li><button type="button" data-go="${i + 1}" ${i + 1 === step ? 'aria-current="step"' : ""} class="${i + 1 < step ? "done" : ""}">${i + 1}. ${esc(s)}</button></li>`).join("");
  }
  function nav(back, next, nextLabel) {
    return `<div class="yo-nav">${back ? `<button class="yo-btn ghost" type="button" data-go="${step - 1}">Back</button>` : "<span></span>"}${next ? `<button class="yo-btn" type="button" id="next">${esc(nextLabel || "Next")}</button>` : ""}</div><p class="yo-saved" id="saved" role="status"></p>`;
  }
  function go(n) {
    step = Math.max(1, Math.min(7, n));
    stepsBar(); render(); save(true);
    window.scrollTo({ top: 0, behavior: "auto" });
    const h = $("#app h2"); if (h) { h.setAttribute("tabindex", "-1"); h.focus(); }
  }

  // ── Step 1: Start where you are ──────────────────────────────────────────
  function s1() {
    const off = C.aiLevel === "off";
    return `<section class="yo-panel"><h2>Start where you are</h2>
      <p class="lead">Got a CV, even an old one? Add it and we'll use it. No CV at all? That's fine too. Lots of people start here without one.</p>
      <div class="yo-q"><fieldset><legend>Do you have a CV?</legend>
        <label class="yo-opt"><input type="radio" name="sw" value="cv" ${A.startedWith !== "none" ? "checked" : ""}> Yes, I'll add it</label>
        <label class="yo-opt"><input type="radio" name="sw" value="none" ${A.startedWith === "none" ? "checked" : ""}> No, not yet</label></fieldset>
        <div id="cvBox" ${A.startedWith === "none" ? "hidden" : ""}>
          <p style="margin:12px 0 0"><button class="yo-btn ghost" type="button" id="useMaster">Use the CV in my account</button> <label class="yo-btn ghost" style="display:inline-block">Upload a Word or PDF file<input type="file" id="cvFile" accept=".pdf,.doc,.docx" hidden></label></p>
          <label class="qt" for="cvText" style="display:block;margin-top:12px">Or paste it here</label>
          <textarea id="cvText" rows="8">${esc(A.cvText)}</textarea>
          <p class="yo-private">If you upload a file, it's deleted as soon as we've read it.</p>
        </div></div>
      <div class="yo-q"><label class="qt" for="qual">Your highest qualification</label>
        <select id="qual">${QUALS.map(([v, l]) => `<option value="${v}" ${A.qualification === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
        <label class="qt" for="yrs" style="display:block;margin-top:12px">Roughly how many years have you worked, paid or unpaid?</label>
        <input type="text" inputmode="numeric" id="yrs" value="${A.experienceYears || ""}" placeholder="For example, 3">
        <p class="yo-private">This helps us suggest options at the right level for you. Caring and volunteering count.</p></div>
      <p class="yo-msg ok">Your AI setting is <b>${C.aiLevel === "full" ? "Full help" : C.aiLevel === "off" ? "Off" : "Essentials only"}</b>. ${off ? "You can still answer the questions and see your options. The CV writing is switched off, and we'll point you to our free CV guide instead." : "You can change it in My account at any time."} <a href="/account/me.html#ai">Change it</a></p>
      ${nav(false, true)}</section>`;
  }
  function bind1() {
    document.querySelectorAll('input[name="sw"]').forEach((r) => r.addEventListener("change", () => { A.startedWith = r.value; $("#cvBox").hidden = r.value === "none"; save(); }));
    $("#cvText").addEventListener("input", (e) => { A.cvText = e.target.value; save(); });
    $("#qual").addEventListener("change", (e) => { A.qualification = e.target.value; save(); });
    $("#yrs").addEventListener("input", (e) => { A.experienceYears = parseInt(e.target.value, 10) || 0; save(); });
    $("#useMaster").addEventListener("click", async () => {
      try { const d = await api("/api/master/text"); if (d && d.text) { A.cvText = d.text; $("#cvText").value = d.text; save(); savedNote("Your CV from My account is in the box."); } else savedNote("There's no CV in your account yet. Paste or upload one instead."); }
      catch (e) { savedNote(e.message); }
    });
    $("#cvFile").addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const fd = new FormData(); fd.append("cvFile", f); savedNote("Reading your CV...");
      try { const d = await api("/api/options/cv-text", { method: "POST", body: fd }); A.cvText = d.text; $("#cvText").value = d.text; save(); }
      catch (err) { savedNote(err.message); }
    });
  }

  // ── Step 2: How you work best ────────────────────────────────────────────
  function s2() {
    return `<section class="yo-panel"><h2>How you work best</h2>
      <p class="lead">No right or wrong answers. Just pick what sounds most like you.</p>
      ${C.workStyle.map((w) => `<div class="yo-q"><fieldset><legend>${esc(w.q)}</legend>${w.a.map((a) => `<label class="yo-opt"><input type="radio" name="ws_${w.id}" value="${esc(a)}" ${A.workStyle[w.id] === a ? "checked" : ""}> ${esc(a)}</label>`).join("")}</fieldset></div>`).join("")}
      <div class="yo-q"><label class="qt" for="hiwb">Anything else that helps you do your best work? (optional)</label>
        <textarea id="hiwb" placeholder="For example: a quiet space, written instructions, regular breaks, hours that fit around caring.">${esc(P.howIWorkBest)}</textarea>
        <p class="yo-private">Private. This is never sent to the AI and isn't used for matching. It only goes in your report if you choose.</p></div>
      ${nav(true, true)}</section>`;
  }
  function bind2() {
    C.workStyle.forEach((w) => document.querySelectorAll(`input[name="ws_${w.id}"]`).forEach((r) => r.addEventListener("change", () => { A.workStyle[w.id] = r.value; save(); })));
    $("#hiwb").addEventListener("input", (e) => { P.howIWorkBest = e.target.value; save(); });
  }

  // ── Step 3: What makes you good at stuff ─────────────────────────────────
  function s3() {
    const picked = new Map(A.traits.map((t) => [t.id, t]));
    return `<section class="yo-panel"><h2>What makes you good at stuff</h2>
      <p class="lead">Tick the ones that sound like you, as many as are true. For each one, tell us about one real time you did it. From work or from life, it all counts. No labels, no tests.</p>
      ${C.traitGroups.map((g) => `<div class="yo-group"><h3>${esc(g)}</h3>${C.traits.filter((t) => t.group === g).map((t) => {
        const p = picked.get(t.id);
        return `<div class="yo-trait ${p ? "on" : ""}" data-t="${t.id}"><label class="head"><input type="checkbox" ${p ? "checked" : ""}> ${esc(t.card)}</label>
          <p class="kinds">Often suits: ${esc(t.kinds)}</p>
          <div class="more"><label class="qt" for="ex_${t.id}">One real time you did this</label>
            <textarea id="ex_${t.id}" data-ex="${t.id}" placeholder="What happened, and what came of it?">${esc(p ? p.example : "")}</textarea>
            ${t.helps ? `<label class="qt" for="hp_${t.id}" style="display:block;margin-top:8px">What helps me (optional, private)</label><input type="text" id="hp_${t.id}" data-hp="${t.id}" placeholder="${esc(t.helps)}" value="${esc(P.helps[t.id] || "")}"><p class="yo-private">Private. Never sent to the AI.</p>` : ""}</div></div>`;
      }).join("")}</div>`).join("")}
      <p class="yo-msg" id="exWarn" hidden>Some of the strengths you ticked don't have an example yet. They'll only count once they do.</p>
      ${nav(true, true)}</section>`;
  }
  function bind3() {
    document.querySelectorAll(".yo-trait").forEach((box) => {
      const id = box.dataset.t;
      box.querySelector("input[type=checkbox]").addEventListener("change", (e) => {
        if (e.target.checked) { if (!A.traits.some((t) => t.id === id)) A.traits.push({ id, example: "" }); box.classList.add("on"); }
        else { A.traits = A.traits.filter((t) => t.id !== id); box.classList.remove("on"); }
        save();
      });
    });
    document.querySelectorAll("[data-ex]").forEach((ta) => ta.addEventListener("input", () => { const t = A.traits.find((x) => x.id === ta.dataset.ex); if (t) { t.example = ta.value; save(); } }));
    document.querySelectorAll("[data-hp]").forEach((inp) => inp.addEventListener("input", () => { if (inp.value.trim()) P.helps[inp.dataset.hp] = inp.value; else delete P.helps[inp.dataset.hp]; save(); }));
  }

  // ── Step 4: What matters to you ──────────────────────────────────────────
  function s4() {
    const musts = C.values.filter((v) => A.values[v.id] === "must");
    return `<section class="yo-panel"><h2>What matters to you</h2>
      <p class="lead">Put each card in a pile: Must have, Nice to have or Not bothered. Then pick your top five Must haves.</p>
      <div class="yo-q">${C.values.map((v) => `<div class="yo-val"><div><b>${esc(v.label)}</b><span>${esc(v.plain)}</span></div>
        <div class="yo-piles" role="group" aria-label="${esc(v.label)}">${[["must", "Must have"], ["nice", "Nice to have"], ["no", "Not bothered"]].map(([p, l]) => `<button type="button" data-v="${v.id}" data-p="${p}" aria-pressed="${A.values[v.id] === p}">${l}</button>`).join("")}</div></div>`).join("")}</div>
      <div class="yo-q"><p class="qt">Your top five Must haves, in order</p>
        ${musts.length ? `<p style="margin:4px 0 0;font-size:14.5px;color:#5B5F66">Tap them in order, most important first. Tap again to take one off.</p><div class="yo-top">${musts.map((v) => { const i = A.topValues.indexOf(v.id); return `<button type="button" data-top="${v.id}" class="${i >= 0 ? "picked" : ""}">${i >= 0 ? i + 1 + ". " : ""}${esc(v.label)}</button>`; }).join("")}</div>` : `<p style="margin:4px 0 0;color:#5B5F66">Put some cards in Must have first.</p>`}</div>
      <div class="yo-q"><label class="qt" for="goodDay">Describe a good day. What would you be doing, and who with?</label>
        <textarea id="goodDay">${esc(A.goodDay)}</textarea></div>
      ${nav(true, true)}</section>`;
  }
  function bind4() {
    document.querySelectorAll("[data-v]").forEach((b) => b.addEventListener("click", () => {
      A.values[b.dataset.v] = b.dataset.p;
      if (b.dataset.p !== "must") A.topValues = A.topValues.filter((x) => x !== b.dataset.v);
      save(); render();
    }));
    document.querySelectorAll("[data-top]").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.top;
      if (A.topValues.includes(id)) A.topValues = A.topValues.filter((x) => x !== id);
      else if (A.topValues.length < 5) A.topValues.push(id);
      save(); render();
    }));
    $("#goodDay").addEventListener("input", (e) => { A.goodDay = e.target.value; save(); });
  }

  // ── Step 5: Your life, not just your jobs ────────────────────────────────
  function s5() {
    const q = [["interests", "Your hobbies and interests", "What do you do when you get the chance? Be specific."], ["favourite", "Your favourite things to do", "The things that make time fly."], ["doing", "What you've been doing lately", "Caring, volunteering, running a home, learning something, getting through a tough time. It all counts as experience. You don't need to tell us about health unless you want to."], ["learn", "How you like to learn", "Courses, YouTube, trial and error, someone showing you?"]];
    return `<section class="yo-panel"><h2>Your life, not just your jobs</h2>
      <p class="lead">Employers hire people, not job histories. Tell us about the rest of your life too.</p>
      ${q.map(([k, l, h]) => `<div class="yo-q"><label class="qt" for="life_${k}">${l}</label><p style="margin:2px 0 0;font-size:14.5px;color:#5B5F66">${h}</p><textarea id="life_${k}" data-life="${k}">${esc(A.life[k])}</textarea></div>`).join("")}
      ${nav(true, true, "Show me my options")}</section>`;
  }
  function bind5() { document.querySelectorAll("[data-life]").forEach((t) => t.addEventListener("input", () => { A.life[t.dataset.life] = t.value; save(); })); }

  // ── Step 6: Your options ─────────────────────────────────────────────────
  function s6() {
    if (!C.data.ready) return `<section class="yo-panel"><h2>Your options</h2><p class="yo-msg">The career options aren't ready yet. We're still loading the official UK job data, so please come back soon. Everything you've told us is saved.</p>${nav(true, false)}</section>`;
    if (!options) return `<section class="yo-panel"><h2>Your options</h2><p>Matching you against ${C.data.count} real UK occupations...</p>${nav(true, false)}</section>`;
    if (options.error) return `<section class="yo-panel"><h2>Your options</h2><p class="yo-msg">${esc(options.error)}</p>${nav(true, false)}</section>`;
    return `<section class="yo-panel"><h2>Your options</h2>
      <p class="lead">These are the occupations that fit you best right now, from Skills England's official list. Each one says why. It's a starting point, not a verdict.</p>
      ${options.options.length ? options.options.map((o) => `<div class="yo-card"><div class="fit">${o.fit}%<small>fit</small></div>
        <h3>${esc(o.title)}</h3><p class="meta">${esc([o.route, o.levelNote].filter(Boolean).join(" · "))}</p>
        ${o.overview ? `<p style="margin:6px 0 0">${esc(o.overview)}</p>` : ""}
        ${o.jobTitles.length ? `<p class="meta" style="margin-top:6px">Job titles you'll see: ${esc(o.jobTitles.join(", "))}</p>` : ""}
        <ul>${o.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
        <p style="margin:12px 0 0"><button class="yo-btn" type="button" data-pick="${esc(o.code)}">Pick this one</button></p></div>`).join("") : `<p class="yo-msg">We couldn't find a close match yet. Try adding examples to more of your strengths, or sorting more values cards.</p>`}
      ${nav(true, false)}</section>`;
  }
  async function bind6() {
    if (C.data.ready && !options) {
      try { options = await post("/api/options/match"); } catch (e) { options = { error: e.message }; }
      render();
      return;
    }
    document.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => { A.pick = b.dataset.pick; go(7); }));
  }

  // ── Step 7: Pick and build ───────────────────────────────────────────────
  let rep = null, repFor = null;
  function s7() {
    if (!A.pick) return `<section class="yo-panel"><h2>Pick and build</h2><p class="yo-msg">Pick one of your options first.</p>${nav(true, false)}</section>`;
    if (repFor !== A.pick || !rep) return `<section class="yo-panel"><h2>Your Options Report</h2><p>Putting your report together...</p></section>`;
    if (rep.error) return `<section class="yo-panel"><h2>Your Options Report</h2><p class="yo-msg">${esc(rep.error)}</p>${nav(true, false)}</section>`;
    const r = rep.report, off = rep.aiLevel === "off";
    return `<section class="yo-panel yo-report"><h2>Your Options Report: ${esc(r.role.title)}</h2>
      <p class="lead">Just for you. This report never goes to an employer. Your CV is a separate document.</p>
      <h3>Your match: ${r.match.percent}%</h3><div class="bar"><i style="width:${r.match.percent}%"></i></div>
      <p style="font-size:14.5px;color:#5B5F66">${esc(r.match.how)} Clearly backed up: ${r.match.strong}. Partly: ${r.match.partial}. Not yet: ${r.match.gaps}.</p>
      ${r.strengths.length ? `<h3>What you already bring</h3><ul>${r.strengths.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
      ${r.gaps.length ? `<h3>Your gaps, and how to close them</h3>${r.gaps.map((g) => `<div class="yo-gap"><b>${esc(g.gap)}</b>
        ${g.transferable.length ? `<p style="margin:2px 0;font-size:15px">Strengths that show you could learn this: ${esc(g.transferable.join("; "))}</p>` : ""}
        ${g.answer ? `<p style="margin:8px 0 0"><b style="display:inline">If they ask about it:</b> ${esc(g.answer)}</p>` : ""}
        ${g.nextStep ? `<p style="margin:4px 0 0"><b style="display:inline">Next step:</b> ${esc(g.nextStep)}</p>` : ""}</div>`).join("")}` : ""}
      ${r.ideas && r.ideas.length ? `<div class="yo-ideas"><b>Ways to close these gaps</b><ul>${r.ideas.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>` : ""}
      ${r.plan.length ? `<h3>Your plan</h3><ol>${r.plan.map((p) => `<li>${esc(p)}</li>`).join("")}</ol>` : ""}
      ${rep.aiLevel !== "full" ? `<p class="yo-msg ok">Want help answering interview questions about these gaps, and a step-by-step plan? That's a Full help extra. <a href="/account/me.html#ai">Switch on Full help</a></p>` : ""}
      ${r.coachingError ? `<p class="yo-msg">${esc(r.coachingError)}</p>` : ""}
      <div class="yo-q"><label class="yo-opt"><input type="checkbox" id="incl" ${P.include ? "checked" : ""}> Include my private "How you work best" notes in this report</label>
        ${r.howYouWorkBest ? `<h3>How you work best</h3>${r.howYouWorkBest.notes ? `<p>${esc(r.howYouWorkBest.notes)}</p>` : ""}${r.howYouWorkBest.helps.length ? `<ul>${r.howYouWorkBest.helps.map((h) => `<li>${esc(h.strength)}: ${esc(h.helps)}</li>`).join("")}</ul>` : ""}` : ""}</div>
      <h3>Your next step</h3><p>${esc(r.nextStep)}</p>
      ${r.aiNotice ? `<p class="yo-ai"><b>${esc(r.aiNotice)}</b></p>` : ""}
      <p style="font-size:13px;color:#5B5F66">${esc(r.sources)}</p>
      <div class="yo-nav"><button class="yo-btn ghost" type="button" data-go="6">Back to my options</button>
        <span><button class="yo-btn ghost" type="button" id="print">Print or save as PDF</button>
        ${off ? `<a class="yo-btn" href="https://the-common-people.com/guide-cv.html">Read the free CV guide</a>` : `<button class="yo-btn" type="button" id="build">Build my CV for this role</button>`}</span></div>
      <p class="yo-saved" id="saved" role="status"></p></section>`;
  }
  async function bind7() {
    if (A.pick && (repFor !== A.pick || !rep)) {
      repFor = A.pick;
      try { rep = await post("/api/options/report", { code: A.pick }); } catch (e) { rep = { error: e.message }; }
      render();
      return;
    }
    const incl = $("#incl");
    if (incl) incl.addEventListener("change", async () => { P.include = incl.checked; await save(true); rep = null; render(); });
    const pr = $("#print"); if (pr) pr.addEventListener("click", () => window.print());
    const b = $("#build");
    if (b) b.addEventListener("click", async () => {
      b.disabled = true; savedNote("Setting up your CV for this role...");
      try { const d = await post("/api/options/build-cv", { code: A.pick }); location.href = d.url; }
      catch (e) { b.disabled = false; savedNote(e.message); }
    });
  }

  const VIEWS = [null, [s1, bind1], [s2, bind2], [s3, bind3], [s4, bind4], [s5, bind5], [s6, bind6], [s7, bind7]];
  function render() {
    const [view, bind] = VIEWS[step];
    $("#app").innerHTML = view();
    bind();
    const n = $("#next");
    if (n) n.addEventListener("click", () => {
      if (step === 3) { const missing = A.traits.some((t) => String(t.example || "").trim().length < 10); const w = $("#exWarn"); if (missing && w && w.hidden) { w.hidden = false; return; } }
      if (step === 5) options = null;
      go(step + 1);
    });
  }
  document.addEventListener("click", (e) => { const g = e.target.closest("[data-go]"); if (g) { e.preventDefault(); if (+g.dataset.go === 6) options = options || null; go(+g.dataset.go); } });

  (async function init() {
    try {
      C = await api("/api/options/cards");
      if (!C.signedIn) { location.href = "/account/?next=" + encodeURIComponent("/options-app.html"); return; }
      const p = await api("/api/options/profile");
      A = p.answers; P = p.private; chosen = p.chosen || [];
      A.pick = chosen[0] ? chosen[0].code : undefined;
      step = A.step || 1;
      const a = C.data.attribution || {};
      $("#attr").textContent = [a.skillsEngland, a.onet].filter(Boolean).join(" ");
      stepsBar(); render();
    } catch (e) { $("#app").innerHTML = `<p class="yo-msg">${esc(e.message)}</p>`; }
  })();
})();
