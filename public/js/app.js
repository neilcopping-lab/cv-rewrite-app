// Front-end flow controller for the four steps. Talks to the JSON API in
// server.js. Kept dependency-free and small.
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
let STATE = { questions: [], answers: [], cv: null, designs: [], designId: null };

function showStep(n) {
  $$(".panel").forEach((p) => p.classList.remove("active"));
  $("#p" + n).classList.add("active");
  $$(".steps .s").forEach((s) => {
    const step = +s.dataset.step;
    s.classList.toggle("active", step === n);
    s.classList.toggle("done", step < n);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function busy(el, on, msg) { el.innerHTML = on ? `<span class="spinner"></span> ${msg || "Working…"}` : (msg || ""); }

// Fetch the current rewritten CV from the server and paint step 3. Used on load
// (after reload / sign-in) and before showing step 3, so it's never blank.
async function ensureDraft() {
  if (STATE.pendingDraft) { renderDraft(STATE.pendingDraft); return true; }
  try {
    const j = await api("/api/draft");
    if (j && j.ok) { STATE.cv = j.cv; STATE.softDone = true; renderDraft(j); return true; }
  } catch (_) {}
  return false;
}

// Let the user click back to a step they've already completed. Going to step 3
// re-paints the rewritten CV from the server if the browser dropped it.
function bindStepTabs() {
  $$(".steps .s").forEach((tab) => {
    tab.style.cursor = "pointer";
    tab.addEventListener("click", async () => {
      const n = +tab.dataset.step;
      if (!tab.classList.contains("done") && !tab.classList.contains("active")) return; // no skipping ahead
      if (n === 3) { await ensureDraft(); }
      showStep(n);
    });
  });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindStepTabs);
else bindStepTabs();

// A pool of warm, plain-spoken messages that pop up while the AI works. Shown
// in a random order each time so it feels alive, not scripted.
const FUN_MESSAGES = [
  "Pop the kettle on, this bit can take a minute or two.",
  "Reading your CV properly, not just skimming it.",
  "Lining you up against the advert, line by line.",
  "Writing it in your own voice, not robot-speak.",
  "Double-checking every number traces back to you.",
  "No inventing, no fluff. Just the real you, sharpened.",
  "Good CVs are worth a short wait. Nearly there.",
  "Making you look brilliant on paper. Hang tight."
];
function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

// Progress countdown shown while a long step runs. Fills a bar toward ~92%
// over an estimate, counts seconds up, and rotates reassuring messages (in a
// random order). The returned object's done()/fail() finish it.
function startProgress(hostId, estimate, messages) {
  messages = shuffle(messages && messages.length ? messages : FUN_MESSAGES);
  let host = document.getElementById(hostId);
  if (!host) {
    host = document.createElement("div");
    host.id = hostId;
    const anchor = document.getElementById(hostId.replace("prog", "go")) || document.body;
    (anchor.parentNode || document.body).appendChild(host);
  }
  host.innerHTML =
    '<div class="progress"><div class="bar"><i></i></div>' +
    '<div class="meta"><span class="msg"></span><span class="secs">0s</span></div>' +
    '<div class="eta">Usually under 2 minutes - you can keep this tab open.</div></div>';
  const fill = host.querySelector(".bar > i");
  const secsEl = host.querySelector(".secs");
  const msgEl = host.querySelector(".msg");
  const t0 = Date.now();
  let mi = 0;
  msgEl.textContent = messages[0] || "Working";
  const timer = setInterval(() => {
    const sec = (Date.now() - t0) / 1000;
    secsEl.textContent = Math.floor(sec) + "s";
    const pct = Math.min(92, (1 - Math.exp(-sec / (estimate * 0.55))) * 100);
    fill.style.width = pct.toFixed(1) + "%";
    const step = estimate / messages.length;
    if (sec > (mi + 1) * step && mi < messages.length - 1) msgEl.textContent = messages[++mi];
    if (sec > estimate * 1.3) msgEl.textContent = "Almost there, thanks for your patience";
  }, 300);
  return {
    done() { clearInterval(timer); fill.style.width = "100%"; msgEl.textContent = "Done"; setTimeout(() => { host.innerHTML = ""; }, 600); },
    fail(m) { clearInterval(timer); host.innerHTML = '<div class="notice">⚠ ' + m + '</div>'; }
  };
}

async function api(url, opts) {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ("Request failed: " + r.status));
  return j;
}
// Start a long job on the server and poll until it's finished. This is what
// keeps long CV writes from timing out: each request here is tiny and quick.
async function runJob(url, body) {
  const start = await api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!start.jobId) return start; // server answered directly (older path)
  const startedAt = Date.now();
  while (true) {
    await new Promise((r) => setTimeout(r, 2000));
    const s = await api("/api/job/" + start.jobId);
    if (s.status === "running") {
      if (Date.now() - startedAt > 5 * 60 * 1000) throw new Error("This is taking longer than expected - please try again.");
      continue;
    }
    if (s.status === "error") throw new Error(s.error || "Something went wrong while writing your CV.");
    if (s.status === "unknown") throw new Error("We lost track of that request - please try again.");
    return s; // done
  }
}
// Turn internal error codes into plain English.
function mapErr(m) {
  if (/rewrite-limit/.test(m)) return "You've used your free rewrites for this CV. Download it to keep it (uses one credit), or start a new one later.";
  if (/no-credits/.test(m)) return "You're out of CV credits - choose a pack to download.";
  return m;
}

// ── STEP 1 ──
$("#go1").onclick = async () => {
  const s = $("#s1"); s.textContent = "";
  const prog = startProgress("prog1", 25, FUN_MESSAGES);
  try {
    const fd = new FormData();
    if ($("#cvFile").files[0]) fd.append("cvFile", $("#cvFile").files[0]);
    if ($("#cvText").value.trim()) fd.append("cvText", $("#cvText").value.trim());
    if ($("#advertFile").files[0]) fd.append("advertFile", $("#advertFile").files[0]);
    if ($("#advertUrl").value.trim()) fd.append("advertUrl", $("#advertUrl").value.trim());
    if ($("#advertText").value.trim()) fd.append("advertText", $("#advertText").value.trim());
    // Optional photo + links.
    if ($("#photoFile") && $("#photoFile").files[0]) fd.append("photo", $("#photoFile").files[0]);
    const links = {
      linkedin: ($("#linkLinkedin") || {}).value?.trim() || "",
      portfolio: ($("#linkPortfolio") || {}).value?.trim() || "",
      website: ($("#linkWebsite") || {}).value?.trim() || "",
      github: ($("#linkGithub") || {}).value?.trim() || "",
      youtube: ($("#linkYoutube") || {}).value?.trim() || ""
    };
    fd.append("links", JSON.stringify(links));
    // Writing style + optional voice sample.
    if ($("#writingStyle")) fd.append("writingStyle", $("#writingStyle").value);
    if ($("#styleSample") && $("#styleSample").value.trim()) fd.append("styleSample", $("#styleSample").value.trim());
    const ex = await api("/api/extract", { method: "POST", body: fd });
    // Show the extracted text in the boxes so you can see it worked and edit it.
    if (ex.cvText) $("#cvText").value = ex.cvText;
    if (ex.advertText) $("#advertText").value = ex.advertText;
    const g = await api("/api/gaps", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    renderGaps(g); prog.done(); showStep(2);
  } catch (e) { prog.fail(mapErr(e.message)); }
};

function renderGaps(g) {
  if (g.note) { const n = $("#gapNote"); n.classList.remove("hidden"); n.textContent = g.note; }
  const reqs = g.requirements || [];
  const covered = reqs.filter((r) => r.status === "covered").length;
  const thin = reqs.filter((r) => r.status === "thin").length;
  const missing = reqs.filter((r) => r.status === "missing").length;
  $("#reqSummary").innerHTML = reqs.length
    ? `<div class="notice">Against the advert, <strong>${covered}</strong> requirements are already covered by your CV, <strong>${thin}</strong> are thin and <strong>${missing}</strong> are missing. We only ask about genuine gaps.</div>`
    : "";
  STATE.questions = [...(g.gapQuestions || []), ...(g.sectionQuestions || [])];
  if (!STATE.questions.length) {
    // Nothing genuinely missing - don't invent questions.
    $("#questions").innerHTML = `<div class="notice"><strong>Nothing to add.</strong> Your CV already covers what we need for this role, so there's nothing to ask. Press <em>Write my CV</em> whenever you're ready.</div>`;
    return;
  }
  $("#questions").innerHTML =
    `<p class="muted" style="margin:0 0 8px">All optional. Only fill in what isn't already on your CV - skip anything that's already covered.</p>` +
    STATE.questions.map((q, i) => {
      const tag = q.requirement ? "Gap" : (q.section || "Optional");
      const id = q.id || "q" + i;
      return `<div class="q" data-qid="${id}">
        <div class="tag">${tag}</div>
        <div class="qtext">${q.question}</div>
        <textarea data-answer="${id}" placeholder="Optional - leave blank if it's already on your CV"></textarea>
        <button class="btn ghost" style="font-size:13px;padding:8px 12px" data-rec="${id}">● Record answer</button>
        <span class="muted" data-recs="${id}"></span>
      </div>`;
    }).join("");
  $$("[data-rec]").forEach((b) => (b.onclick = () => recordAnswer(b.dataset.rec)));
}

// ── STEP 2 ──
$("#go2").onclick = async () => {
  const s = $("#s2"); s.textContent = "";
  const prog = startProgress("prog2", 45, FUN_MESSAGES);
  try {
    const answers = STATE.questions.map((q) => {
      const id = q.id;
      const ta = document.querySelector(`[data-answer="${id}"]`);
      return { id, question: q.question, answer: ta ? ta.value.trim() : "" };
    }).filter((a) => a.answer);
    STATE.answers = answers;
    const j = await runJob("/api/generate", { answers });
    STATE.cv = j.cv; STATE.pendingDraft = j; prog.done(); showStep(3);
    if (STATE.softDone) { revealDraft(j); }
    else { $("#draftContent").classList.add("hidden"); $("#softEmailGate").classList.remove("hidden"); const sm = $("#softMsg"); if (sm) sm.textContent = ""; }
  } catch (e) { prog.fail(mapErr(e.message)); }
};

// Reveal the rewritten CV (hides the soft-email gate) and render it. If the
// browser lost the draft (e.g. after a reload), pull it back from the server.
async function revealDraft(j) {
  const g = $("#softEmailGate"); if (g) g.classList.add("hidden");
  const c = $("#draftContent"); if (c) c.classList.remove("hidden");
  if (j) renderDraft(j);
  else if (!(await ensureDraft())) renderDraft({ message: "Your rewritten CV is ready.", missing: [], review: {} });
}
// Soft email step - capture the lead, then reveal.
const softEmailBtn = $("#softEmailBtn");
if (softEmailBtn) softEmailBtn.onclick = async () => {
  const em = ($("#softEmail").value || "").trim(); const m = $("#softMsg");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { busy(m, false, "Pop in a valid email, or tap skip."); return; }
  busy(m, true, "One moment…");
  try { await api("/api/soft-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: em }) }); STATE.softEmail = em; } catch (_) {}
  STATE.softDone = true;
  prefillSignin();
  revealDraft(STATE.pendingDraft);
};
const softSkip = $("#softSkip");
if (softSkip) softSkip.onclick = (e) => { e.preventDefault(); STATE.softDone = true; revealDraft(STATE.pendingDraft); };
function prefillSignin() {
  if (!STATE.softEmail) return;
  ["#signinEmail", "#topSigninEmail"].forEach((sel) => { const el = $(sel); if (el && !el.value) el.value = STATE.softEmail; });
}

// Turn a flagged item into a clear, plain-English question.
function friendlyGap(m) {
  if (m && m.question) return m.question;
  const it = ((m && m.item) || "").trim();
  const mm = it.match(/^(\w+):\s*(.+)$/);
  if (mm) {
    const kind = mm[1].toLowerCase(), val = mm[2];
    if (kind === "number") return `We couldn't find the figure "${val}" in what you gave us. What's the real number, if any?`;
    if (kind === "skill") return `We listed "${val}" as a skill but couldn't confirm it from your CV. Have you genuinely used it? If not, leave it out.`;
    if (kind === "qualification") return `We listed the qualification "${val}" but couldn't confirm it. Do you actually hold it?`;
    if (kind === "employer" || kind === "title" || kind === "date") return `We added "${val}", which isn't in your source. Is it correct?`;
    return `We added "${val}" but couldn't trace it to your CV. Is it right? If not, leave it out.`;
  }
  return it || "A detail we couldn't confirm from your CV.";
}

function renderDraft(j) {
  j = j || STATE.pendingDraft || {};        // never crash on a missing draft
  STATE.pendingDraft = j;
  STATE.previewV = (STATE.previewV || 0) + 1; // new CV → refresh the PDF preview
  const g = $("#softEmailGate"); if (g) g.classList.add("hidden");
  const c = $("#draftContent"); if (c) c.classList.remove("hidden");
  const banner = $("#checkBanner");
  banner.style.borderColor = j.downloadBlocked ? "var(--accent)" : "var(--ink)";
  banner.innerHTML = `<span class="sans">${j.message || ""}</span>`;
  // missing / fabrication flags to resolve
  const missing = j.missing || [];
  $("#missingBox").innerHTML = missing.length
    ? `<div class="flag"><strong>${missing.length} thing${missing.length > 1 ? "s" : ""} we couldn't confirm from your CV.</strong><br>
        These are details the honesty check couldn't trace to what you gave us. You can leave them out and carry on, or open the list to add the real detail for any of them.</div>
       <p><button class="btn accent" id="leaveAllBtn">Leave them all out and continue →</button> <span id="sr" class="muted"></span></p>
       <details style="margin-top:6px">
         <summary style="cursor:pointer;font-family:var(--font-label);text-transform:uppercase;letter-spacing:.06em;font-size:13px;color:var(--gold);padding:6px 0">Or review each one (${missing.length})</summary>
         ${missing.map((m, i) => `<div class="q" data-mi="${i}">
            <div class="qtext">${friendlyGap(m)}</div>
            <textarea data-mresolve="${i}" placeholder="Add the real detail, or leave blank to drop it"></textarea>
            <label style="font-family:var(--font-body);text-transform:none;letter-spacing:normal;font-weight:400;font-size:13px"><input type="checkbox" data-mdrop="${i}" style="width:auto"> Leave this one out</label>
          </div>`).join("")}
         <p><button class="btn" id="resolveBtn">Apply my answers and re-check</button></p>
       </details>`
    : "";
  if (missing.length) {
    const rb = $("#resolveBtn"); if (rb) rb.onclick = resolveMissing;
    const la = $("#leaveAllBtn"); if (la) la.onclick = leaveAllAndContinue;
  }
  // Block "Choose a design" until nothing is outstanding.
  const go3 = $("#go3");
  if (go3) {
    go3.disabled = missing.length > 0;
    go3.title = missing.length ? "Sort the flagged items above first" : "";
  }
  // review notes
  const rv = j.review || {};
  const notes = [];
  if (rv.soundsHuman === false) notes.push("Reads a little like a press release in places - regenerate or tweak the Word file.");
  (rv.overstatements || []).forEach((o) => notes.push("Possible overstatement: " + o));
  const prog = (j.programmatic && j.programmatic.issues) || [];
  prog.filter((p) => p.severity !== "info").forEach((p) => notes.push(p.detail));
  $("#reviewBox").innerHTML = notes.length ? `<div class="notice sans"><strong>Automated checks:</strong><br>${notes.map((n) => "• " + n).join("<br>")}</div>` : `<div class="notice sans">Automated checks passed: UK spelling, no banned punctuation, standard headings, every figure traced to your source.</div>`;
  previewDraft();
}

// Drop all flagged items without re-running the AI, then go straight to design.
async function leaveAllAndContinue() {
  const sr = document.getElementById("sr");
  if (sr) busy(sr, true, "Finishing up…");
  try {
    const j = await api("/api/drop-flags", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    STATE.cv = j.cv;
    $("#missingBox").innerHTML = "";
    $("#checkBanner").innerHTML = '<span>Ready. Pick a design and download.</span>';
    const go3 = $("#go3"); if (go3) go3.disabled = false;
    await loadDesigns(); await refreshAccount(); showStep(4);
  } catch (e) { if (sr) busy(sr, false, "⚠ " + e.message); }
}

async function resolveMissing() {
  // Place the progress bar next to the re-check button.
  const sr = document.getElementById("sr");
  if (sr && !document.getElementById("progr")) {
    const d = document.createElement("div"); d.id = "progr"; sr.parentNode.appendChild(d);
  }
  const prog = startProgress("progr", 30, FUN_MESSAGES);
  try {
    const resolutions = [], acceptLeaveOut = [];
    (STATE.cv.missing || []).forEach((m, i) => {
      const ta = document.querySelector(`[data-mresolve="${i}"]`);
      const drop = document.querySelector(`[data-mdrop="${i}"]`);
      if (ta && ta.value.trim()) resolutions.push({ item: m.item, answer: ta.value.trim() });
      if (drop && drop.checked) acceptLeaveOut.push(m.item);
    });
    const j = await runJob("/api/resolve", { resolutions, acceptLeaveOut });
    STATE.cv = j.cv; renderDraft(j); prog.done();
  } catch (e) { prog.fail(mapErr(e.message)); }
}

$("#regen").onclick = async () => {
  const prog = startProgress("prog3", 45, FUN_MESSAGES);
  try {
    const j = await runJob("/api/generate", { answers: STATE.answers });
    STATE.cv = j.cv; renderDraft(j); prog.done();
  } catch (e) { prog.fail(mapErr(e.message)); }
};

// The preview now renders the SELECTED design's REAL PDF (same engine as the
// download), so what you see is exactly what you get. A spinner shows until the
// PDF loads; the ?v= busts the browser cache whenever a new CV is generated.
function previewPdfHtml(id) {
  const src = `/api/preview-pdf?design=${encodeURIComponent(id || "modern-minimal")}&v=${STATE.previewV || 0}#toolbar=0&navpanes=0&view=FitH`;
  return `<div class="pvspin muted" style="padding:14px"><span class="spinner"></span> Rendering your exact CV…</div>` +
    `<iframe title="CV preview" src="${src}" style="width:100%;height:900px;border:0;border-radius:6px;background:#fff" onload="var s=this.parentNode.querySelector('.pvspin'); if(s) s.remove();"></iframe>`;
}
function previewDraft() {
  const box = $("#draftPreview");
  if (box) box.innerHTML = previewPdfHtml(STATE.designId || "modern-minimal");
}

// ── STEP 3 -> 4 ──
$("#go3").onclick = async () => { await loadDesigns(); await refreshAccount(); showStep(4); };

async function loadDesigns() {
  if (!STATE.designs.length) {
    const j = await api("/api/designs");
    STATE.designs = j.designs || [];
    STATE.designerTemplates = j.designerTemplates || [];
  }
  STATE.kind = STATE.kind || (isDesignerId(STATE.designId) ? "designer" : "word");
  STATE.designId = STATE.designId || STATE.designs[0].id;
  wireTemplateToggle();
  const pv = $("#prevDesign"), nx = $("#nextDesign");
  if (pv) pv.onclick = () => stepDesign(-1);
  if (nx) nx.onclick = () => stepDesign(1);
  if (typeof prefillSignin === "function") prefillSignin();
  renderDesignGrid();
}
function designIndex() { return currentList().findIndex((d) => d.id === STATE.designId); }
function updateDesignCaption() {
  const list = currentList(), i = designIndex(), d = list[i] || {};
  const cap = $("#designCaption");
  if (cap) cap.textContent = list.length ? `${i + 1} of ${list.length} · ${d.name || ""}` : "";
}
function stepDesign(dir) {
  const list = currentList(); if (!list.length) return;
  let i = designIndex(); if (i < 0) i = 0;
  i = (i + dir + list.length) % list.length;
  STATE.designId = list[i].id;
  $$(".design-card").forEach((c) => c.classList.toggle("sel", c.dataset.d === STATE.designId));
  const sel = document.querySelector(".design-card.sel");
  if (sel && sel.scrollIntoView) sel.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  updateDesignCaption();
  livePreview();
}
function isDesignerId(id) { return (STATE.designerTemplates || []).some((t) => t.id === id); }
function currentList() { return STATE.kind === "designer" ? (STATE.designerTemplates || []) : STATE.designs; }
function wireTemplateToggle() {
  const w = $("#tplWord"), d = $("#tplDesigner");
  if (w) w.onclick = () => switchKind("word");
  if (d) d.onclick = () => switchKind("designer");
  [["word", w], ["designer", d]].forEach(([k, b]) => {
    if (!b) return; const on = STATE.kind === k;
    b.style.background = on ? "var(--gold)" : ""; b.style.color = on ? "#161F29" : ""; b.style.borderColor = on ? "var(--gold)" : "";
  });
}
function switchKind(kind) {
  if (STATE.kind === kind) return;
  STATE.kind = kind;
  STATE.designId = (currentList()[0] || {}).id;
  const wb = document.querySelector('[data-dl="docx"]');
  if (wb) wb.style.display = kind === "designer" ? "none" : "";
  const note = $("#tplNote");
  if (note) note.innerHTML = kind === "designer"
    ? '<strong style="color:var(--cream)">Designer</strong> - premium, print-ready PDF (with an ATS-safe PDF too). Not editable, and Word isn\'t available for these.'
    : '<strong style="color:var(--cream)">Word / ATS</strong> - fully editable, best for online application portals. Downloads as Word, PDF and an ATS-safe version.';
  STATE.designFilter = "All";
  wireTemplateToggle();
  renderDesignGrid();
}

// Map each design's specific category to a broad filter group.
const GROUP_MAP = {
  Traditional: "Classic", "Ops / Hospitality": "Classic",
  Minimal: "Simple", Plain: "Simple", "Early career": "Simple",
  Structured: "Modern", Technical: "Modern",
  Creative: "Creative", Statement: "Creative", Sales: "Creative",
  Professional: "Executive", Senior: "Executive",
  Academic: "Academic", Designer: "Designer"
};
const GROUP_ORDER = ["Simple", "Classic", "Modern", "Creative", "Executive", "Academic"];
function groupOf(d) { return GROUP_MAP[d.category] || (d.kind === "designer" ? "Designer" : "Other"); }
function renderDesignFilters() {
  const host = $("#designFilters");
  if (!host) return;
  // Filters only help the larger Word tier; the 5 designer templates don't need them.
  if (STATE.kind === "designer") { host.innerHTML = ""; return; }
  const present = new Set(currentList().map(groupOf));
  const groups = ["All", ...GROUP_ORDER.filter((g) => present.has(g))];
  const active = STATE.designFilter || "All";
  host.innerHTML = groups.map((g) =>
    `<button type="button" class="chip ${g === active ? "on" : ""}" data-filter="${g}">${g}</button>`).join("");
  host.querySelectorAll("[data-filter]").forEach((b) => (b.onclick = () => { STATE.designFilter = b.dataset.filter; renderDesignGrid(); }));
}
function renderDesignGrid() {
  renderDesignFilters();
  const f = STATE.designFilter || "All";
  const list = currentList().filter((d) => f === "All" || groupOf(d) === f);
  $("#designGrid").innerHTML = list.map((d) =>
    `<div class="design-card ${d.id === STATE.designId ? "sel" : ""}" data-d="${d.id}">
      <img class="thumb" src="/img/thumbs/${d.id}.png" alt="${d.name}" onerror="this.style.opacity=.3">
      <span class="pdf-badge">${STATE.kind === "designer" ? "PDF" : "WORD"}</span>
      <div class="meta"><h4>${d.name}</h4><p>${d.description}</p></div>
    </div>`).join("");
  $$("[data-d]").forEach((c) => (c.onclick = () => selectDesign(c.dataset.d)));
  // Keep a valid selection visible within the current filter.
  if (list.length && !list.some((d) => d.id === STATE.designId)) {
    STATE.designId = list[0].id;
    $$(".design-card").forEach((c) => c.classList.toggle("sel", c.dataset.d === STATE.designId));
  }
  updateDesignCaption();
  livePreview();
}
async function selectDesign(id) {
  STATE.designId = id;
  updateDesignCaption();
  $$(".design-card").forEach((c) => c.classList.toggle("sel", c.dataset.d === id));
  livePreview();
}
function livePreview() {
  // Tell the server which design is selected (keeps session designId in sync),
  // then show the real rendered PDF - identical to the download.
  api("/api/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ designId: STATE.designId }) }).catch(() => {});
  const box = $("#livePreview");
  if (box) box.innerHTML = previewPdfHtml(STATE.designId);
}

// ── Accounts + credits ──
async function refreshAccount() {
  try { STATE.account = await api("/api/auth/me"); }
  catch (e) { STATE.account = { signedIn: false, credits: 0 }; }
  renderAccountBar();
  renderStep4Payment();
}
function renderAccountBar() {
  const a = STATE.account || { signedIn: false };
  const st = $("#accountState"), act = $("#accountAction");
  if (!st) return;
  const topBox = $("#topSigninBox");
  if (a.signedIn) {
    st.innerHTML = `Signed in as <strong>${a.email}</strong> · <strong style="color:var(--gold)">${a.credits} CV credit${a.credits === 1 ? "" : "s"}</strong>`;
    act.innerHTML = `<button class="btn ghost" id="signoutBtn" style="padding:8px 12px">Sign out</button>`;
    const so = $("#signoutBtn"); if (so) so.onclick = async () => { await api("/api/auth/logout", { method: "POST" }); await refreshAccount(); };
    if (topBox) topBox.classList.add("hidden");
  } else {
    st.innerHTML = "New here? Just start below - you can sign in when you're ready to download. Returning customer? Sign in to load your credits.";
    act.innerHTML = `<button class="btn ghost" id="topSigninToggle" style="padding:8px 12px">Sign in</button>`;
    const tt = $("#topSigninToggle");
    if (tt) tt.onclick = () => { if (topBox) { topBox.classList.toggle("hidden"); const e = $("#topSigninEmail"); if (e && !topBox.classList.contains("hidden")) e.focus(); } };
  }
}
function renderStep4Payment() {
  loadCoverQuestions();
  const a = STATE.account || { signedIn: false, credits: 0 };
  const signin = $("#signinBox"), buy = $("#buyBox"), dl = $("#downloads");
  [signin, buy, dl].forEach((x) => x && x.classList.add("hidden"));
  if (!a.signedIn) { signin && signin.classList.remove("hidden"); return; }
  if ((a.credits || 0) > 0) {
    dl && dl.classList.remove("hidden");
    const b = $("#dlBalance"); if (b) b.textContent = `You have ${a.credits} CV${a.credits > 1 ? "s" : ""} left.`;
  } else {
    buy && buy.classList.remove("hidden");
  }
}

// Sign-in: email a 6-digit code (primary) plus a backup link. The code is
// typed into THIS page, so signing in never reloads and never loses your work.
async function requestSignin(email, msg) {
  if (!email) { busy(msg, false, "Enter your email."); return; }
  busy(msg, true, "Sending your code…");
  try {
    const j = await api("/api/auth/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    showCodeEntry(msg, email);
    if (j.sent) busy(msg, false, "We've emailed you a 6-digit code - type it in below to sign in. You won't lose anything on this page.");
    else if (j.devCode) busy(msg, false, `Email isn't set up. Your code is <strong>${j.devCode}</strong> - type it in below.`);
    else busy(msg, false, "Code sent - type it in below.");
    pollForSignin(msg); // backup: if they click the emailed link instead
  } catch (e) { busy(msg, false, "⚠ " + e.message); }
}

// Reveal a code input directly under the sign-in message. Verifying the code
// updates the account in place - no navigation, so the CV in progress stays.
function showCodeEntry(msg, email) {
  if (!msg) return;
  let row = document.getElementById(msg.id + "-code");
  if (!row) {
    row = document.createElement("div");
    row.id = msg.id + "-code";
    row.style.cssText = "display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center";
    row.innerHTML = `<input type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6-digit code" style="flex:0 0 120px;letter-spacing:.25em;text-align:center;font-size:16px;padding:8px 10px;border:1px solid #cfc9bd;border-radius:8px"><button type="button" class="btn" style="padding:8px 16px">Sign in</button>`;
    msg.parentNode.insertBefore(row, msg.nextSibling);
    const input = row.querySelector("input"), btn = row.querySelector("button");
    const go = () => verifyCode(email, input.value.trim(), msg, row);
    btn.onclick = go;
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  }
  row.querySelector("input").focus();
}

async function verifyCode(email, code, msg, row) {
  if (!/^\d{6}$/.test(code)) { busy(msg, false, "Enter the 6-digit code from your email."); return; }
  busy(msg, true, "Signing you in…");
  try {
    const j = await api("/api/auth/verify-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code }) });
    if (_signinPoll) { clearInterval(_signinPoll); _signinPoll = null; }
    STATE.account = { signedIn: true, email: j.email, credits: j.credits };
    if (row) row.remove();
    busy(msg, false, "Signed in - carry on right here, nothing was lost.");
    renderAccountBar(); renderStep4Payment();
  } catch (e) { busy(msg, false, "⚠ " + e.message); }
}
// After a sign-in link is sent, watch for the click (in this or another tab)
// and update the account UI in place - no reload, so the CV in progress stays.
let _signinPoll = null;
function pollForSignin(msg) {
  if (_signinPoll) clearInterval(_signinPoll);
  let tries = 0;
  _signinPoll = setInterval(async () => {
    tries++;
    try {
      const me = await api("/api/auth/me");
      if (me.signedIn) {
        clearInterval(_signinPoll); _signinPoll = null;
        STATE.account = me; renderAccountBar(); renderStep4Payment();
        if (msg) busy(msg, false, "Signed in - carry on right here.");
      }
    } catch (_) {}
    if (tries > 100) { clearInterval(_signinPoll); _signinPoll = null; }
  }, 3000);
}
const signinBtn = $("#signinBtn");
if (signinBtn) signinBtn.onclick = () => requestSignin($("#signinEmail").value.trim(), $("#signinMsg"));
const topSigninBtn = $("#topSigninBtn");
if (topSigninBtn) topSigninBtn.onclick = () => requestSignin($("#topSigninEmail").value.trim(), $("#topSigninMsg"));

// Buy a pack.
$$("[data-pack]").forEach((b) => (b.onclick = async () => {
  const s = $("#s4"); const agree = $("#agree");
  if (agree && !agree.checked) { busy(s, false, "⚠ Please tick the box to agree before buying."); return; }
  busy(s, true, "Opening secure checkout…");
  try {
    const j = await api("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packId: b.dataset.pack }) });
    window.location.href = j.url;
  } catch (e) {
    if (/sign in/i.test(e.message)) { STATE.account = { signedIn: false, credits: 0 }; renderStep4Payment(); busy(s, false, "Please sign in first (below)."); }
    else if (/not configured/i.test(e.message)) busy(s, false, "Payments aren't switched on yet (no Stripe key set).");
    else busy(s, false, "⚠ " + e.message);
  }
}));

// Download: costs 1 credit for a new finished CV; handle sign-in / no-credit.
async function downloadFile(type) {
  const s = $("#s4b"); busy(s, true, "Preparing your file…");
  try {
    const r = await fetch(`/api/download?type=${type}&design=${encodeURIComponent(STATE.designId)}`);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { await refreshAccount(); busy(s, false, "Please sign in to download."); return; }
      if (r.status === 402) { await refreshAccount(); busy(s, false, "You're out of CV credits - choose a pack below."); return; }
      busy(s, false, "⚠ " + (j.error || ("Error " + r.status))); return;
    }
    const blob = await r.blob();
    const cd = r.headers.get("Content-Disposition") || "";
    const m = cd.match(/filename="([^"]+)"/);
    const name = m ? m[1] : "cv." + (type === "docx" ? "docx" : "pdf");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    busy(s, false, "Downloaded.");
    await refreshAccount();
    maybeAskFeedback();
  } catch (e) { busy(s, false, "⚠ " + e.message); }
}
$$("[data-dl]").forEach((b) => (b.onclick = () => downloadFile(b.dataset.dl)));

// ── Feedback pop-up (stars + comment), shown once after a download ──
let _fbStars = 0;
function litStars(n) { $$("#fbStars span").forEach((s) => s.classList.toggle("lit", +s.dataset.star <= n)); }
(function wireFeedback() {
  const stars = $("#fbStars");
  if (stars) {
    stars.querySelectorAll("span").forEach((s) => {
      const v = +s.dataset.star;
      s.onmouseenter = () => litStars(v);
      s.onclick = () => { _fbStars = v; litStars(v); };
      s.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { _fbStars = v; litStars(v); } };
    });
    stars.onmouseleave = () => litStars(_fbStars);
  }
  const close = () => { const m = $("#feedbackModal"); if (m) m.classList.add("hidden"); };
  const cl = $("#fbClose"), sk = $("#fbSkip");
  if (cl) cl.onclick = close;
  if (sk) sk.onclick = (e) => { e.preventDefault(); close(); };
  const send = $("#fbSend");
  if (send) send.onclick = async () => {
    const msg = $("#fbMsg");
    if (!_fbStars) { busy(msg, false, "Tap a star first."); return; }
    busy(msg, true, "Sending…");
    try {
      await api("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stars: _fbStars, comment: ($("#fbComment").value || "").trim(), context: "post-download" }) });
      busy(msg, false, "Thank you - that really helps.");
      setTimeout(close, 1100);
    } catch (e) { busy(msg, false, "⚠ " + e.message); }
  };
})();
function maybeAskFeedback() {
  if (STATE.feedbackShown) return;
  STATE.feedbackShown = true;
  const m = $("#feedbackModal");
  if (m) setTimeout(() => m.classList.remove("hidden"), 900); // let the download start first
}

// ── Cover letter add-on (1 credit) ──
// Load the optional questions once, so the letter is built from real answers.
let _coverQsLoaded = false;
async function loadCoverQuestions() {
  const host = $("#coverQs");
  if (!host || _coverQsLoaded) return;
  try {
    const j = await api("/api/cover-letter/questions");
    STATE.coverQuestions = j.questions || [];
    host.innerHTML = STATE.coverQuestions.map((q) => `
      <div style="margin:0 0 10px">
        <label style="display:block;font-size:13px;color:var(--muted);margin-bottom:4px;text-transform:none;letter-spacing:normal">${escHtml(q.question)}</label>
        <textarea data-cq="${escHtml(q.id)}" rows="2" placeholder="Optional - in your own words" style="width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-family:var(--font-body);font-size:14px;resize:vertical"></textarea>
      </div>`).join("");
    _coverQsLoaded = true;
  } catch (_) {}
}
function collectCoverAnswers() {
  const byId = {}; (STATE.coverQuestions || []).forEach((q) => (byId[q.id] = q.question));
  return $$("#coverQs [data-cq]").map((t) => ({ id: t.dataset.cq, question: byId[t.dataset.cq] || "", answer: t.value.trim() })).filter((a) => a.answer);
}

const coverBtn = $("#coverBtn");
if (coverBtn) coverBtn.onclick = async () => {
  const m = $("#coverMsg");
  const answers = collectCoverAnswers();
  const body = STATE.coverPaid ? { answers, regenerate: true } : { answers };
  busy(m, true, STATE.coverPaid ? "Rewriting in your voice…" : "Writing your cover letter…");
  try {
    const j = await api("/api/cover-letter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    renderCoverLetter(j.coverLetter);
    STATE.coverPaid = true;
    coverBtn.textContent = "Rewrite with my answers (free)";
    busy(m, false, j.alreadyPaid && !answers.length ? "Here's your cover letter." : "Done. Not quite you? Tweak your answers and rewrite - free.");
    await refreshAccount();
  } catch (e) {
    if (/no-credits/.test(e.message)) { await refreshAccount(); busy(m, false, "You're out of credits - choose a pack above to add one."); }
    else if (/sign in/i.test(e.message)) busy(m, false, "Please sign in first (above).");
    else busy(m, false, "⚠ " + mapErr(e.message));
  }
};
function escHtml(s) { return String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
function renderCoverLetter(cl) {
  if (!cl) return;
  const lines = [cl.greeting, ...(cl.paragraphs || []), cl.signOff].map((p) => `<p style="margin:0 0 12px">${escHtml(p)}</p>`).join("");
  const nameP = `<p style="margin:0"><strong>${escHtml(cl.name || "")}</strong></p>`;
  const box = $("#coverPreview");
  box.innerHTML = `<div style="font-family:Georgia,serif;color:#1A1A1A;background:#fff;padding:26px;line-height:1.6;border-radius:6px">${lines}${nameP}</div>`;
  box.classList.remove("hidden");
  $("#coverDownloads").classList.remove("hidden");
}
$$("[data-cover]").forEach((b) => (b.onclick = () => downloadCover(b.dataset.cover)));
async function downloadCover(type) {
  const m = $("#coverMsg");
  busy(m, true, "Preparing…");
  try {
    const r = await fetch(`/api/cover-letter/download?type=${type}`);
    if (!r.ok) { const j = await r.json().catch(() => ({})); busy(m, false, "⚠ " + (j.error || ("Error " + r.status))); return; }
    const blob = await r.blob();
    const cd = r.headers.get("Content-Disposition") || "";
    const mm = cd.match(/filename="([^"]+)"/);
    const name = mm ? mm[1] : ("CoverLetter." + (type === "docx" ? "docx" : "pdf"));
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    busy(m, false, "Downloaded.");
  } catch (e) { busy(m, false, "⚠ " + e.message); }
}

// On load: handle return from Stripe / sign-in, then load account state.
(async function init() {
  const p = new URLSearchParams(location.search);
  let jumpToDesign = false;
  if (p.get("paid") === "1") {
    try {
      const cp = await api("/api/confirm-payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cs: p.get("cs") }) });
      if (cp && cp.designId) STATE.designId = cp.designId; // restore the design chosen before paying
    } catch (e) {}
    jumpToDesign = true;
  }
  await refreshAccount();

  // Restore work after any reload - including the magic-link sign-in, which
  // reloads the page. If the server session still holds a finished CV, take the
  // user straight back to the design step with everything intact.
  try {
    const stt = await api("/api/state");
    if (stt.hasCv) {
      STATE.hasCv = true; STATE.softDone = true;
      if (stt.designId && !STATE.designId) STATE.designId = stt.designId;
      // Rebuild step 3 from the server so the rewritten CV is viewable again
      // (the browser lost its in-memory copy on reload / sign-in).
      await ensureDraft();
      jumpToDesign = true;
    }
  } catch (_) {}

  if (jumpToDesign) {
    try {
      await loadDesigns(); showStep(4);
      // Let a returning visitor know we kept their work (only on a plain reload,
      // not straight after paying).
      if (STATE.hasCv && p.get("paid") !== "1") {
        const p4 = $("#p4");
        if (p4 && !document.getElementById("resumeNote")) {
          const n = document.createElement("div");
          n.id = "resumeNote"; n.className = "notice"; n.style.cssText = "border-color:var(--teal);margin-bottom:14px";
          n.innerHTML = '<strong style="color:var(--teal)">Welcome back.</strong> We kept your rewritten CV - pick up right here, choose a design and download.';
          p4.insertBefore(n, p4.firstChild);
        }
      }
    } catch (e) {}
  }
  if (p.get("signin") === "ok") { const b = $("#s4b"); if (b) b.textContent = "You're signed in - pick a design or add a cover letter below."; }
})();

// ── Voice recording ──
async function recordAnswer(id) {
  const label = document.querySelector(`[data-recs="${id}"]`);
  if (!navigator.mediaDevices) { label.textContent = "Recording not supported in this browser."; return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream); const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      label.innerHTML = '<span class="spinner"></span> Transcribing…';
      // Use the browser's actual recording type + matching file extension so
      // OpenAI recognises the audio format (Safari records mp4, Chrome webm).
      const mime = (rec.mimeType || (chunks[0] && chunks[0].type) || "audio/webm").split(";")[0];
      const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : mime.includes("mpeg") ? "mp3" : "webm";
      const fd = new FormData();
      fd.append("audio", new Blob(chunks, { type: mime }), "answer." + ext);
      try { const j = await api("/api/transcribe", { method: "POST", body: fd });
        document.querySelector(`[data-answer="${id}"]`).value = j.text; label.textContent = "Transcribed."; }
      catch (e) { label.textContent = "⚠ " + e.message + " - you can type your answer instead."; }
    };
    rec.start(); label.textContent = "Recording… click again to stop.";
    const btn = document.querySelector(`[data-rec="${id}"]`);
    btn.textContent = "■ Stop"; btn.onclick = () => { rec.stop(); btn.textContent = "● Record answer"; btn.onclick = () => recordAnswer(id); };
  } catch (e) { label.textContent = "⚠ Mic blocked."; }
}
