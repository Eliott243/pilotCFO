import { NextResponse } from "next/server";
import { ensureUserProfile } from "@/lib/supabase/ensure-profile";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { QUESTIONNAIRE_DONE_COOKIE } from "@/lib/auth/flow-cookies";

/** Marque le questionnaire CFO comme terminé (sans sauvegarder les réponses en base). */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const serviceClient = await createServiceClient();
  const ensured = await ensureUserProfile(serviceClient, user);
  if (!ensured.ok) {
    return NextResponse.json({ error: ensured.error }, { status: 500 });
  }

  const { error } = await serviceClient
    .from("users")
    .update({
      questionnaire_completed: true,
      onboarding_completed: true,
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await serviceClient.from("activity_logs").insert({
    user_id: user.id,
    action: "questionnaire_completed",
    metadata: { type: "cfo_onboarding_v2" },
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set("pilotcfo_cfo_done", "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: false,
  });
  response.cookies.set(QUESTIONNAIRE_DONE_COOKIE, "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });

  return response;
}
