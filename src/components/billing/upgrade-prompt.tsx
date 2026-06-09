"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface UpgradePromptProps {
  feature: string;
  description?: string;
}

export function UpgradePrompt({ feature, description }: UpgradePromptProps) {
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const { url } = await res.json();
      if (url) window.location.href = url;
      else setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
      <div className="w-12 h-12 rounded-full bg-accent-light flex items-center justify-center mb-4">
        <span className="text-accent text-xl font-semibold">★</span>
      </div>
      <h3 className="text-lg font-semibold text-foreground">
        {feature} est une fonctionnalité Growth
      </h3>
      <p className="text-sm text-muted mt-2 leading-relaxed">
        {description ??
          "Passez au plan Growth pour débloquer cette fonctionnalité. Votre essai inclut 14 jours d'accès complet."}
      </p>
      <div className="mt-6 flex flex-col sm:flex-row gap-2">
        <Button onClick={startCheckout} disabled={loading}>
          {loading ? "Redirection..." : "Passer à Growth"}
        </Button>
        <a href="/settings?tab=billing">
          <Button variant="secondary">Voir la facturation</Button>
        </a>
      </div>
    </div>
  );
}
