/**
 * Deterministic what-if simulations built ONLY on metrics computed by the CFO
 * engine. Every assumption is surfaced in the result so the response layer can
 * state it explicitly — the chat never hides a hypothesis.
 */

import type { CFOMetrics } from "@/types/database";
import type { Channel } from "./types";

/** Diminishing returns applied to incremental ad spend (industry heuristic). */
export const MARGINAL_ROAS_FACTOR = 0.85;
/** Employer charges multiplier applied to gross salary. */
export const EMPLOYER_COST_FACTOR = 1.35;

export type Verdict = "go" | "caution" | "no";

/**
 * Contribution rate BEFORE marketing spend: how much of 1 unit of extra
 * revenue remains after COGS + logistics. This is the right rate to apply to
 * ad-driven incremental revenue.
 */
export function contributionRateBeforeMarketing(m: CFOMetrics): number {
  const netRevenue = m.profitability.grossRevenue;
  if (netRevenue <= 0) return Math.max(m.profitability.grossMarginPct, 0) / 100;
  const rate =
    (m.profitability.contributionMargin + m.marketing.totalSpend) / netRevenue;
  return Math.min(Math.max(rate, 0), 1);
}

function runwayFor(m: CFOMetrics, monthlyBurn: number): number {
  if (monthlyBurn <= 0) return 99;
  return Math.max(0, Math.min(99, m.cashFlow.netCashPosition / monthlyBurn));
}

// ---------------------------------------------------------------------------
// Ad budget change
// ---------------------------------------------------------------------------

export interface BudgetSim {
  delta: number;
  channel: Channel | null;
  spendBefore: number;
  spendAfter: number;
  roasUsed: number;
  addedRevenue: number;
  addedProfit: number;
  merBefore: number;
  merAfter: number;
  runwayBefore: number;
  runwayAfter: number;
  verdict: Verdict;
}

export function channelSpend(m: CFOMetrics, channel: Channel | null): number {
  if (channel === "meta") return m.marketing.metaSpend;
  if (channel === "google") return m.marketing.googleSpend;
  if (channel === "influencer") return m.marketing.influencerSpend;
  return m.marketing.totalSpend;
}

/**
 * Simulates a monthly ad spend change of `delta` (signed).
 * Returns null when there is no spend/ROAS baseline to extrapolate from.
 */
export function simulateBudgetChange(
  m: CFOMetrics,
  delta: number,
  channel: Channel | null
): BudgetSim | null {
  const roas = m.marketing.roas;
  if (m.marketing.totalSpend <= 0 || roas <= 0 || delta === 0) return null;

  const spendBefore = channelSpend(m, channel);
  const boundedDelta = Math.max(delta, -spendBefore);
  const spendAfter = spendBefore + boundedDelta;

  // Extra spend earns less than average (saturation); cut spend loses at the
  // same discounted rate (you cut the worst-performing part first).
  const roasUsed = roas * MARGINAL_ROAS_FACTOR;
  const addedRevenue = boundedDelta * roasUsed;
  const cr = contributionRateBeforeMarketing(m);
  const addedProfit = addedRevenue * cr - boundedDelta;

  const revenueAfter = m.revenue.total + addedRevenue;
  const totalSpendAfter = m.marketing.totalSpend + boundedDelta;
  const merBefore = m.marketing.mer;
  const merAfter = revenueAfter > 0 ? (totalSpendAfter / revenueAfter) * 100 : 0;

  const runwayBefore = m.cashFlow.runwayMonths;
  const burnAfter = m.cashFlow.monthlyBurn + (boundedDelta - addedProfit);
  const runwayAfter = runwayFor(m, burnAfter);

  let verdict: Verdict;
  if (boundedDelta > 0) {
    if (addedProfit > 0 && runwayAfter >= 3 && roas >= 2) verdict = "go";
    else if (addedProfit > 0 && runwayAfter >= 1.5) verdict = "caution";
    else verdict = "no";
  } else {
    // Cutting: "go" when the cut improves profit (unprofitable spend).
    if (addedProfit > 0) verdict = "go";
    else if (addedProfit > boundedDelta * 0.25) verdict = "caution";
    else verdict = "no";
  }

  return {
    delta: boundedDelta,
    channel,
    spendBefore,
    spendAfter,
    roasUsed,
    addedRevenue,
    addedProfit,
    merBefore,
    merAfter,
    runwayBefore,
    runwayAfter,
    verdict,
  };
}

// ---------------------------------------------------------------------------
// Hiring
// ---------------------------------------------------------------------------

export interface HireSim {
  monthlySalary: number;
  monthlyFullCost: number;
  profitBefore: number;
  profitAfter: number;
  runwayBefore: number;
  runwayAfter: number;
  verdict: Verdict;
}

/**
 * Requires a user-provided salary — the chat never assumes one.
 * Amounts ≥ 20k are read as annual salaries.
 */
export function simulateHire(m: CFOMetrics, monthlySalaryInput: number): HireSim {
  let monthlySalary = monthlySalaryInput;
  if (monthlySalary >= 20_000) monthlySalary = monthlySalary / 12;

  const monthlyFullCost = monthlySalary * EMPLOYER_COST_FACTOR;
  const profitBefore = m.profitability.netProfit;
  const profitAfter = profitBefore - monthlyFullCost;
  const runwayBefore = m.cashFlow.runwayMonths;
  const runwayAfter = runwayFor(m, m.cashFlow.monthlyBurn + monthlyFullCost);

  let verdict: Verdict;
  if (runwayAfter >= 6 && profitAfter > 0) verdict = "go";
  else if (runwayAfter >= 4) verdict = "caution";
  else verdict = "no";

  return {
    monthlySalary,
    monthlyFullCost,
    profitBefore,
    profitAfter,
    runwayBefore,
    runwayAfter,
    verdict,
  };
}

// ---------------------------------------------------------------------------
// Price change
// ---------------------------------------------------------------------------

export interface PriceSim {
  percent: number;
  aovBefore: number;
  aovAfter: number;
  addedProfitIfVolumeHolds: number;
  /** Max % of order volume you can lose before the change destroys profit. */
  breakEvenVolumeDropPct: number;
}

/** Requires a user-provided percentage — the chat never assumes one. */
export function simulatePriceChange(m: CFOMetrics, percent: number): PriceSim {
  const p = percent / 100;
  const cm = Math.max(m.profitability.contributionMarginPct, 0) / 100;

  const aovBefore = m.revenue.averageOrderValue;
  const aovAfter = aovBefore * (1 + p);
  const addedProfitIfVolumeHolds = m.profitability.grossRevenue * p;
  const breakEvenVolumeDropPct =
    p > 0 && cm + p > 0 ? (p / (cm + p)) * 100 : 0;

  return {
    percent,
    aovBefore,
    aovAfter,
    addedProfitIfVolumeHolds,
    breakEvenVolumeDropPct,
  };
}

// ---------------------------------------------------------------------------
// Forecast horizon selection
// ---------------------------------------------------------------------------

export function pickForecast(m: CFOMetrics, months: number | null) {
  const horizon = months ?? 3;
  if (horizon <= 1) return { label: 1, forecast: m.forecasts.days30 };
  if (horizon <= 3) return { label: 3, forecast: m.forecasts.days90 };
  if (horizon <= 6) return { label: 6, forecast: m.forecasts.months6 };
  return { label: 12, forecast: m.forecasts.months12 };
}
