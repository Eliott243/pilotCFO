import type { CFOMetrics } from "@/types/database";

/** Métriques de démo — uniquement pour prévisualisation UI sans Supabase */
export function getDemoMetrics(): CFOMetrics {
  return {
    revenue: {
      total: 84200,
      previousPeriod: 71500,
      growthRate: 17.8,
      orderCount: 1247,
      averageOrderValue: 67.5,
    },
    profitability: {
      grossRevenue: 84200,
      grossMargin: 42100,
      grossMarginPct: 50,
      netProfit: 16840,
      netMarginPct: 20,
      profitPerOrder: 13.5,
      contributionMargin: 21050,
      contributionMarginPct: 25,
      topCostDrivers: [
        { label: "Coût des produits", amount: 42100, pct: 50 },
        { label: "Marketing", amount: 12600, pct: 15 },
        { label: "Logistique", amount: 6736, pct: 8 },
        { label: "Remboursements", amount: 2105, pct: 2.5 },
      ],
    },
    marketing: {
      totalSpend: 12600,
      metaSpend: 8400,
      googleSpend: 3200,
      influencerSpend: 1000,
      roas: 6.68,
      mer: 15,
      cac: 28.5,
      ltv: 142,
      ltvCacRatio: 4.98,
    },
    cashFlow: {
      cashAvailable: 45000,
      monthlyBurn: 18500,
      monthlyInflow: 84200,
      runwayMonths: 8.2,
      netCashPosition: 52000,
      riskLevel: "low",
    },
    health: {
      overall: 78,
      profitability: 82,
      cash: 75,
      growth: 80,
      explanations: {
        overall:
          "Votre entreprise présente une santé financière solide. (Mode démo)",
        profitability:
          "Marge nette de 20.0% avec 14€ de profit par commande.",
        cash: "8.2 mois de runway avec une situation stable.",
        growth: "17.8% de croissance sur la période analysée.",
      },
    },
    forecasts: {
      days30: {
        projectedRevenue: 92000,
        projectedProfit: 18400,
        projectedCash: 63400,
        confidence: "high",
      },
      days90: {
        projectedRevenue: 285000,
        projectedProfit: 57000,
        projectedCash: 102000,
        confidence: "medium",
      },
      months6: {
        projectedRevenue: 580000,
        projectedProfit: 116000,
        projectedCash: 161000,
        confidence: "medium",
      },
      months12: {
        projectedRevenue: 1250000,
        projectedProfit: 250000,
        projectedCash: 295000,
        confidence: "low",
      },
    },
    alerts: [
      {
        id: "demo-roas",
        priority: "medium",
        title: "Budget Meta à optimiser",
        message:
          "Votre ROAS Meta est de 5.2x — en dessous de votre cible de 6x.",
        category: "marketing",
        action: "Tester de nouvelles audiences ou créatives",
      },
    ],
  };
}
