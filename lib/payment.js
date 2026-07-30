// Stripe — two credit packs that top up a signed-in account. Payment grants
// credits (idempotently) to the user's balance; downloads later spend them.
const db = require("./db");
let stripe = null;
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripe) stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

// The packs. Amounts in pence. Kept here so price + credits never drift apart.
const PACKS = {
  "5": { id: "5", amount: 500, credits: 4, label: "£5 — 4 CVs" },
  "10": { id: "10", amount: 1000, credits: 10, label: "£10 — 10 CVs" }
};
function pack(id) { return PACKS[String(id)] || null; }

async function createCheckoutSession({ packId, userEmail, successUrl, cancelUrl }) {
  const s = getStripe();
  if (!s) throw new Error("STRIPE_SECRET_KEY not set");
  const p = pack(packId);
  if (!p) throw new Error("Unknown pack.");
  if (!userEmail) throw new Error("Sign in first.");
  return s.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: userEmail,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "gbp",
        unit_amount: p.amount,
        product_data: {
          name: `The Com'mon People — CV Rewrite (${p.credits} CVs)`,
          description: `${p.credits} finished-CV downloads. One credit per CV.`
        }
      }
    }],
    metadata: { userEmail, credits: String(p.credits), packId: p.id },
    success_url: successUrl,
    cancel_url: cancelUrl
  });
}

// Grant credits for a paid checkout session, idempotently. Safe to call from
// both the webhook and the polling fallback — credits are added only once.
async function grantForSession(checkoutSessionId) {
  const s = getStripe();
  if (!s) throw new Error("STRIPE_SECRET_KEY not set");
  const cs = await s.checkout.sessions.retrieve(checkoutSessionId);
  if (cs.payment_status !== "paid") return { paid: false };
  const email = (cs.metadata && cs.metadata.userEmail) || cs.customer_email;
  const credits = parseInt((cs.metadata && cs.metadata.credits) || "0", 10);
  if (!email || !credits) return { paid: true, granted: false };
  const res = db.grantOnce(cs.id, email, credits);
  return { paid: true, granted: res.added, balance: res.balance, email, credits };
}

function verifyWebhook(rawBody, signature) {
  const s = getStripe();
  if (!s || !process.env.STRIPE_WEBHOOK_SECRET) throw new Error("webhook not configured");
  return s.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}

module.exports = {
  PACKS, pack, createCheckoutSession, grantForSession, verifyWebhook,
  hasKey: () => !!process.env.STRIPE_SECRET_KEY
};
