import { NextResponse } from "next/server";
import { calculateMetrics } from "@/lib/cfo-engine";
import { createClient } from "@/lib/supabase/server";
import { subDays, format } from "date-fns";
import type { Order, Product, FinancialProfile } from "@/types/database";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!company) {
    return NextResponse.redirect(new URL("/settings", process.env.NEXT_PUBLIC_APP_URL));
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("company_id", company.id)
    .single();

  if (!store) {
    return NextResponse.redirect(
      new URL("/settings?tab=shopify", process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  const periodStart = subDays(new Date(), 30);
  const periodEnd = new Date();

  const [ordersRes, productsRes, profileRes] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("store_id", store.id)
      .gte("ordered_at", periodStart.toISOString()),
    supabase.from("products").select("*").eq("store_id", store.id),
    supabase
      .from("financial_profiles")
      .select("*")
      .eq("company_id", company.id)
      .single(),
  ]);

  const metrics = calculateMetrics({
    orders: (ordersRes.data ?? []) as Order[],
    products: (productsRes.data ?? []) as Product[],
    profile: profileRes.data as FinancialProfile | null,
  });

  const title = `Rapport mensuel — ${format(periodEnd, "MMMM yyyy")}`;

  const { error } = await supabase.from("reports").insert({
    store_id: store.id,
    type: "monthly",
    period_start: format(periodStart, "yyyy-MM-dd"),
    period_end: format(periodEnd, "yyyy-MM-dd"),
    title,
    executive_summary: metrics.health.explanations.overall,
    revenue_section: {
      total: metrics.revenue.total,
      growth: metrics.revenue.growthRate,
      orders: metrics.revenue.orderCount,
      aov: metrics.revenue.averageOrderValue,
    },
    profitability_section: {
      grossMarginPct: metrics.profitability.grossMarginPct,
      netMarginPct: metrics.profitability.netMarginPct,
      netProfit: metrics.profitability.netProfit,
      profitPerOrder: metrics.profitability.profitPerOrder,
      costDrivers: metrics.profitability.topCostDrivers,
    },
    cash_flow_section: {
      cashAvailable: metrics.cashFlow.cashAvailable,
      runwayMonths: metrics.cashFlow.runwayMonths,
      riskLevel: metrics.cashFlow.riskLevel,
    },
    risks_section: metrics.alerts,
    recommendations: metrics.alerts
      .filter((a) => a.action)
      .map((a) => a.action!),
    forecasts_section: metrics.forecasts,
  });

  if (error) {
    return NextResponse.redirect(new URL("/reports?error=1", process.env.NEXT_PUBLIC_APP_URL));
  }

  return NextResponse.redirect(new URL("/reports", process.env.NEXT_PUBLIC_APP_URL));
}
