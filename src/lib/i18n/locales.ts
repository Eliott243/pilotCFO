export type Locale = "fr" | "en";

export const LOCALE_COOKIE = "pilotcfo_locale";
export const DEFAULT_LOCALE: Locale = "fr";

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "fr" || value === "en";
}

