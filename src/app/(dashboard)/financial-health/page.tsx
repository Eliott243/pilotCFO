import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getStoreMetrics } from "@/lib/data/metrics";
import { cn } from "@/lib/utils";

function ScoreBar({ score, label, explanation }: { score: number; label: string; explanation: string }) {
  const color = score >= 75 ? "bg-success" : score >= 50 ? "bg-warning" : "bg-danger";
  return (
    <div className="p-5 rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-2xl font-semibold">{score}</span>
      </div>
      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
      <p className="text-xs text-muted mt-3 leading-relaxed">{explanation}</p>
    </div>
  );
}

export default async function FinancialHealthPage() {
  const { metrics, hasStore } = await getStoreMetrics();

  return (
    <>
      <PageHeader
        title="Financial Health"
        subtitle="Votre entreprise est-elle saine ? Scores calculés par le moteur CFO à partir de vos données réelles."
      />

      {!hasStore || !metrics ? (
        <EmptyState
          title="Données insuffisantes"
          description="Connectez Shopify et complétez le questionnaire CFO pour obtenir votre score de santé financière."
          action={{ label: "Configurer", href: "/settings" }}
        />
      ) : (
        <div className="space-y-6">
          <div className="p-8 rounded-2xl border border-border bg-card text-center">
            <p className="text-sm text-muted mb-2">Score global</p>
            <p className="text-6xl font-semibold tracking-tight text-accent">
              {metrics.health.overall}
            </p>
            <p className="text-sm text-muted mt-3 max-w-md mx-auto">
              {metrics.health.explanations.overall}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ScoreBar
              score={metrics.health.profitability}
              label="Rentabilité"
              explanation={metrics.health.explanations.profitability}
            />
            <ScoreBar
              score={metrics.health.cash}
              label="Trésorerie"
              explanation={metrics.health.explanations.cash}
            />
            <ScoreBar
              score={metrics.health.growth}
              label="Croissance"
              explanation={metrics.health.explanations.growth}
            />
          </div>
        </div>
      )}
    </>
  );
}
