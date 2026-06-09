/**
 * pilotCFO Engine
 * Source of truth for all financial calculations.
 * AI only interprets these results — never invents numbers.
 */

import type {
  Alert,
  AuditFinding,
  CFOMetrics,
  DataQuality,
  FinancialProfile,
  ForecastPeriod,
  Order,
  Product,
} from "@/types/database";

export interface CFOEngineInput {
  orders: Order[];
  products: Product[];
  profile: FinancialProfile | null;
  previousPeriodOrders?: Order[];
  periodDays?: number;
  /** Share (0-100) of line-item value covered by a real Shopify cost.
   *  Provided by the data layer; null/undefined when unknown. */
  cogsCoveragePct?: number | null;
}

/** Real costs must cover at least this share of revenue to be used as-is. */
const COGS_COVERAGE_THRESHOLD = 80;

export function calculateMetrics(input: CFOEngineInput): CFOMetrics {
  const { orders, products, profile, previousPeriodOrders = [] } = input;

  const hasMarketingSpend = getMarketingSpend(profile) > 0;
  const hasCashData = profileHasCashData(profile);

  const revenue = calculateRevenue(orders, previousPeriodOrders);
  const { profitability, cogs } = calculateProfitability(
    orders,
    products,
    profile,
    input.cogsCoveragePct ?? null
  );
  const marketing = calculateMarketing(orders, profile);
  const cashFlow = calculateCashFlow(orders, profile, profitability.netProfit);
  const health = calculateHealthScores(revenue, profitability, cashFlow, marketing, {
    hasCashData,
    hasMarketingSpend,
  });
  const forecasts = calculateForecasts(revenue, profitability, cashFlow);
  const alerts = generateAlerts(revenue, profitability, cashFlow, marketing, products, {
    targetRoas: profile?.target_roas ?? null,
    hasCashData,
    cogsSource: cogs.source,
  });

  const dataQuality: DataQuality = {
    ordersCount: orders.length,
    cogsSource: cogs.source,
    cogsCoveragePct: cogs.coverage,
    logisticsSource: profile?.logistics_cost_pct != null ? "profile" : "default",
    hasMarketingSpend,
    hasCashData,
    hasProfile: profile != null,
  };

  return {
    revenue,
    profitability,
    marketing,
    cashFlow,
    health,
    forecasts,
    alerts,
    dataQuality,
  };
}

function profileHasCashData(profile: FinancialProfile | null): boolean {
  return (
    profile != null &&
    (Number(profile.cash_available) > 0 ||
      Number(profile.existing_debt) > 0 ||
      Number(profile.credit_line) > 0 ||
      profile.estimated_runway_months != null)
  );
}

function calculateRevenue(orders: Order[], previousOrders: Order[]) {
  const total = orders.reduce((sum, o) => sum + Number(o.total_price), 0);
  const previousTotal = previousOrders.reduce(
    (sum, o) => sum + Number(o.total_price),
    0
  );
  const growthRate =
    previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : 0;
  const orderCount = orders.length;
  const averageOrderValue = orderCount > 0 ? total / orderCount : 0;

  return { total, previousPeriod: previousTotal, growthRate, orderCount, averageOrderValue };
}

