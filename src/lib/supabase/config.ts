export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** Fake metrics only — never disables auth in production. */
export function isDemoMetricsOnly(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

/** @deprecated Use isDemoMetricsOnly — demo never bypasses auth. */
export function isDemoMode(): boolean {
  return isDemoMetricsOnly();
}
