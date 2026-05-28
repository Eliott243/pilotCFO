# Installation

## Prérequis

| Outil | Version minimale |
|-------|------------------|
| Node.js | 20.x LTS |
| npm | 10+ |
| Compte Supabase | Projet créé |
| Compte Shopify Partners | App + boutique de dev |
| Compte Stripe | Mode test pour dev |
| Supabase CLI | Optionnel (Edge Functions) |

## 1. Cloner le dépôt

```bash
git clone https://github.com/Eliott243/pilotCFO.git
cd pilotCFO
npm install
```

## 2. Variables d'environnement

```bash
cp .env.example .env.local
```

Renseigner toutes les variables — voir [Configuration](./04-configuration.md).

## 3. Base de données Supabase

### Option A — SQL Editor (recommandé pour débuter)

Dans [Supabase Dashboard](https://supabase.com/dashboard) → **SQL Editor**, exécuter **dans l’ordre** :

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_users_insert_policy.sql`
3. `supabase/migrations/003_shopify_sync_v2.sql`

### Option B — Supabase CLI

```bash
supabase link --project-ref <votre-project-ref>
supabase db push
```

### Auth Supabase

Dans **Authentication → URL Configuration** :

| Champ | Valeur dev |
|-------|------------|
| Site URL | `http://localhost:3000` |
| Redirect URLs | `http://localhost:3000/auth/callback` |

Activer **Email** (ou fournisseur souhaité) pour inscription / connexion.

## 4. Edge Functions (sync v2 + webhooks)

```bash
supabase login
supabase link --project-ref <project-ref>

# Secrets requis côté functions
supabase secrets set SUPABASE_URL=https://<ref>.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
supabase secrets set SHOPIFY_API_SECRET=<shopify_api_secret>
supabase secrets set SUPABASE_FUNCTIONS_URL=https://<ref>.functions.supabase.co

# Déployer toutes les functions
supabase functions deploy sync-shopify-data
supabase functions deploy register-shopify-webhooks
supabase functions deploy webhooks-orders-create
supabase functions deploy webhooks-orders-updated
supabase functions deploy webhooks-orders-cancelled
supabase functions deploy webhooks-refunds-create
supabase functions deploy webhooks-products-update
supabase functions deploy webhooks-app-uninstalled
```

Détail : [Edge Functions](./07-edge-functions.md).

## 5. Shopify Partners

1. [partners.shopify.com](https://partners.shopify.com) → **Apps** → créer une app.
2. **App URL** : `http://localhost:3000` (ou URL tunnel en dev HTTPS).
3. **Allowed redirection URL(s)** :  
   `http://localhost:3000/api/shopify/callback`
4. Créer une **Development store** pour tester (une URL `*.myshopify.com` valide).
5. Copier **API key** et **API secret** dans `.env.local`.

Voir [Intégration Shopify](./06-shopify.md).

## 6. Stripe (optionnel en dev)

1. Créer produits/prix **Starter** et **Growth**.
2. Webhook endpoint : `http://localhost:3000/api/stripe/webhook` (Stripe CLI en local).
3. Copier les clés et `price_*` dans `.env.local`.

Voir [Facturation Stripe](./10-stripe.md).

## 7. Lancer l'application

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

## 8. Vérification

| Check | Attendu |
|-------|---------|
| Inscription | Redirection onboarding |
| Questionnaire | Accès dashboard après complétion |
| Settings → Shopify | OAuth OK, statut sync |
| Sync now | `sync_status` → success, lignes dans `shopify_orders` |
| Overview | KPIs (si données legacy `orders` ou après branchement `shopify_*`) |

## Scripts npm

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build production |
| `npm run start` | Serveur production |
| `npm run lint` | ESLint |

## TypeScript

Les Edge Functions Deno sont **exclues** du typecheck Next.js (`tsconfig.json` → `exclude: supabase/functions/**`).
