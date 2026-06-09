import { NextResponse } from "next/server";
import { getStripe, PLANS } from "@/lib/stripe";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logBilling, errMessage } from "@/lib/logging";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const priceId = PLANS.growth.priceId;
  if (!priceId) {
    return NextResponse.json({ error: "Stripe non configuré" }, { status: 500 });
  }

  // Read current customer id with the user client (RLS: SELECT own row).
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  let customerId = subscription?.stripe_customer_id ?? undefined;

  try {
    if (!customerId) {
      const stripe = getStripe();
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;

      // Billing writes are server-side only. Authenticated clients cannot write
      // the subscriptions table (RLS), so persist with the service role.
      const admin = await createServiceClient();
      const { error: persistError } = await admin
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);

      if (persistError) {
        // Do not silently lose the customer id — a missing link breaks webhook
        // reconciliation and the portal. Fail loudly so it can be retried.
        logBilling(
          "stripe_customer_persist_failed",
          { userId: user.id, customerId, error: persistError.message },
          "error"
        );
        return NextResponse.json(
          { error: "Impossible d'initialiser la facturation." },
          { status: 500 }
        );
      }
      logBilling("stripe_customer_created", { userId: user.id, customerId });
    }

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?billing=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?billing=canceled`,
      subscription_data: {
        trial_period_days: 14,
        metadata: { user_id: user.id },
      },
    });

    logBilling("checkout_session_created", { userId: user.id, customerId });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    logBilling("checkout_failed", { userId: user.id, error: errMessage(e) }, "error");
    return NextResponse.json(
      { error: "Impossible de démarrer le paiement." },
      { status: 500 }
    );
  }
}
