# Moteur CFO

## Principe fondamental

> **Tous les chiffres affichés dans l’application proviennent du moteur CFO.**  
> L’AI CFO **interprète** ces résultats — elle ne **génère** pas de métriques.

Fichier source : `src/lib/cfo-engine/index.ts`

## Entrées

```typescript
interface CFOEngineInput {
  orders: Order[];
  products: Product[];
  profile: FinancialProfile | null;
  previousPeriodOrders?: Order[];
  periodDays?: number;
}
```

| Entrée | Source |
|--------|--------|
| `orders` | 30 derniers jours (`orders` table) |
| `previousPeriodOrders` | J-60 à J-30 |
| `products` | Catalogue boutique |
| `profile` | Questionnaire CFO (`financial_profiles`) |

## Sortie : `CFOMetrics`

```typescript
{
  revenue: { total, previousPeriod, growthRate, orderCount, averageOrderValue },
  profitability: { grossRevenue, netRevenue, cogs, grossProfit, grossMarginPct, netProfit, netMarginPct, ... },
  marketing: { totalSpend, roas, cac, ... },
  cashFlow: { runwayMonths, burnRate, ... },
  health: { overall, profitability, cash, growth },
  forecasts: { month3, month6, month12 },
  alerts: Alert[]
}
```

## Blocs de calcul

### Revenus

- Somme `total_price` sur la période
- Croissance vs période précédente
- Panier moyen = CA / nombre de commandes

### Rentabilité

- CA net = subtotal − remboursements
- **COGS** : priorité `orders.cost_of_goods`, sinon `%` du profil (`avg_product_cost_pct`, défaut 40 %)
- Logistique : `%` du profil (`logistics_cost_pct`, défaut 8 %)
- Marketing : somme Meta + Google + influence du profil
- Marge nette = CA net − COGS − logistique − marketing

### Marketing

- ROAS = CA attribuable / spend (simplifié v1)
- Comparaison au `target_roas` du profil

### Trésorerie

- Runway = `cash_available` / burn mensuel estimé
- Intègre dette (`existing_debt`) et ligne de crédit

### Scores santé (0–100)

Composite pondéré :

- Rentabilité
- Liquidité / runway
- Croissance CA
- Efficacité marketing

### Prévisions

Projection linéaire / tendance à partir des métriques courantes (3, 6, 12 mois). **Hypothèses** — pas une garantie financière.

### Alertes

Règles déterministes, ex. :

- Marge brute < seuil
- Runway < 3 mois
- ROAS sous objectif
- Produits à marge négative

## AI CFO (`cfo-answer-engine.ts`)

### Intents détectés

| Intent | Mots-clés (FR/EN) |
|--------|-------------------|
| `margin_drop` | marge, margin |
| `increase_meta_budget` | meta, facebook, pub |
| `hire` | embauch, hire, recrut |
| `risks` | risque, risk |
| `unprofitable_products` | produit, product |
| `health` | santé, health, sain |

Réponse `unknown` → synthèse générique des KPIs.

### Garde-fous

- Si `metrics === null` → message invitant à connecter Shopify
- Formatage devise via `formatCurrency(currency)`
- Pas d’hallucination de pourcentages hors moteur

## Agrégation (`getStoreMetrics`)

`src/lib/data/metrics.ts` :

1. Résout `company` → `store` actif
2. Charge orders/products/profile
3. Appelle `calculateMetrics()`
4. Retourne `{ metrics, hasStore, hasData, storeId, currency }`

Mode démo : bypass → `getDemoMetrics()`.

## Rapports

`POST /api/reports/generate` snapshot les sections `CFOMetrics` dans `reports.*_section` (JSONB).

## Tests recommandés (roadmap)

| Cas | Attendu |
|-----|---------|
| 0 commande, profil seul | Métriques basées hypothèses profil |
| Commandes avec COGS | COGS réels utilisés |
| Remboursements élevés | Alerte marge |
| ROAS < target | Alerte marketing |

## Disclaimer produit

Les calculs sont des **aides à la décision**, pas un audit comptable certifié. Mention légale recommandée dans l’UI Settings / footer.
