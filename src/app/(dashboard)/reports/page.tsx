import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { GenerateReportButton } from "@/components/reports/generate-report-button";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { createClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/billing/entitlements";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const entitlements = user
    ? await getEntitlements(supabase, user.id)
    : { premium: false };

  if (!entitlements.premium) {
    return (
      <>
        <PageHeader
          title="Reports"
          subtitle="Rapports mensuels générés par le moteur CFO : Executive Summary, Revenue, Profitability, Cash Flow, Risks, Recommendations, Forecasts."
        />
        <UpgradePrompt
          feature="Reports"
          description="Générez des rapports financiers mensuels complets. Disponible avec le plan Growth — votre essai inclut 14 jours d'accès complet."
        />
      </>
    );
  }

  const { data: reports } = await supabase
    .from("reports")
    .select("id, title, period_start, period_end, executive_summary, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Rapports mensuels générés par le moteur CFO : Executive Summary, Revenue, Profitability, Cash Flow, Risks, Recommendations, Forecasts."
      >
        <GenerateReportButton />
      </PageHeader>

      {params.error && (
        <p className="text-sm text-danger mb-4">
          {params.error === "rate"
            ? "Trop de rapports générés. Réessayez dans une minute."
            : params.error === "plan"
              ? "Les rapports nécessitent le plan Growth."
              : "Impossible de générer le rapport. Vérifiez votre connexion Shopify."}
        </p>
      )}

      {!reports || reports.length === 0 ? (
        <EmptyState
          title="Aucun rapport généré"
          description="Générez votre premier rapport mensuel une fois Shopify connecté et des données importées."
          action={{ label: "Connecter Shopify", href: "/settings" }}
        />
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="p-5 rounded-xl border border-border bg-card hover:border-stone-300 transition-colors"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-medium text-sm">{report.title}</h3>
                  <p className="text-xs text-muted mt-0.5">
                    {format(new Date(report.period_start), "d MMM yyyy", { locale: fr })}
                    {" — "}
                    {format(new Date(report.period_end), "d MMM yyyy", { locale: fr })}
                  </p>
                </div>
                <span className="text-xs text-muted shrink-0">
                  {format(new Date(report.created_at), "d MMM yyyy", { locale: fr })}
                </span>
              </div>
              {report.executive_summary && (
                <p className="text-sm text-muted mt-3 line-clamp-2">
                  {report.executive_summary}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
