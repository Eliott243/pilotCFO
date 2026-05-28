import type { CFOMetrics } from "@/types/database";
import { formatCurrency, formatPercent } from "@/lib/utils";

type Intent =
  | "margin_drop"
  | "increase_meta_budget"
  | "hire"
  | "risks"
  | "unprofitable_products"
  | "health"
  | "unknown";

export function answerCfoQuestion(params: {
  question: string;
  metrics: CFOMetrics | null;
  currency: string;
}): string {
  const { question, metrics, currency } = params;

  if (!metrics) {
    return [
      "Je n’ai pas encore assez de données pour répondre précisément.",
      "Connecte Shopify et lance une synchronisation, puis je pourrai analyser ta rentabilité, ta trésorerie et tes risques.",
    ].join("\n");
  }

  const intent = detectIntent(question);

  switch (intent) {
    case "margin_drop":
      return marginDrop(metrics, currency);
    case "increase_meta_budget":
      return increaseMetaBudget(metrics);
    case "hire":
      return hiring(metrics, currency);
    case "risks":
      return risks(metrics);
    case "unprofitable_products":
      return unprofitableProducts(metrics, currency);
    case "health":
      return health(metrics);
    default:
      return generic(metrics, currency);
  }
}

function detectIntent(q: string): Intent {
  const s = q.toLowerCase();

  if (s.includes("marge") || s.includes("margin")) return "margin_drop";
  if (s.includes("meta") || s.includes("facebook") || s.includes("budget pub") || s.includes("publicité")) {
    return "increase_meta_budget";
  }
  if (s.includes("embauch") || s.includes("hire") || s.includes("recrut")) return "hire";
  if (s.includes("risque") || s.includes("risk")) return "risks";
  if (s.includes("produit") || s.includes("product")) return "unprofitable_products";
  if (s.includes("sain") || s.includes("santé") || s.includes("health")) return "health";

  return "unknown";
}

function marginDrop(m: CFOMetrics, currency: string): string {
  const top = m.profitability.topCostDrivers[0];
  const keyDrivers = m.profitability.topCostDrivers.slice(0, 3);

  const lines = [
    `Ta marge nette est de ${formatPercent(m.profitability.netMarginPct)} sur les 30 derniers jours.`,
    `Ton profit net est de ${formatCurrency(m.profitability.netProfit, currency)} pour ${m.revenue.orderCount} commandes (profit/commande: ${formatCurrency(m.profitability.profitPerOrder, currency)}).`,
    "",
    "Ce qui pèse le plus sur ta marge (ordre d'impact):",
    ...keyDrivers.map((d) => `- ${d.label}: ${formatCurrency(d.amount, currency)} (${formatPercent(d.pct)})`),
    "",
    `Action #1: optimise d'abord "${top?.label ?? "tes coûts"}" — c’est ton principal poste.`,
    "Action #2: compare ces postes vs la période précédente (si la tendance est à la hausse, c’est la cause la plus probable de la baisse de marge).",
  ];

  return lines.join("\n");
}

function increaseMetaBudget(m: CFOMetrics): string {
  const roas = m.marketing.roas;
  const mer = m.marketing.mer;
  const margin = m.profitability.netMarginPct;

  const canScale =
    roas >= 2.5 && margin >= 10 && m.cashFlow.runwayMonths >= 3;

  return [
    canScale
      ? "Oui, tu peux probablement augmenter ton budget — mais de façon contrôlée."
      : "Je ne recommande pas d’augmenter ton budget tout de suite.",
    `ROAS: ${roas > 0 ? `${roas.toFixed(2)}x` : "—"} · MER: ${formatPercent(mer)} · Marge nette: ${formatPercent(margin)} · Runway: ${m.cashFlow.runwayMonths.toFixed(1)} mois.`,
    "",
    "Plan simple (sans te mettre en danger):",
    "- +10% de budget pendant 3 jours",
    "- surveille ROAS et profit net (pas seulement le CA)",
    "- si ROAS baisse fortement ou si le profit net se dégrade, reviens au niveau précédent",
  ].join("\n");
}

