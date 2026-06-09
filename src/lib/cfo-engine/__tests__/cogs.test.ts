import { describe, expect, it } from "vitest";
import { calculateMetrics } from "@/lib/cfo-engine";
import { makeOrder, makeProfile } from "./fixtures";

describe("COGS resolution", () => {
  it("uses real Shopify costs when coverage is high, scaling to 100%", () => {
    const orders = [
      makeOrder({ id: "1", cost_of_goods: 36 }),
      makeOrder({ id: "2", cost_of_goods: 36 }),
    ];
    const m = calculateMetrics({ orders, products: [], profile: null, cogsCoveragePct: 90 });

    expect(m.dataQuality.cogsSource).toBe("shopify");
    expect(m.dataQuality.cogsCoveragePct).toBe(90);
    // 72 real costs covering 90% of value → extrapolated to 80 total
    const cogsDriver = m.profitability.topCostDrivers.find((d) =>
      d.label.includes("produits")
    );
    expect(cogsDriver?.amount).toBeCloseTo(80, 0);
  });

  it("falls back to the questionnaire percentage when coverage is low", () => {
    const orders = [makeOrder({ id: "1", cost_of_goods: 10 })];
    const profile = makeProfile({ avg_product_cost_pct: 55 });
    const m = calculateMetrics({ orders, products: [], profile, cogsCoveragePct: 30 });

    expect(m.dataQuality.cogsSource).toBe("profile");
    const cogsDriver = m.profitability.topCostDrivers.find((d) =>
      d.label.includes("produits")
    );
    expect(cogsDriver?.amount).toBeCloseTo(55, 0); // 55% of 100€
  });

  it("labels the industry default when nothing is provided", () => {
    const orders = [makeOrder({ id: "1" })];
    const m = calculateMetrics({ orders, products: [], profile: null });

    expect(m.dataQuality.cogsSource).toBe("default");
    const cogsDriver = m.profitability.topCostDrivers.find((d) =>
      d.label.includes("produits")
    );
    expect(cogsDriver?.amount).toBeCloseTo(40, 0); // 40% of 100€
  });
});

describe("dataQuality flags", () => {
  it("reports missing cash data for an all-zero profile", () => {
    const m = calculateMetrics({
      orders: [makeOrder({})],
      products: [],
      profile: makeProfile(),
    });
    expect(m.dataQuality.hasCashData).toBe(false);
    expect(m.dataQuality.hasMarketingSpend).toBe(false);
    expect(m.dataQuality.hasProfile).toBe(true);
  });

  it("reports cash data when the questionnaire provides it", () => {
    const m = calculateMetrics({
      orders: [makeOrder({})],
      products: [],
      profile: makeProfile({ cash_available: 25_000, meta_spend_monthly: 1_000 }),
    });
    expect(m.dataQuality.hasCashData).toBe(true);
    expect(m.dataQuality.hasMarketingSpend).toBe(true);
  });
});
