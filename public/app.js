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
async function api(url, opts) {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ("Request failed: " + r.status));
  return j;
}

// ── STEP 1 ──
$("#go1").onclick = async () => {
  const s = $("#s1"); busy(s, true, "Reading your CV and the advert…");
  try {
    const fd = new FormData();
    if ($("#cvFile").files[0]) fd.append("cvFile", $("#cvFile").files[0]);
    if ($("#cvText").value.trim()) fd.append("cvText", $("#cvText").value.trim());
    if ($("#advertFile").files[0]) fd.append("advertFile", $("#advertFile").files[0]);
    if ($("#advertUrl").value.trim()) fd.append("advertUrl", $("#advertUrl").value.trim());
    if ($("#advertText").value.trim()) fd.append("advertText", $("#advertText").value.trim());
    const ex = await api("/api/extract", { method: "POST", body: fd });
    // Show the extracted text in the boxes so you can see it worked and edit it.
    if (ex.cvText) $("#cvText").value = ex.cvText;
    if (ex.advertText) $("#advertText").value = ex.advertText;
    busy(s, true, "Comparing the advert against your CV…");
    const g = await api("/api/gaps", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    renderGaps(g); busy(s, false, ""); showStep(2);
  } catch (e) { busy(s, false, "⚠ " + e.message); }
};

function renderGaps(g) {
  if (g.note) { const n = $("#gapNote"); n.classList.remove("hidden"); n.textContent = g.note; }
  const reqs = g.requirements || [];
  const covered = reqs.filter((r) => r.status === "covered").length;
  const thin = reqs.filter((r) => r.status === "thin").length;
  const missing = reqs.filter((r) => r.status === "missing").length;
  $("#reqSummary").innerHTML = reqs.length
    ? `<div class="notice sans">Advert requirements: <strong>${covered}</strong> already covered, <strong>${thin}</strong> thin, <strong>${missing}</strong> missing. We only ask about the last two.</div>`
    : "";
  STATE.questions = [...(g.gapQuestions || []), ...(g.sectionQuestions || [])];
  $("#questions").innerHTML = STATE.questions.map((q, i) => {
    const tag = q.requirement ? "Gap" : (q.section || "Section");
    const id = q.id || "q" + i;
    return `<div class="q" data-qid="${id}">
      <div class="tag">${tag}</div>
      <div class="qtext">${q.question}</div>
      <textarea data-answer="${id}" placeholder="Your answer (optional but it makes the rewrite better)"></textarea>
      <button class="btn ghost sans" style="font-size:13px;padding:8px 12px" data-rec="${id}">● Record answer</button>
      <span class="sans muted" data-recs="${id}"></span>
    </div>`;
  }).join("");
  $$("[data-rec]").forEach((b) => (b.onclick = () => recordAnswer(b.dataset.rec)));
}

// ── STEP 2 ──
$("#go2").onclick = async () => {
  const s = $("#s2"); busy(s, true, "Writing your CV, then checking it for anything invented…");
  try {
    const answers = STATE.questions.map((q) => {
      const id = q.id;
      const ta = document.querySelector(`[data-answer="${id}"]`);
      return { id, question: q.question, answer: ta ? ta.value.trim() : "" };
    }).filter((a) => a.answer);
    STATE.answers = answers;
    const j = await api("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) });
    STATE.cv = j.cv; renderDraft(j); busy(s, false, ""); showStep(3);
  } catch (e) { busy(s, false, "⚠ " + e.message); }
};

function renderDraft(j) {
  const banner = $("#checkBanner");
  banner.style.borderColor = j.downloadBlocked ? "var(--accent)" : "var(--ink)";
  banner.innerHTML = `<span class="sans">${j.message || ""}</span>`;
  // missing / fabrication flags to resolve
  const missing = j.missing || [];
  $("#missingBox").innerHTML = missing.length
    ? `<div class="flag"><strong class="sans">Before you can download, sort these ${missing.length}:</strong></div>` +
      missing.map((m, i) => `<div class="q" data-mi="${i}">
        <div class="tag">Flagged</div><div class="qtext">${m.question || m.item}</div>
        <textarea data-mresolve="${i}" placeholder="Answer, or leave blank to drop it"></textarea>
        <label class="sans" style="font-weight:400;font-size:13px"><input type="checkbox" data-mdrop="${i}"> I'm fine leaving this out</label>
      </div>`).join("") +
      `<p><button class="btn accent" id="resolveBtn">Apply and re-check</button> <span id="sr" class="sans muted"></span></p>`
    : "";
  if (missing.length) $("#resolveBtn").onclick = resolveMissing;
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

async function resolveMissing() {
  const s = $("#sr"); busy(s, true, "Re-checking…");
  try {
    const resolutions = [], acceptLeaveOut = [];
    (STATE.cv.missing || []).forEach((m, i) => {
      const ta = document.querySelector(`[data-mresolve="${i}"]`);
      const drop = document.querySelector(`[data-mdrop="${i}"]`);
      if (ta && ta.value.trim()) resolutions.push({ item: m.item, answer: ta.value.trim() });
      if (drop && drop.checked) acceptLeaveOut.push(m.item);
    });
    const j = await api("/api/resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolutions, acceptLeaveOut }) });
    STATE.cv = j.cv; renderDraft(j); busy(s, false, "");
  } catch (e) { busy(s, false, "⚠ " + e.message); }
}

$("#regen").onclick = async () => {
  const s = $("#s3"); busy(s, true, "Regenerating…");
  try {
    const j = await api("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: STATE.answers }) });
    STATE.cv = j.cv; renderDraft(j); busy(s, false, "");
  } catch (e) { busy(s, false, "⚠ " + e.message); }
};

async function previewDraft() {
  try { const j = await api("/api/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ designId: STATE.designId || "modern-minimal" }) }); $("#draftPreview").innerHTML = j.html; }
  catch (e) { $("#draftPreview").innerHTML = '<p class="muted">Preview needs a generated CV.</p>'; }
}

// ── STEP 3 -> 4 ──
$("#go3").onclick = async () => { await loadDesigns(); showStep(4); };

async function loadDesigns() {
  if (!STATE.designs.length) { const j = await api("/api/designs"); STATE.designs = j.designs; }
  STATE.designId = STATE.designId || STATE.designs[0].id;
  $("#designGrid").innerHTML = STATE.designs.map((d) =>
    `<div class="design-card ${d.id === STATE.designId ? "sel" : ""}" data-d="${d.id}">
      <img class="thumb" src="/img/thumbs/${d.id}.svg" alt="${d.name}" onerror="this.style.opacity=.3">
      <div class="meta"><h4>${d.name}</h4><p>${d.description}</p></div>
    </div>`).join("");
  $$("[data-d]").forEach((c) => (c.onclick = () => selectDesign(c.dataset.d)));
  livePreview();
}
async function selectDesign(id) {
  STATE.designId = id;
  $$(".design-card").forEach((c) => c.classList.toggle("sel", c.dataset.d === id));
  livePreview();
}
async function livePreview() {
  try { const j = await api("/api/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ designId: STATE.designId }) }); $("#livePreview").innerHTML = j.html; }
  catch (e) { $("#livePreview").innerHTML = '<p class="muted">' + e.message + "</p>"; }
}

// ── Payment + download ──
$("#pay").onclick = async () => {
  const s = $("#s4"); busy(s, true, "Opening secure checkout…");
  try {
    const j = await api("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ designId: STATE.designId, email: $("#email").value.trim() }) });
    window.location.href = j.url;
  } catch (e) {
    // Dev mode with no Stripe key: allow direct unlock so the flow is testable.
    if (/not configured/i.test(e.message)) { $("#downloads").classList.remove("hidden"); busy(s, false, "Payment not configured in this environment - downloads shown for testing."); }
    else busy(s, false, "⚠ " + e.message);
  }
};

$$("[data-dl]").forEach((b) => (b.onclick = () => {
  const type = b.dataset.dl;
  window.location.href = `/api/download?type=${type}&design=${encodeURIComponent(STATE.designId)}`;
}));

// Return from Stripe success
(async function checkPaid() {
  const p = new URLSearchParams(location.search);
  if (p.get("paid") === "1") {
    try { const j = await api("/api/confirm-payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cs: p.get("cs") }) });
      if (j.paid) { await loadDesigns(); showStep(4); $("#downloads").classList.remove("hidden"); }
    } catch (e) {}
  }
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
      const fd = new FormData(); fd.append("audio", new Blob(chunks, { type: "audio/webm" }), "a.webm");
      try { const j = await api("/api/transcribe", { method: "POST", body: fd });
        document.querySelector(`[data-answer="${id}"]`).value = j.text; label.textContent = "Transcribed."; }
      catch (e) { label.textContent = "⚠ " + e.message; }
    };
    rec.start(); label.textContent = "Recording… click again to stop.";
    const btn = document.querySelector(`[data-rec="${id}"]`);
    btn.textContent = "■ Stop"; btn.onclick = () => { rec.stop(); btn.textContent = "● Record answer"; btn.onclick = () => recordAnswer(id); };
  } catch (e) { label.textContent = "⚠ Mic blocked."; }
}
