import type { CFOMetrics } from "@/types/database";

/** Realistic, internally-consistent store: 50k€/mo revenue, healthy ROAS. */
export function buildMetrics(overrides?: Partial<CFOMetrics>): CFOMetrics {
  return {
    revenue: {
      total: 50_000,
      previousPeriod: 45_000,
      growthRate: 11.1,
      orderCount: 500,
      averageOrderValue: 100,
    },
    profitability: {
      grossRevenue: 48_000,
      grossMargin: 28_800,
      grossMarginPct: 60,
      netProfit: 7_000,
      netMarginPct: 14.6,
      profitPerOrder: 14,
      contributionMargin: 12_000,
      contributionMarginPct: 25,
      topCostDrivers: [
        { label: "Coût des produits", amount: 19_200, pct: 40 },
        { label: "Marketing", amount: 10_000, pct: 20.8 },
        { label: "Logistique", amount: 3_840, pct: 8 },
        { label: "Remboursements", amount: 2_000, pct: 4.2 },
      ],
    },
    marketing: {
      totalSpend: 10_000,
      metaSpend: 6_000,
      googleSpend: 3_000,
      influencerSpend: 1_000,
      roas: 5,
      mer: 20,
      cac: 25,
      ltv: 120,
      ltvCacRatio: 4.8,
    },
    cashFlow: {
      cashAvailable: 40_000,
      monthlyBurn: 10_000,
      monthlyInflow: 50_000,
      runwayMonths: 4,
      netCashPosition: 40_000,
      riskLevel: "medium",
    },
    health: {
      overall: 70,
      profitability: 75,
      cash: 50,
      growth: 65,
      explanations: {
        overall: "Situation correcte avec des axes d'amélioration identifiés.",
        profitability: "Marge nette de 14.6%.",
        cash: "4.0 mois de runway.",
        growth: "11.1% de croissance.",
      },
    },
    forecasts: {
      days30: {
        projectedRevenue: 51_000,
        projectedProfit: 7_100,
        projectedCash: 42_000,
        confidence: "high",
      },
      days90: {
        projectedRevenue: 155_000,
        projectedProfit: 21_500,
        projectedCash: 47_000,
        confidence: "medium",
      },
      months6: {
        projectedRevenue: 312_000,
        projectedProfit: 43_500,
        projectedCash: 55_000,
        confidence: "medium",
      },
      months12: {
        projectedRevenue: 640_000,
        projectedProfit: 89_000,
        projectedCash: 70_000,
        confidence: "low",
      },
    },
    alerts: [
      {
        id: "products-unprofitable",
        priority: "medium",
        title: "2 produit(s) à faible marge",
        message: "Certains produits ont un coût supérieur à 70% du prix de vente.",
        category: "products",
        action: "Revoir la tarification ou les fournisseurs",
      },
    ],
    dataQuality: {
      ordersCount: 500,
      cogsSource: "shopify",
      cogsCoveragePct: 95,
      logisticsSource: "profile",
      hasMarketingSpend: true,
      hasCashData: true,
      hasProfile: true,
    },
    ...overrides,
  };
}
