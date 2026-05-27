import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, type Locale, LOCALE_COOKIE } from "./locales";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getDictionary(locale: Locale) {
  if (locale === "en") {
    const { en } = await import("./dictionaries/en");
    return en;
  }
  const { fr } = await import("./dictionaries/fr");
  return fr;
}

