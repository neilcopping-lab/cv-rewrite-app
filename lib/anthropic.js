// Thin Anthropic wrapper. Everything model-facing goes through here so the
// system rules, JSON handling and error behaviour live in one place.
const Anthropic = require("@anthropic-ai/sdk");

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
// A faster, cheaper model for secondary analytical passes (self-review) where
// deep creative judgement isn't required. The main write and the fabrication
// gate stay on MODEL. Override with FAST_MODEL if needed.
const FAST_MODEL = process.env.FAST_MODEL || "claude-haiku-4-5-20251001";
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
// Notes on newer models:
//  - They reject the `temperature` parameter, so we do not send it.
//  - On a big task they can spend their whole token budget before producing any
//    visible text, returning an EMPTY reply with stop_reason "max_tokens". So if
//    we get nothing back, we automatically retry with a larger budget (guarding
//    against the model rejecting a budget that is too large for it).
async function ask({ system, prompt, maxTokens = 4000, model }) {
  if (MOCK) return JSON.stringify(mock().respond({ system, prompt }));
  const c = getClient();
  if (!c) throw new Error("ANTHROPIC_API_KEY not set");

  const budgets = [maxTokens];
  for (const bigger of [16000, 32000]) if (bigger > maxTokens) budgets.push(bigger);

  let text = "";
  for (const budget of budgets) {
    let res;
    try {
      res = await c.messages.create({
        model: model || MODEL,
        max_tokens: budget,
        system,
        messages: [{ role: "user", content: prompt }]
      });
    } catch (e) {
      // Model won't accept this budget (too large): try the next one down/up.
      if (budget !== maxTokens && /max_tokens|max output|too large|maximum/i.test(e.message || "")) continue;
      throw e;
    }
    text = (res.content || []).map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    if (text) return text;                         // got a real answer
    if (res.stop_reason !== "max_tokens") break;   // empty for another reason: stop
  }
  return text;
}

// Ask and parse strict JSON. We ask the model to emit only JSON, then defend
// against stray prose by extracting the first {...} / [...] block.
async function askJSON({ system, prompt, maxTokens = 8000, model }) {
  if (MOCK) return mock().respond({ system, prompt });
  let lastErr;
  // Two attempts: guards against the occasional cut-off / malformed reply.
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await ask({
      system: system + "\n\nReturn ONLY valid, COMPLETE JSON. No markdown fences, no commentary. Do not truncate the response.",
      prompt,
      maxTokens,
      model
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
    /* fall through to extraction + repair */
  }
  // Narrow to the first JSON opener onward.
  const first = Math.min(
    ...["{", "["].map((c) => (t.indexOf(c) === -1 ? Infinity : t.indexOf(c)))
  );
  if (first === Infinity) throw new Error("Model did not return parseable JSON");
  const body = t.slice(first);

  // Try the clean span first (opener to last closer).
  const lastObj = body.lastIndexOf("}");
  const lastArr = body.lastIndexOf("]");
  const last = Math.max(lastObj, lastArr);
  if (last > 0) {
    try { return JSON.parse(body.slice(0, last + 1)); } catch (_) {}
  }

  // Repair a truncated reply: trim to a structurally balanced point and close
  // any still-open braces/brackets. Salvages a reply cut off mid-list.
  const repaired = repairTruncatedJSON(body);
  if (repaired) return repaired;

  throw new Error("Model did not return parseable JSON");
}

// Walk back from the end to the last position where brackets balance and we're
// not inside a string, drop a dangling comma, close open structures, parse.
function repairTruncatedJSON(s) {
  for (let end = s.length; end > 0; end--) {
    const stack = [];
    let inStr = false, esc = false, ok = true;
    for (let i = 0; i < end; i++) {
      const c = s[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{") stack.push("}");
      else if (c === "[") stack.push("]");
      else if (c === "}" || c === "]") {
        if (stack.pop() !== c) { ok = false; break; }
      }
    }
    if (!ok || inStr) continue;               // unbalanced or mid-string: back up
    let cand = s.slice(0, end).replace(/,\s*$/, "");
    for (let k = stack.length - 1; k >= 0; k--) cand += stack[k];
    try { return JSON.parse(cand); } catch (_) {}
  }
  return null;
}

module.exports = { ask, askJSON, parseJSON, MODEL, FAST_MODEL, hasKey: () => MOCK || !!process.env.ANTHROPIC_API_KEY };
