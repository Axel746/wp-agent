# Déploiement sur Hostinger

Deux topologies sont possibles. Le choix dépend du produit Hostinger réellement disponible.

## Option recommandée pour le MVP complet : VPS

Un VPS permet d’exécuter le web Next.js, le worker pg-boss, PostgreSQL, MariaDB et le WordPress local de validation. C’est la topologie la plus proche de l’environnement `docker-compose.yml` et la seule qui conserve toutes les fonctions locales du MVP sur une même machine.

Le déploiement devra exposer uniquement l’application web derrière HTTPS. PostgreSQL, MariaDB, Docker et le port du worker restent privés. Le répertoire défini par `ARTIFACTS_DIR` doit être placé sur un volume persistant et sauvegardé.

## Hébergement Web ou Cloud géré

Hostinger prend en charge Next.js, pnpm et Node.js 24 depuis un dépôt GitHub. La file pg-boss réutilise PostgreSQL et supprime le besoin d’un service Redis. Pour le faible volume du MVP, le lanceur `scripts/hostinger-runtime.mjs` exécute le web et le worker dans la même Web App. Cette topologie exige encore :

- un PostgreSQL externe compatible Prisma, par exemple Supabase ;
- un processus Node permanent ; le lanceur Hostinger supervise le web et le worker ensemble ;
- un stockage d’artefacts persistant partagé entre le web et le worker ;
- un WordPress de destination distant, car le WordPress Docker local ne peut pas être lancé par l’application gérée.

Ne déployez pas uniquement le web en pensant que les workflows avanceront : sans worker connecté à la même base PostgreSQL et au même stockage d’artefacts, les travaux resteront dans la file.

## Réglages de construction

Depuis la racine du dépôt :

```text
Préréglage : Other
Branche : branche de livraison validée
Node.js : 24.x
Gestionnaire : pnpm
Répertoire racine : ./
Commande de build : pnpm hostinger:build
Répertoire de sortie : .
Fichier d’entrée : scripts/hostinger-runtime.mjs
Sonde de vie : /api/health/live
Sonde de disponibilité : /api/health
```

`pnpm hostinger:build` génère le client Prisma et construit le web ainsi que le worker. Au démarrage, le lanceur applique les migrations, initialise le compte administrateur de façon idempotente, puis garde Next.js et le worker pg-boss actifs. Si l’un des deux processus tombe, l’application est arrêtée afin que Hostinger puisse la redémarrer proprement.

Le pack Web App ne fournit pas de commande de release séparée : `pnpm db:migrate` et `pnpm db:seed` sont donc exécutés avant les deux processus à chaque démarrage. Ces opérations sont idempotentes ; un échec empêche l’application de démarrer avec un schéma incohérent.

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
