import { NextResponse } from "next/server";
import { syncShopifyStore } from "@/lib/shopify/sync";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

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
    .select("id, shopify_domain")
    .eq("company_id", company.id)
    .single();

  if (!store) {
    return NextResponse.json({ error: "Boutique non connectée" }, { status: 404 });
  }

  const { data: connection } = await supabase
    .from("shopify_connections")
    .select("access_token")
    .eq("store_id", store.id)
    .single();

  if (!connection) {
    return NextResponse.json({ error: "Connexion Shopify introuvable" }, { status: 404 });
  }

  const serviceClient = await createServiceClient();
  const result = await syncShopifyStore(
    serviceClient,
    store.id,
    store.shopify_domain,
    connection.access_token
  );

  await supabase.from("activity_logs").insert({
    user_id: user.id,
    action: "shopify_synced",
    metadata: result,
  });

  return NextResponse.json({ success: true, ...result });
}
