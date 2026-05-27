import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode, isSupabaseConfigured } from "@/lib/supabase/config";
import { ONBOARDING_DONE_COOKIE, QUESTIONNAIRE_DONE_COOKIE } from "@/lib/auth/flow-cookies";

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured() || isDemoMode()) {
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
    // Avoid DB roundtrip on every navigation: prefer cookies set by completion endpoints.
    const onboardingCookie = request.cookies.get(ONBOARDING_DONE_COOKIE)?.value === "1";
    const questionnaireCookie = request.cookies.get(QUESTIONNAIRE_DONE_COOKIE)?.value === "1";
    const cfoCookie = request.cookies.get("pilotcfo_cfo_done")?.value === "1";

    let onboardingDone = onboardingCookie;
    let questionnaireDone = questionnaireCookie;
    let cfoQuestionnaireDone = questionnaireCookie || cfoCookie;

    // Only hit DB if we don't have enough info from cookies (first-time / new device).
    if (!onboardingDone || !questionnaireDone) {
      const { data: profile } = await supabase
        .from("users")
        .select("onboarding_completed, questionnaire_completed")
        .eq("id", user.id)
        .maybeSingle();

      onboardingDone = onboardingDone || profile?.onboarding_completed === true;
      questionnaireDone = questionnaireDone || profile?.questionnaire_completed === true;
      cfoQuestionnaireDone = questionnaireDone || cfoQuestionnaireDone;
    }

    const onboardingExempt =
      pathname.startsWith("/onboarding") ||
      pathname.startsWith("/questionnaire") ||
      (pathname.startsWith("/ai-cfo") && cfoQuestionnaireDone);

    // Ne pas expulser du questionnaire ni renvoyer à l'onboarding après le CFO questionnaire
    if (!onboardingDone && !cfoQuestionnaireDone && !onboardingExempt) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    if (!cfoQuestionnaireDone && !pathname.startsWith("/questionnaire") && !pathname.startsWith("/onboarding")) {
      const url = request.nextUrl.clone();
      url.pathname = "/questionnaire";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
