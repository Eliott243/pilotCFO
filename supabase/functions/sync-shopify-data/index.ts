import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { sub } from "https://deno.land/std@0.224.0/datetime/mod.ts";
import { fetchAllPages } from "../_shared/shopify.ts";
import { getServiceSupabase } from "../_shared/supabase.ts";
import { decryptToken } from "../_shared/crypto.ts";

type SyncStatus = "never" | "syncing" | "success" | "error";

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
    error: userError,
  } = await supabase.auth.getUser(jwt);

  if (userError || !user) return json(401, { error: "Invalid token" });

  const { shop_id } = await req.json().catch(() => ({ shop_id: null }));
  if (!shop_id) return json(400, { error: "Missing shop_id" });

  // Load connection + shop domain
  const { data: connection, error: connError } = await supabase
    .from("shopify_connections")
    .select("id, store_id, access_token, connected")
    .eq("id", shop_id)
    .single();

  if (connError || !connection) return json(404, { error: "Connection not found" });
  if (!connection.connected) return json(400, { error: "Shop is disconnected" });

  // Verify ownership: shopify_connections.store_id -> stores.company_id -> companies.user_id
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

  // Mark syncing
  await supabase
    .from("shopify_connections")
    .update({ sync_status: "syncing" satisfies SyncStatus, sync_error: null })
    .eq("id", shop_id);

  const shop = storeRow.shopify_domain;
  let accessToken: string;
  try {
    accessToken = await decryptToken(connection.access_token as string);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase
      .from("shopify_connections")
      .update({ sync_status: "error" satisfies SyncStatus, sync_error: "token_decrypt_failed" })
      .eq("id", shop_id);
    return json(500, { error: "Token decryption failed", detail: message });
  }

  try {
    const oneYearAgo = sub(new Date(), { years: 1 });
    const createdAtMin = oneYearAgo.toISOString();

    const [orders, products, customers] = await Promise.all([
      fetchAllPages(shop, accessToken, "orders", {
        status: "any",
        created_at_min: createdAtMin,
        fields:
          "id,name,total_price,subtotal_price,total_discounts,total_tax,financial_status,fulfillment_status,cancelled_at,processed_at,customer,line_items,refunds,shipping_lines,created_at,updated_at",
      }),
      fetchAllPages(shop, accessToken, "products", {
        fields: "id,title,vendor,product_type,variants,created_at,updated_at",
      }),
      fetchAllPages(shop, accessToken, "customers", {
        fields: "id,email,total_spent,orders_count,created_at,updated_at",
      }),
    ]);

    // Upsert orders
    const orderRows = orders.map((o: any) => ({
      id: o.id,
      shop_id,
      user_id: user.id,
      order_number: o.name ?? null,
      total_price: o.total_price ? Number(o.total_price) : null,
      subtotal_price: o.subtotal_price ? Number(o.subtotal_price) : null,
      total_discounts: o.total_discounts ? Number(o.total_discounts) : null,
      total_tax: o.total_tax ? Number(o.total_tax) : null,
      financial_status: o.financial_status ?? null,
      fulfillment_status: o.fulfillment_status ?? null,
      cancelled_at: o.cancelled_at ?? null,
      processed_at: o.processed_at ?? null,
      customer_id: o.customer?.id ?? null,
      line_items: o.line_items ?? [],
      refunds: o.refunds ?? [],
      shipping_lines: o.shipping_lines ?? [],
      created_at: o.created_at ?? null,
      updated_at: o.updated_at ?? null,
    }));

    if (orderRows.length) {
      const { error } = await supabase.from("shopify_orders").upsert(orderRows, {
        onConflict: "id",
      });
      if (error) throw new Error(error.message);
    }

    // Product cost handling (never estimate silently)
    const productRows = products.map((p: any) => ({
      id: p.id,
      shop_id,
      user_id: user.id,
      title: p.title ?? null,
      vendor: p.vendor ?? null,
      product_type: p.product_type ?? null,
      variants: (p.variants ?? []).map((v: any) => ({
        ...v,
        cost: v.cost ? Number(v.cost) : null,
        cost_source: v.cost ? "shopify" : "missing",
      })),
      created_at: p.created_at ?? null,
      updated_at: p.updated_at ?? null,
    }));

    if (productRows.length) {
      const { error } = await supabase.from("shopify_products").upsert(productRows, {
        onConflict: "id",
      });
      if (error) throw new Error(error.message);
    }

    const customerRows = customers.map((c: any) => ({
      id: c.id,
      shop_id,
      user_id: user.id,
      email: c.email ?? null,
      total_spent: c.total_spent ? Number(c.total_spent) : null,
      orders_count: c.orders_count ?? null,
      created_at: c.created_at ?? null,
      updated_at: c.updated_at ?? null,
    }));

    if (customerRows.length) {
      const { error } = await supabase.from("shopify_customers").upsert(customerRows, {
        onConflict: "id",
      });
      if (error) throw new Error(error.message);
    }

    await supabase
      .from("shopify_connections")
      .update({
        last_synced_at: new Date().toISOString(),
        sync_status: "success" satisfies SyncStatus,
        sync_error: null,
      })
      .eq("id", shop_id);

    return json(200, {
      success: true,
      shop_id,
      counts: {
        orders: orderRows.length,
        products: productRows.length,
        customers: customerRows.length,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase
      .from("shopify_connections")
      .update({ sync_status: "error" satisfies SyncStatus, sync_error: message })
      .eq("id", shop_id);
    return json(500, { error: "Sync failed", detail: message });
  }
});

