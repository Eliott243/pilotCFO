/**
 * Response composer: turns NLU result + CFO metrics + scenario simulations
 * into a CFO-grade answer. Structure of every substantive answer:
 *   1. direct verdict/answer
 *   2. the real numbers behind it
 *   3. stated assumptions (when a simulation was used)
 *   4. 1-2 concrete actions
 * Plus follow-up suggestions rendered as chips by the UI.
 */

import type { CFOMetrics } from "@/types/database";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { EngineAnswer, Lang, NLUResult } from "./types";
import {
  channelSpend,
  pickForecast,
  simulateBudgetChange,
  simulateHire,
  simulatePriceChange,
  type Verdict,
} from "./scenarios";

interface Ctx {
  m: CFOMetrics;
  nlu: NLUResult;
  lang: Lang;
  /** Currency formatter with the right locale. */
  c: (n: number) => string;
  /** Percent formatter. */
  p: (n: number, d?: number) => string;
  /** Language picker. */
  t: (fr: string, en: string) => string;
}

const CHANNEL_LABEL: Record<string, { fr: string; en: string }> = {
  meta: { fr: "Meta", en: "Meta" },
  google: { fr: "Google", en: "Google" },
  influencer: { fr: "influence", en: "influencers" },
};

function verdictLine(v: Verdict, t: Ctx["t"]): string {
  if (v === "go") return t("Oui — feu vert, à condition de rester progressif.", "Yes — green light, as long as you move gradually.");
  if (v === "caution")
    return t(
      "C'est possible, mais avec prudence : ta marge de sécurité est limitée.",
      "It's possible, but be careful: your safety margin is thin."
    );
  return t(
    "Non, je le déconseille pour l'instant — les chiffres ne le justifient pas.",
    "No, I'd advise against it for now — the numbers don't support it."
  );
}

function months(n: number, t: Ctx["t"]): string {
  return `${n.toFixed(1)} ${t("mois", "months")}`;
}

/** Discloses where the COGS figure comes from — real Shopify costs vs estimate. */
function cogsProvenance(ctx: Ctx): string {
  const { m, t } = ctx;
  const dq = m.dataQuality;
  const cogsPct =
    m.profitability.topCostDrivers.find((d) =>
      d.label.toLowerCase().includes("produit")
    )?.pct ?? 0;

  if (dq.cogsSource === "shopify") {
    return t(
      `Source : coûts produits réels Shopify (couverture ${dq.cogsCoveragePct.toFixed(0)}% de la valeur des commandes).`,
      `Source: real Shopify product costs (covering ${dq.cogsCoveragePct.toFixed(0)}% of order value).`
    );
  }
  if (dq.cogsSource === "profile") {
    return t(
      `Source : coûts produits estimés depuis ton questionnaire (${cogsPct.toFixed(0)}% du CA) — renseigne « coût par article » dans Shopify puis resynchronise pour des marges réelles.`,
      `Source: product costs estimated from your questionnaire (${cogsPct.toFixed(0)}% of revenue) — fill "cost per item" in Shopify then re-sync for real margins.`
    );
  }
  return t(
    `Attention : coûts produits non renseignés (ni Shopify, ni questionnaire). J'utilise une estimation sectorielle de ${cogsPct.toFixed(0)}% du CA — ta vraie marge peut être différente. Renseigne « coût par article » dans Shopify pour des chiffres réels.`,
    `Warning: product costs not provided (neither Shopify nor questionnaire). I'm using a ${cogsPct.toFixed(0)}%-of-revenue industry estimate — your real margin may differ. Fill "cost per item" in Shopify for real numbers.`
  );
}

/** Reminds that ad spend figures are the user's declared questionnaire budgets. */
function spendProvenance(ctx: Ctx): string {
  return ctx.t(
    "Source : dépenses pub = budgets déclarés dans ton questionnaire, CA = commandes Shopify réelles. Mets à jour le questionnaire si tes budgets ont changé.",
    "Source: ad spend = budgets declared in your questionnaire, revenue = real Shopify orders. Update the questionnaire if your budgets changed."
  );
}

export function compose(
  metrics: CFOMetrics,
  nlu: NLUResult,
  currency: string
): EngineAnswer {
  const lang = nlu.lang;
  const locale = lang === "fr" ? "fr-FR" : "en-US";
  const ctx: Ctx = {
    m: metrics,
    nlu,
    lang,
    c: (n) => formatCurrency(n, currency, locale),
    p: (n, d) => formatPercent(n, d),
    t: (fr, en) => (lang === "fr" ? fr : en),
  };

  const { reply, suggestions } = route(ctx);
  return { reply, suggestions, intent: nlu.intent };
}

function route(ctx: Ctx): { reply: string; suggestions: string[] } {
  switch (ctx.nlu.intent) {
    case "greeting":
      return greeting(ctx);
    case "thanks":
      return thanks(ctx);
    case "capabilities":
      return capabilities(ctx);
    case "health":
      return health(ctx);
    case "margin":
      return margin(ctx);
    case "ad_budget":
      return adBudget(ctx);
    case "roas_perf":
      return roasPerf(ctx);
    case "cac_ltv":
      return cacLtv(ctx);
    case "hire":
      return hire(ctx);
    case "cash_runway":
      return cashRunway(ctx);
    case "forecast":
      return forecast(ctx);
    case "revenue_growth":
      return revenueGrowth(ctx);
    case "aov":
      return aov(ctx);
    case "pricing":
      return pricing(ctx);
    case "products":
      return products(ctx);
    case "costs":
      return costs(ctx);
    case "refunds":
      return refunds(ctx);
    case "risks":
      return risks(ctx);
    case "debt":
      return debt(ctx);
    default:
      return generic(ctx);
  }
}

// ---------------------------------------------------------------------------
// Conversational intents
// ---------------------------------------------------------------------------

