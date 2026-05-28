# Vue produit

## Résumé exécutif

**pilotCFO** est une application SaaS B2B qui agit comme un **directeur financier virtuel** pour les marchands e-commerce sur **Shopify**. Elle ne se contente pas d’afficher des graphiques : elle calcule des indicateurs de rentabilité, trésorerie, marketing et risques à partir des **données réelles** de la boutique, enrichies par un **profil financier** (questionnaire CFO) et une couche d’**interprétation** (AI CFO déterministe).

### Proposition de valeur

| Pour qui | Problème | Solution pilotCFO |
|----------|----------|-------------------|
| Fondateur / CEO Shopify | Manque de visibilité sur la marge réelle | Dashboards + scores santé financière |
| DAF / CFO externalisé | Données éparpillées (Shopify, Meta, banque) | Agrégation Shopify + profil questionnaire |
| Opérations / growth | Décisions pub sans ROAS fiable | Métriques marketing liées au CA réel |
| Investisseur / board | Besoin de rapports structurés | Rapports mensuels + alertes |

## Fonctionnalités principales

### 1. Onboarding guidé (6 étapes)

Collecte du contexte entreprise : nom, pays, devise, taille d’équipe, objectifs. Peut être ignoré partiellement ; l’état est persisté en base (`users.onboarding_completed`) et via cookie `pilotcfo_onboarding_done`.

### 2. Questionnaire CFO (6 questions)

Profil financier structuré : revenus, marges, dépenses marketing (Meta, Google, influence), trésorerie, objectifs 12 mois. Résultat avec tags dynamiques et CTA vers l’AI CFO. Persisté dans `financial_profiles` et `users.questionnaire_completed`.

### 3. Connexion Shopify (OAuth 2.0)

Import des commandes, produits et clients. Synchronisation initiale à la connexion, puis sync manuelle ou via webhooks (Edge Functions).

### 4. Tableaux de bord

| Module | Contenu typique |
|--------|-----------------|
| **Overview** | KPIs synthèse, alertes |
| **Financial Health** | Scores santé, rentabilité, cash, croissance |
| **Profitability** | Marge brute/nette, COGS, produits |
| **Cash Flow** | Runway, dette, ligne de crédit |
| **Forecasts** | Projections 3/6/12 mois |
| **AI CFO** | Questions métier, réponses basées sur le moteur |
| **Reports** | Rapports périodiques générés |
| **Settings** | Shopify, abonnement, langue FR/EN |

### 5. AI CFO (sans LLM externe en production)

Le chat utilise `cfo-answer-engine.ts` : détection d’intention (marge, Meta, embauche, risques, etc.) et réponses **uniquement** à partir des métriques calculées par le moteur CFO. Aucun chiffre inventé.

### 6. Abonnements (Stripe)

Essai, plans Starter/Growth, portail client Stripe, webhooks pour le statut d’abonnement.

### 7. Internationalisation

Français et anglais : cookie `pilotcfo_locale`, préférence `settings.preferences.language`, dictionnaires `src/lib/i18n/dictionaries/`.

## Parcours utilisateur (happy path)

```mermaid
flowchart LR
  A[Inscription] --> B[Onboarding]
  B --> C[Questionnaire CFO]
  C --> D[Connexion Shopify]
  D --> E[Sync données]
  E --> F[Dashboards]
  F --> G[AI CFO / Rapports]
```

## Plans et monétisation (cible)

| Plan | Cible | Fonctionnalités typiques |
|------|-------|--------------------------|
| **Trial** | 14 jours | Accès complet limité dans le temps |
| **Starter** | Petite boutique | Dashboards de base |
| **Growth** | Scale-up | Forecasts, AI CFO, rapports avancés |
| **Scale** | Multi-store (roadmap) | À définir |

Les identifiants Stripe sont configurés via `STRIPE_PRICE_ID_*` (voir [Facturation Stripe](./10-stripe.md)).

## Hors périmètre (v1)

- Comptabilité générale / export FEC
- Connexion bancaire (Plaid, etc.)
- Multi-boutiques par compte (schéma prêt, UI limitée)
- Conseil fiscal personnalisé (disclaimer légal requis en production)

## Glossaire

| Terme | Définition |
|-------|------------|
| **Moteur CFO** | Code déterministe calculant toutes les métriques (`src/lib/cfo-engine`) |
| **Profil financier** | Données questionnaire + hypothèses (coûts %, spend pub) |
| **Sync v2** | Tables `shopify_*` + Edge Function paginée 12 mois |
| **RLS** | Row Level Security Supabase — isolation par utilisateur |