function hiring(m: CFOMetrics, currency: string): string {
  const runway = m.cashFlow.runwayMonths;
  const profit = m.profitability.netProfit;

  const ok =
    runway >= 6 && profit > 0 && m.profitability.netMarginPct >= 10;

  return [
    ok
      ? "Oui, l’embauche est envisageable — ta situation est plutôt saine."
      : "Pas encore : ton entreprise n’a pas assez de marge de sécurité pour embaucher sereinement.",
    `Runway: ${runway.toFixed(1)} mois · Profit net (30j): ${formatCurrency(profit, currency)} · Marge nette: ${formatPercent(m.profitability.netMarginPct)}.`,
    "",
    "Règle CFO simple:",
    "- si tu descends sous 6 mois de runway après l’embauche, tu prends un risque élevé",
    "- vise une embauche qui augmente le profit (ops, conversion, rétention), pas seulement le CA",
  ].join("\n");
}

function risks(m: CFOMetrics): string {
  const alerts = m.alerts.slice(0, 3);
  const headline =
    alerts[0]?.title ??
    (m.cashFlow.riskLevel === "high"
      ? "Risque trésorerie élevé"
      : m.profitability.netMarginPct < 5
      ? "Rentabilité fragile"
      : "Risque modéré");

  return [
    `Tes risques prioritaires: ${headline}.`,
    `Runway: ${m.cashFlow.runwayMonths.toFixed(1)} mois · Marge nette: ${formatPercent(m.profitability.netMarginPct)} · Croissance: ${formatPercent(m.revenue.growthRate)}.`,
    "",
    alerts.length
      ? "Alertes détectées:"
      : "Aucune alerte majeure détectée dans tes règles actuelles.",
    ...alerts.map((a) => `- ${a.title}: ${a.message}${a.action ? ` → ${a.action}` : ""}`),
  ].join("\n");
}

function unprofitableProducts(m: CFOMetrics, currency: string): string {
  // Sans table produit-cost détaillée dans les métriques, on reste honnête.
  return [
    "Je peux identifier les produits à risque si j’ai des coûts réels par variant.",
    "Aujourd’hui, tes métriques montrent surtout la structure de coûts globale.",
    `Marge nette: ${formatPercent(m.profitability.netMarginPct)} · Contribution margin: ${formatPercent(m.profitability.contributionMarginPct)} · Profit net: ${formatCurrency(m.profitability.netProfit, currency)}.`,
    "",
    "Action: synchronise les coûts produits (variants.cost) depuis Shopify pour que je puisse classer les produits qui détruisent la rentabilité.",
  ].join("\n");
}

function health(m: CFOMetrics): string {
  return [
    `Score global: ${m.health.overall}/100.`,
    `Rentabilité: ${m.health.profitability}/100 · Trésorerie: ${m.health.cash}/100 · Croissance: ${m.health.growth}/100.`,
    "",
    `Résumé: ${m.health.explanations.overall}`,
    "",
    "Action: commence par l’alerte prioritaire #1 dans Overview (c’est le plus gros levier immédiat).",
  ].join("\n");
}

function generic(m: CFOMetrics, currency: string): string {
  return [
    "Voici où tu en es, en clair :",
    `- CA (30j): ${formatCurrency(m.revenue.total, currency)} (${formatPercent(m.revenue.growthRate)} vs période précédente)`,
    `- Marge nette: ${formatPercent(m.profitability.netMarginPct)} (profit net: ${formatCurrency(m.profitability.netProfit, currency)})`,
    `- Trésorerie: ${formatCurrency(m.cashFlow.cashAvailable, currency)} (runway: ${m.cashFlow.runwayMonths.toFixed(1)} mois)`,
    "",
    "Dis-moi ce que tu veux décider (budget pub, embauche, prix, stock) et je te réponds avec un plan simple.",
  ].join("\n");
}