function greeting(ctx: Ctx): { reply: string; suggestions: string[] } {
  const { m, t } = ctx;
  const topAlert = m.alerts[0];
  const lines = [
    t(
      "Bonjour. Je suis ton CFO — je travaille uniquement sur tes données Shopify et ton profil financier.",
      "Hello. I'm your CFO — I work exclusively from your Shopify data and financial profile."
    ),
    m.dataQuality.hasCashData
      ? t(
          `Vue rapide : score santé ${m.health.overall}/100, marge nette ${ctx.p(m.profitability.netMarginPct)}, runway ${months(m.cashFlow.runwayMonths, t)}.`,
          `Quick view: health score ${m.health.overall}/100, net margin ${ctx.p(m.profitability.netMarginPct)}, runway ${months(m.cashFlow.runwayMonths, t)}.`
        )
      : t(
          `Vue rapide : score santé ${m.health.overall}/100, marge nette ${ctx.p(m.profitability.netMarginPct)}.`,
          `Quick view: health score ${m.health.overall}/100, net margin ${ctx.p(m.profitability.netMarginPct)}.`
        ),
  ];
  if (topAlert) {
    lines.push(
      t(
        `Point d'attention : ${topAlert.title.toLowerCase()} — ${topAlert.message}`,
        `Worth your attention: ${topAlert.title} — ${topAlert.message}`
      )
    );
  }
  lines.push(
    t(
      "Pose-moi une question de décision : budget pub, embauche, prix, trésorerie.",
      "Ask me a decision question: ad budget, hiring, pricing, cash."
    )
  );
  return { reply: lines.join("\n"), suggestions: defaultSuggestions(ctx) };
}

function thanks(ctx: Ctx): { reply: string; suggestions: string[] } {
  return {
    reply: ctx.t(
      "Avec plaisir. Je suis là dès que tu as une décision à chiffrer.",
      "You're welcome. I'm here whenever you have a decision to put numbers on."
    ),
    suggestions: defaultSuggestions(ctx),
  };
}

function capabilities(ctx: Ctx): { reply: string; suggestions: string[] } {
  const { t } = ctx;
  return {
    reply: [
      t(
        "Je réponds uniquement à partir de tes données réelles — jamais d'invention. Voici ce que je sais faire :",
        "I answer only from your real data — never made-up numbers. Here's what I can do:"
      ),
      t("- Analyser : marge, coûts, CA, panier moyen, remboursements, risques", "- Analyze: margin, costs, revenue, AOV, refunds, risks"),
      t("- Simuler : augmenter/réduire le budget pub, embaucher, changer les prix", "- Simulate: increase/cut ad budget, hire, change prices"),
      t("- Surveiller : trésorerie, runway, ROAS, CAC/LTV, score santé", "- Monitor: cash, runway, ROAS, CAC/LTV, health score"),
      t("- Projeter : CA et profit à 1, 3, 6 ou 12 mois", "- Project: revenue and profit over 1, 3, 6 or 12 months"),
      "",
      t(
        "Exemple : « Et si j'ajoute 2 000 € sur Meta ? » ou « Puis-je embaucher à 3 000 €/mois ? »",
        'Example: "What if I add $2,000 on Meta?" or "Can I hire at $3,000/month?"'
      ),
    ].join("\n"),
    suggestions: defaultSuggestions(ctx),
  };
}

// ---------------------------------------------------------------------------
// Analysis intents
// ---------------------------------------------------------------------------

function health(ctx: Ctx): { reply: string; suggestions: string[] } {
  const { m, t } = ctx;
  const weakest = [
    { label: t("la rentabilité", "profitability"), score: m.health.profitability },
    { label: t("la trésorerie", "cash"), score: m.health.cash },
    { label: t("la croissance", "growth"), score: m.health.growth },
  ].sort((a, b) => a.score - b.score)[0];

  return {
    reply: [
      t(`Score santé global : ${m.health.overall}/100.`, `Overall health score: ${m.health.overall}/100.`),
      t(
        `Rentabilité ${m.health.profitability}/100 · Trésorerie ${m.health.cash}/100 · Croissance ${m.health.growth}/100.`,
        `Profitability ${m.health.profitability}/100 · Cash ${m.health.cash}/100 · Growth ${m.health.growth}/100.`
      ),
      "",
      m.health.explanations.overall,
      "",
      t(
        `Ton maillon faible : ${weakest.label} (${weakest.score}/100). C'est ton levier prioritaire — commence par là.`,
        `Your weak link: ${weakest.label} (${weakest.score}/100). That's your priority lever — start there.`
      ),
      ...(!m.dataQuality.hasCashData
        ? [
            "",
            t(
              "Note : le score trésorerie n'est pas fiable — tes données de cash ne sont pas renseignées dans le questionnaire.",
              "Note: the cash score isn't reliable — your cash data isn't filled in the questionnaire."
            ),
          ]
        : m.dataQuality.cogsSource === "default"
        ? [
            "",
            t(
              "Note : tes coûts produits ne sont renseignés nulle part — le score rentabilité repose sur une estimation sectorielle.",
              "Note: your product costs aren't provided anywhere — the profitability score relies on an industry estimate."
            ),
          ]
        : []),
    ].join("\n"),
    suggestions: [
      t("Pourquoi ma marge est à ce niveau ?", "Why is my margin at this level?"),
      t("Quels sont mes plus gros risques ?", "What are my biggest risks?"),
      t("Où serai-je dans 6 mois ?", "Where will I be in 6 months?"),
    ],
  };
}

function margin(ctx: Ctx): { reply: string; suggestions: string[] } {
  const { m, t, c, p } = ctx;
  const drivers = m.profitability.topCostDrivers.slice(0, 3);
  const top = drivers[0];
  const asksWhyDown = ctx.nlu.entities.direction === "decrease";

  const level =
    m.profitability.netMarginPct >= 15
      ? t("C'est une marge solide pour de l'e-commerce.", "That's a solid margin for e-commerce.")
      : m.profitability.netMarginPct >= 5
      ? t("C'est correct mais fragile : un dérapage de coûts peut te faire passer en négatif.", "It's OK but fragile: a cost slip can push you negative.")
      : t("C'est insuffisant : ta structure de coûts consomme presque tout ton CA.", "That's insufficient: your cost structure eats almost all your revenue.");

  const lines = [
    t(
      `Ta marge nette est de ${p(m.profitability.netMarginPct)} sur 30 jours, soit ${c(m.profitability.netProfit)} de profit net pour ${m.revenue.orderCount} commandes (${c(m.profitability.profitPerOrder)}/commande).`,
      `Your net margin is ${p(m.profitability.netMarginPct)} over 30 days — ${c(m.profitability.netProfit)} net profit on ${m.revenue.orderCount} orders (${c(m.profitability.profitPerOrder)}/order).`
    ),
    level,
    "",
    t("Ce qui pèse le plus, par ordre d'impact :", "What weighs the most, by impact:"),
    ...drivers.map((d) => `- ${d.label} : ${c(d.amount)} (${p(d.pct)} ${t("du CA", "of revenue")})`),
    "",
  ];

  if (asksWhyDown) {
    lines.push(
      t(
        `Pour une baisse de marge, le suspect n°1 est ton principal poste de coût : « ${top?.label} ». Vérifie s'il a augmenté en valeur absolue ou en % du CA vs le mois dernier.`,
        `For a margin drop, suspect #1 is your main cost line: "${top?.label}". Check whether it grew in absolute terms or as % of revenue vs last month.`
      ),
      t(
        "Vérifie aussi les remboursements et les remises — ce sont les fuites de marge les plus discrètes.",
        "Also check refunds and discounts — they're the most silent margin leaks."
      )
    );
  } else {
    lines.push(
      t(
        `Action n°1 : attaque « ${top?.label} » — c'est ton plus gros levier (${p(top?.pct ?? 0)} du CA).`,
        `Action #1: attack "${top?.label}" — it's your biggest lever (${p(top?.pct ?? 0)} of revenue).`
      ),
      t(
        "Action n°2 : vise +2 à 3 points de marge via les prix ou la négociation fournisseur avant de chercher plus de volume.",
        "Action #2: target +2-3 margin points via pricing or supplier negotiation before chasing more volume."
      )
    );
  }

  lines.push("", cogsProvenance(ctx));

  return {
    reply: lines.join("\n"),
    suggestions: [
      t("Et si j'augmente mes prix de 10% ?", "What if I raise prices by 10%?"),
      t("Détaille mes coûts", "Break down my costs"),
      t("Mes pubs sont-elles rentables ?", "Are my ads profitable?"),
    ],
  };
}

