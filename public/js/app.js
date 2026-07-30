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

// Progress countdown shown while a long step runs. Fills a bar toward ~92%
// over an estimate, counts seconds up, and rotates reassuring messages. The
// returned object's done()/fail() finish it. Never claims 100% until done.
function startProgress(hostId, estimate, messages) {
  let host = document.getElementById(hostId);
  if (!host) {
    host = document.createElement("div");
    host.id = hostId;
    const anchor = document.getElementById(hostId.replace("prog", "go")) || document.body;
    (anchor.parentNode || document.body).appendChild(host);
  }
  host.innerHTML =
    '<div class="progress"><div class="bar"><i></i></div>' +
    '<div class="meta"><span class="msg"></span><span class="secs">0s</span></div></div>';
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

// ── STEP 1 ──
$("#go1").onclick = async () => {
  const s = $("#s1"); s.textContent = "";
  const prog = startProgress("prog1", 25, [
    "Reading your CV", "Reading the job advert",
    "Comparing them line by line", "Spotting the gaps"
  ]);
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
    const g = await api("/api/gaps", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    renderGaps(g); prog.done(); showStep(2);
  } catch (e) { prog.fail(e.message); }
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
  const s = $("#s2"); s.textContent = "";
  const prog = startProgress("prog2", 45, [
    "Pulling out your achievements", "Writing in your own voice",
    "Tailoring it to the role", "Checking every claim traces back to you",
    "Final polish"
  ]);
  try {
    const answers = STATE.questions.map((q) => {
      const id = q.id;
      const ta = document.querySelector(`[data-answer="${id}"]`);
      return { id, question: q.question, answer: ta ? ta.value.trim() : "" };
    }).filter((a) => a.answer);
    STATE.answers = answers;
    const j = await api("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) });
    STATE.cv = j.cv; renderDraft(j); prog.done(); showStep(3);
  } catch (e) { prog.fail(e.message); }
};

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
    $("#leaveAllBtn").onclick = () => { $$("[data-mdrop]").forEach((c) => (c.checked = true)); resolveMissing(); };
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

async function resolveMissing() {
  // Place the progress bar next to the re-check button.
  const sr = document.getElementById("sr");
  if (sr && !document.getElementById("progr")) {
    const d = document.createElement("div"); d.id = "progr"; sr.parentNode.appendChild(d);
  }
  const prog = startProgress("progr", 30, [
    "Taking your answers on board", "Rewriting the affected lines",
    "Re-checking every claim"
  ]);
  try {
    const resolutions = [], acceptLeaveOut = [];
    (STATE.cv.missing || []).forEach((m, i) => {
      const ta = document.querySelector(`[data-mresolve="${i}"]`);
      const drop = document.querySelector(`[data-mdrop="${i}"]`);
      if (ta && ta.value.trim()) resolutions.push({ item: m.item, answer: ta.value.trim() });
      if (drop && drop.checked) acceptLeaveOut.push(m.item);
    });
    const j = await api("/api/resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolutions, acceptLeaveOut }) });
    STATE.cv = j.cv; renderDraft(j); prog.done();
  } catch (e) { prog.fail(e.message); }
}

$("#regen").onclick = async () => {
  const prog = startProgress("prog3", 45, [
    "Starting your CV fresh", "Writing in your own voice",
    "Tailoring it to the role", "Checking every claim traces back to you"
  ]);
  try {
    const j = await api("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: STATE.answers }) });
    STATE.cv = j.cv; renderDraft(j); prog.done();
  } catch (e) { prog.fail(e.message); }
};

async function previewDraft() {
  try { const j = await api("/api/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ designId: STATE.designId || "modern-minimal" }) }); $("#draftPreview").innerHTML = j.html; }
  catch (e) { $("#draftPreview").innerHTML = '<p class="muted">Preview needs a generated CV.</p>'; }
}

// ── STEP 3 -> 4 ──
$("#go3").onclick = async () => { await loadDesigns(); await refreshAccount(); showStep(4); };

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
  if (a.signedIn) {
    st.innerHTML = `Signed in as <strong>${a.email}</strong> · <strong style="color:var(--gold)">${a.credits} CV credit${a.credits === 1 ? "" : "s"}</strong>`;
    act.innerHTML = `<button class="btn ghost" id="signoutBtn" style="padding:8px 12px">Sign out</button>`;
    const so = $("#signoutBtn"); if (so) so.onclick = async () => { await api("/api/auth/logout", { method: "POST" }); await refreshAccount(); };
  } else {
    st.innerHTML = "Not signed in. You'll sign in with your email when you're ready to buy credits and download.";
    act.innerHTML = "";
  }
}
function renderStep4Payment() {
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

// Sign-in: email a magic link.
const signinBtn = $("#signinBtn");
if (signinBtn) signinBtn.onclick = async () => {
  const em = $("#signinEmail").value.trim(); const msg = $("#signinMsg");
  if (!em) { busy(msg, false, "Enter your email."); return; }
  busy(msg, true, "Sending your link…");
  try {
    const j = await api("/api/auth/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: em }) });
    if (j.sent) busy(msg, false, "Check your email for a sign-in link, then come back to this tab.");
    else if (j.devLink) msg.innerHTML = `Email isn't set up, so here's your link: <a href="${j.devLink}" style="color:var(--teal);text-decoration:underline">click to sign in</a>.`;
    else busy(msg, false, "Link sent.");
  } catch (e) { busy(msg, false, "⚠ " + e.message); }
};

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
      if (r.status === 402) { await refreshAccount(); busy(s, false, "You're out of CV credits — choose a pack below."); return; }
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
  } catch (e) { busy(s, false, "⚠ " + e.message); }
}
$$("[data-dl]").forEach((b) => (b.onclick = () => downloadFile(b.dataset.dl)));

// On load: handle return from Stripe / sign-in, then load account state.
(async function init() {
  const p = new URLSearchParams(location.search);
  if (p.get("paid") === "1") {
    try { await api("/api/confirm-payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cs: p.get("cs") }) }); } catch (e) {}
    try { await loadDesigns(); showStep(4); } catch (e) {}
  }
  await refreshAccount();
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
      catch (e) { label.textContent = "⚠ " + e.message + " — you can type your answer instead."; }
    };
    rec.start(); label.textContent = "Recording… click again to stop.";
    const btn = document.querySelector(`[data-rec="${id}"]`);
    btn.textContent = "■ Stop"; btn.onclick = () => { rec.stop(); btn.textContent = "● Record answer"; btn.onclick = () => recordAnswer(id); };
  } catch (e) { label.textContent = "⚠ Mic blocked."; }
}
