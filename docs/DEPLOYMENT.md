# Guide de déploiement

## Local géré

`docker compose up -d` démarre PostgreSQL, MariaDB et WordPress avec healthchecks. Au premier démarrage du web ou du worker, pg-boss crée ou met à niveau son schéma PostgreSQL puis configure la file idempotente. Au premier déploiement approuvé, le worker attend WordPress, lance l’installation WP‑CLI si nécessaire, installe le ZIP exact depuis le volume d’artefacts puis l’active. L’URL par défaut est `http://localhost:8080`.

## WordPress distant

Le MVP publie les contenus via l’API REST et les crée en brouillon. Avant l’écriture, il vérifie `edit_pages`/`edit_posts`, affiche le plan, exige une approbation, réutilise les slugs pour l’idempotence et enregistre les réponses exactes. Le ZIP du thème est toujours téléchargeable pour installation manuelle.

Le chemin SSH/WP‑CLI reste fermé tant que `ENABLE_REMOTE_DEPLOYMENT=false`. Lorsqu’il est activé, il doit utiliser un utilisateur dédié, une sauvegarde préalable et la liste blanche définie dans le paquet sécurité. Aucune commande produite par un modèle n’est acceptée telle quelle.

## Application

Construisez avec `pnpm build`. Les Dockerfiles `infra/docker/Dockerfile.web` et `Dockerfile.worker` sont fournis. Le worker hôte est recommandé si Codex utilise une authentification locale. Exposez seulement le web derrière HTTPS ; PostgreSQL, MariaDB et Docker ne doivent pas être publics.

Les sondes non authentifiées `GET /api/health/live` et `GET /api/health` exposent respectivement la vie du processus et la disponibilité de la configuration et de PostgreSQL. La file partage cette même connexion via l’adaptateur Prisma officiel de pg-boss. Les sondes ne renvoient ni exception ni valeur de secret. Pour Hostinger, consultez le [guide dédié](HOSTINGER.md).
