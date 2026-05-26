# pilotCFO

CFO virtuel spécialisé pour les marchands Shopify. Pas un chatbot — un directeur financier qui analyse votre rentabilité, trésorerie, croissance et risques à partir de vos **données réelles**.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Supabase** — Auth, PostgreSQL, RLS, Storage
- **Shopify Admin API** — OAuth, sync commandes/produits/clients
- **Stripe** — Essai 14j, abonnements, portail client, webhooks
- **OpenAI** — AI CFO (interprète le moteur CFO, n'invente pas de chiffres)

## Architecture

```
src/lib/cfo-engine/     → Source de vérité (marges, ROAS, runway, scores…)
src/lib/data/metrics.ts → Agrégation Supabase + moteur CFO
src/lib/shopify/        → OAuth + synchronisation
src/lib/ai/             → Prompt CFO + interprétation
```

## Démarrage

### 1. Variables d'environnement

```bash
cp .env.example .env.local
```

Renseigner Supabase, Shopify, Stripe et OpenAI (voir `.env.example`).

### 2. Base de données Supabase

Dans le SQL Editor Supabase, exécuter :

```
supabase/migrations/001_initial_schema.sql
```

### 3. Lancer l'app

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

## Parcours utilisateur

1. **Inscription** → Onboarding guidé (6 étapes, skip possible)
2. **Questionnaire CFO** → Profil financier sauvegardé
3. **Connexion Shopify** → Import réel des données
4. **Dashboards** → Overview, Financial Health, Profitability, Cash Flow, Forecasts
5. **AI CFO** → Questions métier, réponses basées sur le moteur
6. **Reports** → Rapports mensuels structurés

## Menu principal

- Overview
- Financial Health
- Profitability
- Cash Flow
- Forecasts
- AI CFO
- Reports
- Settings

## Sécurité

- Row Level Security sur toutes les tables
- Isolation totale des données par `auth.uid()`
- Routes protégées via middleware
- Validation Zod sur les API
- Tokens Shopify en base (accès service role pour sync)
- Audit logs (`activity_logs`)

## Shopify

1. Créer une app dans [Shopify Partners](https://partners.shopify.com)
2. URL de redirection : `{APP_URL}/api/shopify/callback`
3. Scopes : `read_orders,read_products,read_customers,read_inventory`

## Stripe

1. Créer produit/prix Growth
2. Webhook : `{APP_URL}/api/stripe/webhook`
3. Événements : `customer.subscription.*`

## Prochaines étapes recommandées

- [ ] Webhooks Shopify (commandes temps réel)
- [ ] Coûts produits via Inventory API
- [ ] Pagination sync (>250 commandes)
- [ ] Feature flags par plan (Forecasts, AI CFO)
- [ ] Tests unitaires moteur CFO
