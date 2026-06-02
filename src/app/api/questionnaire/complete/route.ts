import { NextResponse } from "next/server";
import { ensureUserProfile } from "@/lib/supabase/ensure-profile";
import { createClient } from "@/lib/supabase/server";
import { QUESTIONNAIRE_DONE_COOKIE } from "@/lib/auth/flow-cookies";

/** Marque le questionnaire CFO comme terminé (MCQ 6 questions) */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const ensured = await ensureUserProfile(supabase, user);
  if (!ensured.ok) {
    return NextResponse.json({ error: "Profil utilisateur introuvable" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const answers = (body as { answers?: unknown })?.answers;
  if (
    !Array.isArray(answers) ||
    answers.length !== 6 ||
    !answers.every((v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 10)
  ) {
    return NextResponse.json({ error: "Réponses invalides" }, { status: 400 });
  }

  const { error } = await supabase
    .from("users")
    .update({
      questionnaire_completed: true,
      onboarding_completed: true,
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  await supabase.from("activity_logs").insert({
    user_id: user.id,
    action: "questionnaire_completed",
    metadata: { type: "cfo_onboarding_v2", answers },
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set("pilotcfo_cfo_done", "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  response.cookies.set(QUESTIONNAIRE_DONE_COOKIE, "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
