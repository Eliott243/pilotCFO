import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
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
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { error: idempotencyError } = await supabase
    .from("stripe_webhook_events")
    .insert({ event_id: event.id });

  if (idempotencyError?.code === "23505") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata.user_id;
      if (!userId) break;

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
        console.error("Stripe customer mismatch", { userId, customerId });
        break;
      }

      const priceId = sub.items.data[0]?.price?.id;
      const periodStart = (sub as Stripe.Subscription & { current_period_start: number })
        .current_period_start;
      const periodEnd = (sub as Stripe.Subscription & { current_period_end: number })
        .current_period_end;

      await supabase
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
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata.user_id;
      if (!userId) break;

      await supabase
        .from("subscriptions")
        .update({
          status: "canceled",
          plan: "trial",
        })
        .eq("user_id", userId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
