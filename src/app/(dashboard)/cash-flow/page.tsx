import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getStoreMetrics } from "@/lib/data/metrics";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default async function CashFlowPage() {
  const { metrics, hasStore, currency } = await getStoreMetrics();

  return (
    <>
      <PageHeader
        title="Cash Flow"
        subtitle="Vais-je manquer de trésorerie ? Analyse des entrées, sorties et runway de votre entreprise."
      />

      {!hasStore || !metrics ? (
        <EmptyState
          title="Analyse de trésorerie indisponible"
          description="Complétez la section trésorerie du questionnaire CFO et connectez Shopify."
          action={{ label: "Questionnaire", href: "/questionnaire" }}
        />
      ) : (
        <div className="space-y-6">
          <div
            className={cn(
              "p-6 rounded-2xl border",
              metrics.cashFlow.riskLevel === "high"
                ? "border-red-200 bg-red-50"
                : metrics.cashFlow.riskLevel === "medium"
                ? "border-amber-200 bg-amber-50"
                : "border-green-200 bg-green-50"
            )}
          >
            <p className="text-sm font-medium">
              Risque trésorerie ·{" "}
              {metrics.cashFlow.riskLevel === "high"
                ? "Élevé"
                : metrics.cashFlow.riskLevel === "medium"
                ? "Modéré"
                : "Faible"}
            </p>
            <p className="text-3xl font-semibold mt-2">
              {metrics.cashFlow.runwayMonths.toFixed(1)} mois de runway
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Cash disponible", value: formatCurrency(metrics.cashFlow.cashAvailable, currency) },
              { label: "Entrées mensuelles", value: formatCurrency(metrics.cashFlow.monthlyInflow, currency) },
              { label: "Sorties estimées", value: formatCurrency(metrics.cashFlow.monthlyBurn, currency) },
              { label: "Position nette", value: formatCurrency(metrics.cashFlow.netCashPosition, currency) },
            ].map((item) => (
              <div key={item.label} className="p-5 rounded-xl border border-border bg-card">
                <p className="text-sm text-muted">{item.label}</p>
                <p className="text-xl font-semibold mt-1">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
