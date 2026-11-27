// Beyond the Obvious: the seven-step journey (Nov 2026).
// Calm pages, one step at a time, saved to the person's account as they go.
(function () {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const STEPS = ["Start", "How you work", "Your strengths", "What matters", "Your life", "Your options", "Your CVs"];
  const QUALS = [["", "Choose one"], ["none", "No qualifications yet"], ["gcse", "GCSEs"], ["level2", "A Level 2 qualification (like an NVQ 2)"], ["alevel", "A levels"], ["level3", "A Level 3 qualification (like a BTEC or NVQ 3)"], ["level4", "Level 4 (like an HNC)"], ["hnd", "HND or foundation degree"], ["degree", "A degree"], ["masters", "A master's degree"], ["phd", "A doctorate"]];
  let C = null, A = null, P = null, chosen = [], options = null, step = 1, saveTimer = null;
  let beyond = null, beyondShown = 1, extra = null;

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

  // ── Shared bits: one calm line per step, "Why we ask this", and a record button ──
  const CALM = `<p class="yo-calm">Everything you tell us here is yours. You choose what goes in your report.</p>`;
  const CONSENT_TEXT = "Keep my notes. If I mention my health, a disability or anything that helps me at work in these boxes, I'm happy for Comquat to keep it, so I can choose to add it to my report. It's never sent to the AI or used to suggest jobs, and I can untick this at any time to delete it.";
  const consentOn = () => !!(P.consent && P.consent.given);
  const consentBox = () => `<label class="yo-consent"><input type="checkbox" data-consent ${consentOn() ? "checked" : ""}> <span>${esc(CONSENT_TEXT)}</span></label>${consentOn() ? "" : '<p class="yo-consent-note">Tick the box above to use these notes. They\'re optional.</p>'}`;
  function bindConsent() {
    document.querySelectorAll("[data-consent]").forEach((c) => c.addEventListener("change", async () => {
      if (c.checked) P.consent = { given: true, at: new Date().toISOString(), version: "2026-11-27" };
      else { P.consent = { given: false }; P.howIWorkBest = ""; P.helps = {}; P.include = false; }
      await save(true); render();
      if (!c.checked) savedNote("Your notes have been deleted.");
    }));
  }
  const why = (t) => `<details class="yo-why"><summary>Why we ask this</summary><p>${t}</p></details>`;
  const canTalk = () => C.aiLevel !== "off" && !!(navigator.mediaDevices && window.MediaRecorder);
  const micBtn = (forId) => canTalk() ? `<span class="yo-mic-wrap"><button type="button" class="yo-mic" data-mic="${forId}"><span aria-hidden="true">&#127897;</span> Record your answer</button><span class="yo-mic-st" role="status"></span></span>` : "";
  function bindMics() {
    document.querySelectorAll("[data-mic]").forEach((btn) => {
      const ta = document.getElementById(btn.dataset.mic), st = btn.nextElementSibling;
      let rec = null, stream = null, chunks = [];
      btn.addEventListener("click", async () => {
        if (rec && rec.state === "recording") { rec.stop(); return; }
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
        catch (_) { st.textContent = "We couldn't use your microphone. You can type instead."; return; }
        chunks = [];
        const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
        rec = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
        rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          btn.classList.remove("rec"); btn.innerHTML = '<span aria-hidden="true">&#127897;</span> Record your answer'; btn.disabled = true;
          st.textContent = "Turning that into words...";
          const mime = (rec.mimeType || "audio/webm").split(";")[0];
          const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";
          const fd = new FormData(); fd.append("audio", new Blob(chunks, { type: mime }), "answer." + ext);
          try {
            const d = await api("/api/transcribe", { method: "POST", body: fd });
            const cur = ta.value.trim(); ta.value = (cur ? cur + " " : "") + String(d.text || "").trim();
            ta.dispatchEvent(new Event("input", { bubbles: true }));
            st.textContent = "Got it. Have a read and change anything we misheard. The recording itself has been deleted.";
          } catch (e) { st.textContent = e.message + " You can type instead."; }
          btn.disabled = false;
        };
        rec.start(); btn.classList.add("rec"); btn.innerHTML = '<span aria-hidden="true">&#9632;</span> Stop recording'; st.textContent = "Listening. Press stop when you're done.";
      });
    });
  }

  // ── Step 2: How you work best (a story first, then quick choices) ────────
  function s2() {
    const heardIds = new Set((A.heard || []).map((h) => h.id));
    return `<section class="yo-panel"><h2>How you work best</h2>
      ${CALM}
      <div class="yo-q yo-story"><label class="qt" for="story">Tell us about a time things went really well, at work or anywhere else. Where were you, who was around, and what were you doing?</label>
        <textarea id="story" rows="5" placeholder="For example: a busy Saturday at the garden centre, helping customers and getting the deliveries sorted.">${esc(A.story)}</textarea>
        <div class="yo-row">${micBtn("story")}<button type="button" class="yo-btn ghost small" id="hear">See what we heard</button></div>
        <div id="heardBox">${heardChips()}</div></div>
      ${why("So we can suggest jobs where you'd feel at home. Your answers only shape the options we show you. It isn't a test, there are no right or wrong answers, and we never decide anything about you from it.")}
      <h3 class="yo-sub">Prefer to just tap? Pick the one that sounds more like you.</h3>
      ${C.workStyle.map((w) => `<div class="yo-q"><fieldset><legend>${esc(w.q)}${heardIds.has(w.id) ? ' <span class="yo-from">from your story</span>' : ""}</legend><div class="yo-pics">${w.a.map((ans, i) => `<label class="yo-pic ${A.workStyle[w.id] === ans ? "on" : ""}"><input type="radio" name="ws_${w.id}" value="${esc(ans)}" ${A.workStyle[w.id] === ans ? "checked" : ""}><span class="em" aria-hidden="true">${w.pic ? w.pic[i] : ""}</span><span>${esc(w.show ? w.show[i] : ans)}</span></label>`).join("")}</div></fieldset>
        <details class="yo-more" ${A.workNotes[w.id] ? "open" : ""}><summary>Tell us why (optional)</summary><textarea id="wn_${w.id}" data-wn="${w.id}" rows="2">${esc(A.workNotes[w.id] || "")}</textarea>${micBtn("wn_" + w.id)}</details></div>`).join("")}
      <div class="yo-q"><label class="qt" for="hiwb">Anything that helps you have a good day at work? (optional)</label>
        ${consentBox()}
        <textarea id="hiwb" ${consentOn() ? "" : "disabled"} placeholder="For example: a quiet space, written instructions, regular breaks, hours that fit around family.">${esc(P.howIWorkBest)}</textarea>${consentOn() ? micBtn("hiwb") : ""}</div>
      ${nav(true, true)}</section>`;
  }
  function heardChips() {
    const h = A.heard || [];
    if (!h.length) return "";
    return `<p class="yo-heard-t">Here's what we heard. Tap any that aren't right to take them off.</p><div class="yo-chips">${h.map((x) => `<button type="button" class="yo-chip ${x.off ? "off" : ""}" data-chip="${x.id}" aria-pressed="${!x.off}">${x.off ? "" : "&#10003; "}${esc(x.label)}</button>`).join("")}</div>`;
  }
  function bind2() {
    $("#story").addEventListener("input", (e) => { A.story = e.target.value; save(); });
    $("#hear").addEventListener("click", async () => {
      try {
        const d = await post("/api/options/heard", { story: A.story });
        A.heard = d.heard;
        d.heard.forEach((h) => { A.workStyle[h.id] = h.answer; });
        save(); render();
        if (!d.heard.length) savedNote("We couldn't pick anything out yet. Try adding a bit more, or just tap your answers below.");
      } catch (e) { savedNote(e.message); }
    });
    document.querySelectorAll("[data-chip]").forEach((b) => b.addEventListener("click", () => {
      const h = A.heard.find((x) => x.id === b.dataset.chip); if (!h) return;
      h.off = !h.off;
      if (h.off && A.workStyle[h.id] === h.answer) delete A.workStyle[h.id]; else if (!h.off) A.workStyle[h.id] = h.answer;
      save(); render();
    }));
    C.workStyle.forEach((w) => document.querySelectorAll(`input[name="ws_${w.id}"]`).forEach((r) => r.addEventListener("change", () => { A.workStyle[w.id] = r.value; save(); render(); })));
    document.querySelectorAll("[data-wn]").forEach((t) => t.addEventListener("input", () => { if (t.value.trim()) A.workNotes[t.dataset.wn] = t.value; else delete A.workNotes[t.dataset.wn]; save(); }));
    $("#hiwb").addEventListener("input", (e) => { P.howIWorkBest = e.target.value; save(); });
    bindConsent(); bindMics();
  }

  // ── Step 3: What would your mates say? ───────────────────────────────────
  function s3() {
    const picked = new Map(A.traits.map((t) => [t.id, t]));
    return `<section class="yo-panel"><h2>What would the people who know you best say you're brilliant at?</h2>
      ${CALM}
      <p class="lead">Tick the ones they'd say about you, as many as are true. Then tell us about a time it happened. From work or from life, it all counts.</p>
      ${why("The strengths you pick, and the moments you share, are matched against what real jobs need. They also give you true examples to use on your CV and in interviews.")}
      <details class="yo-more"><summary>About the "What helps you" boxes</summary>${consentBox()}</details>
      ${C.traitGroups.map((g) => `<div class="yo-group"><h3>${esc(g)}</h3>${C.traits.filter((t) => t.group === g).map((t) => {
        const p = picked.get(t.id);
        return `<div class="yo-trait ${p ? "on" : ""}" data-t="${t.id}"><label class="head"><input type="checkbox" ${p ? "checked" : ""}> &ldquo;${esc(t.said || t.card)}&rdquo;</label>
          <p class="kinds">Often suits: ${esc(t.kinds)}</p>
          <div class="more"><label class="qt" for="ex_${t.id}">Tell us about a time that happened</label>
            <textarea id="ex_${t.id}" data-ex="${t.id}" placeholder="What happened, and what came of it?">${esc(p ? p.example : "")}</textarea>${micBtn("ex_" + t.id)}
            ${t.helps ? `<label class="qt" for="hp_${t.id}" style="display:block;margin-top:10px">What helps you have a day like that? (optional)</label><input type="text" id="hp_${t.id}" data-hp="${t.id}" ${consentOn() ? "" : 'disabled title="Tick Keep my notes at the top of this step to use this box"'} placeholder="${esc(t.helps)}" value="${esc(P.helps[t.id] || "")}">` : ""}</div></div>`;
      }).join("")}</div>`).join("")}
      <p class="yo-msg" id="exWarn" hidden>Some of the strengths you ticked don't have a story yet. They'll only count once they do.</p>
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
    bindConsent(); bindMics();
  }

  // ── Step 4: What matters to you ──────────────────────────────────────────
  function s4() {
    const musts = C.values.filter((v) => A.values[v.id] === "must");
    return `<section class="yo-panel"><h2>What matters to you</h2>
      ${CALM}
      <p class="lead">Put each card in a pile: Must have, Nice to have or Not bothered. Then pick your top five Must haves.</p>
      ${why("So the jobs you'd actually enjoy come to the top of your list, not just the ones you could do.")}
      <div class="yo-q">${C.values.map((v) => `<div class="yo-val"><div><b>${esc(v.label)}</b><span>${esc(v.plain)}</span></div>
        <div class="yo-piles" role="group" aria-label="${esc(v.label)}">${[["must", "Must have"], ["nice", "Nice to have"], ["no", "Not bothered"]].map(([p, l]) => `<button type="button" data-v="${v.id}" data-p="${p}" aria-pressed="${A.values[v.id] === p}">${l}</button>`).join("")}</div></div>`).join("")}</div>
      <div class="yo-q"><p class="qt">Your top five Must haves, in order</p>
        ${musts.length ? `<p style="margin:4px 0 0;font-size:14.5px;color:#5B5F66">Tap them in order, most important first. Tap again to take one off.</p><div class="yo-top">${musts.map((v) => { const i = A.topValues.indexOf(v.id); return `<button type="button" data-top="${v.id}" class="${i >= 0 ? "picked" : ""}">${i >= 0 ? i + 1 + ". " : ""}${esc(v.label)}</button>`; }).join("")}</div>` : `<p style="margin:4px 0 0;color:#5B5F66">Put some cards in Must have first.</p>`}</div>
      <div class="yo-q"><label class="qt" for="goodDay">Describe a good day. What would you be doing, and who with?</label>
        <textarea id="goodDay">${esc(A.goodDay)}</textarea>${micBtn("goodDay")}</div>
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
    bindMics();
  }

  // ── Step 5: Your life, not just your jobs ────────────────────────────────
  function s5() {
    const q = [["interests", "Your hobbies and interests", "What do you do when you get the chance? Be specific."], ["favourite", "Your favourite things to do", "The things that make time fly."], ["doing", "What you've been up to lately", "Caring, volunteering, running a home, learning something new. It all counts as experience. Share as much or as little as you like."], ["learn", "How you like to learn", "Courses, YouTube, trial and error, someone showing you?"]];
    return `<section class="yo-panel"><h2>Your life, not just your jobs</h2>
      ${CALM}
      <p class="lead">Employers hire people, not job histories. Tell us about the rest of your life too.</p>
      ${why("Lots of real skills come from outside work. This helps us spot them and count them.")}
      ${q.map(([k, l, h]) => `<div class="yo-q"><label class="qt" for="life_${k}">${l}</label><p style="margin:2px 0 0;font-size:14.5px;color:#5B5F66">${h}</p><textarea id="life_${k}" data-life="${k}">${esc(A.life[k])}</textarea>${micBtn("life_" + k)}</div>`).join("")}
      <div class="yo-q yo-mix"><label class="qt" for="life_mix">Mix your worlds (optional)</label>
        <p style="margin:2px 0 0;font-size:14.5px;color:#5B5F66">Are there two things you love or care about that don't usually go together? Art and health. Gardening and helping people. History and teaching. Gaming and fairness. Tell us, and we'll look for work that brings them together.</p>
        <textarea id="life_mix" data-life="mix" rows="3" placeholder="For example: I paint, and I'd love to use it to help people feel better.">${esc(A.life.mix || "")}</textarea>${micBtn("life_mix")}</div>
      ${nav(true, true, "Show me my options")}</section>`;
  }
  function bind5() { document.querySelectorAll("[data-life]").forEach((t) => t.addEventListener("input", () => { A.life[t.dataset.life] = t.value; save(); })); bindMics(); }

  // ── Step 6: Your options ─────────────────────────────────────────────────
  // Two parts: matches from the official Skills England data, and Beyond the
  // Obvious, our hand-checked list of roles people don't often think of.
  // The second part works even before the official data is in.
  function seCard(o) {
    return `<div class="yo-card"><div class="fit">${o.fit}%<small>fit</small></div>
        <h3>${esc(o.title)}</h3><p class="meta">${esc([o.route, o.levelNote].filter(Boolean).join(" · "))}</p>
        ${o.overview ? `<p style="margin:6px 0 0">${esc(o.overview)}</p>` : ""}
        ${o.jobTitles.length ? `<p class="meta" style="margin-top:6px">Job titles you'll see: ${esc(o.jobTitles.join(", "))}</p>` : ""}
        <ul>${o.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
        <p style="margin:12px 0 0"><button class="yo-btn" type="button" data-pick="${esc(o.code)}">Take a closer look</button></p></div>`;
  }
  function btoCard(o) {
    return `<div class="yo-card yo-bto"><span class="yo-tag">Beyond the obvious</span>
        <h3>${esc(o.title)}</h3>
        ${o.aka.length ? `<p class="meta">Also called: ${esc(o.aka.join(", "))}</p>` : ""}
        <p style="margin:6px 0 0">${esc(o.what)}</p>
        <p class="meta" style="margin-top:6px"><b>Why it's easy to miss:</b> ${esc(o.whyMissed)}</p>
        ${o.reasons.length ? `<ul>${o.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
        ${o.worthKnowing.length ? `<p class="yo-worth"><b>Worth knowing:</b> ${esc(o.worthKnowing[0])}</p>` : ""}
        <p style="margin:12px 0 0"><button class="yo-btn" type="button" data-pick="${esc(o.code)}">Take a closer look</button></p></div>`;
  }
  function beyondPart() {
    if (!beyond) return `<p>Looking for roles you might not have thought of...</p>`;
    if (beyond.error) return `<p class="yo-msg">${esc(beyond.error)}</p>`;
    const all = beyond.batches, shown = all.slice(0, beyondShown);
    const more = beyondShown < all.length;
    return `${shown.map((b, i) => `${i ? `<h3 class="yo-sub">Something different</h3>` : ""}${b.map(btoCard).join("")}`).join("")}
      <p class="yo-row-btns">${more ? `<button class="yo-btn ghost" type="button" id="btoMore">Show me something different</button>` : `<span class="yo-done-note">That's every role in our list for now. We add more as we check them.</span>`}</p>`;
  }
  function s6() {
    const head = `<h2>Your options</h2>`;
    const bto = `<section class="yo-beyond" aria-labelledby="btoH"><h3 class="yo-sub" id="btoH">Roles you might not have thought of</h3>
      <p class="lead">Some of the best jobs never come up in a careers chat, because they're new, small or sit between two worlds. These come from our hand-checked list, and every one links to where we found it.</p>
      ${beyondPart()}</section>`;
    if (!C.data.ready) return `<section class="yo-panel">${head}<p class="yo-msg">Your matches from the official UK job data aren't ready yet, because we're still loading it. Everything you've told us is saved. In the meantime, here are some roles you might not have thought of.</p>${bto}${nav(true, false)}</section>`;
    if (!options) return `<section class="yo-panel">${head}<p>Matching you against ${C.data.count} real UK occupations...</p>${nav(true, false)}</section>`;
    if (options.error) return `<section class="yo-panel">${head}<p class="yo-msg">${esc(options.error)}</p>${bto}${nav(true, false)}</section>`;
    return `<section class="yo-panel">${head}
      <p class="lead">Here are some options that may be a good fit for you, from Skills England's list of real UK jobs. Each one says why. They're ideas to explore, not a verdict. Pick any you'd like to look at more closely.</p>
      ${options.options.length ? options.options.map(seCard).join("") : `<p class="yo-msg">We couldn't find a close match yet. Try adding examples to more of your strengths, or sorting more values cards.</p>`}
      ${extra && extra.options ? `<h3 class="yo-sub">Something different</h3><p style="margin:0;font-size:15px;color:#5B5F66">From other areas of work, so you can see a wider spread.</p>${extra.options.length ? extra.options.map(seCard).join("") : `<p class="yo-msg">We've shown you the closest matches across every area of work.</p>`}` : ""}
      ${extra && extra.error ? `<p class="yo-msg">${esc(extra.error)}</p>` : ""}
      ${options.options.length && !extra ? `<p class="yo-row-btns"><button class="yo-btn ghost" type="button" id="seMore">Show me something different</button></p>` : ""}
      ${bto}
      ${nav(true, false)}</section>`;
  }
  async function bind6() {
    if (!beyond) {
      try { beyond = await post("/api/options/beyond"); } catch (e) { beyond = { error: e.message }; }
      render(); return;
    }
    if (C.data.ready && !options) {
      try { options = await post("/api/options/match"); } catch (e) { options = { error: e.message }; }
      render(); return;
    }
    document.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => { A.pick = b.dataset.pick; go(7); }));
    const bm = $("#btoMore");
    if (bm) bm.addEventListener("click", () => {
      beyondShown++; render();
      const hs = document.querySelectorAll(".yo-beyond h3.yo-sub"); const h = hs[hs.length - 1];
      if (h) { h.setAttribute("tabindex", "-1"); h.focus(); }
    });
    const sm = $("#seMore");
    if (sm) sm.addEventListener("click", async () => {
      sm.disabled = true; sm.textContent = "Looking further afield...";
      try { extra = await post("/api/options/match", { different: true, seen: options.options.map((o) => o.code) }); } catch (e) { extra = { error: e.message }; }
      render();
    });
  }

  // ── Step 7: Pick and build ───────────────────────────────────────────────
  let rep = null, repFor = null;
  function s7() {
    if (!A.pick) return `<section class="yo-panel"><h2>Your CVs</h2><p class="yo-msg">Choose one of your options first.</p>${nav(true, false)}</section>`;
    if (repFor !== A.pick || !rep) return `<section class="yo-panel"><h2>Your Options Report</h2><p>Putting your report together...</p></section>`;
    if (rep.error) return `<section class="yo-panel"><h2>Your Options Report</h2><p class="yo-msg">${esc(rep.error)}</p>${nav(true, false)}</section>`;
    const r = rep.report, off = rep.aiLevel === "off";
    if (r.kind === "beyond") return s7beyond(r, off);
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
      <div class="yo-q" ${consentOn() ? "" : "hidden"}><label class="yo-opt"><input type="checkbox" id="incl" ${P.include ? "checked" : ""}> Include my "good day at work" notes in this report</label>
        ${r.howYouWorkBest ? `<h3>How you work best</h3>${r.howYouWorkBest.notes ? `<p>${esc(r.howYouWorkBest.notes)}</p>` : ""}${r.howYouWorkBest.helps.length ? `<ul>${r.howYouWorkBest.helps.map((h) => `<li>${esc(h.strength)}: ${esc(h.helps)}</li>`).join("")}</ul>` : ""}` : ""}</div>
      <h3>Your next step</h3><p>${esc(r.nextStep)}</p>
      ${r.aiNotice ? `<p class="yo-ai"><b>${esc(r.aiNotice)}</b></p>` : ""}
      <p style="font-size:13px;color:#5B5F66">${esc(r.sources)}</p>
      <div class="yo-nav"><button class="yo-btn ghost" type="button" data-go="6">See my other options</button>
        <span><button class="yo-btn ghost" type="button" id="print">Print or save as PDF</button>
        ${off ? `<a class="yo-btn" href="https://the-common-people.com/guide-cv.html">Read the free CV guide</a>` : `<button class="yo-btn" type="button" id="build">Create a CV for this option</button>`}</span></div>
      <p class="yo-saved" id="saved" role="status"></p></section>`;
  }
  const links = (list) => `<ul>${list.map((n) => `<li><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.name)}<span class="sr-only"> (opens in a new tab)</span></a></li>`).join("")}</ul>`;
  function s7beyond(r, off) {
    return `<section class="yo-panel yo-report">
      <p class="yo-tag-line"><span class="yo-tag">Beyond the obvious</span></p>
      <h2>Your Options Report: ${esc(r.role.title)}</h2>
      <p class="lead">Just for you. This report never goes to an employer. Your CV is a separate document.</p>
      ${r.role.aka.length ? `<p class="meta">Also called: ${esc(r.role.aka.join(", "))}</p>` : ""}
      <h3>What the work is</h3><p>${esc(r.what)}</p>
      <p><b>Why it's easy to miss:</b> ${esc(r.whyMissed)}</p>
      ${r.reasons.length ? `<h3>Why it might suit you</h3><ul>${r.reasons.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      <p class="yo-msg ok">${esc(r.noMatchNote)}</p>
      <h3>How people get in</h3><ul>${r.waysIn.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      ${r.worthKnowing.length ? `<h3>Worth knowing first</h3><ul>${r.worthKnowing.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${r.networks.length ? `<h3>Who to talk to</h3>${links(r.networks)}` : ""}
      <h3>Your next steps</h3><ol>${r.nextSteps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
      <div class="yo-q" ${consentOn() ? "" : "hidden"}><label class="yo-opt"><input type="checkbox" id="incl" ${P.include ? "checked" : ""}> Include my "good day at work" notes in this report</label>
        ${r.howYouWorkBest ? `<h3>How you work best</h3>${r.howYouWorkBest.notes ? `<p>${esc(r.howYouWorkBest.notes)}</p>` : ""}${r.howYouWorkBest.helps.length ? `<ul>${r.howYouWorkBest.helps.map((h) => `<li>${esc(h.strength)}: ${esc(h.helps)}</li>`).join("")}</ul>` : ""}` : ""}</div>
      <h3>Where we found this</h3>${links(r.sources)}
      <p style="font-size:13px;color:#5B5F66">Checked by The Com'mon People on ${esc(new Date(r.checked + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }))}. Things change, so check the details with the sources before you make a big decision.</p>
      <div class="yo-nav"><button class="yo-btn ghost" type="button" data-go="6">See my other options</button>
        <span><button class="yo-btn ghost" type="button" id="print">Print or save as PDF</button>
        ${off ? `<a class="yo-btn" href="https://the-common-people.com/guide-cv.html">Read the free CV guide</a>` : `<button class="yo-btn" type="button" id="build">Create a CV for this option</button>`}</span></div>
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
      if (step === 5) { options = null; beyond = null; beyondShown = 1; extra = null; }
      go(step + 1);
    });
  }
  document.addEventListener("click", (e) => { const g = e.target.closest("[data-go]"); if (g) { e.preventDefault(); if (+g.dataset.go === 6) options = options || null; go(+g.dataset.go); } });

  (async function init() {
    try {
      C = await api("/api/options/cards");
      if (!C.signedIn) { location.href = "/account/?next=" + encodeURIComponent("/options-app.html"); return; }
      const p = await api("/api/options/profile");
      A = p.answers; P = p.private; chosen = p.chosen || []; A.workNotes = A.workNotes || {}; A.heard = A.heard || []; P.consent = P.consent || { given: false };
      A.pick = chosen[0] ? chosen[0].code : undefined;
      step = A.step || 1;
      const a = C.data.attribution || {};
      $("#attr").textContent = [a.skillsEngland, a.onet].filter(Boolean).join(" ");
      stepsBar(); render();
    } catch (e) { $("#app").innerHTML = `<p class="yo-msg">${esc(e.message)}</p>`; }
  })();
})();
