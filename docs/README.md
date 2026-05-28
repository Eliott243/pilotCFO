# Documentation pilotCFO

Documentation technique et produit pour **pilotCFO** — CFO virtuel pour marchands Shopify.

| Document | Public | Description |
|----------|--------|-------------|
| [Vue produit](./01-product.md) | Produit, investisseurs | Positionnement, fonctionnalités, parcours |
| [Architecture](./02-architecture.md) | Développeurs, ops | Stack, flux de données, composants |
| [Installation](./03-installation.md) | Développeurs | Setup local, prérequis, migrations |
| [Configuration](./04-configuration.md) | Développeurs, ops | Variables d'environnement, secrets |
| [Base de données](./05-database.md) | Développeurs | Schéma, RLS, migrations |
| [Intégration Shopify](./06-shopify.md) | Développeurs | OAuth, sync, webhooks |
| [Edge Functions](./07-edge-functions.md) | Développeurs, ops | Déploiement Supabase, sync v2 |
| [Référence API](./08-api.md) | Développeurs | Routes Next.js, contrats |
| [Moteur CFO](./09-cfo-engine.md) | Produit, data | Calculs, métriques, AI CFO |
| [Facturation Stripe](./10-stripe.md) | Développeurs | Plans, webhooks, portail |
| [Sécurité](./11-security.md) | Sécurité, ops | Auth, RLS, conformité |
| [Déploiement](./12-deployment.md) | Ops | Vercel, Supabase, production |
| [Guide utilisateur](./13-user-guide.md) | Clients finaux | Parcours non technique |
| [Dépannage](./14-troubleshooting.md) | Support, ops | Erreurs fréquentes |

## Démarrage rapide

```bash
git clone https://github.com/Eliott243/pilotCFO.git
cd pilotCFO
cp .env.example .env.local
npm install
npm run dev
```

Voir [Installation](./03-installation.md) et [Configuration](./04-configuration.md) pour le détail complet.

## Support

- Dépôt : [github.com/Eliott243/pilotCFO](https://github.com/Eliott243/pilotCFO)
- Problèmes courants : [Dépannage](./14-troubleshooting.md)
