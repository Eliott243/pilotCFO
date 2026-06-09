export type Lang = "fr" | "en";

export type Channel = "meta" | "google" | "influencer";

export type IntentId =
  | "greeting"
  | "thanks"
  | "capabilities"
  | "health"
  | "margin"
  | "ad_budget"
  | "roas_perf"
  | "cac_ltv"
  | "hire"
  | "cash_runway"
  | "forecast"
  | "revenue_growth"
  | "aov"
  | "pricing"
  | "products"
  | "costs"
  | "refunds"
  | "risks"
  | "debt"
  | "unknown";

export interface Entities {
  /** Absolute currency amount mentioned in the question (e.g. "2000€", "3k"). */
  amount: number | null;
  /** Percentage mentioned (e.g. "15%"). */
  percent: number | null;
  /** Multiplier from words like "doubler" (2), "tripler" (3), "moitié" (0.5). */
  multiplier: number | null;
  /** Time horizon in months. */
  months: number | null;
  channel: Channel | null;
  direction: "increase" | "decrease" | null;
}

export interface NLUResult {
  lang: Lang;
  intent: IntentId;
  secondary: IntentId | null;
  confidence: "high" | "low" | "none";
  entities: Entities;
  /** True when the intent was inherited from conversation history. */
  followUp: boolean;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface EngineAnswer {
  reply: string;
  suggestions: string[];
  intent: IntentId;
}
