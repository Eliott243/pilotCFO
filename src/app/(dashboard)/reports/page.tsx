import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default async function ReportsPage() {
  const supabase = await createClient();
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
        <form action="/api/reports/generate" method="POST">
          <Button type="submit" variant="secondary" size="sm">
            Générer rapport mensuel
          </Button>
        </form>
      </PageHeader>

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
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-sm">{report.title}</h3>
                  <p className="text-xs text-muted mt-0.5">
                    {format(new Date(report.period_start), "d MMM yyyy", { locale: fr })}
                    {" — "}
                    {format(new Date(report.period_end), "d MMM yyyy", { locale: fr })}
                  </p>
                </div>
                <span className="text-xs text-muted">
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
