// Stripe - the £12.50 one-off charge that gates the download. Real payment,
// tested end-to-end (same discipline as the Interview Prep Report's £25 gate).
// No subscription, no upsell. The charge is stated plainly up front.
const brand = require("./brand");
let stripe = null;
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripe) stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

const priceMinor = () => Math.round(parseFloat(brand.priceGBP) * 100); // pence

async function createCheckoutSession({ sessionId, successUrl, cancelUrl, email }) {
  const s = getStripe();
  if (!s) throw new Error("STRIPE_SECRET_KEY not set");
  return s.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: email || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: priceMinor(),
          product_data: {
            name: "The Com'mon People - CV Rewrite",
            description: "A CV rewritten to align with one specific role. Word + PDF. One-off, no subscription."
          }
        }
      }
    ],
    metadata: { cvSessionId: sessionId },
    success_url: successUrl,
    cancel_url: cancelUrl
  });
}

async function isPaid(checkoutSessionId) {
  const s = getStripe();
  if (!s) return false;
  const cs = await s.checkout.sessions.retrieve(checkoutSessionId);
  return cs.payment_status === "paid";
}

function verifyWebhook(rawBody, signature) {
  const s = getStripe();
  if (!s || !process.env.STRIPE_WEBHOOK_SECRET) throw new Error("webhook not configured");
  return s.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}

module.exports = { createCheckoutSession, isPaid, verifyWebhook, priceMinor, hasKey: () => !!process.env.STRIPE_SECRET_KEY };
