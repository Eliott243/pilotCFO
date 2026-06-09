import { NextRequest, NextResponse } from "next/server";
import { getStoreMetrics } from "@/lib/data/metrics";
import { createClient } from "@/lib/supabase/server";
import { answerCfoQuestion, type ChatTurn } from "@/lib/ai/cfo-answer-engine";
import { checkRateLimit } from "@/lib/rate-limit";
import { getEntitlements } from "@/lib/billing/entitlements";
import { getLocale } from "@/lib/i18n/server";
import { logPaywall } from "@/lib/logging";

const MAX_HISTORY_TURNS = 12;

function parseHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (turn): turn is ChatTurn =>
        typeof turn === "object" &&
        turn !== null &&
        ((turn as ChatTurn).role === "user" || (turn as ChatTurn).role === "assistant") &&
        typeof (turn as ChatTurn).content === "string" &&
        (turn as ChatTurn).content.length <= 2000
    )
    .slice(-MAX_HISTORY_TURNS);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Server-side paywall — never trust frontend gating alone.
  const entitlements = await getEntitlements(supabase, user.id);
  if (!entitlements.premium) {
    logPaywall("blocked", { userId: user.id, feature: "ai_cfo", plan: entitlements.plan, status: entitlements.status });
    return NextResponse.json(
      {
        error: "Fonctionnalité réservée au plan Growth.",
        code: "upgrade_required",
        feature: "ai_cfo",
      },
      { status: 402 }
    );
  }

  const { allowed, retryAfterSec } = checkRateLimit(`ai-chat:${user.id}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez dans quelques instants." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const message = (body as { message?: unknown })?.message;
  if (!message || typeof message !== "string" || message.length > 2000) {
    return NextResponse.json({ error: "Message invalide" }, { status: 400 });
  }

  const history = parseHistory((body as { history?: unknown })?.history);

  const [{ metrics, currency }, locale] = await Promise.all([
    getStoreMetrics(),
    getLocale(),
  ]);

  if (!metrics) {
    return NextResponse.json(
      { error: "Données insuffisantes pour répondre." },
      { status: 422 }
    );
  }

  const { reply, suggestions } = answerCfoQuestion({
    question: message,
    metrics,
    currency,
    history,
    locale,
  });

  await supabase.from("activity_logs").insert({
    user_id: user.id,
    action: "settings_updated",
    metadata: { type: "ai_cfo_query", question: message.slice(0, 100) },
  });

  return NextResponse.json({ reply, suggestions });
}