function calculateProfitability(
  orders: Order[],
  products: Product[],
  profile: FinancialProfile | null,
  cogsCoveragePct: number | null
) {
  const grossRevenue = orders.reduce((sum, o) => sum + Number(o.subtotal_price || o.total_price), 0);
  const refunds = orders.reduce((sum, o) => sum + Number(o.refunded_amount), 0);
  const netRevenue = grossRevenue - refunds;

  const cogs = resolveCogs(orders, profile, netRevenue, cogsCoveragePct);
  const estimatedCogs = cogs.amount;

  const logisticsPct = profile?.logistics_cost_pct ?? 8;
  const logisticsCost = netRevenue * (logisticsPct / 100);

  const marketingSpend = getMarketingSpend(profile);
  const grossProfit = netRevenue - estimatedCogs;
  const grossMargin = grossProfit;
  const grossMarginPct = netRevenue > 0 ? (grossMargin / netRevenue) * 100 : 0;

  const contributionMargin = grossProfit - logisticsCost - marketingSpend;
  const contributionMarginPct =
    netRevenue > 0 ? (contributionMargin / netRevenue) * 100 : 0;

  const netProfit = contributionMargin;
  const netMarginPct = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;
  const profitPerOrder = orders.length > 0 ? netProfit / orders.length : 0;

  const topCostDrivers = [
    { label: "Coût des produits", amount: estimatedCogs, pct: pctOf(estimatedCogs, netRevenue) },
    { label: "Logistique", amount: logisticsCost, pct: pctOf(logisticsCost, netRevenue) },
    { label: "Marketing", amount: marketingSpend, pct: pctOf(marketingSpend, netRevenue) },
    { label: "Remboursements", amount: refunds, pct: pctOf(refunds, netRevenue) },
  ].sort((a, b) => b.amount - a.amount);

  return {
    profitability: {
      grossRevenue: netRevenue,
      grossMargin,
      grossMarginPct,
      netProfit,
      netMarginPct,
      profitPerOrder,
      contributionMargin,
      contributionMarginPct,
      topCostDrivers,
    },
    cogs,
  };
}

interface CogsResolution {
  amount: number;
  source: DataQuality["cogsSource"];
  coverage: number;
}

/**
 * COGS resolution, most-real-first:
 * 1. Real Shopify per-variant costs when they cover ≥80% of line-item value
 *    (the uncovered remainder is extrapolated from the store's OWN real cost
 *    ratio — no external assumption).
 * 2. The questionnaire's declared cost percentage.
 * 3. A 40% industry default, explicitly labeled "default" in dataQuality so
 *    consumers (chat, dashboards) can disclose it.
 */
function resolveCogs(
  orders: Order[],
  profile: FinancialProfile | null,
  netRevenue: number,
  coveragePct: number | null
): CogsResolution {
  const cogsFromOrders = orders.reduce((sum, o) => sum + Number(o.cost_of_goods), 0);
  const coverage = coveragePct ?? (cogsFromOrders > 0 ? 100 : 0);

  if (cogsFromOrders > 0 && coverage >= COGS_COVERAGE_THRESHOLD) {
    const scaled = coverage > 0 ? cogsFromOrders / (coverage / 100) : cogsFromOrders;
    return { amount: scaled, source: "shopify", coverage };
  }

  if (profile?.avg_product_cost_pct != null) {
    return {
      amount: netRevenue * (profile.avg_product_cost_pct / 100),
      source: "profile",
      coverage,
    };
  }

  return { amount: netRevenue * 0.4, source: "default", coverage };
}

function calculateMarketing(orders: Order[], profile: FinancialProfile | null) {
  const revenue = orders.reduce((sum, o) => sum + Number(o.total_price), 0);
  const metaSpend = Number(profile?.meta_spend_monthly ?? 0);
  const googleSpend = Number(profile?.google_spend_monthly ?? 0);
  const influencerSpend = Number(profile?.influencer_spend_monthly ?? 0);
  const totalSpend = metaSpend + googleSpend + influencerSpend;

  const roas = totalSpend > 0 ? revenue / totalSpend : 0;
  const mer = revenue > 0 ? (totalSpend / revenue) * 100 : 0;

  const attributedOrders = orders.filter((o) => o.customer_id);
  const uniqueCustomers = new Set(attributedOrders.map((o) => o.customer_id)).size;
  const cac = uniqueCustomers > 0 ? totalSpend / uniqueCustomers : 0;

  // Per-customer value over the period: only orders attributed to a customer,
  // so numerator and denominator cover the same population.
  const totalCustomerSpend = attributedOrders.reduce(
    (sum, o) => sum + Number(o.total_price),
    0
  );
  const ltv = uniqueCustomers > 0 ? totalCustomerSpend / uniqueCustomers : 0;
  const ltvCacRatio = cac > 0 ? ltv / cac : 0;

  return {
    totalSpend,
    metaSpend,
    googleSpend,
    influencerSpend,
    roas,
    mer,
    cac,
    ltv,
    ltvCacRatio,
  };
}

