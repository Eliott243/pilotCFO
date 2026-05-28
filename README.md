# pilotCFO

CFO virtuel pour marchands **Shopify** — rentabilité, trésorerie, marketing et risques à partir de vos **données réelles**, pas d’un chatbot générique.

[![Documentation](./docs/README.md)](./docs/README.md)

## Documentation complète

| Guide | Lien |
|-------|------|
| Index & navigation | [docs/README.md](./docs/README.md) |
| Vue produit | [docs/01-product.md](./docs/01-product.md) |
| Architecture | [docs/02-architecture.md](./docs/02-architecture.md) |
| Installation | [docs/03-installation.md](./docs/03-installation.md) |
| Configuration | [docs/04-configuration.md](./docs/04-configuration.md) |
| Base de données | [docs/05-database.md](./docs/05-database.md) |
| Shopify | [docs/06-shopify.md](./docs/06-shopify.md) |
| Edge Functions | [docs/07-edge-functions.md](./docs/07-edge-functions.md) |
| API | [docs/08-api.md](./docs/08-api.md) |
| Moteur CFO | [docs/09-cfo-engine.md](./docs/09-cfo-engine.md) |
| Stripe | [docs/10-stripe.md](./docs/10-stripe.md) |
| Sécurité | [docs/11-security.md](./docs/11-security.md) |
| Déploiement | [docs/12-deployment.md](./docs/12-deployment.md) |
| Guide utilisateur | [docs/13-user-guide.md](./docs/13-user-guide.md) |
| Dépannage | [docs/14-troubleshooting.md](./docs/14-troubleshooting.md) |

## Stack

- **Next.js 16** — App Router, TypeScript, Tailwind CSS 4
- **Supabase** — Auth, PostgreSQL, RLS, Edge Functions
- **Shopify Admin API** — OAuth, sync paginée, webhooks
- **Stripe** — Essai, abonnements, portail client

## Démarrage rapide

```bash
cp .env.example .env.local
# Renseigner Supabase, Shopify, Stripe — voir docs/04-configuration.md

# Migrations SQL (Supabase SQL Editor, dans l'ordre) :
# 001_initial_schema.sql → 002_users_insert_policy.sql → 003_shopify_sync_v2.sql

npm install
npm run dev
```

→ [Installation détaillée](./docs/03-installation.md)

## Architecture (résumé)

```
src/lib/cfo-engine/       → Calculs financiers (source de vérité)
src/lib/data/metrics.ts   → Agrégation BDD → moteur CFO
src/lib/ai/               → AI CFO déterministe (sans OpenAI requis)
supabase/functions/       → Sync Shopify v2 + webhooks
```

## Fonctionnalités

- Onboarding + questionnaire CFO (6 questions)
- Connexion Shopify OAuth + sync 12 mois + webhooks temps réel
- Dashboards : Overview, Financial Health, Profitability, Cash Flow, Forecasts
- AI CFO, rapports, i18n FR/EN, facturation Stripe

## Licence

Propriétaire — tous droits réservés (sauf mention contraire).
