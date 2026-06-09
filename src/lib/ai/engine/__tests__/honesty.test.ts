/**
 * "Never invent anything" guarantees: the chat must disclose data provenance
 * and ask for missing inputs instead of assuming values.
 */

import { describe, expect, it } from "vitest";
import { answerCfoQuestion } from "@/lib/ai/cfo-answer-engine";
import type { CFOMetrics } from "@/types/database";
import { buildMetrics } from "./fixtures";

const real = buildMetrics();

function withoutCashData(): CFOMetrics {
  return buildMetrics({
    dataQuality: { ...real.dataQuality, hasCashData: false },
  });
}

function withEstimatedCogs(source: "profile" | "default"): CFOMetrics {
  return buildMetrics({
    dataQuality: { ...real.dataQuality, cogsSource: source, cogsCoveragePct: 0 },
  });
}

describe("provenance disclosure", () => {
  it("margin answer cites real Shopify costs when available", () => {
    const { reply } = answerCfoQuestion({
      question: "Quelle est ma marge ?",
      metrics: real,
      currency: "EUR",
      locale: "fr",
    });
    expect(reply).toContain("coûts produits réels Shopify");
    expect(reply).toContain("95%");
  });

  it("margin answer discloses questionnaire-based estimation", () => {
    const { reply } = answerCfoQuestion({
      question: "Quelle est ma marge ?",
      metrics: withEstimatedCogs("profile"),
      currency: "EUR",
      locale: "fr",
    });
    expect(reply).toContain("estimés depuis ton questionnaire");
  });

  it("margin answer warns loudly about the industry default", () => {
    const { reply } = answerCfoQuestion({
      question: "Quelle est ma marge ?",
      metrics: withEstimatedCogs("default"),
      currency: "EUR",
      locale: "fr",
    });
    expect(reply).toContain("Attention");
    expect(reply).toContain("estimation sectorielle");
  });

  it("ROAS answer states that spend is questionnaire-declared", () => {
    const { reply } = answerCfoQuestion({
      question: "Quel est mon ROAS ?",
      metrics: real,
      currency: "EUR",
      locale: "fr",
    });
    expect(reply).toContain("déclarés dans ton questionnaire");
  });
});

describe("asking instead of assuming", () => {
  it("hire question without salary asks for the salary", () => {
    const { reply } = answerCfoQuestion({
      question: "Puis-je embaucher ?",
      metrics: real,
      currency: "EUR",
      locale: "fr",
    });
    expect(reply).toContain("Quel salaire mensuel brut");
    expect(reply).not.toMatch(/Oui — feu vert|Non, je le déconseille/);
  });

  it("pricing question without percentage asks for the percentage", () => {
    const { reply } = answerCfoQuestion({
      question: "Dois-je augmenter mes prix ?",
      metrics: real,
      currency: "EUR",
      locale: "fr",
    });
    expect(reply).toContain("pourcentage");
    expect(reply).not.toContain("point mort");
  });

  it("hire simulation still runs when the salary is provided", () => {
    const { reply } = answerCfoQuestion({
      question: "Puis-je embaucher à 3000€ par mois ?",
      metrics: real,
      currency: "EUR",
      locale: "fr",
    });
    expect(reply).toMatch(/Oui — feu vert|C'est possible|Non, je le déconseille/);
  });
});

describe("refusing to fabricate missing data", () => {
  it("runway question without cash data refuses and asks for the questionnaire", () => {
    const { reply } = answerCfoQuestion({
      question: "Quel est mon runway ?",
      metrics: withoutCashData(),
      currency: "EUR",
      locale: "fr",
    });
    expect(reply).toContain("serait inventé");
    expect(reply).toContain("questionnaire");
    expect(reply).not.toContain("Niveau de risque");
  });

  it("hire question without cash data refuses a verdict", () => {
    const { reply } = answerCfoQuestion({
      question: "Puis-je embaucher à 3000€ par mois ?",
      metrics: withoutCashData(),
      currency: "EUR",
      locale: "fr",
    });
    expect(reply).toContain("je n'ai pas tes données de trésorerie");
    expect(reply).not.toMatch(/Oui — feu vert|Non, je le déconseille/);
  });

  it("debt question without cash data asks for the questionnaire", () => {
    const { reply } = answerCfoQuestion({
      question: "Dois-je rembourser ma dette ?",
      metrics: withoutCashData(),
      currency: "EUR",
      locale: "fr",
    });
    expect(reply).toContain("questionnaire");
  });

  it("budget simulation omits runway impact without cash data", () => {
    const { reply } = answerCfoQuestion({
      question: "Puis-je augmenter mon budget Meta de 1000€ ?",
      metrics: withoutCashData(),
      currency: "EUR",
      locale: "fr",
    });
    expect(reply).toContain("pas d'impact runway calculable");
  });

  it("greeting omits runway without cash data", () => {
    const { reply } = answerCfoQuestion({
      question: "Bonjour",
      metrics: withoutCashData(),
      currency: "EUR",
      locale: "fr",
    });
    expect(reply).not.toContain("runway");
  });
});
