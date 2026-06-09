import { describe, expect, it } from "vitest";
import { answerCfoQuestion } from "@/lib/ai/cfo-answer-engine";
import { buildMetrics } from "./fixtures";

const metrics = buildMetrics();

describe("answerCfoQuestion (end to end)", () => {
  it("answers a margin question in French with real numbers", () => {
    const { reply, intent } = answerCfoQuestion({
      question: "Pourquoi ma marge baisse ?",
      metrics,
      currency: "EUR",
      locale: "fr",
    });
    expect(intent).toBe("margin");
    expect(reply).toContain("14.6%");
    expect(reply).toContain("Coût des produits");
  });

  it("answers in English when the question is in English", () => {
    const { reply } = answerCfoQuestion({
      question: "Why is my margin so low?",
      metrics,
      currency: "USD",
      locale: "fr",
    });
    expect(reply).toContain("Your net margin");
  });

  it("simulates an ad budget increase with stated assumptions", () => {
    const { reply, intent } = answerCfoQuestion({
      question: "Puis-je augmenter mon budget Meta de 1000€ ?",
      metrics,
      currency: "EUR",
      locale: "fr",
    });
    expect(intent).toBe("ad_budget");
    expect(reply).toContain("Hypothèses");
    expect(reply).toContain("4.25x"); // marginal ROAS = 5 × 0.85
    expect(reply).toMatch(/Oui/);
  });

  it("handles follow-ups using conversation history", () => {
    const { reply, intent } = answerCfoQuestion({
      question: "et si je double ?",
      metrics,
      currency: "EUR",
      locale: "fr",
      history: [
        { role: "user", content: "Puis-je augmenter mon budget Meta ?" },
        { role: "assistant", content: "Oui, progressivement." },
      ],
    });
    expect(intent).toBe("ad_budget");
    expect(reply).toContain("Meta");
  });

  it("gives a hire verdict driven by runway", () => {
    const { reply, intent } = answerCfoQuestion({
      question: "Puis-je embaucher à 3000€ par mois ?",
      metrics,
      currency: "EUR",
      locale: "fr",
    });
    expect(intent).toBe("hire");
    // 4 months runway falls below 4 after the hire → negative verdict
    expect(reply).toMatch(/Non, je le déconseille/);
  });

  it("is honest about the 30-day LTV limitation", () => {
    const { reply } = answerCfoQuestion({
      question: "Quel est mon LTV ?",
      metrics,
      currency: "EUR",
      locale: "fr",
    });
    expect(reply).toContain("30 jours");
    expect(reply).toContain("plancher");
  });

  it("returns suggestions with every answer", () => {
    const { suggestions } = answerCfoQuestion({
      question: "Quelle est ma santé financière ?",
      metrics,
      currency: "EUR",
      locale: "fr",
    });
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
  });

  it("asks for data when metrics are missing", () => {
    const { reply } = answerCfoQuestion({
      question: "Suis-je rentable ?",
      metrics: null,
      currency: "EUR",
      locale: "fr",
    });
    expect(reply).toContain("Connecte Shopify");
  });

  it("asks for data in English for English questions", () => {
    const { reply } = answerCfoQuestion({
      question: "Am I profitable right now?",
      metrics: null,
      currency: "USD",
      locale: "fr",
    });
    expect(reply).toContain("Connect Shopify");
  });

  it("is deterministic: same question → same answer", () => {
    const a = answerCfoQuestion({ question: "Quel est mon ROAS ?", metrics, currency: "EUR", locale: "fr" });
    const b = answerCfoQuestion({ question: "Quel est mon ROAS ?", metrics, currency: "EUR", locale: "fr" });
    expect(a.reply).toBe(b.reply);
  });
});
