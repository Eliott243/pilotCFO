import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getStoreMetrics } from "@/lib/data/metrics";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { detectProfitabilityIssues } from "@/lib/cfo-engine";

export default async function ProfitabilityPage() {
  const { metrics, hasStore, currency } = await getStoreMetrics();

  const findings = metrics ? detectProfitabilityIssues(metrics) : [];

  return (
    <>
      <PageHeader
        title="Profitability"
        subtitle="Pourquoi ma marge baisse ? Analyse des marges et rentabilité réelle de votre boutique."
      />

      {!hasStore || !metrics ? (
        <EmptyState
          title="Analyse de rentabilité indisponible"
          description="Importez vos commandes Shopify et renseignez vos coûts dans le questionnaire CFO."
          action={{ label: "Questionnaire CFO", href: "/questionnaire" }}
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Marge brute", value: formatPercent(metrics.profitability.grossMarginPct) },
              { label: "Marge nette", value: formatPercent(metrics.profitability.netMarginPct) },
              { label: "Profit / commande", value: formatCurrency(metrics.profitability.profitPerOrder, currency) },
              { label: "Contribution margin", value: formatPercent(metrics.profitability.contributionMarginPct) },
            ].map((item) => (
              <div key={item.label} className="p-5 rounded-xl border border-border bg-card">
                <p className="text-sm text-muted">{item.label}</p>
                <p className="text-xl font-semibold mt-1">{item.value}</p>
              </div>
            ))}
          </div>

          <section>
            <h2 className="text-sm font-medium mb-3">Principaux postes de coûts</h2>
            <div className="space-y-2">
              {metrics.profitability.topCostDrivers.map((driver) => (
                <div
                  key={driver.label}
                  className="flex items-center justify-between p-4 rounded-xl border border-border bg-card"
                >
                  <span className="text-sm">{driver.label}</span>
                  <div className="text-right">
                    <span className="text-sm font-medium">
                      {formatCurrency(driver.amount, currency)}
                    </span>
                    <span className="text-xs text-muted ml-2">
                      {formatPercent(driver.pct)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {findings.length > 0 && (
            <section>
              <h2 className="text-sm font-medium mb-3">Problèmes détectés</h2>
              <div className="space-y-2">
                {findings.map((f, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl border border-amber-200 bg-amber-50"
                  >
                    <p className="text-sm font-medium text-amber-900">{f.title}</p>
                    <p className="text-sm text-amber-800 mt-1">{f.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
