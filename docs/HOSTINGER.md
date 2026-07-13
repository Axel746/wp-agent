# Déploiement sur Hostinger

Deux topologies sont possibles. Le choix dépend du produit Hostinger réellement disponible.

## Option recommandée pour le MVP complet : VPS

Un VPS permet d’exécuter le web Next.js, le worker pg-boss, PostgreSQL, MariaDB et le WordPress local de validation. C’est la topologie la plus proche de l’environnement `docker-compose.yml` et la seule qui conserve toutes les fonctions locales du MVP sur une même machine.

Le déploiement devra exposer uniquement l’application web derrière HTTPS. PostgreSQL, MariaDB, Docker et le port du worker restent privés. Le répertoire défini par `ARTIFACTS_DIR` doit être placé sur un volume persistant et sauvegardé.

## Hébergement Web ou Cloud géré

Hostinger prend en charge Next.js, pnpm et Node.js 24 depuis un dépôt GitHub. La file pg-boss réutilise PostgreSQL et supprime le besoin d’un service Redis. Cette topologie exige encore :

- un PostgreSQL externe compatible Prisma, par exemple Supabase ;
- un worker pg-boss permanent, exécuté dans un processus Node compatible ou sur un service séparé ;
- un stockage d’artefacts persistant partagé entre le web et le worker ;
- un WordPress de destination distant, car le WordPress Docker local ne peut pas être lancé par l’application gérée.

Ne déployez pas uniquement le web en pensant que les workflows avanceront : sans worker connecté à la même base PostgreSQL et au même stockage d’artefacts, les travaux resteront dans la file.

## Réglages de construction

Depuis la racine du dépôt :

```text
Node.js : 24.x
Gestionnaire : pnpm
Commande de build : pnpm hostinger:build
Commande de démarrage : pnpm hostinger:start
Port : 3000
Sonde de vie : /api/health/live
Sonde de disponibilité : /api/health
```

`pnpm hostinger:build` génère le client Prisma et construit uniquement l’application web. Le worker doit être construit et lancé séparément avec `pnpm --filter @wp-agent-studio/worker build` puis `pnpm --filter @wp-agent-studio/worker start`.

Exécutez `pnpm db:migrate` comme étape contrôlée avant le premier démarrage et lors des versions contenant une migration. Une migration ne doit pas être cachée dans le démarrage normal de l’application.

## Variables et vérification préalable

Ajoutez les variables dans hPanel ; ne téléversez jamais le vrai fichier `.env` dans GitHub. Avant le déploiement, exécutez :

```text
pnpm check:production
```

Le contrôle vérifie l’URL PostgreSQL, le schéma pg-boss, HTTPS pour `APP_URL`, les secrets de session et de chiffrement, le stockage et les paramètres des fournisseurs réels. Il n’affiche jamais la valeur des secrets.

Pour `AGENT_MODE=real`, l’environnement Hostinger géré doit utiliser `OPENAI_API_KEY` : il ne faut pas compter sur une session Codex locale persistante. Conservez `ENABLE_PRIVATE_NETWORK_TARGETS=false` et `ENABLE_REMOTE_DEPLOYMENT=false` jusqu’à la validation explicite du réseau et de la stratégie de sauvegarde.

## Contrôle après mise en ligne

1. Vérifier que `/api/health/live` répond avec un statut HTTP 200.
2. Vérifier que `/api/health` répond avec un statut HTTP 200 et que les trois contrôles sont à `ok`.
3. Appliquer la migration puis créer le premier compte avec un mot de passe unique.
4. Lancer un workflow en mode `mock` et confirmer que le worker le consomme.
5. Tester les deux approbations et télécharger le ZIP généré.
6. Activer les fournisseurs réels seulement après ce test déterministe.

## Références Hostinger

- [Déployer une application Node.js depuis GitHub](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)
- [Configurer les variables d’environnement](https://www.hostinger.com/support/how-to-add-environment-variables-during-node-js-application-deployment/)
- [Connecter une base PostgreSQL Supabase](https://www.hostinger.com/support/connecting-a-supabase-database-to-a-hostinger-node-js-application/)
- [File PostgreSQL pg-boss](https://github.com/timgit/pg-boss)
