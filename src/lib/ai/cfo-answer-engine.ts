/**
 * AI CFO — fully internal, deterministic answer engine (no external LLM).
 *
 * Pipeline: NLU (language, entities, weighted intent scoring, follow-up
 * resolution from history) → scenario simulations → CFO-grade response
 * composition in the user's language. Every number comes from the CFO engine;
 * every assumption used by a simulation is stated in the answer.
 */

import type { CFOMetrics } from "@/types/database";
import { analyze, detectLang, normalize } from "./engine/nlu";
import { compose } from "./engine/respond";
import type { ChatTurn, EngineAnswer, Lang } from "./engine/types";

export type { ChatTurn, EngineAnswer } from "./engine/types";

export interface AnswerCfoParams {
  question: string;
  metrics: CFOMetrics | null;
  currency: string;
  history?: ChatTurn[];
  locale?: Lang;
}

export function answerCfoQuestion(params: AnswerCfoParams): EngineAnswer {
  const { question, metrics, currency, history = [], locale = "fr" } = params;

  if (!metrics) {
    const lang = detectLang(normalize(question), locale);
    return {
      reply:
        lang === "fr"
          ? [
              "Je n'ai pas encore assez de données pour répondre précisément.",
              "Connecte Shopify et lance une synchronisation, puis je pourrai analyser ta rentabilité, ta trésorerie et tes risques.",
            ].join("\n")
          : [
              "I don't have enough data yet to answer precisely.",
              "Connect Shopify and run a sync — then I can analyze your profitability, cash and risks.",
            ].join("\n"),
      suggestions: [],
      intent: "unknown",
    };
  }

  const nlu = analyze(question, history, locale);
  return compose(metrics, nlu, currency);
}
