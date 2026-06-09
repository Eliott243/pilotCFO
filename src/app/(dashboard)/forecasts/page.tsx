import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { getStoreMetrics } from "@/lib/data/metrics";
import { createClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/billing/entitlements";
import { formatCurrency } from "@/lib/utils";

const PERIODS = [
  { key: "days30" as const, label: "30 jours" },
  { key: "days90" as const, label: "90 jours" },
  { key: "months6" as const, label: "6 mois" },
  { key: "months12" as const, label: "12 mois" },
];

export default async function ForecastsPage() {
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
          title="Forecasts"
          subtitle="Quelle croissance puis-je supporter ? Projections basées sur vos données réelles Shopify."
        />
        <UpgradePrompt
          feature="Forecasts"
          description="Projetez votre croissance, votre profit et votre trésorerie. Disponible avec le plan Growth — votre essai inclut 14 jours d'accès complet."
        />
      </>
    );
  }

  const { metrics, hasStore, currency } = await getStoreMetrics();

  return (
    <>
      <PageHeader
        title="Forecasts"
        subtitle="Quelle croissance puis-je supporter ? Projections basées sur vos données réelles Shopify."
      />

      {!hasStore || !metrics ? (
        <EmptyState
          title="Projections indisponibles"
          description="Les prévisions nécessitent au minimum 30 jours de données Shopify synchronisées."
          action={{ label: "Connecter Shopify", href: "/settings?tab=shopify" }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PERIODS.map(({ key, label }) => {
            const forecast = metrics.forecasts[key];
            return (
              <div key={key} className="p-6 rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-sm">{label}</h3>
                  <span className="text-xs text-muted capitalize">
                    confiance {forecast.confidence}
                  </span>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted">CA projeté</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(forecast.projectedRevenue, currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Profit projeté</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(forecast.projectedProfit, currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Trésorerie projetée</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(forecast.projectedCash, currency)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
