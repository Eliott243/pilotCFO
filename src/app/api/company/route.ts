import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureUserProfile } from "@/lib/supabase/ensure-profile";
import { createClient } from "@/lib/supabase/server";

const companySchema = z.object({
  name: z.string().min(1).max(200),
  country: z.string().max(100).optional(),
  currency: z.string().length(3),
  founded_year: z.coerce.number().int().optional(),
  employee_count: z.coerce.number().int().min(0).optional(),
});

export async function POST(request: NextRequest) {
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

  const body = await request.json();
  const parsed = companySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const data = parsed.data;

  const { error } = await supabase.from("companies").upsert(
    {
      user_id: user.id,
      name: data.name,
      country: data.country?.trim() ? data.country.trim() : null,
      currency: data.currency.toUpperCase(),
      founded_year: data.founded_year ?? null,
      employee_count: data.employee_count ?? 0,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("activity_logs").insert({
    user_id: user.id,
    action: "settings_updated",
    metadata: { type: "company" },
  });

  return NextResponse.json({ success: true });
}
