import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import type Stripe from "stripe";

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

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata.user_id;
      if (!userId) break;

      const periodStart = (sub as Stripe.Subscription & { current_period_start: number }).current_period_start;
      const periodEnd = (sub as Stripe.Subscription & { current_period_end: number }).current_period_end;

      await supabase.from("subscriptions").update({
        stripe_subscription_id: sub.id,
        status: sub.status as "active" | "trialing" | "past_due" | "canceled",
        plan: "growth",
        current_period_start: periodStart
          ? new Date(periodStart * 1000).toISOString()
          : null,
        current_period_end: periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : null,
        cancel_at_period_end: sub.cancel_at_period_end,
      }).eq("user_id", userId);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata.user_id;
      if (!userId) break;

      await supabase.from("subscriptions").update({
        status: "canceled",
        plan: "trial",
      }).eq("user_id", userId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
