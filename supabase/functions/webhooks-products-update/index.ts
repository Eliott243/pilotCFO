import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceSupabase } from "../_shared/supabase.ts";
import { verifyShopifyWebhook } from "../_shared/webhooks.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const secret = Deno.env.get("SHOPIFY_API_SECRET");
  if (!secret) return json(500, { error: "Missing SHOPIFY_API_SECRET" });

  const body = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");

  const ok = await verifyShopifyWebhook(body, hmac, secret);
  if (!ok) return json(401, { error: "Invalid HMAC" });

  const payload = JSON.parse(body);
  const shopDomain = req.headers.get("x-shopify-shop-domain");
  if (!shopDomain) return json(400, { error: "Missing shop domain header" });

  const supabase = getServiceSupabase();

  const { data: storeRow } = await supabase
    .from("stores")
    .select("id, company_id")
    .eq("shopify_domain", shopDomain)
    .single();

  if (!storeRow) return json(404, { error: "Store not found" });

  const { data: companyRow } = await supabase
    .from("companies")
    .select("user_id")
    .eq("id", storeRow.company_id)
    .single();

  if (!companyRow) return json(404, { error: "Company not found" });

  const { data: connection } = await supabase
    .from("shopify_connections")
    .select("id")
    .eq("store_id", storeRow.id)
    .single();

  if (!connection) return json(404, { error: "Connection not found" });

  const productRow = {
    id: payload.id,
    shop_id: connection.id,
    user_id: companyRow.user_id,
    title: payload.title ?? null,
    vendor: payload.vendor ?? null,
    product_type: payload.product_type ?? null,
    variants: (payload.variants ?? []).map((v: any) => ({
      ...v,
      cost: v.cost ? Number(v.cost) : null,
      cost_source: v.cost ? "shopify" : "missing",
    })),
    created_at: payload.created_at ?? null,
    updated_at: payload.updated_at ?? null,
  };

  const { error } = await supabase.from("shopify_products").upsert(productRow, {
    onConflict: "id",
  });

  if (error) return json(500, { error: error.message });
  return json(200, { success: true });
});

