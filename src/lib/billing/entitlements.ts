import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasFeatureAccess } from "@/lib/stripe";

export interface SubscriptionRow {
  plan: string | null;
  status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

export interface Entitlements {
  plan: string;
  status: string;
  isTrialing: boolean;
  trialValid: boolean;
  /** Whether the account may use premium features (AI CFO, Forecasts, Reports). */
  premium: boolean;
}

/**
 * Single source of truth for "can this account use premium features?".
 *
 * Access is granted when the account is on an active paid Growth/Scale plan, OR
 * is in a still-valid trial (the 14-day trial is a full-feature trial of
 * Growth — this preserves the current onboarding UX where a fresh user lands on
 * AI CFO). Expired trials, past_due, unpaid and canceled subscriptions get
 * basic-only access and are blocked from premium execution.
 */
export function resolveEntitlements(sub: SubscriptionRow | null): Entitlements {
  const plan = sub?.plan ?? "trial";
  const status = sub?.status ?? "trialing";
  const now = Date.now();
  const trialEnds = sub?.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : 0;
  const trialValid = status === "trialing" && trialEnds > now;

  const premium = (status === "active" && hasFeatureAccess(plan, "ai_cfo")) || trialValid;

  return {
    plan,
    status,
    isTrialing: status === "trialing",
    trialValid,
    premium,
  };
}

/** Fetch the user's subscription and resolve entitlements in one call. */
export async function getEntitlements(
  supabase: SupabaseClient,
  userId: string
): Promise<Entitlements> {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status, trial_ends_at, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  return resolveEntitlements((data as SubscriptionRow | null) ?? null);
}
