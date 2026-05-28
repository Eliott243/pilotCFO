# Dépannage

## Authentification & parcours

### Boucle redirect login ↔ dashboard

**Symptôme** : impossible d’accéder au dashboard, retour login.

**Causes** :

- `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` incorrects
- Redirect URL Supabase Auth non configurée

**Fix** : vérifier Auth → URL Configuration ; vider cookies ; reconnecter.

### Renvoyé vers onboarding / questionnaire en boucle

**Symptôme** : après le questionnaire, retour onboarding.

**Causes** :

- Flags `onboarding_completed` / `questionnaire_completed` non mis à jour
- Cookies bloqués

**Fix** :

1. Compléter via UI jusqu’au bout
2. Vérifier `POST /api/questionnaire/complete` (network tab)
3. Cookies `pilotcfo_onboarding_done`, `pilotcfo_questionnaire_done` présents
4. En SQL : `UPDATE users SET onboarding_completed=true, questionnaire_completed=true WHERE id='...'`

### « L’app redémarre » après la question 6

**Symptôme** : retour début questionnaire.

**Fix appliqué en code** : cookies `pilotcfo_cfo_done` + middleware exempt. Mettre à jour vers dernier commit ; vider cache.

## Shopify

### « Store unavailable » / domaine invalide

**Cause** : pas une boutique Shopify réelle.

**Fix** :

1. Partners → **Stores** → Create development store
2. Utiliser exactement `nom.myshopify.com`
3. Ouvrir `/admin` pour confirmer

### `?error=oauth` après connexion

| Paramètre | Cause |
|-----------|--------|
| `oauth` | State cookie manquant ou code invalide |
| `hmac` | Secret Shopify incorrect |
| `sync` | Erreur post-token (DB, scopes) |

**Fix** : vérifier `SHOPIFY_API_SECRET`, redirect URI, logs serveur.

### Sync échoue (🔴 Sync failed)

**Checks** :

1. Edge Function `sync-shopify-data` déployée ?
2. `shopify_connections.sync_error` en SQL
3. Logs : `supabase functions logs sync-shopify-data`
4. Token révoqué ? Reconnecter OAuth

### Webhooks non reçus

1. `register-shopify-webhooks` status dans UI Settings
2. `SUPABASE_FUNCTIONS_URL` secret défini
3. Partners → app → API access → webhooks listés
4. HMAC : `SHOPIFY_API_SECRET` identique partout

## Données & dashboards

### Dashboards vides après sync réussie

**Cause probable** : sync v2 écrit dans `shopify_*` mais `getStoreMetrics()` lit `orders` / `products` legacy.

**Fix court terme** : relancer connexion OAuth (sync legacy) ou brancher metrics sur `shopify_*` (dev).

**Vérification SQL** :

```sql
SELECT COUNT(*) FROM shopify_orders WHERE user_id = '<uuid>';
SELECT COUNT(*) FROM orders WHERE store_id = '<store_uuid>';
```

### Métriques « démo » alors que Shopify connecté

**Cause** : `NEXT_PUBLIC_DEMO_MODE=true`

**Fix** : retirer ou `false` dans `.env.local` / Vercel ; redémarrer.

## AI CFO

### « Je n’ai pas encore assez de données »

- Shopify non connecté
- Sync jamais lancée
- Tables `orders` vides (voir section dashboards vides)

### Réponses génériques

Normal si la question ne match aucun intent. Reformuler avec mots-clés : marge, Meta, risque, embauche.

## Stripe

### Webhook 400 / signature invalid

- `STRIPE_WEBHOOK_SECRET` ne correspond pas à l’endpoint
- Body parsé avant vérif (ne pas utiliser `JSON.parse` middleware sur cette route)

### Abonnement pas mis à jour

Vérifier logs `/api/stripe/webhook` ; event types activés ; ligne `subscriptions` pour `user_id`.

## Performance

### Navigation lente

Ancienne version : middleware requêtait DB à chaque page. Version actuelle : cookies de flow. Mettre à jour le déploiement.

## Logs utiles

| Zone | Commande / emplacement |
|------|------------------------|
| Next.js local | Terminal `npm run dev` |
| Vercel | Dashboard → Logs |
| Supabase DB | Dashboard → Logs → Postgres |
| Edge Functions | `supabase functions logs <name> --tail` |
| Shopify | Partners → app → API health |

## Checklist support niveau 1

1. URL exacte + capture écran erreur
2. `user.id` (masqué en public)
3. `shopify_connections.sync_status`, `sync_error`
4. Count `shopify_orders` vs `orders`
5. Version commit / date déploiement
6. Navigateur + cookies tiers bloqués ?
