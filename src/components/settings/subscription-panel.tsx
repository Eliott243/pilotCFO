"use client";

import { Button } from "@/components/ui/button";

interface SubscriptionPanelProps {
  subscription: {
    plan: string;
    status: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
  } | null;
}

export function SubscriptionPanel({ subscription }: SubscriptionPanelProps) {
  async function openPortal() {
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const { url } = await res.json();
    if (url) window.location.href = url;
  }

  async function startCheckout() {
    const res = await fetch("/api/stripe/checkout", { method: "POST" });
    const { url } = await res.json();
    if (url) window.location.href = url;
  }

  const isTrialing = subscription?.status === "trialing";
  const plan = subscription?.plan ?? "trial";

  return (
    <div className="p-5 rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm capitalize">Plan {plan}</p>
          <p className="text-xs text-muted mt-0.5">
            {isTrialing && subscription?.trial_ends_at
              ? `Essai jusqu'au ${new Date(subscription.trial_ends_at).toLocaleDateString("fr-FR")}`
              : `Statut · ${subscription?.status ?? "—"}`}
          </p>
        </div>
        <div className="flex gap-2">
          {plan === "trial" || plan === "starter" ? (
            <Button size="sm" onClick={startCheckout}>
              Passer à Growth
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" onClick={openPortal}>
            Portail client
          </Button>
        </div>
      </div>
    </div>
  );
}
