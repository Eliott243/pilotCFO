# Référence API

Routes **Next.js App Router** sous `src/app/api/`. Toutes les routes protégées exigent une session Supabase sauf mention contraire.

## Authentification

| Mécanisme | Routes |
|-----------|--------|
| Session cookie Supabase | Majorité |
| Aucune (public) | `/api/stripe/webhook`, `/api/shopify/callback` |
| HMAC Shopify | Webhooks (Edge Functions, pas Next.js) |

## Routes

### Auth & parcours

| Route | Méthode | Description |
|-------|---------|-------------|
| `/auth/callback` | GET | Callback OAuth Supabase (email magic link / OAuth provider) |
| `/api/onboarding/complete` | POST | Marque onboarding terminé + cookie |
| `/api/questionnaire` | GET | Lit profil / réponses questionnaire |
| `/api/questionnaire` | POST | Sauvegarde réponses partielles |
| `/api/questionnaire/complete` | POST | Termine questionnaire + cookies |

### Internationalisation

| Route | Méthode | Body | Description |
|-------|---------|------|-------------|
| `/api/i18n/locale` | POST | `{ "locale": "fr" \| "en" }` | Change langue + cookie |

### Shopify

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/shopify/auth` | GET | `?shop=xxx` → redirect OAuth |
| `/api/shopify/callback` | GET | Callback OAuth (public) |
| `/api/shopify/sync` | POST | Proxy vers Edge Function sync |

### AI CFO

| Route | Méthode | Body | Response |
|-------|---------|------|----------|
| `/api/ai/chat` | POST | `{ "message": string }` | `{ "reply": string }` |

Contraintes :

- `message` requis, max 2000 caractères
- Réponse générée par `answerCfoQuestion()` (pas de streaming)

### Rapports

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/reports/generate` | POST | Génère un rapport structuré en base |

### Stripe

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/stripe/checkout` | POST | Crée session Checkout |
| `/api/stripe/portal` | POST | Portail client Stripe |
| `/api/stripe/webhook` | POST | Événements Stripe (raw body) |

## Exemples

### AI CFO

```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: <session_cookies>" \
  -d '{"message":"Pourquoi ma marge baisse ?"}'
```

```json
{
  "reply": "Sur les 30 derniers jours, …"
}
```

### Sync Shopify

```bash
curl -X POST http://localhost:3000/api/shopify/sync \
  -H "Cookie: <session_cookies>"
```

```json
{
  "success": true,
  "orders": 142,
  "products": 38,
  "customers": 91
}
```

## Codes d'erreur courants

| HTTP | Message type | Cause |
|------|--------------|-------|
| 401 | Non autorisé | Session expirée |
| 404 | Entreprise / boutique introuvable | Parcours incomplet |
| 400 | Message invalide | Validation Zod / taille |
| 500 | Sync failed | Edge Function ou Shopify down |

## Edge Functions (hors Next.js)

Voir [Edge Functions](./07-edge-functions.md). URL pattern :

```
https://<project-ref>.supabase.co/functions/v1/<function-name>
```

## Validation

Les routes utilisent **Zod** ou validations manuelles sur les entrées JSON. Ne pas faire confiance aux champs client pour `user_id` — toujours dériver de `supabase.auth.getUser()`.

## Rate limiting (production)

Non implémenté en v1. Recommandations :

- `/api/ai/chat` : 30 req/min/user
- `/api/shopify/sync` : 1 req/5min/user
- Implémenter via Vercel KV, Upstash, ou middleware
