import { NextResponse } from "next/server";
import { ensureUserProfile } from "@/lib/supabase/ensure-profile";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const ensured = await ensureUserProfile(supabase, user);
  if (!ensured.ok) {
    return NextResponse.json(
      { error: "Profil utilisateur introuvable", detail: ensured.error },
      { status: 500 }
    );
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ onboarding_completed: true })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await supabase.from("activity_logs").insert({
    user_id: user.id,
    action: "onboarding_completed",
  });

  return NextResponse.json({ success: true });
}
