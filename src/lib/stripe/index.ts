import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

export const PLANS = {
  trial: { name: "Essai gratuit", days: 14 },
  starter: {
    name: "Starter",
    priceId: process.env.STRIPE_PRICE_ID_STARTER,
    features: ["Overview", "Financial Health", "Profitability", "Cash Flow"],
  },
  growth: {
    name: "Growth",
    priceId: process.env.STRIPE_PRICE_ID_GROWTH,
    features: ["Tout Starter", "Forecasts", "AI CFO", "Reports"],
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function hasFeatureAccess(
  plan: string,
  feature: "forecasts" | "ai_cfo" | "reports" | "basic"
): boolean {
  if (plan === "growth" || plan === "scale") return true;
  if (plan === "trial" || plan === "starter") {
    return feature === "basic";
  }
  return false;
}
