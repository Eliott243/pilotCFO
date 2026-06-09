/**
 * Structured, monitoring-friendly logging.
 *
 * Emits single-line JSON to stdout/stderr so Vercel log drains and external
 * monitors (Datadog, Logflare, etc.) can parse fields without regex. Never log
 * secrets (tokens, raw card data, full emails) — only identifiers and outcomes.
 */

type LogLevel = "info" | "warn" | "error";

export type LogCategory =
  | "auth"
  | "security"
  | "billing"
  | "shopify"
  | "paywall"
  | "app";

interface LogFields {
  [key: string]: unknown;
}

function emit(level: LogLevel, category: LogCategory, event: string, fields: LogFields) {
  const record = {
    ts: new Date().toISOString(),
    level,
    category,
    event,
    ...fields,
  };
  const line = safeStringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ ts: new Date().toISOString(), level: "error", event: "log_serialize_failed" });
  }
}

/** Security-relevant events: auth bypass attempts, ownership mismatches, denials. */
export function logSecurity(event: string, fields: LogFields = {}, level: LogLevel = "warn") {
  emit(level, "security", event, fields);
}

/** Billing/Stripe lifecycle events: checkout, subscription changes, webhook processing. */
export function logBilling(event: string, fields: LogFields = {}, level: LogLevel = "info") {
  emit(level, "billing", event, fields);
}

/** Auth/session lifecycle events. */
export function logAuth(event: string, fields: LogFields = {}, level: LogLevel = "info") {
  emit(level, "auth", event, fields);
}

/** Paywall enforcement decisions. */
export function logPaywall(event: string, fields: LogFields = {}, level: LogLevel = "info") {
  emit(level, "paywall", event, fields);
}

/** Generic structured log with explicit category/level. */
export function logEvent(
  level: LogLevel,
  category: LogCategory,
  event: string,
  fields: LogFields = {}
) {
  emit(level, category, event, fields);
}

/** Normalize an unknown error into a safe message for logging. */
export function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
