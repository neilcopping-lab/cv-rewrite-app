// Thin Anthropic wrapper. Everything model-facing goes through here so the
// system rules, JSON handling and error behaviour live in one place.
const Anthropic = require("@anthropic-ai/sdk");

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// Test-only mock switch (MOCK_MODEL=1) so the full pipeline can run offline.
const MOCK = process.env.MOCK_MODEL === "1";
function mock() { return require("./mockModel"); }

// Ask the model and get raw text back.
// Note: newer models reject the `temperature` parameter ("temperature is
// deprecated for this model"), so we do not send it.
async function ask({ system, prompt, maxTokens = 4000 }) {
  if (MOCK) return JSON.stringify(mock().respond({ system, prompt }));
  const c = getClient();
  if (!c) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await c.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }]
  });
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

// Ask and parse strict JSON. We ask the model to emit only JSON, then defend
// against stray prose by extracting the first {...} / [...] block.
async function askJSON({ system, prompt, maxTokens = 8000 }) {
  if (MOCK) return mock().respond({ system, prompt });
  let lastErr;
  // Two attempts: guards against the occasional cut-off / malformed reply.
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await ask({
      system: system + "\n\nReturn ONLY valid, COMPLETE JSON. No markdown fences, no commentary. Do not truncate the response.",
      prompt,
      maxTokens
    });
    try {
      return parseJSON(text);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    "The AI reply could not be read as JSON (it may have been cut off). Please try again. (" +
      (lastErr ? lastErr.message : "unknown") + ")"
  );
}

function parseJSON(text) {
  if (!text) throw new Error("Empty model response");
  let t = text.trim();
  // strip ```json fences if present
  t = t.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(t);
  } catch (_) {
    const first = Math.min(
      ...["{", "["].map((c) => (t.indexOf(c) === -1 ? Infinity : t.indexOf(c)))
    );
    const lastObj = t.lastIndexOf("}");
    const lastArr = t.lastIndexOf("]");
    const last = Math.max(lastObj, lastArr);
    if (first !== Infinity && last > first) {
      return JSON.parse(t.slice(first, last + 1));
    }
    throw new Error("Model did not return parseable JSON");
  }
}

module.exports = { ask, askJSON, parseJSON, MODEL, hasKey: () => MOCK || !!process.env.ANTHROPIC_API_KEY };
