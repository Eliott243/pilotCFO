import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { logBilling, errMessage } from "@/lib/logging";
import type Stripe from "stripe";

function planFromPriceId(priceId: string | undefined): "starter" | "growth" | "trial" {
  if (priceId === process.env.STRIPE_PRICE_ID_GROWTH) return "growth";
  if (priceId === process.env.STRIPE_PRICE_ID_STARTER) return "starter";
  return "trial";
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (e) {
    logBilling("webhook_signature_invalid", { error: errMessage(e) }, "warn");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Idempotency: claim the event id first. A duplicate delivery short-circuits.
  const { error: idempotencyError } = await supabase
    .from("stripe_webhook_events")
    .insert({ event_id: event.id });

  if (idempotencyError?.code === "23505") {
    logBilling("webhook_duplicate", { eventId: event.id, type: event.type });
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata.user_id;
        if (!userId) {
          logBilling("webhook_missing_user_id", { eventId: event.id, type: event.type }, "warn");
          break;
        }

        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

        const { data: existing } = await supabase
          .from("subscriptions")
          .select("stripe_customer_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (
          existing?.stripe_customer_id &&
          customerId &&
          existing.stripe_customer_id !== customerId
        ) {
          // Never let a webhook re-point a user to a different Stripe customer.
          logBilling(
            "webhook_customer_mismatch",
            { userId, expected: existing.stripe_customer_id, received: customerId },
            "error"
          );
          break;
        }

        const priceId = sub.items.data[0]?.price?.id;
        const periodStart = (sub as Stripe.Subscription & { current_period_start: number })
          .current_period_start;
        const periodEnd = (sub as Stripe.Subscription & { current_period_end: number })
          .current_period_end;

        const { error: updateError } = await supabase
          .from("subscriptions")
          .update({
            stripe_customer_id: customerId ?? existing?.stripe_customer_id,
            stripe_subscription_id: sub.id,
            status: sub.status as "active" | "trialing" | "past_due" | "canceled",
            plan: planFromPriceId(priceId),
            current_period_start: periodStart
              ? new Date(periodStart * 1000).toISOString()
              : null,
            current_period_end: periodEnd
              ? new Date(periodEnd * 1000).toISOString()
              : null,
            cancel_at_period_end: sub.cancel_at_period_end,
          })
          .eq("user_id", userId);

        if (updateError) throw new Error(`subscription update failed: ${updateError.message}`);

        logBilling("subscription_synced", {
          userId,
          status: sub.status,
          plan: planFromPriceId(priceId),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata.user_id;
        if (!userId) {
          logBilling("webhook_missing_user_id", { eventId: event.id, type: event.type }, "warn");
          break;
        }

        const { error: updateError } = await supabase
          .from("subscriptions")
          .update({ status: "canceled", plan: "trial" })
          .eq("user_id", userId);

        if (updateError) throw new Error(`subscription cancel failed: ${updateError.message}`);

        logBilling("subscription_canceled", { userId });
        break;
      }
      default:
        logBilling("webhook_ignored", { eventId: event.id, type: event.type });
    }
  } catch (e) {
    // Processing failed after claiming the event id — release the claim so Stripe
    // can safely retry instead of us treating the retry as a duplicate (which
    // would permanently drop the update).
    await supabase.from("stripe_webhook_events").delete().eq("event_id", event.id);
    logBilling(
      "webhook_processing_failed",
      { eventId: event.id, type: event.type, error: errMessage(e) },
      "error"
    );
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
