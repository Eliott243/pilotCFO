/**
 * Deterministic NLU for the AI CFO chat.
 * Pipeline: normalize → detect language → extract entities → score intents →
 * resolve follow-ups from conversation history. No external API.
 */

import type { ChatTurn, Channel, Entities, IntentId, Lang, NLUResult } from "./types";

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(norm: string): string[] {
  return norm.split(/[^a-z0-9€$%]+/).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Language detection (FR vs EN), with the UI locale as tie-breaker
// ---------------------------------------------------------------------------

const FR_MARKERS = new Set([
  "le", "la", "les", "de", "des", "du", "un", "une", "je", "tu", "mon", "ma",
  "mes", "est", "et", "que", "quoi", "pourquoi", "combien", "comment", "puis",
  "peux", "dois", "faut", "si", "pas", "plus", "moins", "avec", "pour", "sur",
  "quel", "quels", "quelle", "quelles", "ou", "sont", "suis",
]);

const EN_MARKERS = new Set([
  "the", "my", "i", "is", "are", "can", "should", "what", "why", "how", "much",
  "many", "do", "does", "if", "with", "for", "on", "to", "of", "be", "will",
  "would", "and", "or", "am", "it",
]);

export function detectLang(norm: string, fallback: Lang): Lang {
  let fr = 0;
  let en = 0;
  for (const token of tokenize(norm)) {
    if (FR_MARKERS.has(token)) fr += 1;
    if (EN_MARKERS.has(token)) en += 1;
  }
  if (fr >= en + 2) return "fr";
  if (en >= fr + 2) return "en";
  if (fr > en) return "fr";
  if (en > fr) return "en";
  return fallback;
}

// ---------------------------------------------------------------------------
// Entity extraction
// ---------------------------------------------------------------------------

function parseNum(raw: string): number {
  let s = raw.replace(/\s/g, "");
  if (s.includes(".") && s.includes(",")) {
    s = s.replace(/,/g, "");
  } else {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

const PCT_RE = /(\d+(?:[.,]\d+)?)\s*(?:%|pourcents?|percent)/;
const DURATION_RE =
  /(\d+(?:[.,]\d+)?)\s*(mois|months?|ans?|annees?|years?|semaines?|weeks?|jours?|days?)\b/;
const MONEY_RE =
  /(\d[\d\s]*(?:[.,]\d+)?)\s*(k|m)?\s*(€|\$|eur(?:os)?|usd|dollars?)/;
const MONEY_PREFIX_RE = /(?:€|\$)\s*(\d[\d\s]*(?:[.,]\d+)?)\s*(k|m)?/;
const MONEY_SUFFIX_RE = /(\d[\d\s]*(?:[.,]\d+)?)\s*(k|m)\b/;
const BARE_NUMBER_RE = /\b(\d{2,8}(?:[.,]\d+)?)\b/;

const MONEY_CONTEXT =
  /(budget|salair|salary|prix|price|depens|spend|cout|cost|cash|tresorerie|invest|embauch|hire)/;

const CHANNEL_PREFIXES: [string, Channel][] = [
  ["meta", "meta"],
  ["facebook", "meta"],
  ["fb", "meta"],
  ["insta", "meta"],
  ["google", "google"],
  ["adwords", "google"],
  ["youtube", "google"],
  ["influenc", "influencer"],
  ["tiktok", "influencer"],
  ["ugc", "influencer"],
  ["createur", "influencer"],
  ["creator", "influencer"],
];

const INCREASE_RE =
  /(augment|monte|scal|boost|increase|raise|accroit|rajout|ajout|plus de|invest)/;
const DECREASE_RE =
  /(redui|baiss|diminu|coup|cut|decrease|lower|moins de|stop|arret|descend|drop)/;

export function extractEntities(norm: string): Entities {
  let working = norm;

  let percent: number | null = null;
  const pctMatch = working.match(PCT_RE);
  if (pctMatch) {
    percent = parseNum(pctMatch[1]);
    working = working.replace(pctMatch[0], " ");
  }

  let months: number | null = null;
  const durMatch = working.match(DURATION_RE);
  if (durMatch) {
    const n = parseNum(durMatch[1]);
    const unit = durMatch[2];
    if (/^(an|annee|year)/.test(unit)) months = n * 12;
    else if (/^(semaine|week)/.test(unit)) months = Math.max(1, Math.round(n / 4));
    else if (/^(jour|day)/.test(unit)) months = Math.max(1, Math.round(n / 30));
    else months = n;
    working = working.replace(durMatch[0], " ");
  }

  let amount: number | null = null;
  const moneyMatch =
    working.match(MONEY_RE) ??
    working.match(MONEY_PREFIX_RE) ??
    working.match(MONEY_SUFFIX_RE);
  if (moneyMatch) {
    amount = parseNum(moneyMatch[1]);
    const scale = moneyMatch[2];
    if (scale === "k") amount *= 1_000;
    if (scale === "m") amount *= 1_000_000;
  } else if (MONEY_CONTEXT.test(working)) {
    const bare = working.match(BARE_NUMBER_RE);
    if (bare) amount = parseNum(bare[1]);
  }

  let multiplier: number | null = null;
  if (/quadrupl/.test(norm)) multiplier = 4;
  else if (/tripl/.test(norm)) multiplier = 3;
  else if (/doubl/.test(norm)) multiplier = 2;
  else if (/(moitie|half)/.test(norm)) multiplier = 0.5;

  let channel: Channel | null = null;
  const tokens = tokenize(norm);
  outer: for (const token of tokens) {
    for (const [prefix, ch] of CHANNEL_PREFIXES) {
      if (token === prefix || (prefix.length >= 4 && token.startsWith(prefix))) {
        channel = ch;
        break outer;
      }
    }
  }

  let direction: "increase" | "decrease" | null = null;
  if (INCREASE_RE.test(norm)) direction = "increase";
  else if (DECREASE_RE.test(norm)) direction = "decrease";
  if (multiplier !== null && direction === null) {
    direction = multiplier >= 1 ? "increase" : "decrease";
  }

  return { amount, percent, multiplier, months, channel, direction };
}

// ---------------------------------------------------------------------------
// Intent scoring
// ---------------------------------------------------------------------------

interface Keyword {
  k: string;
  w: number;
  /** Exact token match (for short/ambiguous words). Default: prefix match. */
  exact?: boolean;
}

interface IntentDef {
  keywords: Keyword[];
  phrases?: { p: string; w: number }[];
}

const INTENTS: Record<Exclude<IntentId, "unknown">, IntentDef> = {
  greeting: {
    keywords: [
      { k: "bonjour", w: 3, exact: true },
      { k: "bonsoir", w: 3, exact: true },
      { k: "salut", w: 3, exact: true },
      { k: "coucou", w: 3, exact: true },
      { k: "hello", w: 3, exact: true },
      { k: "hi", w: 3, exact: true },
      { k: "hey", w: 3, exact: true },
      { k: "yo", w: 2, exact: true },
    ],
  },
  thanks: {
    keywords: [
      { k: "merci", w: 3 },
      { k: "thank", w: 3 },
      { k: "thx", w: 3, exact: true },
    ],
  },
  capabilities: {
    keywords: [
      { k: "aide", w: 2, exact: true },
      { k: "help", w: 2, exact: true },
      { k: "fonctionnalit", w: 2 },
      { k: "capacit", w: 2 },
    ],
    phrases: [
      { p: "que peux tu", w: 4 },
      { p: "que sais tu", w: 4 },
      { p: "what can you", w: 4 },
      { p: "comment ca marche", w: 3 },
      { p: "how do you work", w: 3 },
      { p: "a quoi sers tu", w: 4 },
    ],
  },
  health: {
    keywords: [
      { k: "sante", w: 3 },
      { k: "sain", w: 2 },
      { k: "health", w: 3 },
      { k: "score", w: 2 },
      { k: "bilan", w: 2 },
      { k: "diagnost", w: 3 },
    ],
    phrases: [
      { p: "etat general", w: 3 },
      { p: "how am i doing", w: 4 },
      { p: "ou j en suis", w: 3 },
    ],
  },
  margin: {
    keywords: [
      { k: "marg", w: 3 },
      { k: "rentab", w: 2 },
      { k: "profit", w: 2 },
      { k: "benefice", w: 3 },
    ],
    phrases: [
      { p: "combien je gagne", w: 4 },
      { p: "am i profitable", w: 4 },
      { p: "suis je rentable", w: 4 },
    ],
  },
  ad_budget: {
    keywords: [
      { k: "budget", w: 2 },
      { k: "pub", w: 2 },
      { k: "publicit", w: 3 },
      { k: "ads", w: 2, exact: true },
      { k: "campagn", w: 2 },
      { k: "advertis", w: 3 },
      { k: "spend", w: 2 },
      { k: "scal", w: 1 },
    ],
    phrases: [
      { p: "budget pub", w: 3 },
      { p: "ad budget", w: 3 },
      { p: "depenses marketing", w: 3 },
      { p: "marketing spend", w: 3 },
    ],
  },
  roas_perf: {
    keywords: [
      { k: "roas", w: 5, exact: true },
      { k: "mer", w: 3, exact: true },
    ],
    phrases: [
      { p: "retour sur", w: 3 },
      { p: "return on ad", w: 4 },
      { p: "mes pubs sont rentables", w: 4 },
      { p: "ads profitable", w: 3 },
    ],
  },
  cac_ltv: {
    keywords: [
      { k: "cac", w: 5, exact: true },
      { k: "ltv", w: 5, exact: true },
    ],
    phrases: [
      { p: "cout d acquisition", w: 4 },
      { p: "acquisition cost", w: 4 },
      { p: "lifetime value", w: 4 },
      { p: "valeur client", w: 3 },
      { p: "cout par client", w: 4 },
    ],
  },
  hire: {
    keywords: [
      { k: "embauch", w: 5 },
      { k: "recrut", w: 5 },
      { k: "hire", w: 5 },
      { k: "hiring", w: 5 },
      { k: "salari", w: 2 },
      { k: "employe", w: 2 },
      { k: "staff", w: 2 },
      { k: "equipe", w: 1, exact: true },
      { k: "team", w: 1, exact: true },
    ],
    phrases: [{ p: "agrandir l equipe", w: 4 }],
  },
  cash_runway: {
    keywords: [
      { k: "tresorerie", w: 5 },
      { k: "runway", w: 5 },
      { k: "cash", w: 3 },
      { k: "liquidit", w: 3 },
      { k: "burn", w: 3 },
    ],
    phrases: [
      { p: "compte en banque", w: 3 },
      { p: "bank account", w: 3 },
      { p: "combien de temps je peux tenir", w: 5 },
      { p: "how long can i", w: 4 },
    ],
  },
  forecast: {
    keywords: [
      { k: "prevision", w: 5 },
      { k: "projection", w: 5 },
      { k: "forecast", w: 5 },
      { k: "futur", w: 2 },
      { k: "avenir", w: 2 },
    ],
    phrases: [
      { p: "dans le futur", w: 3 },
      { p: "mois prochain", w: 3 },
      { p: "next month", w: 3 },
      { p: "ou serai je", w: 3 },
      { p: "where will i be", w: 4 },
    ],
  },
  revenue_growth: {
    keywords: [
      { k: "revenu", w: 3 },
      { k: "revenue", w: 3 },
      { k: "vente", w: 2 },
      { k: "sales", w: 2 },
      { k: "croissance", w: 3 },
      { k: "growth", w: 3 },
      { k: "grandir", w: 2 },
      { k: "grow", w: 2 },
      { k: "ca", w: 1, exact: true },
    ],
    phrases: [{ p: "chiffre d affaires", w: 5 }],
  },
  aov: {
    keywords: [
      { k: "aov", w: 5, exact: true },
      { k: "panier", w: 2 },
    ],
    phrases: [
      { p: "panier moyen", w: 5 },
      { p: "average order", w: 5 },
      { p: "average basket", w: 4 },
    ],
  },
  pricing: {
    keywords: [
      { k: "prix", w: 3 },
      { k: "tarif", w: 3 },
      { k: "pricing", w: 4 },
      { k: "price", w: 3 },
    ],
    phrases: [
      { p: "augmenter mes prix", w: 5 },
      { p: "raise prices", w: 5 },
      { p: "raise my prices", w: 5 },
      { p: "baisser les prix", w: 4 },
    ],
  },
  products: {
    keywords: [
      { k: "produit", w: 3 },
      { k: "product", w: 3 },
      { k: "sku", w: 3, exact: true },
      { k: "catalogue", w: 2 },
      { k: "bestseller", w: 3 },
      { k: "variante", w: 2 },
    ],
  },
  costs: {
    keywords: [
      { k: "cout", w: 3 },
      { k: "charge", w: 2 },
      { k: "depense", w: 2 },
      { k: "cost", w: 3 },
      { k: "cogs", w: 4, exact: true },
      { k: "logisti", w: 3 },
      { k: "frais", w: 2 },
      { k: "expense", w: 2 },
      { k: "fourniss", w: 2 },
      { k: "shipping", w: 2 },
      { k: "livraison", w: 2 },
    ],
  },
  refunds: {
    keywords: [
      { k: "rembours", w: 5 },
      { k: "refund", w: 5 },
      { k: "retour", w: 2 },
      { k: "return", w: 2 },
    ],
  },
  risks: {
    keywords: [
      { k: "risqu", w: 4 },
      { k: "risk", w: 4 },
      { k: "alert", w: 3 },
      { k: "danger", w: 3 },
      { k: "menace", w: 2 },
      { k: "probleme", w: 2 },
      { k: "inquiet", w: 2 },
      { k: "worr", w: 2 },
      { k: "threat", w: 2 },
    ],
  },
  debt: {
    keywords: [
      { k: "dette", w: 5 },
      { k: "debt", w: 5 },
      { k: "emprunt", w: 4 },
      { k: "credit", w: 2 },
      { k: "loan", w: 4 },
    ],
    phrases: [
      { p: "rembourser ma dette", w: 4 },
      { p: "rembourser mon emprunt", w: 4 },
      { p: "pay off", w: 3 },
      { p: "repay", w: 3 },
    ],
  },
};

export function scoreIntents(norm: string): [IntentId, number][] {
  const tokens = tokenize(norm);
  const scores: [IntentId, number][] = [];

  for (const [intent, def] of Object.entries(INTENTS) as [
    Exclude<IntentId, "unknown">,
    IntentDef,
  ][]) {
    let score = 0;
    for (const { k, w, exact } of def.keywords) {
      const hit = tokens.some((t) => (exact ? t === k : t.startsWith(k)));
      if (hit) score += w;
    }
    for (const { p, w } of def.phrases ?? []) {
      if (norm.includes(p)) score += w;
    }
    if (score > 0) scores.push([intent, score]);
  }

  return scores.sort((a, b) => b[1] - a[1]);
}

// ---------------------------------------------------------------------------
// Follow-up handling + full analysis
// ---------------------------------------------------------------------------

const FOLLOW_UP_RE =
  /^(et si|et avec|et pour|pourquoi|comment|combien|what if|why|how|and if|explique|detaille|develop|more|encore|vraiment|sur(?: |$)|ok mais|oui mais)/;

function hasAnyEntity(e: Entities): boolean {
  return (
    e.amount !== null ||
    e.percent !== null ||
    e.multiplier !== null ||
    e.months !== null ||
    e.channel !== null
  );
}

/**
 * Top intent for a normalized message, including the channel boost (a channel
 * mention alone strongly implies an ad question). Shared by the main analysis
 * and the history scan so follow-ups inherit the same interpretation.
 */
function effectiveTopIntent(
  norm: string,
  entities: Entities
): { intent: IntentId; score: number; scored: [IntentId, number][] } {
  const scored = scoreIntents(norm);
  let intent: IntentId = scored[0]?.[0] ?? "unknown";
  let score = scored[0]?.[1] ?? 0;

  if (entities.channel) {
    const adScore = (scored.find(([i]) => i === "ad_budget")?.[1] ?? 0) + 2;
    if (adScore > score || intent === "ad_budget") {
      intent = "ad_budget";
      score = Math.max(adScore, score);
    }
  }

  return { intent, score, scored };
}

export function analyze(
  question: string,
  history: ChatTurn[],
  defaultLang: Lang
): NLUResult {
  const norm = normalize(question);
  const lang = detectLang(norm, defaultLang);
  const entities = extractEntities(norm);
  const { intent: topIntent, score: topScore, scored } = effectiveTopIntent(norm, entities);

  let intent = topIntent;
  let secondary: IntentId | null = null;
  let followUp = false;

  if (intent === "ad_budget" && scored[0] && scored[0][0] !== "ad_budget" && scored[0][1] >= 3) {
    secondary = scored[0][0];
  } else if (scored[1] && scored[1][1] >= 3) {
    secondary = scored[1][0];
  }

  const confidence: NLUResult["confidence"] =
    topScore >= 3 ? "high" : topScore >= 2 ? "low" : "none";

  // Follow-up resolution: weak intent + ongoing conversation → inherit the
  // last confidently-detected user intent (entities from this message win).
  const looksLikeFollowUp =
    FOLLOW_UP_RE.test(norm) || tokenize(norm).length <= 8 || hasAnyEntity(entities);

  if (confidence !== "high" && history.length > 0 && looksLikeFollowUp) {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const turn = history[i];
      if (turn.role !== "user") continue;
      const prevNorm = normalize(turn.content);
      const prevEntities = extractEntities(prevNorm);
      const prev = effectiveTopIntent(prevNorm, prevEntities);
      if (prev.score >= 3) {
        if (prev.intent !== "greeting" && prev.intent !== "thanks") {
          // Only inherit when this message has no strong signal of its own.
          if (confidence === "none" || prev.intent === intent) {
            intent = prev.intent;
            followUp = true;
            entities.channel = entities.channel ?? prevEntities.channel;
            entities.direction = entities.direction ?? prevEntities.direction;
          }
        }
        break;
      }
    }
  }

  return {
    lang,
    intent,
    secondary,
    confidence: followUp && confidence === "none" ? "low" : confidence,
    entities,
    followUp,
  };
}
