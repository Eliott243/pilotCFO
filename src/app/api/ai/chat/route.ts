import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { buildCFOSystemPrompt } from "@/lib/ai/cfo-prompt";
import { getStoreMetrics } from "@/lib/data/metrics";
import { createClient } from "@/lib/supabase/server";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
}

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

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      reply:
        "Le service AI CFO nécessite une clé OpenAI configurée. En attendant, consultez vos dashboards Overview, Profitability et Cash Flow pour vos métriques calculées.",
    });
  }

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: buildCFOSystemPrompt(metrics, currency) },
      { role: "user", content: message },
    ],
    max_tokens: 800,
    temperature: 0.3,
  });

  const reply = completion.choices[0]?.message?.content ?? "Réponse indisponible.";

  await supabase.from("activity_logs").insert({
    user_id: user.id,
    action: "settings_updated",
    metadata: { type: "ai_cfo_query", question: message.slice(0, 100) },
  });

  return NextResponse.json({ reply });
}
