"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/locales";

export function LocaleSwitcher({ current }: { current: Locale }) {
  const [locale, setLocale] = useState<Locale>(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: Locale) {
    setLocale(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/i18n/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update locale");
      }
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update locale");
      setSaving(false);
    }
  }

  return (
    <div className="p-5 rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Language</p>
          <p className="text-xs text-muted mt-1">
            {locale === "fr"
              ? "Choisissez la langue de l’interface."
              : "Choose the interface language."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={locale === "fr" ? "primary" : "secondary"}
            disabled={saving}
            onClick={() => save("fr")}
          >
            FR
          </Button>
          <Button
            size="sm"
            variant={locale === "en" ? "primary" : "secondary"}
            disabled={saving}
            onClick={() => save("en")}
          >
            EN
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-danger mt-3">{error}</p>}
    </div>
  );
}

