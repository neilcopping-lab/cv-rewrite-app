// My account: Your job hunt (with This week's two and the follow-up kit) and
// Your story bank. Hidden until the account has these features switched on.
(function () {
  "use strict";
  var CV = "https://cv.the-common-people.com/";
  var PREP = "https://prep.the-common-people.com/";
  var STAGES = [["saved", "Looking at it"], ["applied", "Applied"], ["interview", "Interview"], ["offer", "Offer"], ["no", "Not this time"], ["withdrawn", "Withdrawn"]];
  var FIT = { green: "Go for it", amber: "Worth a try", red: "A long shot" };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function get(u) { return fetch(u, { credentials: "same-origin", cache: "no-store" }).then(function (r) { return r.json().then(function (j) { j._status = r.status; return j; }); }); }
  function post(u, b) { return fetch(u, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "Something went wrong."); return j; }); }); }
  function day(v) { return v ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(v)) : ""; }
  function el(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }

  var tools = document.getElementById("tools");
  if (!tools) return;
  var hunt = el('<section class="card hidden" id="hunt-card" data-tab="search"><h2>Your job hunt</h2>' +
    '<p class="small">One card for each job you\'re going for. Your CV and the advert carry from CV Rewrite into Interview Prep, so you never upload them twice.</p>' +
    '<div id="hunt-week"></div><div id="hunt-list"></div>' +
    '<details style="margin-top:14px"><summary><b>Add a job by hand</b></summary><form id="hunt-add" style="margin-top:10px">' +
    '<label>Job title<input name="title" maxlength="200" required></label><label>Company<input name="company" maxlength="200"></label>' +
    '<label>The advert <span class="hint">Paste it in if you have it.</span><textarea name="advert" rows="4" maxlength="30000"></textarea></label>' +
    '<button class="btn btn-primary">Add this job</button></form></details></section>');
  var bank = el('<section class="card hidden" id="story-card" data-tab="search"><h2>Your story bank</h2>' +
    '<p class="small">The examples you\'d tell an employer: what happened, what you did and how it turned out. Save them once and use them for every CV, cover letter and interview.</p>' +
    '<div id="story-list"></div>' +
    '<details style="margin-top:14px"><summary><b>Add a story</b></summary><form id="story-add" style="margin-top:10px">' +
    '<label>A short title <span class="hint">For example: Calming an upset customer</span><input name="title" maxlength="200" required></label>' +
    '<label>What was going on?<textarea name="situation" rows="2" maxlength="3000"></textarea></label>' +
    '<label>What did you do?<textarea name="action" rows="3" maxlength="3000"></textarea></label>' +
    '<label>How did it turn out?<textarea name="result" rows="2" maxlength="3000"></textarea></label>' +
    '<label>Skills it shows <span class="hint">For example: patience, problem solving</span><input name="skills" maxlength="500"></label>' +
    '<button class="btn btn-primary">Save this story</button></form></details></section>');
  tools.parentNode.insertBefore(bank, tools.nextSibling);
  tools.parentNode.insertBefore(hunt, tools.nextSibling);

  // ---- jobs ----
  var jobs = [];
  function stageSelect(j) {
    return '<select data-act="stage" aria-label="Where this job is up to">' + STAGES.map(function (s) { return '<option value="' + s[0] + '"' + (j.status === s[0] ? " selected" : "") + ">" + s[1] + "</option>"; }).join("") + "</select>";
  }
  function nextBtn(j) {
    var n = j.next || {};
    if (n.kind === "apply") return '<a class="btn btn-primary" href="' + CV + "?job=" + encodeURIComponent(j.id) + '">' + esc(n.label) + "</a>";
    if (n.kind === "prep") return '<a class="btn btn-primary" href="' + PREP + "?job=" + encodeURIComponent(j.id) + '">' + esc(n.label) + "</a>";
    if (n.kind === "chase" || n.kind === "thanks" || n.kind === "feedback") return '<button class="btn btn-primary" data-act="draft" data-kind="' + n.kind + '">' + esc(n.label) + "</button>";
    return n.label ? '<p class="small">' + esc(n.label) + "</p>" : "";
  }
  function card(j) {
    var fit = j.fit ? '<span class="small"><b>' + FIT[j.fit] + "</b>" + (j.fit_note ? ": " + esc(j.fit_note) : "") + "</span>" : "";
    var dates = [j.applied_at ? "Applied " + day(j.applied_at) : "", j.interview_at ? "Interview " + day(j.interview_at) : "", j.chased_at ? "Chased " + day(j.chased_at) : "", j.thanked_at ? "Thanked " + day(j.thanked_at) : ""].filter(Boolean).join(" · ");
    return '<div class="card" data-id="' + esc(j.id) + '" style="padding:16px;margin:10px 0;border-left:5px solid ' + (j.this_week ? "#FF8A1F" : "#e6e2da") + '">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><strong>' + esc(j.title || "A job") + "</strong>" + (j.company ? '<br><span class="small">' + esc(j.company) + "</span>" : "") + "</div>" +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' + stageSelect(j) +
      '<label class="small" style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" data-act="week"' + (j.this_week ? " checked" : "") + "> This week</label></div></div>" +
      (fit ? '<p style="margin:8px 0 0">' + fit + "</p>" : "") + (dates ? '<p class="small" style="margin:6px 0 0">' + esc(dates) + "</p>" : "") +
      (j.status === "interview" ? '<label class="small" style="margin-top:8px">Interview date <input type="date" data-act="idate" value="' + (j.interview_at ? j.interview_at.slice(0, 10) : "") + '" style="max-width:180px"></label>' : "") +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center">' + nextBtn(j) +
      '<a class="btn btn-ghost" href="' + CV + "?job=" + encodeURIComponent(j.id) + '">CV</a><a class="btn btn-ghost" href="' + PREP + "?job=" + encodeURIComponent(j.id) + '">Interview prep</a>' +
      '<button class="btn btn-ghost" data-act="del" aria-label="Remove this job">Remove</button></div><div data-slot="draft"></div></div>';
  }
  function render() {
    var week = jobs.filter(function (j) { return j.this_week; });
    document.getElementById("hunt-week").innerHTML = '<div style="background:#FFF4E8;border-radius:12px;padding:14px 16px;margin:6px 0 4px"><strong>This week\'s two</strong><p class="small" style="margin:4px 0 0">' +
      (week.length ? "You're focusing on " + week.map(function (j) { return esc(j.title); }).join(" and ") + ". Two good applications beat fifty." : "Tick \"This week\" on the two jobs you'll put real effort into. Two good applications beat fifty.") + "</p></div>";
    document.getElementById("hunt-list").innerHTML = jobs.length ? jobs.map(card).join("") : '<p class="small">No jobs yet. When you tailor a CV in CV Rewrite or make a prep report while signed in, the job appears here.</p>';
  }
  function load() {
    get("/api/account/jobs").then(function (j) {
      if (j.setup || j._status === 503 || !j.jobs) return;
      jobs = j.jobs; hunt.classList.remove("hidden"); render();
    }).catch(function () {});
  }
  hunt.addEventListener("change", function (e) {
    var c = e.target.closest("[data-id]"); if (!c) return;
    var id = c.getAttribute("data-id"), act = e.target.getAttribute("data-act"), body = null;
    if (act === "stage") body = { status: e.target.value };
    if (act === "week") body = { thisWeek: e.target.checked };
    if (act === "idate") body = { interviewAt: e.target.value || null };
    if (!body) return;
    post("/api/account/jobs/" + encodeURIComponent(id), body).then(load).catch(function (err) { alertBox(c, err.message); load(); });
  });
  hunt.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-act]"); if (!b) return;
    var c = b.closest("[data-id]"), id = c.getAttribute("data-id"), act = b.getAttribute("data-act");
    if (act === "del") { if (window.confirm("Remove this job from your job hunt?")) post("/api/account/jobs/" + encodeURIComponent(id) + "/delete", {}).then(load); return; }
    if (act === "draft") {
      var kind = b.getAttribute("data-kind");
      post("/api/account/jobs/" + encodeURIComponent(id) + "/draft", { kind: kind }).then(function (d) {
        c.querySelector('[data-slot="draft"]').innerHTML = '<div style="margin-top:12px"><label>Subject<input data-f="s" value="' + esc(d.subject) + '"></label><label>Message<textarea data-f="b" rows="9">' + esc(d.body) + "</textarea></label>" +
          '<p class="small">Change anything you like, then copy it into your own email. It goes from you.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-ghost" data-act="copy">Copy</button>' +
          (kind === "feedback" ? "" : '<button class="btn btn-primary" data-act="sent" data-kind="' + kind + '">I\'ve sent it</button>') + "</div></div>";
      }).catch(function (err) { alertBox(c, err.message); });
    }
    if (act === "copy") { var t = c.querySelector('[data-f="s"]').value + "\n\n" + c.querySelector('[data-f="b"]').value; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { b.textContent = "Copied"; }, function () { b.textContent = "Select and copy the text"; }); }
    if (act === "sent") { var k = b.getAttribute("data-kind"); post("/api/account/jobs/" + encodeURIComponent(id), k === "chase" ? { chasedAt: new Date().toISOString() } : { thankedAt: new Date().toISOString() }).then(load); }
  });
  function alertBox(c, msg) { var s = c.querySelector('[data-slot="draft"]'); if (s) s.innerHTML = '<p class="small" style="color:#B42318">' + esc(msg) + "</p>"; }
  document.getElementById("hunt-add").addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target;
    post("/api/account/jobs", { title: f.title.value, company: f.company.value, advert: f.advert.value }).then(function () { f.reset(); load(); }).catch(function (err) { window.alert(err.message); });
  });

  // ---- stories ----
  function storyHtml(s) {
    return '<div class="card" data-sid="' + esc(s.id) + '" style="padding:16px;margin:10px 0"><strong>' + esc(s.title) + "</strong>" + (s.skills ? '<br><span class="small">' + esc(s.skills) + "</span>" : "") +
      [["What was going on", s.situation], ["What I did", s.action], ["How it turned out", s.result]].filter(function (x) { return x[1]; }).map(function (x) { return '<p class="small" style="margin:6px 0 0"><b>' + x[0] + ":</b> " + esc(x[1]) + "</p>"; }).join("") +
      '<div style="margin-top:8px"><button class="btn btn-ghost" data-sact="del">Delete</button></div></div>';
  }
  function loadStories() {
    get("/api/account/stories").then(function (j) {
      if (!j.stories) return;
      bank.classList.remove("hidden");
      document.getElementById("story-list").innerHTML = j.stories.length ? j.stories.map(storyHtml).join("") : '<p class="small">No stories yet. Add one below, or save one from CV Rewrite or Interview Prep.</p>';
    }).catch(function () {});
  }
  bank.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-sact]"); if (!b) return;
    var id = b.closest("[data-sid]").getAttribute("data-sid");
    if (window.confirm("Delete this story?")) post("/api/account/stories/" + encodeURIComponent(id) + "/delete", {}).then(loadStories);
  });
  document.getElementById("story-add").addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target;
    post("/api/account/stories", { title: f.title.value, situation: f.situation.value, action: f.action.value, result: f.result.value, skills: f.skills.value }).then(function () { f.reset(); loadStories(); }).catch(function (err) { window.alert(err.message); });
  });

  load(); loadStories();
})();
