import type { FinancialProfile, Order } from "@/types/database";

export function makeOrder(overrides: Partial<Order>): Order {
  return {
    id: "1",
    store_id: "s1",
    shopify_order_id: 1,
    order_number: "#1001",
    total_price: 100,
    subtotal_price: 100,
    total_tax: 0,
    total_discounts: 0,
    total_shipping: 0,
    currency: "EUR",
    financial_status: "paid",
    fulfillment_status: "fulfilled",
    customer_id: 1,
    line_items_count: 1,
    refunded_amount: 0,
    cost_of_goods: 0,
    ordered_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeProfile(overrides?: Partial<FinancialProfile>): FinancialProfile {
  return {
    id: "p1",
    company_id: "c1",
    annual_revenue: null,
    monthly_revenue_avg: null,
    annual_revenue_target: null,
    avg_product_cost_pct: null,
    gross_margin_estimate_pct: null,
    logistics_cost_pct: null,
    meta_spend_monthly: 0,
    google_spend_monthly: 0,
    influencer_spend_monthly: 0,
    target_roas: null,
    cash_available: 0,
    existing_debt: 0,
    credit_line: 0,
    estimated_runway_months: null,
    growth_objectives_12m: null,
    planned_hires: 0,
    new_markets: null,
    ...overrides,
  };
}