function adBudget(ctx: Ctx): { reply: string; suggestions: string[] } {
  const { m, t, c, p, nlu } = ctx;
  const e = nlu.entities;
  const channel = e.channel;
  const baseSpend = channelSpend(m, channel);
  const chLabel = channel
    ? CHANNEL_LABEL[channel][ctx.lang]
    : t("pub (tous canaux)", "ads (all channels)");

  if (m.marketing.totalSpend <= 0 || m.marketing.roas <= 0) {
    return {
      reply: t(
        "Je n'ai pas de dépenses publicitaires dans ton profil, donc pas de ROAS de référence pour simuler. Renseigne tes budgets Meta/Google/influence dans le questionnaire et je pourrai chiffrer ce scénario précisément.",
        "I don't have ad spend in your profile, so no baseline ROAS to simulate from. Fill in your Meta/Google/influencer budgets in the questionnaire and I'll quantify this scenario precisely."
      ),
      suggestions: [
        t("Quelle est ma santé financière ?", "What's my financial health?"),
        t("Détaille mes coûts", "Break down my costs"),
      ],
    };
  }

  // Resolve the spend delta: explicit amount > multiplier > percent > default +20%.
  let delta: number;
  let assumed = false;
  const sign = e.direction === "decrease" ? -1 : 1;
  if (e.amount !== null) {
    delta = sign * e.amount;
  } else if (e.multiplier !== null) {
    delta = baseSpend * (e.multiplier - 1);
  } else if (e.percent !== null) {
    delta = sign * baseSpend * (e.percent / 100);
  } else {
    delta = sign * baseSpend * 0.2;
    assumed = true;
  }

  const sim = simulateBudgetChange(m, delta, channel);
  if (!sim) return generic(ctx);

  const deltaLabel = `${sim.delta > 0 ? "+" : "−"}${c(Math.abs(sim.delta))}`;
  const lines = [
    verdictLine(sim.verdict, t),
    "",
    t(
      `Scénario : ${deltaLabel}/mois sur ${chLabel} (budget actuel : ${c(sim.spendBefore)} → ${c(Math.max(sim.spendAfter, 0))}).`,
      `Scenario: ${deltaLabel}/month on ${chLabel} (current budget: ${c(sim.spendBefore)} → ${c(Math.max(sim.spendAfter, 0))}).`
    ),
    t(
      `- CA estimé : ${sim.addedRevenue >= 0 ? "+" : "−"}${c(Math.abs(sim.addedRevenue))}/mois`,
      `- Estimated revenue: ${sim.addedRevenue >= 0 ? "+" : "−"}${c(Math.abs(sim.addedRevenue))}/month`
    ),
    t(
      `- Profit net estimé : ${sim.addedProfit >= 0 ? "+" : "−"}${c(Math.abs(sim.addedProfit))}/mois`,
      `- Estimated net profit: ${sim.addedProfit >= 0 ? "+" : "−"}${c(Math.abs(sim.addedProfit))}/month`
    ),
    m.dataQuality.hasCashData
      ? t(
          `- Runway : ${months(sim.runwayBefore, t)} → ${months(sim.runwayAfter, t)} · MER : ${p(sim.merBefore)} → ${p(sim.merAfter)}`,
          `- Runway: ${months(sim.runwayBefore, t)} → ${months(sim.runwayAfter, t)} · MER: ${p(sim.merBefore)} → ${p(sim.merAfter)}`
        )
      : t(
          `- MER : ${p(sim.merBefore)} → ${p(sim.merAfter)} (pas d'impact runway calculable : données de trésorerie absentes du questionnaire)`,
          `- MER: ${p(sim.merBefore)} → ${p(sim.merAfter)} (no runway impact computable: cash data missing from the questionnaire)`
        ),
    "",
    t(
      `Hypothèses : ROAS marginal de ${sim.roasUsed.toFixed(2)}x (ton ROAS moyen de ${m.marketing.roas.toFixed(2)}x — CA Shopify réel / budgets déclarés au questionnaire — décoté de 15% pour la saturation)${assumed ? " ; variation de 20% de ton budget déclaré, faute de montant précisé" : ""}.`,
      `Assumptions: marginal ROAS of ${sim.roasUsed.toFixed(2)}x (your ${m.marketing.roas.toFixed(2)}x average — real Shopify revenue / questionnaire-declared budgets — discounted 15% for saturation)${assumed ? "; 20% change of your declared budget since no amount was given" : ""}.`
    ),
    "",
    sim.delta > 0
      ? t(
          "Plan d'exécution : monte par paliers de 10-15% tous les 3-4 jours, surveille le profit net (pas le CA), et reviens en arrière si le ROAS décroche.",
          "Execution plan: scale in 10-15% steps every 3-4 days, watch net profit (not revenue), and roll back if ROAS breaks down."
        )
      : t(
          "Plan d'exécution : coupe d'abord les campagnes au ROAS le plus faible, garde le retargeting, et mesure l'impact sur 7 jours avant d'aller plus loin.",
          "Execution plan: cut your lowest-ROAS campaigns first, keep retargeting, and measure impact over 7 days before going further."
        ),
  ];

  return {
    reply: lines.join("\n"),
    suggestions: [
      t("Et si je double ce montant ?", "What if I double that amount?"),
      t("Quel est mon ROAS ?", "What's my ROAS?"),
      t("Quel impact sur ma trésorerie ?", "What's the impact on my cash?"),
    ],
  };
}

