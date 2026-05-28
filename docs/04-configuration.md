# Configuration

## Fichiers d'environnement

| Fichier | Commité | Usage |
|---------|---------|-------|
| `.env.example` | Oui | Modèle sans secrets |
| `.env.local` | Non (`.gitignore`) | Développement local |
| Variables Vercel / Supabase | — | Production |

**Ne jamais committer** de clés réelles. En cas de fuite : rotation immédiate (Supabase, Shopify, Stripe).

## Variables applicatives (Next.js)

### Application

| Variable | Requis | Description |
|----------|--------|-------------|
| `NEXT_PUBLIC_APP_URL` | Oui | URL canonique (`http://localhost:3000` en dev) |
| `NEXT_PUBLIC_DEMO_MODE` | Non | `true` = métriques fictives, middleware allégé |

### Supabase

| Variable | Requis | Description |
|----------|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Oui | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Oui | Clé publique (RLS actif) |
| `SUPABASE_SERVICE_ROLE_KEY` | Oui | Serveur uniquement — bypass RLS pour OAuth/sync |

### Shopify

| Variable | Requis | Description |
|----------|--------|-------------|
| `SHOPIFY_API_KEY` | Oui | Client ID Partners |
| `SHOPIFY_API_SECRET` | Oui | Secret HMAC OAuth + webhooks |
| `SHOPIFY_SCOPES` | Oui | Scopes séparés par virgules |
| `SHOPIFY_APP_URL` | Oui | Même base que `NEXT_PUBLIC_APP_URL` |

**Scopes recommandés** :

```
read_orders,read_products,read_customers,read_inventory,read_analytics
```

### Stripe

| Variable | Requis | Description |
|----------|--------|-------------|
| `STRIPE_SECRET_KEY` | Oui | `sk_test_` ou `sk_live_` |
| `STRIPE_WEBHOOK_SECRET` | Oui | `whsec_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Oui | Checkout côté client |
| `STRIPE_PRICE_ID_STARTER` | Oui | ID prix Stripe |
| `STRIPE_PRICE_ID_GROWTH` | Oui | ID prix Stripe |

### OpenAI (legacy / optionnel)

| Variable | Requis | Description |
|----------|--------|-------------|
| `OPENAI_API_KEY` | Non | **Non utilisé** par `/api/ai/chat` actuel |

Le README historique mentionnait OpenAI ; l’AI CFO est **déterministe** via `cfo-answer-engine.ts`.

## Secrets Edge Functions (Supabase)

À définir via `supabase secrets set` :

| Secret | Description |
|--------|-------------|
| `SUPABASE_URL` | URL projet |
| `SUPABASE_SERVICE_ROLE_KEY` | Écriture sync + webhooks |
| `SHOPIFY_API_SECRET` | Vérification HMAC webhooks |
| `SUPABASE_FUNCTIONS_URL` | Base publique des functions, ex. `https://<ref>.functions.supabase.co` |

Utilisé par `register-shopify-webhooks` pour enregistrer les URLs de callback Shopify.

## Cookies applicatifs

| Cookie | Défini par | Rôle |
|--------|------------|------|
| `pilotcfo_onboarding_done` | `POST /api/onboarding/complete` | Middleware perf |
| `pilotcfo_questionnaire_done` | `POST /api/questionnaire/complete` | Middleware perf |
| `pilotcfo_cfo_done` | Questionnaire CFO (client) | Variante questionnaire |
| `pilotcfo_locale` | `POST /api/i18n/locale` | `fr` \| `en` |
| `shopify_oauth_state` | `GET /api/shopify/auth` | Protection CSRF OAuth |
| `shopify_oauth_user` | `GET /api/shopify/auth` | Lien user ↔ OAuth |

## Configuration Supabase Auth

| Paramètre | Production |
|-----------|------------|
| Site URL | `https://app.votredomaine.com` |
| Redirect URLs | `https://app.../auth/callback` |
| JWT expiry | Défaut Supabase (ajuster si besoin SSO) |

## Configuration Shopify Partners (production)

| Champ | Valeur |
|-------|--------|
| App URL | `https://app.votredomaine.com` |
| Redirect | `https://app.../api/shopify/callback` |
| Webhooks | Enregistrés automatiquement par `register-shopify-webhooks` |

Pour le dev local sans HTTPS public : tunnel (**ngrok**, **Cloudflare Tunnel**) pointant vers `:3000`.

## i18n

Langue par défaut : déduite du cookie `pilotcfo_locale`, sinon `settings.preferences.language`, sinon `fr`.

Fichiers : `src/lib/i18n/dictionaries/fr.ts`, `en.ts`.
