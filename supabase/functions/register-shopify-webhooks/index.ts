import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceSupabase } from "../_shared/supabase.ts";

const WEBHOOKS = [
  { topic: "orders/create", path: "/webhooks-orders-create" },
  { topic: "orders/updated", path: "/webhooks-orders-updated" },
  { topic: "orders/cancelled", path: "/webhooks-orders-cancelled" },
  { topic: "refunds/create", path: "/webhooks-refunds-create" },
  { topic: "products/update", path: "/webhooks-products-update" },
  { topic: "app/uninstalled", path: "/webhooks-app-uninstalled" },
] as const;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabase = getServiceSupabase();
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace("Bearer ", "");
  if (!jwt) return json(401, { error: "Missing Authorization Bearer token" });

  const {
    data: { user },
  } = await supabase.auth.getUser(jwt);
  if (!user) return json(401, { error: "Invalid token" });

  const { shop_id, supabase_functions_url } = await req.json().catch(() => ({
    shop_id: null,
    supabase_functions_url: null,
  }));
  if (!shop_id) return json(400, { error: "Missing shop_id" });

  const functionsUrl =
    supabase_functions_url ??
    Deno.env.get("SUPABASE_FUNCTIONS_URL") ??
    null;
  if (!functionsUrl) {
    return json(500, { error: "Missing SUPABASE_FUNCTIONS_URL" });
  }

  const { data: connection } = await supabase
    .from("shopify_connections")
    .select("id, store_id, access_token, connected")
    .eq("id", shop_id)
    .single();

  if (!connection || !connection.connected) {
    return json(404, { error: "Connection not found" });
  }

  const { data: storeRow } = await supabase
    .from("stores")
    .select("id, shopify_domain, company_id")
    .eq("id", connection.store_id)
    .single();

  if (!storeRow) return json(404, { error: "Store not found" });

  const { data: companyRow } = await supabase
    .from("companies")
    .select("user_id")
    .eq("id", storeRow.company_id)
    .single();

  if (!companyRow || companyRow.user_id !== user.id) {
    return json(403, { error: "Forbidden" });
  }

  const shop = storeRow.shopify_domain;
  const accessToken = connection.access_token as string;

  const results: { topic: string; ok: boolean; status?: number; error?: string }[] = [];

  for (const wh of WEBHOOKS) {
    const res = await fetch(`https://${shop}/admin/api/2024-01/webhooks.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        webhook: {
          topic: wh.topic,
          address: `${functionsUrl}${wh.path}`,
          format: "json",
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      results.push({ topic: wh.topic, ok: false, status: res.status, error: text });
      continue;
    }

    results.push({ topic: wh.topic, ok: true, status: res.status });
  }

  return json(200, { success: true, shop_id, results });
});