function roasPerf(ctx: Ctx): { reply: string; suggestions: string[] } {
  const { m, t, c, p } = ctx;

  if (!m.dataQuality.hasMarketingSpend) {
    return {
      reply: t(
        "Je ne peux pas calculer ton ROAS : aucune dépense publicitaire n'est déclarée dans ton questionnaire. Renseigne tes budgets Meta/Google/influence et je te donne un ROAS basé sur ton CA Shopify réel.",
        "I can't compute your ROAS: no ad spend is declared in your questionnaire. Fill in your Meta/Google/influencer budgets and I'll give you a ROAS based on your real Shopify revenue."
      ),
      suggestions: [
        t("Quelle est ma marge ?", "What's my margin?"),
        t("Quel est mon chiffre d'affaires ?", "What's my revenue?"),
      ],
    };
  }

  const roas = m.marketing.roas;
  const judgment =
    roas >= 4
      ? t("Excellent — tes pubs créent clairement de la valeur.", "Excellent — your ads clearly create value.")
      : roas >= 2.5
      ? t("Correct — rentable, mais sans marge de sécurité énorme.", "Decent — profitable, but without a huge safety margin.")
      : roas >= 1.5
      ? t("Limite — après COGS et logistique, tu gagnes peu (voire rien) sur chaque euro investi.", "Borderline — after COGS and logistics, you make little (or nothing) on each dollar spent.")
      : t("Insuffisant — chaque euro de pub te coûte probablement de l'argent net.", "Insufficient — every ad dollar is probably losing you money net.");

  return {
    reply: [
      t(
        `ROAS global : ${roas > 0 ? `${roas.toFixed(2)}x` : "—"} pour ${c(m.marketing.totalSpend)}/mois de dépenses (MER : ${p(m.marketing.mer)}).`,
        `Blended ROAS: ${roas > 0 ? `${roas.toFixed(2)}x` : "—"} on ${c(m.marketing.totalSpend)}/month spend (MER: ${p(m.marketing.mer)}).`
      ),
      t(
        `Répartition : Meta ${c(m.marketing.metaSpend)} · Google ${c(m.marketing.googleSpend)} · Influence ${c(m.marketing.influencerSpend)}.`,
        `Split: Meta ${c(m.marketing.metaSpend)} · Google ${c(m.marketing.googleSpend)} · Influencers ${c(m.marketing.influencerSpend)}.`
      ),
      judgment,
      "",
      t(
        `Repère CFO : avec ta marge de contribution actuelle (${p(m.profitability.contributionMarginPct)}), ton seuil de rentabilité publicitaire est plus exigeant qu'il n'y paraît — le ROAS seul ne suffit pas, regarde le profit net par euro dépensé.`,
        `CFO benchmark: with your current contribution margin (${p(m.profitability.contributionMarginPct)}), your ad break-even is more demanding than it looks — ROAS alone isn't enough, watch net profit per dollar spent.`
      ),
      "",
      spendProvenance(ctx),
    ].join("\n"),
    suggestions: [
      t("Puis-je augmenter mon budget pub ?", "Can I increase my ad budget?"),
      t("Quel est mon CAC ?", "What's my CAC?"),
      t("Pourquoi ma marge est faible ?", "Why is my margin low?"),
    ],
  };
}

function cacLtv(ctx: Ctx): { reply: string; suggestions: string[] } {
  const { m, t, c } = ctx;

  if (!m.dataQuality.hasMarketingSpend) {
    return {
      reply: t(
        "Je ne peux pas calculer ton CAC sans tes dépenses publicitaires — elles ne sont pas déclarées dans ton questionnaire. Renseigne tes budgets et je croise avec tes clients Shopify réels.",
        "I can't compute your CAC without your ad spend — it isn't declared in your questionnaire. Fill in your budgets and I'll cross it with your real Shopify customers."
      ),
      suggestions: [
        t("Quel est mon panier moyen ?", "What's my AOV?"),
        t("Quelle est ma marge ?", "What's my margin?"),
      ],
    };
  }

  const ratio = m.marketing.ltvCacRatio;
  const judgment =
    ratio >= 3
      ? t("Ratio sain (≥3) : chaque client rapporte nettement plus qu'il ne coûte.", "Healthy ratio (≥3): each customer brings in clearly more than they cost.")
      : ratio >= 1.5
      ? t("Ratio moyen : acceptable, mais ton acquisition manque d'efficacité.", "Average ratio: acceptable, but your acquisition lacks efficiency.")
      : t("Ratio faible : ton acquisition coûte trop cher par rapport à la valeur générée.", "Weak ratio: acquisition costs too much vs the value generated.");

  return {
    reply: [
      t(
        `CAC : ${c(m.marketing.cac)} · Valeur client (30j) : ${c(m.marketing.ltv)} · Ratio : ${ratio.toFixed(2)}.`,
        `CAC: ${c(m.marketing.cac)} · Customer value (30d): ${c(m.marketing.ltv)} · Ratio: ${ratio.toFixed(2)}.`
      ),
      judgment,
      "",
      t(
        "Précision importante : je calcule cette valeur client sur 30 jours de données — c'est un plancher, pas une vraie LTV. Si tes clients rachètent, ton vrai ratio est meilleur que ça.",
        "Important caveat: I compute this customer value over 30 days of data — it's a floor, not a true LTV. If your customers reorder, your real ratio is better than this."
      ),
      "",
      t(
        "Levier le plus rapide : augmenter la valeur par client (upsell, bundle, panier moyen) coûte moins cher que baisser le CAC.",
        "Fastest lever: raising value per customer (upsell, bundles, AOV) is cheaper than lowering CAC."
      ),
    ].join("\n"),
    suggestions: [
      t("Quel est mon panier moyen ?", "What's my average order value?"),
      t("Mes pubs sont-elles rentables ?", "Are my ads profitable?"),
    ],
  };
}

