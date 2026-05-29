"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
