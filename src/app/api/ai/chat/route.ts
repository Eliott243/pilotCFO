import { NextRequest, NextResponse } from "next/server";
import { getStoreMetrics } from "@/lib/data/metrics";
import { createClient } from "@/lib/supabase/server";
import { answerCfoQuestion } from "@/lib/ai/cfo-answer-engine";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
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

  const { metrics, currency } = await getStoreMetrics();

  if (!metrics) {
    return NextResponse.json(
      { error: "Données insuffisantes pour répondre." },
      { status: 422 }
    );
  }

  const reply = answerCfoQuestion({ question: message, metrics, currency });

  await supabase.from("activity_logs").insert({
    user_id: user.id,
    action: "settings_updated",
    metadata: { type: "ai_cfo_query", question: message.slice(0, 100) },
  });

  return NextResponse.json({ reply });
}
