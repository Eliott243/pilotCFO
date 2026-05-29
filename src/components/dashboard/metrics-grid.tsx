import { Card, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { CFOMetrics } from "@/types/database";
import { TrendingDown, TrendingUp } from "lucide-react";

interface MetricsGridProps {
  metrics: CFOMetrics;
  currency: string;
}

export function MetricsGrid({ metrics, currency }: MetricsGridProps) {
  const growthPositive = metrics.revenue.growthRate >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Chiffre d&apos;affaires</CardTitle>
          <CardValue>{formatCurrency(metrics.revenue.total, currency)}</CardValue>
        </CardHeader>
        <div className="flex items-center gap-1 text-xs text-muted">
          {growthPositive ? (
            <TrendingUp className="w-3.5 h-3.5 text-success" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-danger" />
          )}
          <span className={growthPositive ? "text-success" : "text-danger"}>
            {formatPercent(Math.abs(metrics.revenue.growthRate))} vs période préc.
          </span>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profit net</CardTitle>
          <CardValue>{formatCurrency(metrics.profitability.netProfit, currency)}</CardValue>
        </CardHeader>
        <p className="text-xs text-muted">
          Marge {formatPercent(metrics.profitability.netMarginPct)}
        </p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cash disponible</CardTitle>
          <CardValue>
            {formatCurrency(metrics.cashFlow.cashAvailable, currency)}
          </CardValue>
        </CardHeader>
        <p className="text-xs text-muted">
          Runway {metrics.cashFlow.runwayMonths.toFixed(1)} mois
        </p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Santé financière</CardTitle>
          <CardValue>{metrics.health.overall}/100</CardValue>
        </CardHeader>
        <p className="text-xs text-muted line-clamp-2">
          {metrics.health.explanations.overall}
        </p>
      </Card>
    </div>
  );
}
