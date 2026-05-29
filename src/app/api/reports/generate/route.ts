import { NextResponse } from "next/server";
import { getStoreMetrics } from "@/lib/data/metrics";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { subDays, format } from "date-fns";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));
  }

  const { allowed } = checkRateLimit(`reports:${user.id}`, 5, 60_000);
  if (!allowed) {
    return NextResponse.redirect(new URL("/reports?error=rate", process.env.NEXT_PUBLIC_APP_URL));
  }

  const { metrics, hasStore, storeId } = await getStoreMetrics();

  if (!hasStore || !metrics || !storeId || storeId === "demo") {
    return NextResponse.redirect(
      new URL("/settings?tab=shopify", process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  const periodStart = subDays(new Date(), 30);
  const periodEnd = new Date();
  const title = `Rapport mensuel — ${format(periodEnd, "MMMM yyyy")}`;

  const { error } = await supabase.from("reports").insert({
    store_id: storeId,
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
    recommendations: metrics.alerts.filter((a) => a.action).map((a) => a.action!),
    forecasts_section: metrics.forecasts,
  });

  if (error) {
    return NextResponse.redirect(new URL("/reports?error=1", process.env.NEXT_PUBLIC_APP_URL));
  }

  await supabase.from("activity_logs").insert({
    user_id: user.id,
    action: "report_generated",
    resource_type: "report",
    resource_id: storeId,
  });

  return NextResponse.redirect(new URL("/reports", process.env.NEXT_PUBLIC_APP_URL));
}
