import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureUserProfile } from "@/lib/supabase/ensure-profile";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  await ensureUserProfile(supabase, user);

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!company) {
    return NextResponse.json({ company: null, financial: null });
  }

  const { data: financial } = await supabase
    .from("financial_profiles")
    .select("*")
    .eq("company_id", company.id)
    .maybeSingle();

  return NextResponse.json({ company, financial });
}

const questionnaireSchema = z.object({
  name: z.string().min(1).max(200),
  country: z.string().min(1).max(100),
  currency: z.string().length(3),
  founded_year: z.coerce.number().optional(),
  employee_count: z.coerce.number().optional(),
  annual_revenue: z.coerce.number().optional(),
  monthly_revenue_avg: z.coerce.number().optional(),
  annual_revenue_target: z.coerce.number().optional(),
  avg_product_cost_pct: z.coerce.number().optional(),
  gross_margin_estimate_pct: z.coerce.number().optional(),
  logistics_cost_pct: z.coerce.number().optional(),
  meta_spend_monthly: z.coerce.number().optional(),
  google_spend_monthly: z.coerce.number().optional(),
  influencer_spend_monthly: z.coerce.number().optional(),
  target_roas: z.coerce.number().optional(),
  cash_available: z.coerce.number().optional(),
  existing_debt: z.coerce.number().optional(),
  credit_line: z.coerce.number().optional(),
  estimated_runway_months: z.coerce.number().optional(),
  growth_objectives_12m: z.string().optional(),
  planned_hires: z.coerce.number().optional(),
  new_markets: z.string().optional(),
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
  const parsed = questionnaireSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const data = parsed.data;

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .upsert(
      {
        user_id: user.id,
        name: data.name,
        country: data.country,
        currency: data.currency,
        founded_year: data.founded_year ?? null,
        employee_count: data.employee_count ?? 0,
      },
      { onConflict: "user_id" }
    )
    .select("id")
    .single();

  if (companyError || !company) {
    return NextResponse.json({ error: "Erreur entreprise" }, { status: 500 });
  }

  const { error: profileError } = await supabase.from("financial_profiles").upsert(
    {
      company_id: company.id,
      annual_revenue: data.annual_revenue ?? null,
      monthly_revenue_avg: data.monthly_revenue_avg ?? null,
      annual_revenue_target: data.annual_revenue_target ?? null,
      avg_product_cost_pct: data.avg_product_cost_pct ?? null,
      gross_margin_estimate_pct: data.gross_margin_estimate_pct ?? null,
      logistics_cost_pct: data.logistics_cost_pct ?? null,
      meta_spend_monthly: data.meta_spend_monthly ?? 0,
      google_spend_monthly: data.google_spend_monthly ?? 0,
      influencer_spend_monthly: data.influencer_spend_monthly ?? 0,
      target_roas: data.target_roas ?? null,
      cash_available: data.cash_available ?? 0,
      existing_debt: data.existing_debt ?? 0,
      credit_line: data.credit_line ?? 0,
      estimated_runway_months: data.estimated_runway_months ?? null,
      growth_objectives_12m: data.growth_objectives_12m ?? null,
      planned_hires: data.planned_hires ?? 0,
      new_markets: data.new_markets ?? null,
    },
    { onConflict: "company_id" }
  );

  if (profileError) {
    return NextResponse.json({ error: "Erreur profil financier" }, { status: 500 });
  }

  const { error: userUpdateError } = await supabase
    .from("users")
    .update({
      questionnaire_completed: true,
      onboarding_completed: true,
    })
    .eq("id", user.id);

  if (userUpdateError) {
    return NextResponse.json({ error: userUpdateError.message }, { status: 500 });
  }

  await supabase.from("activity_logs").insert({
    user_id: user.id,
    action: "questionnaire_completed",
  });

  return NextResponse.json({ success: true });
}
