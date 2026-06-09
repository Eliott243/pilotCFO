/**
 * Regression tests for engine bug fixes:
 * - ROAS alerts (previously dead code: compared against a non-existent field)
 * - fabricated alerts/scores when questionnaire data is missing
 * - forecast compounding (previously growth/12 applied linearly)
 * - LTV computed on attributed orders only
 * - runway without invented fallbacks
 */

import { describe, expect, it } from "vitest";
import { calculateMetrics } from "@/lib/cfo-engine";
import { makeOrder, makeProfile } from "./fixtures";

describe("ROAS alerts", () => {
  it("raises a high alert when ROAS < 1.5", () => {
    // 1000€ revenue, 800€ declared spend → ROAS 1.25
    const m = calculateMetrics({
      orders: [makeOrder({ total_price: 1000, subtotal_price: 1000 })],
      products: [],
      profile: makeProfile({ meta_spend_monthly: 800 }),
    });
    expect(m.alerts.some((a) => a.id === "roas-low")).toBe(true);
  });

  it("raises a medium alert when ROAS is below the user's target", () => {
    // ROAS 2.5 with a declared target of 4
    const m = calculateMetrics({
      orders: [makeOrder({ total_price: 1000, subtotal_price: 1000 })],
      products: [],
      profile: makeProfile({ meta_spend_monthly: 400, target_roas: 4 }),
    });
    const alert = m.alerts.find((a) => a.id === "roas-below-target");
    expect(alert).toBeDefined();
    expect(alert?.priority).toBe("medium");
  });

  it("raises nothing without declared spend", () => {
    const m = calculateMetrics({
      orders: [makeOrder({})],
      products: [],
      profile: makeProfile(),
    });
    expect(m.alerts.some((a) => a.category === "marketing")).toBe(false);
  });
});

describe("no fabricated alerts from missing data", () => {
  it("does not raise a critical cash alert when cash data is missing", () => {
    const m = calculateMetrics({
      orders: [makeOrder({})],
      products: [],
      profile: makeProfile(), // all-zero cash section
    });
    expect(m.dataQuality.hasCashData).toBe(false);
    expect(m.alerts.some((a) => a.id === "cash-critical")).toBe(false);
  });

  it("raises the cash alert when real cash data shows a short runway", () => {
    const m = calculateMetrics({
      orders: [makeOrder({ total_price: 10_000, subtotal_price: 10_000 })],
      products: [],
      profile: makeProfile({ cash_available: 2_000, meta_spend_monthly: 3_000 }),
    });
    expect(m.dataQuality.hasCashData).toBe(true);
    expect(m.alerts.some((a) => a.id === "cash-critical")).toBe(true);
  });

  it("does not raise a margin alert when the margin rests on the default estimate", () => {
    // No profile, no real costs → cogsSource "default" → margin is an estimate
    const m = calculateMetrics({
      orders: [makeOrder({ total_price: 100, subtotal_price: 100, refunded_amount: 60 })],
      products: [],
      profile: null,
    });
    expect(m.dataQuality.cogsSource).toBe("default");
    expect(m.alerts.some((a) => a.id === "margin-low")).toBe(false);
  });
});

describe("health score with missing data", () => {
  it("excludes cash and ROAS components when their data is missing", () => {
    const m = calculateMetrics({
      orders: [makeOrder({})],
      products: [],
      profile: null,
    });
    // Without exclusion, the zero-cash runway would force a cash score of 10
    // and drag the overall score down. Reweighted: only profitability + growth.
    const expected = Math.round(
      (m.health.profitability * 0.35 + m.health.growth * 0.2) / 0.55
    );
    expect(m.health.overall).toBe(expected);
    expect(m.health.explanations.cash).toContain("non renseignées");
  });
});

describe("forecast compounding", () => {
  it("compounds the observed monthly growth rate", () => {
    // 10 orders of 100€ this month vs 1000€/1.1 last month → exactly +10%
    const current = Array.from({ length: 10 }, (_, i) =>
      makeOrder({ id: `c${i}`, total_price: 100, subtotal_price: 100 })
    );
    const previous = [
      makeOrder({ id: "p1", total_price: 1000 / 1.1, subtotal_price: 1000 / 1.1 }),
    ];
    const m = calculateMetrics({
      orders: current,
      products: [],
      profile: null,
      previousPeriodOrders: previous,
    });

    // 3 months at +10%: 1000 × (1.1 + 1.21 + 1.331)
    expect(m.forecasts.days90.projectedRevenue).toBeCloseTo(3641, 0);
    // 12-month projection must exceed naive linear (12 × 1100 = 13200)
    expect(m.forecasts.months12.projectedRevenue).toBeGreaterThan(13_200);
  });

  it("caps extreme growth at +30%/month", () => {
    // +900% growth month-over-month must project like +30%
    const current = [makeOrder({ id: "c1", total_price: 10_000, subtotal_price: 10_000 })];
    const previous = [makeOrder({ id: "p1", total_price: 1_000, subtotal_price: 1_000 })];
    const m = calculateMetrics({
      orders: current,
      products: [],
      profile: null,
      previousPeriodOrders: previous,
    });

    let expected = 0;
    for (let i = 1; i <= 12; i += 1) expected += 10_000 * Math.pow(1.3, i);
    expect(m.forecasts.months12.projectedRevenue).toBeCloseTo(expected, 0);
  });
});

describe("LTV attribution", () => {
  it("only counts attributed orders in the per-customer value", () => {
    const m = calculateMetrics({
      orders: [
        makeOrder({ id: "1", customer_id: 1, total_price: 100, subtotal_price: 100 }),
        makeOrder({ id: "2", customer_id: null, total_price: 50, subtotal_price: 50 }),
      ],
      products: [],
      profile: makeProfile({ meta_spend_monthly: 10 }),
    });
    // Before the fix: (100+50)/1 = 150. After: 100/1.
    expect(m.marketing.ltv).toBe(100);
  });
});

describe("runway sanity", () => {
  it("self-funding store gets capped runway, not an invented 12 months", () => {
    // No marketing spend, profitable → burn = 0
    const m = calculateMetrics({
      orders: [makeOrder({ total_price: 100, subtotal_price: 100 })],
      products: [],
      profile: null,
    });
    expect(m.cashFlow.monthlyBurn).toBe(0);
    expect(m.cashFlow.runwayMonths).toBe(99);
  });

  it("prefers the user's own runway estimate when burn is zero", () => {
    const m = calculateMetrics({
      orders: [makeOrder({ total_price: 100, subtotal_price: 100 })],
      products: [],
      profile: makeProfile({ estimated_runway_months: 7 }),
    });
    expect(m.cashFlow.runwayMonths).toBe(7);
  });
});
