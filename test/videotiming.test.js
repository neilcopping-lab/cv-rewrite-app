const test = require("node:test");
const assert = require("node:assert");
const ai = require("../lib/anthropic");
const mw = require("../lib/masterWriter");

const segments = [
  { t: 0, text: "Hi I'm Sam and I'd love to be your next general manager" },
  { t: 6.2, text: "At the Fox I rebuilt the rota around when we were busy" },
  { t: 12.5, text: "and wage cost went from 36 to 31 percent in a year" },
  { t: 20.1, text: "Then the chef went off sick on the morning of a wedding" },
  { t: 27, text: "so I went on the pass myself and we got every course out" },
  { t: 34.4, text: "You'd get someone who's on the floor for every service" },
  { t: 40.8, text: "and who keeps their team. CV attached, happy to chat" },
];
const cards = { role: "General manager", s1skill: "Rota planning", s1proof: "", s2skill: "", s2proof: "", bring: [] };
const withReply = async (reply, fn) => { const real = ai.askJSON; ai.askJSON = async () => reply; try { return await fn(); } finally { ai.askJSON = real; } };

test("cards line up with the moment they're said", async () => {
  const out = await withReply({
    intro: 0, story1: 1, story2: 3, close: 5,
    story1Card: { skill: "Wage cost control", proof: "Wage cost from 36 to 31 percent" },
    story2Card: { skill: "Calm under pressure", proof: "Every course out — chef off sick" },
    bring: [{ text: "On the floor every service", piece: 5 }, { text: "Keeps their team", piece: 6 }],
    hook: "Want a GM who cut wage cost by 9 percent?",
  }, () => mw.videoTiming({ cv: {}, segments, cards, short: false }));
  assert.deepStrictEqual([out.timing.intro, out.timing.story1, out.timing.story2, out.timing.close], [0, 6.2, 20.1, 34.4]);
  assert.deepStrictEqual(out.timing.bring, [34.4, 40.8]);
  assert.strictEqual(out.words.s1.proof, "Wage cost from 36 to 31 percent", "numbers they said are kept");
  assert.ok(!/—/.test(out.words.s2.proof || ""), "no dashes");
  assert.notStrictEqual(out.words.hook, "Want a GM who cut wage cost by 9 percent?", "an invented number is dropped");
});

test("an answer that doesn't hold together falls back to even timings", async () => {
  const out = await withReply({ intro: 0, story1: 5, story2: 2, close: 9 }, () => mw.videoTiming({ cv: {}, segments, cards, short: false }));
  assert.ok(out.timing.intro < out.timing.story1 && out.timing.story1 < out.timing.story2 && out.timing.story2 < out.timing.close);
  assert.strictEqual(out.words.s1.skill, "Rota planning", "keeps their own card when the AI gives none");
});

test("the 30-second cut has no story two", async () => {
  const out = await withReply({ intro: 0, story1: 2, close: 5, story1Card: { skill: "Rota planning", proof: "Rebuilt the rota around busy times" } },
    () => mw.videoTiming({ cv: {}, segments, cards, short: true }));
  assert.strictEqual(out.timing.story2, null);
  assert.strictEqual(out.words.s2, null);
});

test("personal details never go on screen", async () => {
  const out = await withReply({ intro: 0, story1: 1, story2: 3, close: 5, story1Card: { skill: "Juggling", proof: "Around my two kids" }, bring: [] },
    () => mw.videoTiming({ cv: {}, segments: segments.concat([{ t: 46, text: "I fit it all around my two kids" }]), cards: { ...cards, s1skill: "" }, short: false }));
  assert.ok(!/kids/.test(JSON.stringify(out.words)));
});
