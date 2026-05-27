import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "@/lib/i18n/locales";

const schema = z.object({
  locale: z.enum(["fr", "en"]),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  const locale: Locale = parsed.data.locale;

  // Persist in settings.preferences.language (best-effort)
  const { data: settings } = await supabase
    .from("settings")
    .select("id, preferences")
    .eq("user_id", user.id)
    .single();

  if (settings?.id) {
    const preferences =
      typeof settings.preferences === "object" && settings.preferences
        ? settings.preferences
        : {};

    await supabase
      .from("settings")
      .update({ preferences: { ...preferences, language: locale } })
      .eq("id", settings.id);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(LOCALE_COOKIE, locale ?? DEFAULT_LOCALE, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
  return response;
}

