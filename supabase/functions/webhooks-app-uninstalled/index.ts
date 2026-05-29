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

  const shopDomain = req.headers.get("x-shopify-shop-domain");
  if (!shopDomain) return json(400, { error: "Missing shop domain header" });

  const supabase = getServiceSupabase();
  const { data: storeRow } = await supabase
    .from("stores")
    .select("id")
    .eq("shopify_domain", shopDomain)
    .single();

  if (!storeRow) return json(200, { success: true }); // idempotent

  await supabase
    .from("shopify_connections")
    .update({
      connected: false,
      access_token: "revoked",
      sync_status: "error",
      sync_error: "app/uninstalled",
    })
    .eq("store_id", storeRow.id);

  return json(200, { success: true });
});