function calculateCashFlow(
  orders: Order[],
  profile: FinancialProfile | null,
  netProfit: number
) {
  const cashAvailable = Number(profile?.cash_available ?? 0);
  const debt = Number(profile?.existing_debt ?? 0);
  const creditLine = Number(profile?.credit_line ?? 0);

  const monthlyInflow = orders.reduce((sum, o) => sum + Number(o.total_price), 0);
  const marketingSpend = getMarketingSpend(profile);
  const estimatedFixedCosts = monthlyInflow * 0.15;
  const monthlyBurn = Math.max(
    marketingSpend + estimatedFixedCosts - netProfit,
    marketingSpend * 0.5
  );

  // Burn ≤ 0 means the store funds itself: runway is effectively unbounded.
  // Prefer the user's own estimate; otherwise cap at 99 instead of inventing.
  const runwayMonths =
    monthlyBurn > 0
      ? (cashAvailable + creditLine - debt) / monthlyBurn
      : profile?.estimated_runway_months ?? 99;

  const netCashPosition = cashAvailable + creditLine - debt;
  let riskLevel: "low" | "medium" | "high" = "low";
  if (runwayMonths < 3) riskLevel = "high";
  else if (runwayMonths < 6) riskLevel = "medium";

  return {
    cashAvailable,
    monthlyBurn,
    monthlyInflow,
    runwayMonths: Math.min(99, Math.max(0, runwayMonths)),
    netCashPosition,
    riskLevel,
  };
}

function calculateHealthScores(
  revenue: CFOMetrics["revenue"],
  profitability: CFOMetrics["profitability"],
  cashFlow: CFOMetrics["cashFlow"],
  marketing: CFOMetrics["marketing"],
  available: { hasCashData: boolean; hasMarketingSpend: boolean }
) {
  const profitabilityScore = scoreRange(profitability.netMarginPct, [
    { min: 20, score: 95 },
    { min: 10, score: 75 },
    { min: 5, score: 55 },
    { min: 0, score: 35 },
    { min: -100, score: 15 },
  ]);

  const cashScore = scoreRange(cashFlow.runwayMonths, [
    { min: 12, score: 95 },
    { min: 6, score: 75 },
    { min: 3, score: 50 },
    { min: 1, score: 25 },
    { min: 0, score: 10 },
  ]);

  const growthScore = scoreRange(revenue.growthRate, [
    { min: 30, score: 95 },
    { min: 15, score: 80 },
    { min: 5, score: 65 },
    { min: 0, score: 45 },
    { min: -100, score: 20 },
  ]);

  const roasScore = scoreRange(marketing.roas, [
    { min: 4, score: 90 },
    { min: 2.5, score: 70 },
    { min: 1.5, score: 50 },
    { min: 1, score: 30 },
    { min: 0, score: 10 },
  ]);

  // The overall score only aggregates components backed by actual data —
  // a missing questionnaire section must not drag the score down.
  const components = [
    { score: profitabilityScore, weight: 0.35 },
    available.hasCashData ? { score: cashScore, weight: 0.3 } : null,
    { score: growthScore, weight: 0.2 },
    available.hasMarketingSpend ? { score: roasScore, weight: 0.15 } : null,
  ].filter((c): c is { score: number; weight: number } => c !== null);

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const overall = Math.round(
    components.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight
  );

  return {
    overall,
    profitability: profitabilityScore,
    cash: cashScore,
    growth: growthScore,
    explanations: {
      overall: explainOverall(overall),
      profitability: explainProfitability(profitability),
      cash: available.hasCashData
        ? explainCash(cashFlow)
        : "Données de trésorerie non renseignées — complétez le questionnaire pour un score fiable.",
      growth: explainGrowth(revenue),
    },
  };
}

/** Monthly growth used for projections is capped so an exceptional month
 *  (e.g. +300% after a launch) doesn't compound into absurd numbers. */
