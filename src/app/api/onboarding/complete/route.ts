import { NextResponse } from "next/server";
import { ensureUserProfile } from "@/lib/supabase/ensure-profile";
import { createClient } from "@/lib/supabase/server";
import { ONBOARDING_DONE_COOKIE } from "@/lib/auth/flow-cookies";
import { markUserFlags } from "@/lib/auth/profile-flags";

const DEBUG = process.env.AUTH_FLOW_DEBUG === "1";

export async function POST() {
  if (DEBUG) console.log("[auth-flow] handler:/api/onboarding/complete reached");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (DEBUG) console.log("[auth-flow] /api/onboarding/complete -> 401 (no user)");
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const ensured = await ensureUserProfile(supabase, user);
  if (!ensured.ok) {
    return NextResponse.json(
      { error: "Profil utilisateur introuvable", detail: ensured.error },
      { status: 500 }
    );
  }

  // Sensitive flag: written via service role (authenticated clients cannot
  // update onboarding_completed after migration 005).
  const ok = await markUserFlags(user.id, { onboarding_completed: true });

  if (DEBUG)
    console.log("[auth-flow] /api/onboarding/complete update", {
      userId: user.id,
      ok,
    });

  if (!ok) {
    return NextResponse.json(
      { error: "Impossible d'enregistrer l'onboarding." },
      { status: 500 }
    );
  }

  await supabase.from("activity_logs").insert({
    user_id: user.id,
    action: "onboarding_completed",
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set(ONBOARDING_DONE_COOKIE, "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
