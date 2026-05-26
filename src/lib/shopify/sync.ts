import type { SupabaseClient } from "@supabase/supabase-js";

interface ShopifyOrder {
  id: number;
  name: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  total_discounts: string;
  total_shipping_price_set?: { shop_money: { amount: string } };
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer?: { id: number };
  line_items: { quantity: number }[];
  refunds: { transactions: { amount: string }[] }[];
  created_at: string;
}

interface ShopifyProduct {
  id: number;
  title: string;
  vendor: string;
  product_type: string;
  status: string;
  variants: {
    price: string;
    inventory_quantity: number;
    inventory_item_id: number;
  }[];
}

interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  orders_count: number;
  total_spent: string;
}

export async function syncShopifyStore(
  supabase: SupabaseClient,
  storeId: string,
  shop: string,
  accessToken: string
): Promise<{ orders: number; products: number; customers: number }> {
  const [ordersResult, productsResult, customersResult] = await Promise.all([
    syncOrders(supabase, storeId, shop, accessToken),
    syncProducts(supabase, storeId, shop, accessToken),
    syncCustomers(supabase, storeId, shop, accessToken),
  ]);

  await supabase
    .from("stores")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", storeId);

  return {
    orders: ordersResult,
    products: productsResult,
    customers: customersResult,
  };
}

async function syncOrders(
  supabase: SupabaseClient,
  storeId: string,
  shop: string,
  accessToken: string
): Promise<number> {
  const { default: fetchOrders } = await import("./fetch");
  const orders = await fetchOrders<ShopifyOrder>(shop, accessToken, "orders", {
    status: "any",
    limit: "250",
  });

  const rows = orders.map((o) => ({
    store_id: storeId,
    shopify_order_id: o.id,
    order_number: o.name,
    total_price: parseFloat(o.total_price),
    subtotal_price: parseFloat(o.subtotal_price ?? o.total_price),
    total_tax: parseFloat(o.total_tax ?? "0"),
    total_discounts: parseFloat(o.total_discounts ?? "0"),
    total_shipping: parseFloat(
      o.total_shipping_price_set?.shop_money?.amount ?? "0"
    ),
    currency: o.currency,
    financial_status: o.financial_status,
    fulfillment_status: o.fulfillment_status,
    customer_id: o.customer?.id ?? null,
    line_items_count: o.line_items?.length ?? 0,
    refunded_amount: (o.refunds ?? []).reduce(
      (sum, r) =>
        sum +
        (r.transactions ?? []).reduce((s, t) => s + parseFloat(t.amount ?? "0"), 0),
      0
    ),
    ordered_at: o.created_at,
  }));

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("orders").upsert(rows, {
    onConflict: "store_id,shopify_order_id",
  });

  if (error) throw error;
  return rows.length;
}

async function syncProducts(
  supabase: SupabaseClient,
  storeId: string,
  shop: string,
  accessToken: string
): Promise<number> {
  const { default: fetchOrders } = await import("./fetch");
  const products = await fetchOrders<ShopifyProduct>(shop, accessToken, "products", {
    limit: "250",
  });

  const rows = products.flatMap((p) =>
    (p.variants ?? []).map((v) => ({
      store_id: storeId,
      shopify_product_id: p.id,
      title: p.title,
      vendor: p.vendor,
      product_type: p.product_type,
      status: p.status,
      price: parseFloat(v.price ?? "0"),
      cost_per_item: 0,
      inventory_quantity: v.inventory_quantity ?? 0,
    }))
  );

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("products").upsert(rows, {
    onConflict: "store_id,shopify_product_id",
  });

  if (error) throw error;
  return rows.length;
}

async function syncCustomers(
  supabase: SupabaseClient,
  storeId: string,
  shop: string,
  accessToken: string
): Promise<number> {
  const { default: fetchOrders } = await import("./fetch");
  const customers = await fetchOrders<ShopifyCustomer>(
    shop,
    accessToken,
    "customers",
    { limit: "250" }
  );

  const rows = customers.map((c) => ({
    store_id: storeId,
    shopify_customer_id: c.id,
    email: c.email,
    first_name: c.first_name,
    last_name: c.last_name,
    orders_count: c.orders_count,
    total_spent: parseFloat(c.total_spent ?? "0"),
  }));

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("customers").upsert(rows, {
    onConflict: "store_id,shopify_customer_id",
  });

  if (error) throw error;
  return rows.length;
}