function hire(ctx: Ctx): { reply: string; suggestions: string[] } {
  const { m, t, c, p, nlu } = ctx;

  // No cash data → a runway verdict would be invented. Ask for it instead.
  if (!m.dataQuality.hasCashData) {
    return {
      reply: [
        t(
          "Je ne peux pas te donner un verdict sérieux : une décision d'embauche se juge sur le runway, et je n'ai pas tes données de trésorerie (cash, dette, ligne de crédit).",
          "I can't give you a serious verdict: a hiring decision is judged on runway, and I don't have your cash data (cash, debt, credit line)."
        ),
        "",
        t(
          `Ce que je sais de ta boutique : profit net ${c(m.profitability.netProfit)}/mois (marge nette ${p(m.profitability.netMarginPct)}).`,
          `What I know from your store: net profit ${c(m.profitability.netProfit)}/month (net margin ${p(m.profitability.netMarginPct)}).`
        ),
        "",
        t(
          "Complète la partie trésorerie du questionnaire et repose-moi la question — je te donnerai un verdict chiffré.",
          "Complete the cash section of the questionnaire and ask me again — I'll give you a numbered verdict."
        ),
      ].join("\n"),
      suggestions: [
        t("Suis-je rentable ?", "Am I profitable?"),
        t("Quelle est ma santé financière ?", "What's my financial health?"),
      ],
    };
  }

  // No salary given → ask, never assume one.
  if (nlu.entities.amount === null) {
    return {
      reply: [
        t(
          "Quel salaire mensuel brut envisages-tu ? Je ne veux pas supposer un chiffre à ta place.",
          "What gross monthly salary are you considering? I don't want to assume a figure for you."
        ),
        "",
        t(
          `Pour cadrer ta réflexion avec tes vrais chiffres : profit net ${c(m.profitability.netProfit)}/mois, runway ${months(m.cashFlow.runwayMonths, t)}.`,
          `To frame it with your real numbers: net profit ${c(m.profitability.netProfit)}/month, runway ${months(m.cashFlow.runwayMonths, t)}.`
        ),
        t(
          "Dis-moi par exemple : « une embauche à 2 800 €/mois » et je simule l'impact exact.",
          'Tell me e.g.: "a hire at $2,800/month" and I\'ll simulate the exact impact.'
        ),
      ].join("\n"),
      suggestions: [
        t("Une embauche à 2 500 €/mois", "A hire at $2,500/month"),
        t("Une embauche à 3 500 €/mois", "A hire at $3,500/month"),
      ],
    };
  }

  const sim = simulateHire(m, nlu.entities.amount);

  const lines = [
    verdictLine(sim.verdict, t),
    "",
    t(
      `Scénario : une embauche à ${c(sim.monthlySalary)}/mois brut, soit ${c(sim.monthlyFullCost)}/mois chargé (coefficient 1,35 — charges employeur).`,
      `Scenario: a hire at ${c(sim.monthlySalary)}/month gross, i.e. ${c(sim.monthlyFullCost)}/month fully loaded (1.35x factor — employer charges).`
    ),
    t(
      `- Profit net : ${c(sim.profitBefore)} → ${c(sim.profitAfter)}/mois`,
      `- Net profit: ${c(sim.profitBefore)} → ${c(sim.profitAfter)}/month`
    ),
    t(
      `- Runway : ${months(sim.runwayBefore, t)} → ${months(sim.runwayAfter, t)}`,
      `- Runway: ${months(sim.runwayBefore, t)} → ${months(sim.runwayAfter, t)}`
    ),
    "",
    t(
      "Règle CFO : si l'embauche te fait passer sous 6 mois de runway, le risque est élevé. Et privilégie un poste qui augmente le profit (ops, conversion, rétention), pas seulement le CA.",
      "CFO rule: if the hire pushes you under 6 months of runway, the risk is high. And favor a role that grows profit (ops, conversion, retention), not just revenue."
    ),
  ];

  return {
    reply: lines.join("\n"),
    suggestions: [
      t("Et à 4 000 €/mois ?", "What about $4,000/month?"),
      t("Quelle est ma trésorerie ?", "What's my cash position?"),
      t("Où serai-je dans 6 mois ?", "Where will I be in 6 months?"),
    ],
  };
}

function cashRunway(ctx: Ctx): { reply: string; suggestions: string[] } {
  const { m, t, c } = ctx;

  // No cash data → any runway figure would be invented. Say so.
  if (!m.dataQuality.hasCashData) {
    return {
      reply: [
        t(
          "Je n'ai pas tes données de trésorerie (cash disponible, dette, ligne de crédit) — tout runway que je te donnerais serait inventé, et je ne fais pas ça.",
          "I don't have your cash data (available cash, debt, credit line) — any runway figure I'd give you would be made up, and I don't do that."
        ),
        "",
        t(
          `Ce que tes données Shopify me disent : encaissements ${c(m.cashFlow.monthlyInflow)} sur 30 jours, profit net ${c(m.profitability.netProfit)}.`,
          `What your Shopify data tells me: ${c(m.cashFlow.monthlyInflow)} inflows over 30 days, net profit ${c(m.profitability.netProfit)}.`
        ),
        "",
        t(
          "Complète la partie trésorerie du questionnaire (2 minutes) et je calcule ton runway réel.",
          "Complete the cash section of the questionnaire (2 minutes) and I'll compute your real runway."
        ),
      ].join("\n"),
      suggestions: [
        t("Suis-je rentable ?", "Am I profitable?"),
        t("Quel est mon chiffre d'affaires ?", "What's my revenue?"),
      ],
    };
  }

  const riskLabel =
    m.cashFlow.riskLevel === "high"
      ? t("élevé — c'est ta priorité absolue", "high — this is your absolute priority")
      : m.cashFlow.riskLevel === "medium"
      ? t("modéré — à surveiller de près", "moderate — watch it closely")
      : t("faible — situation stable", "low — stable situation");

  return {
    reply: [
      t(
        `Trésorerie disponible : ${c(m.cashFlow.cashAvailable)} · Position nette : ${c(m.cashFlow.netCashPosition)}.`,
        `Available cash: ${c(m.cashFlow.cashAvailable)} · Net position: ${c(m.cashFlow.netCashPosition)}.`
      ),
      t(
        `Burn mensuel estimé : ${c(m.cashFlow.monthlyBurn)} → runway de ${months(m.cashFlow.runwayMonths, t)}.`,
        `Estimated monthly burn: ${c(m.cashFlow.monthlyBurn)} → ${months(m.cashFlow.runwayMonths, t)} of runway.`
      ),
      t(`Niveau de risque : ${riskLabel}.`, `Risk level: ${riskLabel}.`),
      "",
      m.cashFlow.runwayMonths < 6
        ? t(
            "Sous 6 mois de runway, chaque décision de dépense doit passer le test : « est-ce que ça génère du cash en moins de 60 jours ? ». Sinon, reporte.",
            'Under 6 months of runway, every spend decision must pass the test: "does this generate cash within 60 days?". If not, postpone.'
          )
        : t(
            "Avec ce runway, tu as de la marge pour investir — mais garde un plancher de 6 mois de burn en réserve.",
            "With this runway you have room to invest — but keep a floor of 6 months of burn in reserve."
          ),
    ].join("\n"),
    suggestions: [
      t("Puis-je embaucher ?", "Can I hire?"),
      t("Et si je réduis mon budget pub de 30% ?", "What if I cut my ad budget by 30%?"),
      t("Où serai-je dans 3 mois ?", "Where will I be in 3 months?"),
    ],
  };
}

