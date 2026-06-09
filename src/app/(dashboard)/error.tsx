"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Monitoring-friendly structured log (Vercel/Datadog can parse the JSON).
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        category: "app",
        event: "dashboard_error_boundary",
        message: error.message,
        digest: error.digest ?? null,
      })
    );
  }, [error]);

  return (
    <div className="py-16 text-center px-4">
      <h2 className="text-lg font-semibold">Une erreur est survenue</h2>
      <p className="text-sm text-muted mt-2 max-w-md mx-auto">
        {error.message || "Impossible de charger cette page."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 text-sm text-accent hover:underline"
      >
        Réessayer
      </button>
    </div>
  );
}
