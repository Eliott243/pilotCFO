import { NextRequest, NextResponse } from "next/server";
import { getStoreMetrics } from "@/lib/data/metrics";
import { createClient } from "@/lib/supabase/server";
import { answerCfoQuestion } from "@/lib/ai/cfo-answer-engine";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { message } = await request.json();
  if (!message || typeof message !== "string" || message.length > 2000) {
    return NextResponse.json({ error: "Message invalide" }, { status: 400 });
  }

  const { metrics, currency } = await getStoreMetrics();

  const reply = answerCfoQuestion({ question: message, metrics, currency });

  await supabase.from("activity_logs").insert({
    user_id: user.id,
    action: "settings_updated",
    metadata: { type: "ai_cfo_query", question: message.slice(0, 100) },
  });

  return NextResponse.json({ reply });
}
