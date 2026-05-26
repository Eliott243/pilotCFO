/**
 * pilotCFO Engine
 * Source of truth for all financial calculations.
 * AI only interprets these results — never invents numbers.
 */

import type {
  Alert,
  AuditFinding,
  CFOMetrics,
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
}

export function calculateMetrics(input: CFOEngineInput): CFOMetrics {
  const { orders, products, profile, previousPeriodOrders = [] } = input;

  const revenue = calculateRevenue(orders, previousPeriodOrders);
  const profitability = calculateProfitability(orders, products, profile);
  const marketing = calculateMarketing(orders, profile);
  const cashFlow = calculateCashFlow(orders, profile, profitability.netProfit);
  const health = calculateHealthScores(revenue, profitability, cashFlow, marketing);
  const forecasts = calculateForecasts(revenue, profitability, cashFlow);
  const alerts = generateAlerts(revenue, profitability, cashFlow, marketing, products);

  return {
    revenue,
    profitability,
    marketing,
    cashFlow,
    health,
    forecasts,
    alerts,
  };
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
  profile: FinancialProfile | null
) {
  const grossRevenue = orders.reduce((sum, o) => sum + Number(o.subtotal_price || o.total_price), 0);
  const refunds = orders.reduce((sum, o) => sum + Number(o.refunded_amount), 0);
  const netRevenue = grossRevenue - refunds;

  const cogsFromOrders = orders.reduce((sum, o) => sum + Number(o.cost_of_goods), 0);
  const costPct = profile?.avg_product_cost_pct ?? 40;
  const estimatedCogs =
    cogsFromOrders > 0 ? cogsFromOrders : netRevenue * (costPct / 100);

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
    grossRevenue: netRevenue,
    grossMargin,
    grossMarginPct,
    netProfit,
    netMarginPct,
    profitPerOrder,
    contributionMargin,
    contributionMarginPct,
    topCostDrivers,
  };
}

function calculateMarketing(orders: Order[], profile: FinancialProfile | null) {
  const revenue = orders.reduce((sum, o) => sum + Number(o.total_price), 0);
  const metaSpend = Number(profile?.meta_spend_monthly ?? 0);
  const googleSpend = Number(profile?.google_spend_monthly ?? 0);
  const influencerSpend = Number(profile?.influencer_spend_monthly ?? 0);
  const totalSpend = metaSpend + googleSpend + influencerSpend;

  const roas = totalSpend > 0 ? revenue / totalSpend : 0;
  const mer = revenue > 0 ? (totalSpend / revenue) * 100 : 0;

  const uniqueCustomers = new Set(
    orders.filter((o) => o.customer_id).map((o) => o.customer_id)
  ).size;
  const cac = uniqueCustomers > 0 ? totalSpend / uniqueCustomers : 0;

  const totalCustomerSpend = orders.reduce((sum, o) => sum + Number(o.total_price), 0);
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

  const netMonthlyCash = monthlyInflow - monthlyBurn;
  const runwayMonths =
    monthlyBurn > 0
      ? (cashAvailable + creditLine - debt) / monthlyBurn
      : profile?.estimated_runway_months ?? 12;

  const netCashPosition = cashAvailable + creditLine - debt;
  let riskLevel: "low" | "medium" | "high" = "low";
  if (runwayMonths < 3) riskLevel = "high";
  else if (runwayMonths < 6) riskLevel = "medium";

  return {
    cashAvailable,
    monthlyBurn,
    monthlyInflow,
    runwayMonths: Math.max(0, runwayMonths),
    netCashPosition,
    riskLevel,
  };
}

function calculateHealthScores(
  revenue: CFOMetrics["revenue"],
  profitability: CFOMetrics["profitability"],
  cashFlow: CFOMetrics["cashFlow"],
  marketing: CFOMetrics["marketing"]
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

  const overall = Math.round(
    profitabilityScore * 0.35 + cashScore * 0.3 + growthScore * 0.2 + roasScore * 0.15
  );

  return {
    overall,
    profitability: profitabilityScore,
    cash: cashScore,
    growth: growthScore,
    explanations: {
      overall: explainOverall(overall),
      profitability: explainProfitability(profitability),
      cash: explainCash(cashFlow),
      growth: explainGrowth(revenue),
    },
  };
}

function calculateForecasts(
  revenue: CFOMetrics["revenue"],
  profitability: CFOMetrics["profitability"],
  cashFlow: CFOMetrics["cashFlow"]
): CFOMetrics["forecasts"] {
  const dailyRevenue = revenue.total / 30;
  const dailyProfit = profitability.netProfit / 30;
  const monthlyGrowth = 1 + revenue.growthRate / 100 / 12;

  return {
    days30: buildForecast(dailyRevenue, dailyProfit, cashFlow.cashAvailable, 30, monthlyGrowth, "high"),
    days90: buildForecast(dailyRevenue, dailyProfit, cashFlow.cashAvailable, 90, monthlyGrowth, "medium"),
    months6: buildForecast(dailyRevenue, dailyProfit, cashFlow.cashAvailable, 180, monthlyGrowth, "medium"),
    months12: buildForecast(dailyRevenue, dailyProfit, cashFlow.cashAvailable, 365, monthlyGrowth, "low"),
  };
}

function buildForecast(
  dailyRevenue: number,
  dailyProfit: number,
  currentCash: number,
  days: number,
  growthFactor: number,
  confidence: ForecastPeriod["confidence"]
): ForecastPeriod {
  const projectedRevenue = dailyRevenue * days * growthFactor;
  const projectedProfit = dailyProfit * days * growthFactor;
  const projectedCash = currentCash + projectedProfit - dailyProfit * days * 0.3;

  return { projectedRevenue, projectedProfit, projectedCash, confidence };
}

function generateAlerts(
  revenue: CFOMetrics["revenue"],
  profitability: CFOMetrics["profitability"],
  cashFlow: CFOMetrics["cashFlow"],
  marketing: CFOMetrics["marketing"],
  products: Product[]
): Alert[] {
  const alerts: Alert[] = [];

  if (cashFlow.runwayMonths < 3) {
    alerts.push({
      id: "cash-critical",
      priority: "critical",
      title: "Trésorerie critique",
      message: `Votre runway est de ${cashFlow.runwayMonths.toFixed(1)} mois. Action immédiate requise.`,
      category: "cash",
      action: "Réduire les dépenses marketing ou augmenter les fonds",
    });
  }

  if (profitability.netMarginPct < 5) {
    alerts.push({
      id: "margin-low",
      priority: "high",
      title: "Marge nette faible",
      message: `Marge nette à ${profitability.netMarginPct.toFixed(1)}%. Votre rentabilité est sous pression.`,
      category: "profitability",
      action: "Analyser les coûts produits et la structure marketing",
    });
  }

  if (marketing.roas > 0 && marketing.roas < (marketing as { targetRoas?: number }).targetRoas!) {
    if (marketing.roas < 1.5) {
      alerts.push({
        id: "roas-low",
        priority: "high",
        title: "ROAS insuffisant",
        message: `ROAS actuel: ${marketing.roas.toFixed(2)}x. Vos dépenses publicitaires ne sont pas rentables.`,
        category: "marketing",
        action: "Optimiser les campagnes ou réduire le budget",
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

export function detectProfitabilityIssues(
  metrics: CFOMetrics,
  products: Product[]
): AuditFinding[] {
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
