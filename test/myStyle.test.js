// "My writing style": the writers use the saved voice only when it's picked,
// the old sample box is ignored then, and learning needs three real pieces.
const { test } = require("node:test");
const assert = require("node:assert");
process.env.MOCK_MODEL = process.env.MOCK_MODEL || "";
const myStyle = require("../lib/myStyle");
const styleLink = require("../lib/styleLink");

const PRESETS = { professional: "PRO", warm: "WARM" };

test("picks their own voice only when chosen and saved", () => {
  assert.match(myStyle.styleLineFor("mine", PRESETS, "Short, warm sentences."), /THEIR OWN VOICE[\s\S]*Short, warm sentences\./);
  assert.strictEqual(myStyle.styleLineFor("mine", PRESETS, null), "PRO");
  assert.strictEqual(myStyle.styleLineFor("warm", PRESETS, "ignored"), "WARM");
  assert.strictEqual(myStyle.styleLineFor("nonsense", PRESETS, null), "PRO");
});

test("learning needs three pieces of at least 40 words", async () => {
  await assert.rejects(() => myStyle.learn(["too short", "x", "y"]), /three pieces|3 pieces/i);
  await assert.rejects(() => myStyle.learn(["word ".repeat(50)]), /3 pieces/);
});

test("the link between apps stays off without a long secret and peers", () => {
  delete process.env.COMQUAT_LINK_SECRET;
  delete process.env.COMQUAT_LINK_PEERS;
  assert.strictEqual(styleLink.enabled(), false);
  assert.strictEqual(styleLink.secretOk("anything"), false);
  process.env.COMQUAT_LINK_SECRET = "s".repeat(40);
  process.env.COMQUAT_LINK_PEERS = "http://insecure.example,https://recruiters.example/api/link/style";
  assert.strictEqual(styleLink.enabled(), true);
  assert.strictEqual(styleLink.secretOk("s".repeat(40)), true);
  assert.strictEqual(styleLink.secretOk("t".repeat(40)), false);
});

test("the CV writers accept My writing style without breaking the presets", () => {
  const src = require("fs").readFileSync(require.resolve("../lib/cvGenerator"), "utf8");
  assert.match(src, /styleLineFor\(writingStyle, STYLE_GUIDE, voiceProfile\)/);
  const cl = require("fs").readFileSync(require.resolve("../lib/coverLetter"), "utf8");
  assert.match(cl, /styleLineFor\(writingStyle, STYLE_GUIDE, voiceProfile\)/);
  const mw = require("fs").readFileSync(require.resolve("../lib/masterWriter"), "utf8");
  assert.strictEqual((mw.match(/voiceLine\(voiceProfile\)/g) || []).length, 3);
});
