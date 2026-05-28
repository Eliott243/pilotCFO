# Edge Functions (Supabase)

Runtime **Deno** déployé sur Supabase Edge. Responsables de la sync paginée et des webhooks Shopify (charge hors Next.js).

## Liste des functions

| Function | Méthode | Auth | Rôle |
|----------|---------|------|------|
| `sync-shopify-data` | POST | Bearer JWT user | Sync 12 mois → `shopify_*` |
| `register-shopify-webhooks` | POST | Bearer JWT user | Enregistre 6 webhooks Shopify |
| `webhooks-orders-create` | POST | HMAC Shopify | Nouvelle commande |
| `webhooks-orders-updated` | POST | HMAC Shopify | Mise à jour commande |
| `webhooks-orders-cancelled` | POST | HMAC Shopify | Annulation |
| `webhooks-refunds-create` | POST | HMAC Shopify | Remboursement |
| `webhooks-products-update` | POST | HMAC Shopify | Produit modifié |
| `webhooks-app-uninstalled` | POST | HMAC Shopify | Déconnexion app |

## Code partagé

```
supabase/functions/_shared/
├── shopify.ts      # fetchAllPages, Admin API
├── supabase.ts     # getServiceSupabase()
└── webhooks.ts     # verifyShopifyWebhook (HMAC SHA-256)
```

## Déploiement

```bash
supabase link --project-ref <ref>

supabase secrets set SUPABASE_URL=...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
supabase secrets set SHOPIFY_API_SECRET=...
supabase secrets set SUPABASE_FUNCTIONS_URL=https://<ref>.functions.supabase.co

supabase functions deploy sync-shopify-data
# … répéter pour chaque function
```

## Invocation depuis l'app

### Client Supabase (recommandé UI)

```typescript
await supabase.functions.invoke("sync-shopify-data", {
  body: { shop_id: connectionId },
});
```

Le SDK envoie automatiquement le JWT session.

### Fetch direct (API route)

```typescript
fetch(`${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-shopify-data`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ shop_id }),
});
```

## Contrat `sync-shopify-data`

**Request**

```json
{
  "shop_id": "uuid-de-shopify_connections"
}
```

**Headers**

```
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
```

**Réponses**

| Code | Signification |
|------|---------------|
| 200 | Sync terminée, counts dans body |
| 401 | JWT manquant/invalide |
| 403 | `shop_id` n’appartient pas à l’utilisateur |
| 404 | Connexion ou boutique introuvable |
| 500 | Erreur Shopify ou DB (`sync_error` renseigné) |

**Autorisation** : la function vérifie la chaîne  
`shopify_connections` → `stores` → `companies.user_id === jwt.sub`.

## Contrat `register-shopify-webhooks`

**Request**

```json
{
  "shop_id": "uuid",
  "supabase_functions_url": "https://<ref>.functions.supabase.co"
}
```

Enregistre chaque webhook avec URL :

```
{supabase_functions_url}/webhooks-orders-create
```

## Webhooks entrants

Shopify envoie :

- Header `X-Shopify-Hmac-Sha256`
- Body JSON brut (important pour HMAC — ne pas re-parser avant vérif)

Les functions **n’utilisent pas** le JWT Supabase ; seule la signature HMAC fait foi.

## Logs & monitoring

```bash
supabase functions logs sync-shopify-data --tail
```

En production : brancher Supabase Logs → Datadog / alertes sur taux d’erreur 5xx.

## CORS

Les webhooks Shopify sont server-to-server (pas de CORS navigateur). L’invoke depuis le navigateur passe par le domaine Supabase (config CORS Supabase par défaut pour functions).

## Développement local

```bash
supabase functions serve sync-shopify-data --env-file .env.local
```

Adapter `SUPABASE_FUNCTIONS_URL` vers l’URL locale exposée si test webhooks via tunnel.
