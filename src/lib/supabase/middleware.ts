import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  ONBOARDING_DONE_COOKIE,
  QUESTIONNAIRE_DONE_COOKIE,
} from "@/lib/auth/flow-cookies";

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/api/stripe/webhook") ||
    pathname.startsWith("/api/shopify/callback");

  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/overview";
    return NextResponse.redirect(url);
  }

  if (user && !isAuthRoute && !isPublicRoute) {
    const { data: profile } = await supabase
      .from("users")
      .select("onboarding_completed, questionnaire_completed")
      .eq("id", user.id)
      .maybeSingle();

    // Fallback sur les cookies posés par les routes de complétion : juste après
    // l'écriture en base, une lecture peut encore renvoyer l'ancienne valeur
    // (latence / réplica). Le cookie évite alors une redirection en boucle.
    const onboardingCookie =
      request.cookies.get(ONBOARDING_DONE_COOKIE)?.value === "1";
    const questionnaireCookie =
      request.cookies.get(QUESTIONNAIRE_DONE_COOKIE)?.value === "1";

    const onboardingDone =
      profile?.onboarding_completed === true || onboardingCookie;
    const questionnaireDone =
      profile?.questionnaire_completed === true || questionnaireCookie;

    const onboardingExempt =
      pathname.startsWith("/onboarding") ||
      pathname.startsWith("/questionnaire") ||
      (pathname.startsWith("/ai-cfo") && questionnaireDone);

    if (!onboardingDone && !questionnaireDone && !onboardingExempt) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    if (
      !questionnaireDone &&
      !pathname.startsWith("/questionnaire") &&
      !pathname.startsWith("/onboarding")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/questionnaire";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
