"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n/locales";
import { fr } from "@/lib/i18n/dictionaries/fr";
import { en } from "@/lib/i18n/dictionaries/en";

type Dictionary = typeof fr;

const LocaleContext = createContext<{
  locale: Locale;
  dict: Dictionary;
} | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale] = useState<Locale>(initialLocale);

  const dict = useMemo(
    () => (locale === "en" ? (en as unknown as Dictionary) : fr),
    [locale]
  );

  return (
    <LocaleContext.Provider value={{ locale, dict }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useI18n must be used within LocaleProvider");
  return ctx;
}