function forecast(ctx: Ctx): { reply: string; suggestions: string[] } {
  const { m, t, c, nlu } = ctx;
  const { label, forecast: f } = pickForecast(m, nlu.entities.months);
  const confLabel =
    f.confidence === "high"
      ? t("élevée", "high")
      : f.confidence === "medium"
      ? t("moyenne", "medium")
      : t("faible", "low");

  return {
    reply: [
      t(
        `Projection à ${label} mois, sur la base de ta tendance actuelle (${ctx.p(m.revenue.growthRate)} de croissance) :`,
        `${label}-month projection, based on your current trend (${ctx.p(m.revenue.growthRate)} growth):`
      ),
      t(`- CA projeté : ${c(f.projectedRevenue)}`, `- Projected revenue: ${c(f.projectedRevenue)}`),
      t(`- Profit projeté : ${c(f.projectedProfit)}`, `- Projected profit: ${c(f.projectedProfit)}`),
      t(`- Trésorerie projetée : ${c(f.projectedCash)}`, `- Projected cash: ${c(f.projectedCash)}`),
      t(`- Confiance : ${confLabel}`, `- Confidence: ${confLabel}`),
      "",
      t(
        "À prendre comme un cap, pas une promesse : la projection prolonge ta tendance des 30 derniers jours et ne connaît pas ta saisonnalité.",
        "Treat this as a heading, not a promise: it extrapolates your last 30 days and doesn't know your seasonality."
      ),
      t(
        "Plus l'horizon est long, plus l'incertitude grandit — re-vérifie chaque mois après ta sync Shopify.",
        "The longer the horizon, the bigger the uncertainty — recheck monthly after your Shopify sync."
      ),
    ].join("\n"),
    suggestions: [
      t("Et dans 12 mois ?", "What about in 12 months?"),
      t("Quels sont mes risques ?", "What are my risks?"),
      t("Comment accélérer ma croissance ?", "How do I speed up growth?"),
    ],
  };
}

function revenueGrowth(ctx: Ctx): { reply: string; suggestions: string[] } {
  const { m, t, c, p } = ctx;
  const growing = m.revenue.growthRate >= 0;
  return {
    reply: [
      t(
        `CA sur 30 jours : ${c(m.revenue.total)} (${growing ? "+" : ""}${p(m.revenue.growthRate)} vs la période précédente, ${c(m.revenue.previousPeriod)}).`,
        `30-day revenue: ${c(m.revenue.total)} (${growing ? "+" : ""}${p(m.revenue.growthRate)} vs previous period, ${c(m.revenue.previousPeriod)}).`
      ),
      t(
        `${m.revenue.orderCount} commandes · panier moyen ${c(m.revenue.averageOrderValue)}.`,
        `${m.revenue.orderCount} orders · ${c(m.revenue.averageOrderValue)} average order value.`
      ),
      "",
      growing
        ? t(
            `Attention au réflexe « croissance avant tout » : ta marge nette est à ${p(m.profitability.netMarginPct)}. De la croissance à marge faible, c'est du volume qui ne paie pas.`,
            `Beware the "growth first" reflex: your net margin is ${p(m.profitability.netMarginPct)}. Low-margin growth is volume that doesn't pay.`
          )
        : t(
            "Pour un CA en baisse, regarde dans l'ordre : (1) volume de commandes, (2) panier moyen, (3) remboursements. Le coupable est presque toujours l'un des trois.",
            "For declining revenue, check in order: (1) order volume, (2) AOV, (3) refunds. The culprit is almost always one of the three."
          ),
    ].join("\n"),
    suggestions: [
      t("Quel est mon panier moyen ?", "What's my AOV?"),
      t("Où serai-je dans 3 mois ?", "Where will I be in 3 months?"),
      t("Suis-je rentable ?", "Am I profitable?"),
    ],
  };
}

function aov(ctx: Ctx): { reply: string; suggestions: string[] } {
  const { m, t, c } = ctx;
  return {
    reply: [
      t(
        `Panier moyen : ${c(m.revenue.averageOrderValue)} sur ${m.revenue.orderCount} commandes (30 jours).`,
        `Average order value: ${c(m.revenue.averageOrderValue)} across ${m.revenue.orderCount} orders (30 days).`
      ),
      "",
      t(
        `Pourquoi c'est ton meilleur levier : +10% de panier moyen = environ ${c(m.profitability.grossRevenue * 0.1)} de CA en plus sans dépenser un euro de pub de plus.`,
        `Why it's your best lever: +10% AOV ≈ ${c(m.profitability.grossRevenue * 0.1)} extra revenue without spending one more ad dollar.`
      ),
      t(
        "Tactiques classées par effort : seuil de livraison gratuite < bundle 2-3 produits < upsell post-achat.",
        "Tactics ranked by effort: free-shipping threshold < 2-3 product bundles < post-purchase upsell."
      ),
    ].join("\n"),
    suggestions: [
      t("Et si j'augmente mes prix de 10% ?", "What if I raise prices by 10%?"),
      t("Quel est mon CAC ?", "What's my CAC?"),
    ],
  };
}

