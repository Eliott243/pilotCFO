import { describe, expect, it } from "vitest";
import { analyze, detectLang, extractEntities, normalize, scoreIntents } from "../nlu";

describe("normalize", () => {
  it("strips accents, apostrophes and case", () => {
    expect(normalize("Pourquoi ma TRÉSORERIE l'été ?")).toBe(
      "pourquoi ma tresorerie l ete ?"
    );
  });
});

describe("detectLang", () => {
  it("detects French", () => {
    expect(detectLang(normalize("Pourquoi ma marge baisse ?"), "en")).toBe("fr");
  });

  it("detects English", () => {
    expect(detectLang(normalize("Why is my margin going down?"), "fr")).toBe("en");
  });

  it("falls back to locale when ambiguous", () => {
    expect(detectLang(normalize("ROAS ?"), "fr")).toBe("fr");
    expect(detectLang(normalize("ROAS ?"), "en")).toBe("en");
  });
});

describe("extractEntities", () => {
  it("parses amounts with currency suffix", () => {
    expect(extractEntities(normalize("augmenter de 2000€")).amount).toBe(2000);
  });

  it("parses currency-prefixed amounts", () => {
    expect(extractEntities(normalize("increase by $500")).amount).toBe(500);
  });

  it("parses k-suffixed amounts", () => {
    expect(extractEntities(normalize("un budget de 3k€")).amount).toBe(3000);
  });

  it("parses percentages", () => {
    expect(extractEntities(normalize("réduire de 15%")).percent).toBe(15);
  });

  it("parses durations into months", () => {
    expect(extractEntities(normalize("dans 6 mois")).months).toBe(6);
    expect(extractEntities(normalize("in 2 years")).months).toBe(24);
  });

  it("does not confuse a duration with an amount", () => {
    const e = extractEntities(normalize("où serai-je dans 3 mois ?"));
    expect(e.months).toBe(3);
    expect(e.amount).toBeNull();
  });

  it("detects channels", () => {
    expect(extractEntities(normalize("mes pubs Facebook")).channel).toBe("meta");
    expect(extractEntities(normalize("Google Ads")).channel).toBe("google");
    expect(extractEntities(normalize("campagnes influenceurs")).channel).toBe(
      "influencer"
    );
  });

  it("detects direction and multiplier", () => {
    const e = extractEntities(normalize("et si je double mon budget ?"));
    expect(e.multiplier).toBe(2);
    expect(e.direction).toBe("increase");
    expect(extractEntities(normalize("réduire mes coûts")).direction).toBe(
      "decrease"
    );
  });
});

describe("scoreIntents", () => {
  const cases: [string, string][] = [
    ["Pourquoi ma marge baisse ?", "margin"],
    ["Why is my margin dropping?", "margin"],
    ["Puis-je augmenter mon budget pub ?", "ad_budget"],
    ["Quels sont mes plus gros risques ?", "risks"],
    ["Puis-je embaucher ?", "hire"],
    ["Can I hire someone?", "hire"],
    ["Quelle est ma trésorerie ?", "cash_runway"],
    ["What's my runway?", "cash_runway"],
    ["Quel est mon ROAS ?", "roas_perf"],
    ["Quel est mon CAC ?", "cac_ltv"],
    ["Quel est mon panier moyen ?", "aov"],
    ["Où serai-je dans 6 mois ?", "forecast"],
    ["Quel est mon chiffre d'affaires ?", "revenue_growth"],
    ["Et si j'augmente mes prix de 10% ?", "pricing"],
    ["Quels produits détruisent ma rentabilité ?", "products"],
    ["Détaille mes coûts", "costs"],
    ["J'ai trop de remboursements", "refunds"],
    ["Quelle est ma santé financière ?", "health"],
    ["Bonjour", "greeting"],
    ["Merci !", "thanks"],
    ["Que peux-tu faire ?", "capabilities"],
    ["Dois-je rembourser ma dette ?", "debt"],
  ];

  it.each(cases)("classifies %s as %s", (question, expected) => {
    const scored = scoreIntents(normalize(question));
    expect(scored[0]?.[0]).toBe(expected);
  });
});

describe("analyze", () => {
  it("boosts ad_budget when a channel is mentioned", () => {
    const r = analyze("Puis-je mettre plus sur Meta ?", [], "fr");
    expect(r.intent).toBe("ad_budget");
    expect(r.entities.channel).toBe("meta");
  });

  it("inherits intent from history for follow-ups", () => {
    const history = [
      { role: "user" as const, content: "Puis-je embaucher ?" },
      { role: "assistant" as const, content: "Oui, sous conditions." },
    ];
    const r = analyze("et à 4000€ par mois ?", history, "fr");
    expect(r.intent).toBe("hire");
    expect(r.followUp).toBe(true);
    expect(r.entities.amount).toBe(4000);
  });

  it("keeps channel context across follow-ups", () => {
    const history = [
      { role: "user" as const, content: "Puis-je augmenter mon budget Meta ?" },
      { role: "assistant" as const, content: "Oui." },
    ];
    const r = analyze("et si je double ?", history, "fr");
    expect(r.intent).toBe("ad_budget");
    expect(r.entities.multiplier).toBe(2);
    expect(r.entities.channel).toBe("meta");
  });

  it("does not treat a clear new question as a follow-up", () => {
    const history = [
      { role: "user" as const, content: "Puis-je embaucher ?" },
      { role: "assistant" as const, content: "Oui." },
    ];
    const r = analyze("Quelle est ma trésorerie ?", history, "fr");
    expect(r.intent).toBe("cash_runway");
    expect(r.followUp).toBe(false);
  });
});
