// My job search, one-tap email links, the monthly check-in, the 12 month
// closing rule with two warnings, and the profile photo clean-up.
const test = require("node:test");
const assert = require("node:assert");

process.env.ACCOUNT_LINK_SECRET = "test-secret";
const js = require("../accounts/jobsearch");
const inactive = require("../accounts/inactive");
const photo = require("../accounts/photo");

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2027, 10, 20, 12);

// A tiny stand-in for the Supabase admin client: tables in memory.
function fakeAdmin({ users, profiles, subs }) {
  const t = { profiles: profiles || [], subscriptions: subs || [], consent_log: [] };
  const deleted = [];
  function q(name) {
    let rows = t[name], filters = [];
    const api = {
      select() { return api; },
      eq(k, v) { filters.push((r) => r[k] === v); return api; },
      in(k, vs) { filters.push((r) => vs.includes(r[k])); return api; },
      maybeSingle() { return Promise.resolve({ data: rows.filter((r) => filters.every((f) => f(r)))[0] || null, error: null }); },
      then(res) { return Promise.resolve({ data: rows.filter((r) => filters.every((f) => f(r))), error: null }).then(res); },
      update(patch) {
        return { eq(k, v) { rows.filter((r) => r[k] === v).forEach((r) => Object.assign(r, patch)); return Promise.resolve({ error: null }); } };
      },
      upsert(row, o) {
        const key = (o && o.onConflict) || "id";
        const ex = rows.find((r) => r[key] === row[key]);
        if (ex) Object.assign(ex, row); else rows.push({ ...row });
        return Promise.resolve({ error: null });
      },
      insert(row) { [].concat(row).forEach((r) => rows.push(r)); return Promise.resolve({ error: null }); },
    };
    return api;
  }
  return {
    t, deleted,
    from: q,
    auth: { admin: {
      listUsers: async () => ({ data: { users }, error: null }),
      getUserById: async (id) => ({ data: { user: users.find((u) => u.id === id) || null }, error: null }),
    } },
  };
}

test("one-tap links: genuine, tamper-proof, and they expire", () => {
  const tok = js.sign("user-1", "gotjob", 10 * DAY, NOW);
  assert.deepStrictEqual(js.verify(tok, NOW + DAY), { userId: "user-1", action: "gotjob" });
  assert.strictEqual(js.verify(tok, NOW + 11 * DAY).error, "expired");
  const [body, mac] = tok.split(".");
  const evil = Buffer.from(JSON.stringify({ u: "user-2", a: "gotjob", e: NOW + 10 * DAY })).toString("base64url");
  assert.strictEqual(js.verify(evil + "." + mac, NOW).error, "broken", "someone else's id with the old signature");
  assert.strictEqual(js.verify(body + ".AAAA", NOW).error, "broken");
  assert.strictEqual(js.verify("", NOW).error, "broken");
  assert.throws(() => js.sign("user-1", "delete-everything", DAY, NOW), "only the four known actions can be signed");
});

test("check-in email: three buttons, no promotion, unsubscribe link", () => {
  const m = js.checkinEmail("Sam Taylor", { still: "S", gotjob: "G", stop: "X" });
  assert.match(m.subject, /Sam/);
  for (const l of ['href="S"', 'href="G"', 'href="X"']) assert.ok(m.html.includes(l), l);
  assert.ok(!/loudspeaker|guide|dispatch|£|offer|subscribe to/i.test(m.text), "no promotion in a check-in");
  assert.ok(!/[–—]/.test(m.html + m.text + m.subject), "no dashes");
});

