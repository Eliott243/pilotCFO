import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { logBilling, errMessage } from "@/lib/logging";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (!subscription?.stripe_customer_id) {
    return NextResponse.json({ error: "Aucun abonnement" }, { status: 404 });
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
    });

    logBilling("portal_session_created", { userId: user.id });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    logBilling("portal_failed", { userId: user.id, error: errMessage(e) }, "error");
    return NextResponse.json(
      { error: "Impossible d'ouvrir le portail de facturation." },
      { status: 500 }
    );
  }
}
