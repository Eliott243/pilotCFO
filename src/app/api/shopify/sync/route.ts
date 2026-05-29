import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { allowed, retryAfterSec } = checkRateLimit(`shopify-sync:${user.id}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Trop de synchronisations. Réessayez plus tard." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!company) {
    return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("company_id", company.id)
    .single();

  if (!store) {
    return NextResponse.json({ error: "Boutique non connectée" }, { status: 404 });
  }

  const { data: connection } = await supabase
    .from("shopify_connections")
    .select("id")
    .eq("store_id", store.id)
    .single();

  if (!connection?.id) {
    return NextResponse.json({ error: "Connexion Shopify introuvable" }, { status: 404 });
  }

  if (!session?.access_token) {
    return NextResponse.json({ error: "Session invalide" }, { status: 401 });
  }

  await supabase
    .from("shopify_connections")
    .update({ sync_status: "syncing", sync_error: null })
    .eq("store_id", store.id);

  const functionsUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-shopify-data`;
  const res = await fetch(functionsUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ shop_id: connection.id }),
  });

  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: "Échec de la synchronisation" }, { status: 500 });
  }

  await supabase.from("activity_logs").insert({
    user_id: user.id,
    action: "shopify_synced",
    metadata: result,
  });

  return NextResponse.json({ success: true, ...result });
}
