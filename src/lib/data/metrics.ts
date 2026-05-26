import { calculateMetrics } from "@/lib/cfo-engine";
import { getDemoMetrics } from "@/lib/demo/metrics";
import { isDemoMode } from "@/lib/supabase/config";
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
  if (isDemoMode()) {
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

  const [ordersRes, prevOrdersRes, productsRes, profileRes] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("store_id", store.id)
      .gte("ordered_at", periodStart)
      .order("ordered_at", { ascending: false }),
    supabase
      .from("orders")
      .select("*")
      .eq("store_id", store.id)
      .gte("ordered_at", previousStart)
      .lt("ordered_at", periodStart),
    supabase.from("products").select("*").eq("store_id", store.id),
    supabase
      .from("financial_profiles")
      .select("*")
      .eq("company_id", company.id)
      .single(),
  ]);

  const orders = (ordersRes.data ?? []) as Order[];
  const previousPeriodOrders = (prevOrdersRes.data ?? []) as Order[];
  const products = (productsRes.data ?? []) as Product[];
  const profile = profileRes.data as FinancialProfile | null;

  const hasData = orders.length > 0;

  if (!hasData && !profile) {
    return {
      metrics: null,
      hasStore: true,
      hasData: false,
      storeId: store.id,
      currency: store.currency ?? company.currency ?? "USD",
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
    currency: store.currency ?? company.currency ?? "USD",
  };
}
