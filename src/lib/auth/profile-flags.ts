import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { logSecurity } from "@/lib/logging";

/**
 * Sensitive lifecycle flags (onboarding_completed / questionnaire_completed)
 * are NOT writable by an authenticated client after migration 005 — only the
 * service role may set them. Centralise that write here so every "completion"
 * route goes through the same audited, server-only path.
 *
 * Returns true only when exactly the target row was updated. A zero-row / error
 * result is logged as a security event and reported as failure so callers never
 * report a false success (which previously caused the onboarding redirect loop).
 */
export async function markUserFlags(
  userId: string,
  flags: { onboarding_completed?: boolean; questionnaire_completed?: boolean }
): Promise<boolean> {
  const admin = await createServiceClient();
  const { data, error } = await admin
    .from("users")
    .update(flags)
    .eq("id", userId)
    .select("id, onboarding_completed, questionnaire_completed");

  if (error || !data || data.length === 0) {
    logSecurity(
      "user_flag_update_failed",
      { userId, flags, error: error?.message ?? "zero_rows" },
      "error"
    );
    return false;
  }
  return true;
}
