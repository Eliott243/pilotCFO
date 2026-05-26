import { PageHeader } from "@/components/dashboard/page-header";
import { MetricsGrid } from "@/components/dashboard/metrics-grid";
import { AlertBadge } from "@/components/ui/alert-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getStoreMetrics } from "@/lib/data/metrics";

export default async function OverviewPage() {
  const { metrics, hasStore, hasData, currency } = await getStoreMetrics();

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Est-ce que mon entreprise est saine ? Vue d'ensemble de votre performance financière."
      />

      {!hasStore ? (
        <EmptyState
          title="Connectez votre boutique Shopify"
          description="Pour analyser votre entreprise, pilotCFO a besoin de vos données réelles de commandes, produits et clients."
          action={{ label: "Connecter Shopify", href: "/settings?tab=shopify" }}
        />
      ) : !hasData && !metrics ? (
        <EmptyState
          title="Synchronisation en cours"
          description="Vos données Shopify sont en cours d'import. Relancez la synchronisation depuis les paramètres si nécessaire."
          action={{ label: "Paramètres", href: "/settings" }}
        />
      ) : metrics ? (
        <div className="space-y-8">
          <MetricsGrid metrics={metrics} currency={currency} />

          {metrics.alerts.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-foreground mb-3">
                Alertes prioritaires
              </h2>
              <div className="space-y-3">
                {metrics.alerts.slice(0, 3).map((alert) => (
                  <AlertBadge key={alert.id} alert={alert} />
                ))}
              </div>
            </section>
          )}

          <section className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-xl border border-border bg-card">
              <p className="text-sm text-muted">Commandes (30j)</p>
              <p className="text-xl font-semibold mt-1">
                {metrics.revenue.orderCount}
              </p>
              <p className="text-xs text-muted mt-1">
                Panier moyen · données Shopify réelles
              </p>
            </div>
            <div className="p-5 rounded-xl border border-border bg-card">
              <p className="text-sm text-muted">ROAS marketing</p>
              <p className="text-xl font-semibold mt-1">
                {metrics.marketing.roas > 0
                  ? `${metrics.marketing.roas.toFixed(2)}x`
                  : "—"}
              </p>
              <p className="text-xs text-muted mt-1">
                Basé sur votre profil financier
              </p>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