test("check-ins: only to people who ticked, only while looking, once a month", async () => {
  const users = ["a", "b", "c", "d", "e"].map((id) => ({ id, email: id + "@x.com", created_at: new Date(NOW - 400 * DAY).toISOString() }));
  const admin = fakeAdmin({
    users,
    profiles: [
      { id: "a", full_name: "Ann", search_status: "looking", checkin_clock_at: new Date(NOW - 31 * DAY).toISOString() }, // due
      { id: "b", full_name: "Bob", search_status: "looking", checkin_clock_at: new Date(NOW - 10 * DAY).toISOString() }, // not yet
      { id: "c", full_name: "Cat", search_status: "paused", checkin_clock_at: new Date(NOW - 60 * DAY).toISOString() },  // paused
      { id: "d", full_name: "Dan", search_status: "looking", checkin_clock_at: new Date(NOW - 60 * DAY).toISOString() }, // not ticked
      { id: "e", full_name: "Eve", search_status: "looking", checkin_clock_at: null },                                     // clock starts
    ],
    subs: [{ user_id: "a", checkin: true }, { user_id: "b", checkin: true }, { user_id: "c", checkin: true }, { user_id: "d", checkin: false }, { user_id: "e", checkin: true }],
  });
  const sent = [];
  const r = await js.runCheckins({ admin, now: NOW, send: async (to, msg, headers) => sent.push({ to, msg, headers }) });
  assert.deepStrictEqual(sent.map((s) => s.to), ["a@x.com"]);
  assert.strictEqual(r.started, 1, "Eve's clock starts, first email in a month");
  assert.ok(sent[0].headers["List-Unsubscribe"].includes("/account/unsub?t="));
  assert.strictEqual(sent[0].headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  const again = [];
  await js.runCheckins({ admin, now: NOW + DAY, send: async (to) => again.push(to) });
  assert.deepStrictEqual(again, [], "nobody gets two in a month");
});

test("one-tap actions: got a job pauses, stop records the consent change, any button keeps the account open", async () => {
  const users = [{ id: "a", email: "a@x.com" }];
  const admin = fakeAdmin({ users, profiles: [{ id: "a", search_status: "looking", inactivity_warned_at: "x", inactivity_final_warned_at: "y" }], subs: [{ user_id: "a", checkin: true }] });
  await js.perform(admin, "a", "gotjob");
  const p = admin.t.profiles[0];
  assert.strictEqual(p.search_status, "paused");
  assert.strictEqual(p.inactivity_warned_at, null);
  assert.strictEqual(p.inactivity_final_warned_at, null);
  await js.perform(admin, "a", "stopcheckin");
  assert.strictEqual(admin.t.subscriptions[0].checkin, false);
  assert.deepStrictEqual(admin.t.consent_log.map((c) => [c.topic, c.granted, c.source]), [["checkin", false, "email"]]);
  assert.deepStrictEqual(await js.perform(admin, "gone", "keep"), { gone: true });
});

test("closing rule: warning a month before, second a week before, close only after both", async () => {
  const last = NOW - 340 * DAY;
  const users = [{ id: "a", email: "a@x.com", created_at: new Date(last).toISOString() }, { id: "b", email: "b@x.com", created_at: new Date(NOW).toISOString() }];
  for (let i = 0; i < 4; i++) users.push({ id: "z" + i, email: `z${i}@x.com`, created_at: new Date(NOW).toISOString() });
  const admin = fakeAdmin({ users, profiles: users.map((u) => ({ id: u.id, full_name: "Ann" })) });
  const sent = [], closed = [];
  const deps = (now) => ({ admin, now, send: async (to, msg) => sent.push({ to, subject: msg.subject, html: msg.html }), closeAccount: async (u) => closed.push(u.id) });

  // 340 days: nothing yet (first warning at 335 days, i.e. 30 days before 365)
  let r = await inactive.runOnce(deps(last + 330 * DAY));
  assert.strictEqual(r.warned, 0);
  r = await inactive.runOnce(deps(last + 336 * DAY));
  assert.strictEqual(r.warned, 1);
  assert.match(sent[0].subject, /will close on/);
  assert.ok(sent[0].html.includes("/account/do?t="), "Keep my account works without signing in");
  assert.ok(/12 months/.test(sent[0].html));
  // Same day again: no repeat
  r = await inactive.runOnce(deps(last + 337 * DAY));
  assert.strictEqual(r.warned + r.finalWarned, 0);
  // A week before closing: the second warning
  r = await inactive.runOnce(deps(last + 359 * DAY));
  assert.strictEqual(r.finalWarned, 1);
  assert.match(sent[1].subject, /Last reminder/);
  // Day 365 but only 6 days after the second warning: not yet
  r = await inactive.runOnce(deps(last + 365 * DAY));
  assert.strictEqual(r.closed, 0);
  r = await inactive.runOnce(deps(last + 366.5 * DAY));
  assert.strictEqual(r.closed, 1);
  assert.deepStrictEqual(closed, ["a"]);
  assert.ok(!/[–—]/.test(sent.map((s) => s.subject + s.html).join("")), "no dashes");
});

test("closing rule: coming back after a warning clears both and restarts the clock", async () => {
  const last = NOW - 340 * DAY;
  const users = [{ id: "a", email: "a@x.com", created_at: new Date(last).toISOString() }];
  for (let i = 0; i < 5; i++) users.push({ id: "z" + i, email: `z${i}@x.com`, created_at: new Date(NOW).toISOString() });
  const admin = fakeAdmin({ users, profiles: users.map((u) => ({ id: u.id })) });
  const sent = [];
  const deps = (now) => ({ admin, now, send: async (to, msg) => sent.push(msg.subject), closeAccount: async () => assert.fail("must not close") });
  await inactive.runOnce(deps(last + 336 * DAY));
  await inactive.runOnce(deps(last + 359 * DAY));
  admin.t.profiles[0].last_seen_at = new Date(last + 360 * DAY).toISOString(); // pressed Keep my account
  const r = await inactive.runOnce(deps(last + 370 * DAY));
  assert.strictEqual(r.cleared, 1);
  assert.strictEqual(admin.t.profiles[0].inactivity_warned_at, null);
  assert.strictEqual(admin.t.profiles[0].inactivity_final_warned_at, null);
  const r2 = await inactive.runOnce(deps(last + 380 * DAY));
  assert.strictEqual(r2.closed, 0);
});

test("closing rule: never closes if the second warning didn't go", async () => {
  const last = NOW - 400 * DAY;
  const users = [{ id: "a", email: "a@x.com", created_at: new Date(last).toISOString() }];
  for (let i = 0; i < 5; i++) users.push({ id: "z" + i, email: `z${i}@x.com`, created_at: new Date(NOW).toISOString() });
  const admin = fakeAdmin({ users, profiles: users.map((u) => ({ id: u.id })) });
  let fail = false;
  const deps = (now) => ({ admin, now, send: async () => { if (fail) throw new Error("email down"); }, closeAccount: async () => assert.fail("must not close") });
  await inactive.runOnce(deps(NOW)); // first warning
  fail = true;
  for (let d = 1; d < 60; d += 3) await inactive.runOnce(deps(NOW + d * DAY));
  assert.ok(!admin.t.profiles[0].inactivity_final_warned_at);
});

test("photo: hidden camera and location details are stripped", () => {
  const seg = (m, body) => Buffer.concat([Buffer.from([0xff, m]), Buffer.from([(body.length + 2) >> 8, (body.length + 2) & 255]), body]);
  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe0, Buffer.from("JFIF\0\x01\x01\0\0\x01\0\x01\0\0", "binary")),
    seg(0xe1, Buffer.from("Exif\0\0GPS 51.75N 0.34W", "binary")),
    seg(0xfe, Buffer.from("taken at home")),
    seg(0xdb, Buffer.alloc(65, 1)),
    Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]),
  ]);
  const out = photo.stripJpeg(jpeg);
  assert.ok(out);
  assert.ok(!out.includes("GPS") && !out.includes("taken at home") && !out.includes("Exif"));
  assert.ok(out.includes("JFIF"));
  assert.strictEqual(photo.stripJpeg(Buffer.from("not a jpeg at all")), null);
  assert.strictEqual(photo.stripJpeg(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff])), null, "a broken file is refused");
});