function pricing(ctx: Ctx): { reply: string; suggestions: string[] } {
  const { m, t, c, p, nlu } = ctx;
  const pct =
    nlu.entities.percent ??
    (nlu.entities.multiplier ? (nlu.entities.multiplier - 1) * 100 : null);

  // No percentage given → ask, never assume one.
  if (pct === null || pct <= 0) {
    return {
      reply: [
        t(
          "De combien veux-tu bouger tes prix ? Donne-moi un pourcentage (ex. « +8% ») et je calcule l'impact exact sur tes chiffres.",
          'How much do you want to move your prices? Give me a percentage (e.g. "+8%") and I\'ll compute the exact impact on your numbers.'
        ),
        "",
        t(
          `Ton point de départ réel : panier moyen ${c(m.revenue.averageOrderValue)}, marge de contribution ${p(m.profitability.contributionMarginPct)}.`,
          `Your real starting point: AOV ${c(m.revenue.averageOrderValue)}, contribution margin ${p(m.profitability.contributionMarginPct)}.`
        ),
      ].join("\n"),
      suggestions: [
        t("Et si j'augmente mes prix de 5% ?", "What if I raise prices by 5%?"),
        t("Et si j'augmente mes prix de 10% ?", "What if I raise prices by 10%?"),
      ],
    };
  }

  const sim = simulatePriceChange(m, pct);

  return {
    reply: [
      t(
        `Scénario : prix +${p(sim.percent, 0)} → panier moyen ${c(sim.aovBefore)} → ${c(sim.aovAfter)}.`,
        `Scenario: prices +${p(sim.percent, 0)} → AOV ${c(sim.aovBefore)} → ${c(sim.aovAfter)}.`
      ),
      t(
        `- Si le volume tient : ${c(sim.addedProfitIfVolumeHolds)}/mois de profit en plus (ça tombe directement dans la marge).`,
        `- If volume holds: ${c(sim.addedProfitIfVolumeHolds)}/month extra profit (it drops straight to margin).`
      ),
      t(
        `- Ton point mort : tu peux perdre jusqu'à ${p(sim.breakEvenVolumeDropPct)} de volume avant que la hausse devienne perdante.`,
        `- Your break-even: you can lose up to ${p(sim.breakEvenVolumeDropPct)} of volume before the increase becomes a loss.`
      ),
      "",
      t(
        "En e-commerce, une perte de volume supérieure à ce point mort après une hausse de prix est rare — surtout si tu montes par paliers.",
        "In e-commerce, losing more volume than this break-even after a price increase is rare — especially if you raise gradually."
      ),
      "",
      t(
        "Exécution : teste d'abord sur tes 20% de produits les plus demandés, sur 2 semaines, en surveillant le taux de conversion.",
        "Execution: test on your top 20% most-demanded products first, over 2 weeks, watching conversion rate."
      ),
    ].join("\n"),
    suggestions: [
      t("Et avec +15% ?", "What about +15%?"),
      t("Quel est mon panier moyen ?", "What's my AOV?"),
      t("Pourquoi ma marge est faible ?", "Why is my margin low?"),
    ],
  };
}

function products(ctx: Ctx): { reply: string; suggestions: string[] } {
  const { m, t, c, p } = ctx;
  const productAlert = m.alerts.find((a) => a.id === "products-unprofitable");

  const lines = [
    productAlert
      ? t(
          `Signal détecté : ${productAlert.message}`,
          `Signal detected: ${productAlert.message}`
        )
      : t(
          "Aucun produit à marge critique détecté dans les données synchronisées.",
          "No critically low-margin product detected in the synced data."
        ),
    "",
    t(
      `Vue globale : marge de contribution à ${p(m.profitability.contributionMarginPct)}, profit net ${c(m.profitability.netProfit)} sur 30 jours.`,
      `Global view: contribution margin at ${p(m.profitability.contributionMarginPct)}, net profit ${c(m.profitability.netProfit)} over 30 days.`
    ),
    "",
    t(
      "Pour un classement produit par produit (lesquels créent ou détruisent ta marge), il me faut les coûts par variante : renseigne le champ « coût par article » dans Shopify puis relance une sync.",
      'For a product-by-product ranking (which ones create or destroy margin), I need per-variant costs: fill the "cost per item" field in Shopify, then re-sync.'
    ),
  ];

  return {
    reply: lines.join("\n"),
    suggestions: [
      t("Détaille mes coûts", "Break down my costs"),
      t("Et si j'augmente mes prix de 10% ?", "What if I raise prices by 10%?"),
    ],
  };
}

function costs(ctx: Ctx): { reply: string; suggestions: string[] } {
  const { m, t, c, p } = ctx;
  const drivers = m.profitability.topCostDrivers;
  const top = drivers[0];

  return {
    reply: [
      t("Ta structure de coûts sur 30 jours, du plus lourd au plus léger :", "Your 30-day cost structure, heaviest to lightest:"),
      ...drivers.map((d) => `- ${d.label} : ${c(d.amount)} (${p(d.pct)} ${t("du CA", "of revenue")})`),
      "",
      t(
        `Il te reste ${p(m.profitability.netMarginPct)} de marge nette une fois tout payé.`,
        `You keep ${p(m.profitability.netMarginPct)} net margin once everything is paid.`
      ),
      "",
      t(
        `Règle des 80/20 : négocier ou optimiser « ${top?.label} » de 10% aurait plus d'impact que de réduire tous les autres postes de 5%.`,
        `80/20 rule: negotiating or optimizing "${top?.label}" by 10% would beat cutting every other line by 5%.`
      ),
      "",
      cogsProvenance(ctx),
    ].join("\n"),
    suggestions: [
      t("Pourquoi ma marge est faible ?", "Why is my margin low?"),
      t("Et si je réduis mon budget pub de 20% ?", "What if I cut my ad budget by 20%?"),
    ],
  };
}

function refunds(ctx: Ctx): { reply: string; suggestions: string[] } {
  const { m, t, c, p } = ctx;
  const driver = m.profitability.topCostDrivers.find((d) =>
    d.label.toLowerCase().includes("rembours")
  );
  const amount = driver?.amount ?? 0;
  const pct = driver?.pct ?? 0;

  const judgment =
    pct > 5
      ? t(
          "C'est élevé : au-delà de 5% du CA, les remboursements sont un problème produit ou logistique, pas un bruit de fond.",
          "That's high: above 5% of revenue, refunds are a product or logistics problem, not background noise."
        )
      : pct > 2
      ? t("C'est dans la norme e-commerce (2-5%), mais ça reste de la marge qui s'évapore.", "That's within e-commerce norms (2-5%), but it's still margin evaporating.")
      : t("C'est maîtrisé — sous 2% du CA.", "That's under control — below 2% of revenue.");

  return {
    reply: [
      t(
        `Remboursements sur 30 jours : ${c(amount)}, soit ${p(pct)} de ton CA.`,
        `Refunds over 30 days: ${c(amount)}, i.e. ${p(pct)} of your revenue.`
      ),
      judgment,
      "",
      t(
        "Si tu veux creuser : identifie les 3 produits les plus remboursés dans Shopify (Analytics → Retours). Un seul produit défectueux concentre souvent la majorité des retours.",
        "To dig in: identify your 3 most-refunded products in Shopify (Analytics → Returns). A single defective product often concentrates most returns."
      ),
    ].join("\n"),
    suggestions: [
      t("Détaille mes coûts", "Break down my costs"),
      t("Quels produits posent problème ?", "Which products are problematic?"),
    ],
  };
}

