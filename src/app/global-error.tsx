"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        category: "app",
        event: "global_error_boundary",
        message: error.message,
        digest: error.digest ?? null,
      })
    );
  }, [error]);

  return (
    <html lang="fr">
      <body>
        <div style={{ padding: "4rem 1rem", textAlign: "center", fontFamily: "system-ui" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600 }}>
            Une erreur est survenue
          </h2>
          <p style={{ fontSize: "0.875rem", color: "#666", marginTop: "0.5rem" }}>
            {error.message || "Impossible de charger l'application."}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              fontSize: "0.875rem",
              color: "#2563eb",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
