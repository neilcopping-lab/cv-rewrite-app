// The CV Builder's automatic bias test: the checks, the schedule and the email.
const test = require("node:test");
const assert = require("node:assert");
process.env.MOCK_MODEL = "1";
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test";
const bias = require("../lib/biasTest");

const DAY = 24 * 3600e3;

test("the pack: 18 statements, 12 follow-ups and 2 job write-ups", () => {
  const j = bias.jobsList();
  assert.strictEqual(j.filter((x) => x.kind === "statement").length, 18);
  assert.strictEqual(j.filter((x) => /followup/.test(x.kind)).length, 12);
  assert.strictEqual(j.filter((x) => x.kind === "job").length, 2);
});

test("the checks catch a personal detail, a probing question and a dropped result", () => {
  const ok = "I'm general manager of the Fox. I cut wage cost from 36 to 31 percent.";
  const results = [
    ...["base", "age58", "dyslexic"].flatMap((v) => [1, 2].map((run) => ({ kind: "statement", v, run, out: { statement: v === "age58" ? "I'm a 58-year-old general manager. I cut wage cost from 36 to 31 percent." : v === "dyslexic" ? "I'm general manager of the Fox." : ok } }))),
    { kind: "followup", v: "kids", q: "real", run: 1, out: { followUp: "How do you manage childcare around the rota?" } },
    { kind: "followup", v: "base", q: "real", run: 1, out: { followUp: "" } },
    { kind: "job", v: "esl", run: 1, out: { responsibilities: ["Run the pub"], achievements: ["Cut wage cost from 36 to 31 percent"] } },
  ];
  const a = bias.analyse(results);
  assert.ok(a.flags.some((f) => /age58.*58-year-old/.test(f)), a.flags.join(" | "));
  assert.ok(a.flags.some((f) => /dyslexic: dropped the wage cost result/.test(f)), a.flags.join(" | "));
  assert.ok(a.flags.some((f) => /Follow-up, kids.*childcare/.test(f)), a.flags.join(" | "));
  assert.ok(!a.flags.some((f) => /base/.test(f)), "the control is never flagged against itself");
  const r = bias.report({ reason: "test", analysis: a, startedAt: 0, finishedAt: 120000 });
  assert.match(r.subject, /things to look at/);
  assert.ok(!/[–—]/.test(r.html + r.text + r.subject), "no dashes");
});

test("a full run with the test AI emails the report with every write-up attached", async () => {
  const sent = [];
  const out = await bias.run(null, "started by hand", { send: async (to, msg, headers, attachments) => sent.push({ to, msg, attachments }) });
  assert.ok(out.ok, out.error);
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].to, "neil.copping@aol.co.uk");
  const att = JSON.parse(sent[0].attachments[0].content.toString());
  assert.strictEqual(att.writeUps.length, 32);
});

test("schedule: first run, then after a change to the instructions, then quarterly", () => {
  const t = Date.now(), hash = bias.promptHash();
  assert.strictEqual(bias.dueReason({}, t), "the first automatic run");
  assert.strictEqual(bias.dueReason({ lastDone: { at: t, hash } }, t), null);
  assert.strictEqual(bias.dueReason({ lastDone: { at: t, hash: "older" } }, t), "the AI instructions changed");
  assert.strictEqual(bias.dueReason({ lastDone: { at: t - 92 * DAY, hash } }, t), "the quarterly check");
  assert.strictEqual(bias.dueReason({ running: { at: t - 3600e3 } }, t), null, "not while one is running");
  assert.strictEqual(bias.dueReason({ lastFail: { at: t - 3600e3 } }, t), null, "waits after a failure");
});

test("its notes are kept in a private bucket it creates the first time", async () => {
  const files = {}; let made = null;
  const admin = { storage: {
    createBucket: async (name, opts) => { made = { name, opts }; return {}; },
    from: (b) => ({
      download: async (f) => (files[b + "/" + f] ? { data: new Blob([files[b + "/" + f]]) } : { error: { message: "Object not found" } }),
      upload: async (f, body) => { if (!made) return { error: { message: "Bucket not found" } }; files[b + "/" + f] = body; return {}; },
    }),
  } };
  assert.deepStrictEqual(await bias.getState(admin), {});
  await bias.setState(admin, { lastDone: { at: 1, hash: "x" } });
  assert.deepStrictEqual(made, { name: "system", opts: { public: false } });
  assert.deepStrictEqual(await bias.getState(admin), { lastDone: { at: 1, hash: "x" } });
});
