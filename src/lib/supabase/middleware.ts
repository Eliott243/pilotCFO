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
  // API routes authenticate themselves (every handler calls getUser and returns
  // 401 when needed). The middleware must NEVER redirect an /api/* request to an
  // HTML page: doing so means the route handler never runs. This is exactly what
  // broke onboarding — POST /api/onboarding/complete and POST
  // /api/questionnaire/complete were being 307-redirected to /onboarding before
  // they could write onboarding_completed / questionnaire_completed, causing an
  // infinite redirect loop.
  const isApiRoute = pathname.startsWith("/api");
  const isPublicRoute = pathname === "/" || isApiRoute;

  const DEBUG = process.env.AUTH_FLOW_DEBUG === "1";
  const log = (decision: string, extra: Record<string, unknown> = {}) => {
    if (DEBUG) console.log("[auth-flow]", { pathname, decision, ...extra });
  };

  if (!user && !isAuthRoute && !isPublicRoute) {
    log("redirect:/login (no user)");
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    log("redirect:/overview (authed on auth route)");
    const url = request.nextUrl.clone();
    url.pathname = "/overview";
    return NextResponse.redirect(url);
  }

  // Never apply onboarding/questionnaire gating to API routes — they run their
  // own auth and must reach their handler so completion flags can be written.
  if (user && !isAuthRoute && !isApiRoute) {
    const { data: profile, error: profileError } = await supabase
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

    log("gate", {
      userId: user.id,
      profileError: profileError?.message ?? null,
      dbOnboarding: profile?.onboarding_completed ?? "MISSING",
      dbQuestionnaire: profile?.questionnaire_completed ?? "MISSING",
      cookieOnboarding: onboardingCookie,
      cookieQuestionnaire: questionnaireCookie,
    });

    const onboardingExempt =
      pathname.startsWith("/onboarding") ||
      pathname.startsWith("/questionnaire") ||
      (pathname.startsWith("/ai-cfo") && questionnaireDone);

    if (!onboardingDone && !questionnaireDone && !onboardingExempt) {
      log("redirect:/onboarding (gate: nothing done)");
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    if (
      !questionnaireDone &&
      !pathname.startsWith("/questionnaire") &&
      !pathname.startsWith("/onboarding")
    ) {
      log("redirect:/questionnaire (gate: questionnaire pending)");
      const url = request.nextUrl.clone();
      url.pathname = "/questionnaire";
      return NextResponse.redirect(url);
    }
  }

  log("pass-through");
  return supabaseResponse;
}
