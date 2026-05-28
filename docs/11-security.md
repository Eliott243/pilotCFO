# Sécurité

## Modèle de menace (résumé)

| Menace | Mitigation |
|--------|------------|
| Accès données autre tenant | RLS PostgreSQL + `auth.uid()` |
| Token Shopify volé | Stockage serveur, jamais exposé au client |
| OAuth CSRF | Cookie `state` |
| Falsification callback Shopify | HMAC query + webhook HMAC |
| Webhook Stripe forgé | Signature `constructEvent` |
| XSS | React escape par défaut, pas de `dangerouslySetInnerHTML` |
| Injection SQL | Supabase client paramétré |

## Authentification

- **Supabase Auth** : JWT en cookies httpOnly (SSR)
- Middleware rafraîchit la session sur chaque requête protégée
- Mots de passe : politique Supabase (longueur, etc.)

## Autorisation

### Row Level Security

Toutes les tables `public.*` métier ont RLS activé (migration 001 + 003).

Pattern type :

```sql
CREATE POLICY "Users see own data"
  ON public.shopify_orders
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Service role

`SUPABASE_SERVICE_ROLE_KEY` :

- Uniquement côté serveur (API routes, jamais `NEXT_PUBLIC_*`)
- Utilisé pour OAuth callback, sync, webhooks Edge
- **Ne jamais** logger ni renvoyer au navigateur

## Données sensibles

| Donnée | Classification | Stockage |
|--------|----------------|----------|
| `shopify_connections.access_token` | Secret | PostgreSQL, accès service role |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret critique | Env serveur |
| `SHOPIFY_API_SECRET` | Secret | Env + Edge secrets |
| Email utilisateur | PII | `users`, Auth |
| Commandes clients | PII business | `orders`, `shopify_orders` |

## Audit

Table `activity_logs` :

- Actions : connexion Shopify, sync, questionnaire, etc.
- Métadonnées JSON (pas de tokens)
- Index `(user_id, created_at DESC)`

## Headers & HTTPS

Production :

- Forcer HTTPS (Vercel)
- `Secure` cookies
- Envisager CSP, HSTS via `next.config.ts`

## Conformité (orientation)

| Sujet | Statut v1 |
|-------|-----------|
| RGPD | Export/suppression à documenter (Supabase Auth delete user) |
| PCI | Stripe Checkout — pas de carte stockée chez pilotCFO |
| SOC 2 | Dépend hébergeurs (Vercel, Supabase) |

## Bonnes pratiques développement

- Rotation des secrets si commit accidentel
- Reviews sur toute route utilisant service role
- Pas de `NEXT_PUBLIC_*` pour secrets
- Limiter scopes Shopify au minimum nécessaire

## Signalement incidents

Procédure recommandée :

1. Révoquer token Shopify / rotation clés Supabase
2. Analyser `activity_logs` + Supabase Auth logs
3. Notifier utilisateurs affectés si fuite PII confirmée
