export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function isDemoMode(): boolean {
  // Demo mode must be explicitly enabled.
  // If Supabase is missing, the app should fail fast rather than silently switching to demo.
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}