const FORECAST_MONTHLY_GROWTH_CAP = 0.3;

function calculateForecasts(
  revenue: CFOMetrics["revenue"],
  profitability: CFOMetrics["profitability"],
  cashFlow: CFOMetrics["cashFlow"]
): CFOMetrics["forecasts"] {
  const monthlyRevenue = revenue.total;
  const monthlyProfit = profitability.netProfit;
  // growthRate is measured over 30 days vs the previous 30 days → it IS the
  // monthly growth rate. Compound it, bounded to keep projections sane.
  const g = Math.max(
    -FORECAST_MONTHLY_GROWTH_CAP,
    Math.min(FORECAST_MONTHLY_GROWTH_CAP, revenue.growthRate / 100)
  );

  return {
    days30: buildForecast(monthlyRevenue, monthlyProfit, cashFlow.cashAvailable, 1, g, "high"),
    days90: buildForecast(monthlyRevenue, monthlyProfit, cashFlow.cashAvailable, 3, g, "medium"),
    months6: buildForecast(monthlyRevenue, monthlyProfit, cashFlow.cashAvailable, 6, g, "medium"),
    months12: buildForecast(monthlyRevenue, monthlyProfit, cashFlow.cashAvailable, 12, g, "low"),
  };
}

function buildForecast(
  monthlyRevenue: number,
  monthlyProfit: number,
  currentCash: number,
  months: number,
  monthlyGrowth: number,
  confidence: ForecastPeriod["confidence"]
): ForecastPeriod {
  // Sum of month 1..n, each compounding on the last observed month.
  let revenueSum = 0;
  for (let i = 1; i <= months; i += 1) {
    revenueSum += monthlyRevenue * Math.pow(1 + monthlyGrowth, i);
  }
  const profitRate = monthlyRevenue > 0 ? monthlyProfit / monthlyRevenue : 0;
  const projectedRevenue = revenueSum;
  const projectedProfit = revenueSum * profitRate;
  const projectedCash = currentCash + projectedProfit;

  return { projectedRevenue, projectedProfit, projectedCash, confidence };
}

function generateAlerts(
  revenue: CFOMetrics["revenue"],
  profitability: CFOMetrics["profitability"],
  cashFlow: CFOMetrics["cashFlow"],
  marketing: CFOMetrics["marketing"],
  products: Product[],
  context: {
    targetRoas: number | null;
    hasCashData: boolean;
    cogsSource: DataQuality["cogsSource"];
  }
): Alert[] {
  const alerts: Alert[] = [];

  // Only raise cash alerts when the user actually provided cash data —
  // an empty questionnaire must not produce a fabricated "critical runway".
  if (context.hasCashData && cashFlow.runwayMonths < 3) {
    alerts.push({
      id: "cash-critical",
      priority: "critical",
      title: "Trésorerie critique",
      message: `Votre runway est de ${cashFlow.runwayMonths.toFixed(1)} mois. Action immédiate requise.`,
      category: "cash",
      action: "Réduire les dépenses marketing ou augmenter les fonds",
    });
  }

  // Margin alerts are only meaningful when the margin rests on provided data
  // (real Shopify costs or the questionnaire), not on the industry default.
  if (context.cogsSource !== "default" && profitability.netMarginPct < 5) {
    alerts.push({
      id: "margin-low",
      priority: "high",
      title: "Marge nette faible",
      message: `Marge nette à ${profitability.netMarginPct.toFixed(1)}%. Votre rentabilité est sous pression.`,
      category: "profitability",
      action: "Analyser les coûts produits et la structure marketing",
    });
  }

  if (marketing.totalSpend > 0 && marketing.roas > 0) {
    if (marketing.roas < 1.5) {
      alerts.push({
        id: "roas-low",
        priority: "high",
        title: "ROAS insuffisant",
        message: `ROAS actuel: ${marketing.roas.toFixed(2)}x. Vos dépenses publicitaires ne sont probablement pas rentables.`,
        category: "marketing",
        action: "Optimiser les campagnes ou réduire le budget",
      });
    } else if (context.targetRoas != null && marketing.roas < context.targetRoas) {
      alerts.push({
        id: "roas-below-target",
        priority: "medium",
        title: "ROAS sous votre cible",
        message: `ROAS actuel: ${marketing.roas.toFixed(2)}x, en dessous de votre cible de ${context.targetRoas.toFixed(1)}x.`,
        category: "marketing",
        action: "Revoir les audiences et créatives avant d'augmenter le budget",
      });
    }
  }

  if (revenue.growthRate < 0) {
    alerts.push({
      id: "revenue-decline",
      priority: "high",
      title: "Chiffre d'affaires en baisse",
      message: `Baisse de ${Math.abs(revenue.growthRate).toFixed(1)}% vs période précédente.`,
      category: "revenue",
    });
  }

  const unprofitableProducts = products.filter(
    (p) => p.cost_per_item > 0 && p.price > 0 && p.cost_per_item / p.price > 0.7
  );
  if (unprofitableProducts.length > 0) {
    alerts.push({
      id: "products-unprofitable",
      priority: "medium",
      title: `${unprofitableProducts.length} produit(s) à faible marge`,
      message: "Certains produits ont un coût supérieur à 70% du prix de vente.",
      category: "products",
      action: "Revoir la tarification ou les fournisseurs",
    });
  }

  return alerts.sort((a, b) => {
    const priority = { critical: 0, high: 1, medium: 2 };
    return priority[a.priority] - priority[b.priority];
  });
}

