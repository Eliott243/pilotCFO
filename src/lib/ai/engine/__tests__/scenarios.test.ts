import { describe, expect, it } from "vitest";
import {
  contributionRateBeforeMarketing,
  simulateBudgetChange,
  simulateHire,
  simulatePriceChange,
  pickForecast,
} from "../scenarios";
import { buildMetrics } from "./fixtures";

const m = buildMetrics();

describe("contributionRateBeforeMarketing", () => {
  it("computes the post-COGS/logistics rate", () => {
    // (12000 + 10000) / 48000
    expect(contributionRateBeforeMarketing(m)).toBeCloseTo(0.4583, 3);
  });
});

describe("simulateBudgetChange", () => {
  it("simulates an increase with marginal ROAS decay", () => {
    const sim = simulateBudgetChange(m, 1000, "meta");
    expect(sim).not.toBeNull();
    expect(sim!.roasUsed).toBeCloseTo(4.25, 2);
    expect(sim!.addedRevenue).toBeCloseTo(4250, 0);
    expect(sim!.addedProfit).toBeCloseTo(4250 * 0.458333 - 1000, 0);
    expect(sim!.runwayAfter).toBeCloseTo(40_000 / (10_000 + (1000 - 947.9)), 1);
    expect(sim!.verdict).toBe("go");
  });

  it("never cuts more than the channel budget", () => {
    const sim = simulateBudgetChange(m, -50_000, "google");
    expect(sim!.delta).toBe(-3000);
    expect(sim!.spendAfter).toBe(0);
  });

  it("recommends cutting unprofitable spend", () => {
    const lowRoas = buildMetrics({
      marketing: { ...m.marketing, roas: 1 },
    });
    const sim = simulateBudgetChange(lowRoas, -1000, null);
    // Cutting 1000 loses 850 revenue → ~390 contribution, saves 1000 → profit up.
    expect(sim!.addedProfit).toBeGreaterThan(0);
    expect(sim!.verdict).toBe("go");
  });

  it("returns null without a spend baseline", () => {
    const noAds = buildMetrics({
      marketing: { ...m.marketing, totalSpend: 0, roas: 0 },
    });
    expect(simulateBudgetChange(noAds, 1000, null)).toBeNull();
  });
});

describe("simulateHire", () => {
  it("applies employer charges and recomputes runway", () => {
    const sim = simulateHire(m, 3000);
    expect(sim.monthlyFullCost).toBeCloseTo(4050, 0);
    expect(sim.profitAfter).toBeCloseTo(2950, 0);
    expect(sim.runwayAfter).toBeCloseTo(40_000 / 14_050, 2);
    expect(sim.verdict).toBe("no"); // runway drops under 4 months
  });

  it("converts annual salaries to monthly", () => {
    const sim = simulateHire(m, 36_000);
    expect(sim.monthlySalary).toBe(3000);
  });
});

describe("simulatePriceChange", () => {
  it("computes break-even volume drop", () => {
    const sim = simulatePriceChange(m, 10);
    // p / (cm + p) = 0.10 / 0.35
    expect(sim.breakEvenVolumeDropPct).toBeCloseTo(28.57, 1);
    expect(sim.aovAfter).toBeCloseTo(110, 2);
    expect(sim.addedProfitIfVolumeHolds).toBeCloseTo(4800, 0);
  });
});

describe("pickForecast", () => {
  it("maps months to the closest horizon", () => {
    expect(pickForecast(m, 1).label).toBe(1);
    expect(pickForecast(m, 3).label).toBe(3);
    expect(pickForecast(m, 6).label).toBe(6);
    expect(pickForecast(m, 12).label).toBe(12);
    expect(pickForecast(m, null).label).toBe(3);
  });
});
