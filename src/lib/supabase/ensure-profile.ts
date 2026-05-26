import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Garantit qu'une ligne public.users existe (trigger manquant ou compte créé avant migration).
 */
export async function ensureUserProfile(
  supabase: SupabaseClient,
  user: User
): Promise<{ ok: boolean; error?: string }> {
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    return { ok: true };
  }

  const { error: userError } = await supabase.from("users").insert({
    id: user.id,
    email: user.email ?? "",
    full_name: (user.user_metadata?.full_name as string) ?? null,
  });

  if (userError) {
    return { ok: false, error: userError.message };
  }

  await supabase.from("settings").upsert({ user_id: user.id }, { onConflict: "user_id" });

  await supabase.from("subscriptions").upsert(
    {
      user_id: user.id,
      plan: "trial",
      status: "trialing",
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "user_id" }
  );

  return { ok: true };
}