export function detectProfitabilityIssues(metrics: CFOMetrics): AuditFinding[] {
  const findings: AuditFinding[] = [];

  if (metrics.profitability.netMarginPct < 10) {
    findings.push({
      type: "warning",
      category: "profitability",
      title: "Marge nette insuffisante",
      description: `Votre marge nette de ${metrics.profitability.netMarginPct.toFixed(1)}% est en dessous du seuil recommandé de 10% pour une boutique Shopify rentable.`,
      impact: "high",
    });
  }

  const topDriver = metrics.profitability.topCostDrivers[0];
  if (topDriver && topDriver.pct > 50) {
    findings.push({
      type: "warning",
      category: "costs",
      title: `${topDriver.label} domine vos coûts`,
      description: `${topDriver.label} représente ${topDriver.pct.toFixed(0)}% de votre CA. Diversifiez ou optimisez cette ligne.`,
      impact: "medium",
    });
  }

  return findings;
}

function getMarketingSpend(profile: FinancialProfile | null): number {
  return (
    Number(profile?.meta_spend_monthly ?? 0) +
    Number(profile?.google_spend_monthly ?? 0) +
    Number(profile?.influencer_spend_monthly ?? 0)
  );
}

function pctOf(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0;
}

function scoreRange(
  value: number,
  thresholds: { min: number; score: number }[]
): number {
  for (const t of thresholds) {
    if (value >= t.min) return t.score;
  }
  return 10;
}

function explainOverall(score: number): string {
  if (score >= 80) return "Votre entreprise présente une santé financière solide.";
  if (score >= 60) return "Situation correcte avec des axes d'amélioration identifiés.";
  if (score >= 40) return "Plusieurs signaux d'alerte nécessitent votre attention.";
  return "Situation financière préoccupante. Actions correctives urgentes recommandées.";
}

function explainProfitability(p: CFOMetrics["profitability"]): string {
  return `Marge nette de ${p.netMarginPct.toFixed(1)}% avec ${p.profitPerOrder.toFixed(0)}€ de profit par commande.`;
}

function explainCash(c: CFOMetrics["cashFlow"]): string {
  return `${c.runwayMonths.toFixed(1)} mois de runway avec ${c.riskLevel === "high" ? "un risque élevé" : c.riskLevel === "medium" ? "un risque modéré" : "une situation stable"}.`;
}

function explainGrowth(r: CFOMetrics["revenue"]): string {
  const direction = r.growthRate >= 0 ? "croissance" : "décroissance";
  return `${Math.abs(r.growthRate).toFixed(1)}% de ${direction} sur la période analysée.`;
}
