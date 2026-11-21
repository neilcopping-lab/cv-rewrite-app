const test = require("node:test");
const assert = require("node:assert");
process.env.ACCOUNT_LINK_SECRET = "test-secret";
const weekly = require("../accounts/weekly");
const js = require("../accounts/jobsearch");

// Monday 24 Nov 2025 09:00 UK, and the Sunday before.
const MON = Date.parse("2025-11-24T09:00:00Z");
const SUN = Date.parse("2025-11-23T09:00:00Z");
const DAY = 86400000;

test("only sends on Monday mornings, UK time", () => {
  assert.equal(weekly.isMondayMorningUK(MON), true);
  assert.equal(weekly.isMondayMorningUK(SUN), false);
  assert.equal(weekly.isMondayMorningUK(Date.parse("2025-11-24T05:00:00Z")), false);
});

test("shows the two picked jobs, a due chase, escapes and never em dashes", () => {
  const jobs = [
    { title: "Chef <de partie>", company: "The Swan", status: "applied", this_week: true, applied_at: new Date(MON - 2 * DAY).toISOString() },
    { title: "Sous chef", company: "", status: "saved", this_week: true },
    { title: "Waiter", company: "Bistro", status: "applied", this_week: false, applied_at: new Date(MON - 12 * DAY).toISOString() },
  ];
  const m = weekly.weeklyEmail("Sam Jones", jobs, { stop: "https://x/stop" }, MON);
  assert.match(m.subject, /Your two this week, Sam/);
  assert.match(m.html, /Chef &lt;de partie&gt;/);
  assert.match(m.html, /Heard nothing back/);
  assert.match(m.text, /Waiter at Bistro/);
  assert.match(m.text, /https:\/\/x\/stop/);
  assert.doesNotMatch(m.html + m.text + m.subject, /—/);
});

test("asks them to pick when nothing is picked", () => {
  const m = weekly.weeklyEmail("", [{ title: "Barista", status: "saved" }], { stop: "s" }, MON);
  assert.equal(m.subject, "Which two this week?");
  assert.match(m.text, /Pick my two/);
});

test("the stop link works, and does nothing else", () => {
  const t = js.sign("user-1", "stopweekly", 10 * DAY, MON);
  assert.deepEqual(js.verify(t, MON + DAY), { userId: "user-1", action: "stopweekly" });
});

test("runWeekly sends once, skips paused people and empty lists", async () => {
  const sent = [], updates = [];
  const rows = {
    subscriptions: [
      { user_id: "a", weekly_sent_at: null },
      { user_id: "b", weekly_sent_at: null },
      { user_id: "c", weekly_sent_at: new Date(MON - 2 * DAY).toISOString() },
      { user_id: "d", weekly_sent_at: null },
    ],
    profiles: { a: { full_name: "Ann", search_status: "looking" }, b: { full_name: "Bo", search_status: "paused" }, c: { search_status: "looking" }, d: { search_status: "looking" } },
    job_hunt: { a: [{ title: "Chef", status: "saved" }], d: [] },
  };
  const q = (table) => {
    const st = { table, f: {} };
    const api = {
      select() { return api; }, order() { return api; }, limit() { return api; }, in() { return api; },
      eq(k, v) { st.f[k] = v; return api; },
      update(v) { st.update = v; return api; },
      maybeSingle() { return Promise.resolve({ data: rows.profiles[st.f.id] }); },
      then(res, rej) {
        if (st.update) { updates.push([table, st.f, st.update]); return Promise.resolve({ error: null }).then(res, rej); }
        if (table === "subscriptions") return Promise.resolve({ data: rows.subscriptions }).then(res, rej);
        if (table === "job_hunt") return Promise.resolve({ data: rows.job_hunt[st.f.user_id] || [] }).then(res, rej);
        return Promise.resolve({ data: null }).then(res, rej);
      },
    };
    return api;
  };
  const admin = { from: q, auth: { admin: { getUserById: async (id) => ({ data: { user: { email: id + "@x.test" } } }) } } };
  const r = await weekly.runWeekly({ admin, now: MON, send: async (to, msg, h) => sent.push([to, msg, h]) });
  assert.equal(r.sent, 1);
  assert.equal(r.empty, 1);
  assert.equal(sent[0][0], "a@x.test");
  assert.match(sent[0][2]["List-Unsubscribe"], /\/account\/unsub\?t=/);
  assert.equal(updates.length, 1);
  const off = await weekly.runWeekly({ admin, now: SUN, send: async () => { throw new Error("no"); } });
  assert.deepEqual(off.skipped, ["not monday"]);
});
