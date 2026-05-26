export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid";

export type SubscriptionPlan = "trial" | "starter" | "growth" | "scale";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  questionnaire_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  user_id: string;
  name: string;
  country: string | null;
  currency: string;
  founded_year: number | null;
  employee_count: number;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  company_id: string;
  shopify_domain: string;
  shop_name: string | null;
  shop_email: string | null;
  currency: string;
  timezone: string | null;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialProfile {
  id: string;
  company_id: string;
  annual_revenue: number | null;
  monthly_revenue_avg: number | null;
  annual_revenue_target: number | null;
  avg_product_cost_pct: number | null;
  gross_margin_estimate_pct: number | null;
  logistics_cost_pct: number | null;
  meta_spend_monthly: number;
  google_spend_monthly: number;
  influencer_spend_monthly: number;
  target_roas: number | null;
  cash_available: number;
  existing_debt: number;
  credit_line: number;
  estimated_runway_months: number | null;
  growth_objectives_12m: string | null;
  planned_hires: number;
  new_markets: string | null;
}

export interface Order {
  id: string;
  store_id: string;
  shopify_order_id: number;
  order_number: string | null;
  total_price: number;
  subtotal_price: number;
  total_tax: number;
  total_discounts: number;
  total_shipping: number;
  currency: string;
  financial_status: string | null;
  fulfillment_status: string | null;
  customer_id: number | null;
  line_items_count: number;
  refunded_amount: number;
  cost_of_goods: number;
  ordered_at: string;
}

export interface Product {
  id: string;
  store_id: string;
  shopify_product_id: number;
  title: string;
  vendor: string | null;
  product_type: string | null;
  status: string | null;
  price: number;
  cost_per_item: number;
  inventory_quantity: number;
  total_sold: number;
  total_revenue: number;
}

export interface Audit {
  id: string;
  store_id: string;
  status: string;
  health_score: number | null;
  profitability_score: number | null;
  cash_score: number | null;
  growth_score: number | null;
  findings: AuditFinding[];
  metrics_snapshot: Record<string, unknown>;
  completed_at: string | null;
}

export interface AuditFinding {
  type: "warning" | "critical" | "info";
  category: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
}

export interface Report {
  id: string;
  store_id: string;
  type: string;
  period_start: string;
  period_end: string;
  title: string;
  executive_summary: string | null;
  revenue_section: Record<string, unknown>;
  profitability_section: Record<string, unknown>;
  cash_flow_section: Record<string, unknown>;
  risks_section: AuditFinding[];
  recommendations: string[];
  forecasts_section: Record<string, unknown>;
  created_at: string;
}

export interface CFOMetrics {
  revenue: {
    total: number;
    previousPeriod: number;
    growthRate: number;
    orderCount: number;
    averageOrderValue: number;
  };
  profitability: {
    grossRevenue: number;
    grossMargin: number;
    grossMarginPct: number;
    netProfit: number;
    netMarginPct: number;
    profitPerOrder: number;
    contributionMargin: number;
    contributionMarginPct: number;
    topCostDrivers: { label: string; amount: number; pct: number }[];
  };
  marketing: {
    totalSpend: number;
    metaSpend: number;
    googleSpend: number;
    influencerSpend: number;
    roas: number;
    mer: number;
    cac: number;
    ltv: number;
    ltvCacRatio: number;
  };
  cashFlow: {
    cashAvailable: number;
    monthlyBurn: number;
    monthlyInflow: number;
    runwayMonths: number;
    netCashPosition: number;
    riskLevel: "low" | "medium" | "high";
  };
  health: {
    overall: number;
    profitability: number;
    cash: number;
    growth: number;
    explanations: {
      overall: string;
      profitability: string;
      cash: string;
      growth: string;
    };
  };
  forecasts: {
    days30: ForecastPeriod;
    days90: ForecastPeriod;
    months6: ForecastPeriod;
    months12: ForecastPeriod;
  };
  alerts: Alert[];
}

export interface ForecastPeriod {
  projectedRevenue: number;
  projectedProfit: number;
  projectedCash: number;
  confidence: "low" | "medium" | "high";
}

export interface Alert {
  id: string;
  priority: "critical" | "high" | "medium";
  title: string;
  message: string;
  category: string;
  action?: string;
}
