const test = require("node:test");
const assert = require("node:assert");
const ai = require("../lib/anthropic");
const mw = require("../lib/masterWriter");

const cv = {
  journey: "first",
  header: { targetRole: "Trainee chef" },
  videoPlan: { role: "Trainee chef", company: "The Swan", intro: "Hi, I'm [NAME]\nGot into it through my Saturday job", story1: "Where: my uncle's cafe\nWhat I did: served customers and cashed up", story2: "Where: college\nWhat I did: worked service on busy nights", close: "You'd get someone who turns up early" },
  experience: [{ title: "Cafe assistant", company: "Uncle's cafe", dates: "2024 to now", about: "I serve customers, make coffees and cash up on busy Saturdays" }],
};
const withReply = async (reply, fn) => { const real = ai.askJSON; ai.askJSON = async () => reply; try { return await fn(); } finally { ai.askJSON = real; } };

test("video text keeps short, true words", async () => {
  const out = await withReply({
    story1: { skill: "Customer service", proof: "Served customers and cashed up" },
    story2: { skill: "Calm under pressure", proof: "Cut waste by 40%" },
    bring: ["Turns up early", "A real team player", "Does it properly — always"],
    hook: "Want a trainee chef who loves a busy service? 🔥",
    suits: { professional: ["Hotel kitchens"], socials: ["Pub kitchens", "Street food"] },
  }, () => mw.videoText({ cv, role: "Trainee chef" }));
  assert.strictEqual(out.story1.skill, "Customer service");
  assert.strictEqual(out.story2.proof, "", "an invented number is dropped");
  assert.ok(!out.bring.some((b) => /team player/i.test(b)), "cliches go");
  assert.ok(out.bring.every((b) => !/[—–]/.test(b)), "no dashes");
  assert.ok(!/🔥/.test(out.hook), "no emojis");
  assert.deepStrictEqual(out.suits.socials, ["Pub kitchens", "Street food"]);
});

test("video text drops personal details", async () => {
  const out = await withReply({ story1: { skill: "Reliability", proof: "Juggled shifts around my kids" }, story2: { skill: "", proof: "" }, bring: ["Turns up early"], hook: "", suits: {} },
    () => mw.videoText({ cv, role: "Trainee chef" }));
  assert.strictEqual(out.story1.proof, "");
});

test("video text needs notes or a CV first", async () => {
  await assert.rejects(() => mw.videoText({ cv: { header: {} }, role: "" }), /Plan your 90 seconds first/);
});