function risks(ctx: Ctx): { reply: string; suggestions: string[] } {
  const { m, t, p } = ctx;
  const alerts = m.alerts.slice(0, 4);

  const lines = [
    alerts.length > 0
      ? t(
          `J'ai ${alerts.length} alerte(s) active(s), par ordre de priorité :`,
          `I have ${alerts.length} active alert(s), in priority order:`
        )
      : t(
          "Aucune alerte majeure dans mes règles actuelles — mais voici tes points de vigilance structurels :",
          "No major alert in my current rules — but here are your structural watch points:"
        ),
    ...alerts.map(
      (a) => `- [${a.priority === "critical" ? t("CRITIQUE", "CRITICAL") : a.priority === "high" ? t("ÉLEVÉ", "HIGH") : t("MOYEN", "MEDIUM")}] ${a.title} : ${a.message}${a.action ? ` → ${a.action}` : ""}`
    ),
    "",
    t(
      `Vue d'ensemble : runway ${months(m.cashFlow.runwayMonths, t)} · marge nette ${p(m.profitability.netMarginPct)} · croissance ${p(m.revenue.growthRate)}.`,
      `Big picture: runway ${months(m.cashFlow.runwayMonths, t)} · net margin ${p(m.profitability.netMarginPct)} · growth ${p(m.revenue.growthRate)}.`
    ),
    "",
    t(
      "Traite-les dans l'ordre : une alerte trésorerie passe toujours avant une alerte marketing.",
      "Handle them in order: a cash alert always comes before a marketing alert."
    ),
  ];

  return {
    reply: lines.join("\n"),
    suggestions: [
      t("Quelle est ma trésorerie ?", "What's my cash position?"),
      t("Quelle est ma santé financière ?", "What's my financial health?"),
    ],
  };
}

function debt(ctx: Ctx): { reply: string; suggestions: string[] } {
  const { m, t, c } = ctx;

  if (!m.dataQuality.hasCashData) {
    return {
      reply: t(
        "Je n'ai pas tes données de dette et de trésorerie — complète la partie trésorerie du questionnaire (cash, dette, ligne de crédit) et je te donne une analyse réelle, pas une supposition.",
        "I don't have your debt and cash data — complete the cash section of the questionnaire (cash, debt, credit line) and I'll give you a real analysis, not a guess."
      ),
      suggestions: [
        t("Quelle est ma santé financière ?", "What's my financial health?"),
        t("Suis-je rentable ?", "Am I profitable?"),
      ],
    };
  }

  return {
    reply: [
      t(
        `Position nette de trésorerie (cash + ligne de crédit − dette) : ${c(m.cashFlow.netCashPosition)}.`,
        `Net cash position (cash + credit line − debt): ${c(m.cashFlow.netCashPosition)}.`
      ),
      t(
        `Cash disponible : ${c(m.cashFlow.cashAvailable)} · Runway : ${months(m.cashFlow.runwayMonths, t)}.`,
        `Available cash: ${c(m.cashFlow.cashAvailable)} · Runway: ${months(m.cashFlow.runwayMonths, t)}.`
      ),
      "",
      m.cashFlow.netCashPosition < 0
        ? t(
            "Position nette négative : ta dette dépasse tes liquidités. Priorité absolue au remboursement ou à la renégociation avant tout nouvel investissement.",
            "Negative net position: your debt exceeds your liquidity. Absolute priority on repayment or renegotiation before any new investment."
          )
        : t(
            "Règle simple : de la dette pour financer du stock qui tourne, oui. De la dette pour financer des pertes opérationnelles, non.",
            "Simple rule: debt to finance fast-turning inventory, yes. Debt to finance operating losses, no."
          ),
    ].join("\n"),
    suggestions: [
      t("Quelle est ma trésorerie ?", "What's my cash position?"),
      t("Où serai-je dans 6 mois ?", "Where will I be in 6 months?"),
    ],
  };
}

// ---------------------------------------------------------------------------
// Fallback
// ---------------------------------------------------------------------------

function generic(ctx: Ctx): { reply: string; suggestions: string[] } {
  const { m, t, c, p } = ctx;
  return {
    reply: [
      t("Voici où tu en es, en clair :", "Here's where you stand, plainly:"),
      t(
        `- CA (30j) : ${c(m.revenue.total)} (${p(m.revenue.growthRate)} vs période précédente)`,
        `- Revenue (30d): ${c(m.revenue.total)} (${p(m.revenue.growthRate)} vs previous period)`
      ),
      t(
        `- Marge nette : ${p(m.profitability.netMarginPct)} · Profit net : ${c(m.profitability.netProfit)}`,
        `- Net margin: ${p(m.profitability.netMarginPct)} · Net profit: ${c(m.profitability.netProfit)}`
      ),
      t(
        `- Trésorerie : ${c(m.cashFlow.cashAvailable)} · Runway : ${months(m.cashFlow.runwayMonths, t)}`,
        `- Cash: ${c(m.cashFlow.cashAvailable)} · Runway: ${months(m.cashFlow.runwayMonths, t)}`
      ),
      "",
      t(
        "Je n'ai pas bien saisi ta question. Reformule-la autour d'une décision (budget pub, embauche, prix, stock) ou d'un indicateur (marge, ROAS, trésorerie) et je te réponds avec un plan chiffré.",
        "I didn't quite catch your question. Frame it around a decision (ad budget, hiring, pricing, inventory) or a metric (margin, ROAS, cash) and I'll answer with a numbered plan."
      ),
    ].join("\n"),
    suggestions: defaultSuggestions(ctx),
  };
}

function defaultSuggestions(ctx: Ctx): string[] {
  const { t } = ctx;
  return [
    t("Quelle est ma santé financière ?", "What's my financial health?"),
    t("Puis-je augmenter mon budget Meta de 20% ?", "Can I increase my Meta budget by 20%?"),
    t("Puis-je embaucher ?", "Can I hire?"),
  ];
}
