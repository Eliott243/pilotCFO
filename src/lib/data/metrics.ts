import { calculateMetrics } from "@/lib/cfo-engine";
import { getDemoMetrics } from "@/lib/demo/metrics";
import { isDemoMetricsOnly } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { CFOMetrics, FinancialProfile, Order, Product } from "@/types/database";
import { subDays } from "date-fns";

export async function getStoreMetrics(storeId?: string): Promise<{
  metrics: CFOMetrics | null;
  hasStore: boolean;
  hasData: boolean;
  storeId: string | null;
  currency: string;
}> {
  if (isDemoMetricsOnly()) {
    return {
      metrics: getDemoMetrics(),
      hasStore: true,
      hasData: true,
      storeId: "demo",
      currency: "EUR",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { metrics: null, hasStore: false, hasData: false, storeId: null, currency: "USD" };
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id, currency")
    .eq("user_id", user.id)
    .single();

  if (!company) {
    return { metrics: null, hasStore: false, hasData: false, storeId: null, currency: "USD" };
  }

  let storeQuery = supabase
    .from("stores")
    .select("id, currency")
    .eq("company_id", company.id)
    .eq("is_active", true)
    .limit(1);

  if (storeId) {
    storeQuery = storeQuery.eq("id", storeId);
  }

  const { data: store } = await storeQuery.single();

  if (!store) {
    return {
      metrics: null,
      hasStore: false,
      hasData: false,
      storeId: null,
      currency: company.currency ?? "USD",
    };
  }

  const periodStart = subDays(new Date(), 30).toISOString();
  const previousStart = subDays(new Date(), 60).toISOString();

  const currency = store.currency ?? company.currency ?? "USD";

  const profileRes = await supabase
    .from("financial_profiles")
    .select("*")
    .eq("company_id", company.id)
    .maybeSingle();
  const profile = profileRes.data as FinancialProfile | null;

  // Prefer Shopify sync v2 tables (populated by the `sync-shopify-data` Edge Function,
  // i.e. the "Sync now" button). Fall back to legacy tables (populated by the in-app
  // OAuth-callback sync) when v2 has no data yet.
  const { data: connection } = await supabase
    .from("shopify_connections")
    .select("id")
    .eq("store_id", store.id)
    .maybeSingle();

  let orders: Order[] = [];
  let previousPeriodOrders: Order[] = [];
  let products: Product[] = [];

  if (connection?.id) {
    const [v2Orders, v2PrevOrders, v2Products] = await Promise.all([
      supabase
        .from("shopify_orders")
        .select("*")
        .eq("shop_id", connection.id)
        .gte("created_at", periodStart)
        .order("created_at", { ascending: false })
        .limit(10_000),
      supabase
        .from("shopify_orders")
        .select("*")
        .eq("shop_id", connection.id)
        .gte("created_at", previousStart)
        .lt("created_at", periodStart)
        .limit(10_000),
      supabase.from("shopify_products").select("*").eq("shop_id", connection.id).limit(5_000),
    ]);

    if ((v2Orders.data?.length ?? 0) > 0) {
      orders = (v2Orders.data ?? []).map((o) => mapV2Order(o, store.id, currency));
      previousPeriodOrders = (v2PrevOrders.data ?? []).map((o) =>
        mapV2Order(o, store.id, currency)
      );
      products = (v2Products.data ?? []).map((p) => mapV2Product(p, store.id));
    }
  }

  // Legacy fallback
  if (orders.length === 0) {
    const [ordersRes, prevOrdersRes, productsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .eq("store_id", store.id)
        .gte("ordered_at", periodStart)
        .order("ordered_at", { ascending: false })
        .limit(10_000),
      supabase
        .from("orders")
        .select("*")
        .eq("store_id", store.id)
        .gte("ordered_at", previousStart)
        .lt("ordered_at", periodStart)
        .limit(10_000),
      supabase.from("products").select("*").eq("store_id", store.id).limit(5_000),
    ]);

    orders = (ordersRes.data ?? []) as Order[];
    previousPeriodOrders = (prevOrdersRes.data ?? []) as Order[];
    products = (productsRes.data ?? []) as Product[];
  }

  const hasData = orders.length > 0;

  if (!hasData && !profile) {
    return {
      metrics: null,
      hasStore: true,
      hasData: false,
      storeId: store.id,
      currency,
    };
  }

  const metrics = calculateMetrics({
    orders,
    products,
    profile,
    previousPeriodOrders,
  });

  return {
    metrics,
    hasStore: true,
    hasData,
    storeId: store.id,
    currency,
  };
}

interface V2Order {
  id: number;
  order_number: string | null;
  total_price: number | null;
  subtotal_price: number | null;
  total_tax: number | null;
  total_discounts: number | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  customer_id: number | null;
  line_items: unknown;
  refunds: unknown;
  shipping_lines: unknown;
  created_at: string | null;
  processed_at: string | null;
}

interface V2Product {
  id: number;
  title: string | null;
  vendor: string | null;
  product_type: string | null;
  variants: unknown;
}

function toNumber(value: unknown): number {
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sumRefunds(refunds: unknown): number {
  if (!Array.isArray(refunds)) return 0;
  return refunds.reduce((sum: number, refund) => {
    const transactions = (refund as { transactions?: unknown })?.transactions;
    if (!Array.isArray(transactions)) return sum;
    return (
      sum +
      transactions.reduce(
        (s: number, t) => s + toNumber((t as { amount?: unknown })?.amount),
        0
      )
    );
  }, 0);
}

function sumShipping(shippingLines: unknown): number {
  if (!Array.isArray(shippingLines)) return 0;
  return shippingLines.reduce(
    (sum: number, line) => sum + toNumber((line as { price?: unknown })?.price),
    0
  );
}

function mapV2Order(raw: V2Order, storeId: string, currency: string): Order {
  const lineItems = Array.isArray(raw.line_items) ? raw.line_items : [];
  return {
    id: String(raw.id),
    store_id: storeId,
    shopify_order_id: raw.id,
    order_number: raw.order_number,
    total_price: toNumber(raw.total_price),
    subtotal_price: toNumber(raw.subtotal_price ?? raw.total_price),
    total_tax: toNumber(raw.total_tax),
    total_discounts: toNumber(raw.total_discounts),
    total_shipping: sumShipping(raw.shipping_lines),
    currency,
    financial_status: raw.financial_status,
    fulfillment_status: raw.fulfillment_status,
    customer_id: raw.customer_id,
    line_items_count: lineItems.length,
    refunded_amount: sumRefunds(raw.refunds),
    cost_of_goods: 0,
    ordered_at: raw.created_at ?? raw.processed_at ?? new Date().toISOString(),
  };
}

function mapV2Product(raw: V2Product, storeId: string): Product {
  const variants = Array.isArray(raw.variants) ? raw.variants : [];
  const first = (variants[0] ?? {}) as { price?: unknown; cost?: unknown };
  return {
    id: String(raw.id),
    store_id: storeId,
    shopify_product_id: raw.id,
    title: raw.title ?? "",
    vendor: raw.vendor,
    product_type: raw.product_type,
    status: null,
    price: toNumber(first.price),
    cost_per_item: toNumber(first.cost),
    inventory_quantity: 0,
    total_sold: 0,
    total_revenue: 0,
  };
}
