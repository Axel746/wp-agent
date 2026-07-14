# WP Agent Studio

WP Agent Studio orchestre explicitement Claude et Codex pour spécifier, construire, tester et déployer des sites WordPress. Les agents ne se contactent jamais directement : chaque message, transition et approbation passe par l’application et est persisté.

Le mode par défaut `AGENT_MODE=mock` exécute un workflow déterministe sans appel payant. Il produit une spécification réaliste, un plan, un thème de blocs installable, un ZIP avec empreinte SHA‑256 et une revue, puis s’arrête aux deux approbations humaines.

## Prérequis

- Node.js 22.12 ou 24 LTS et Git ;
- pnpm 11.7+ ;
- Docker Desktop avec Compose pour PostgreSQL, MariaDB et WordPress ;
- 4 Go de mémoire disponible pour les conteneurs.

## Démarrage local

```text
copy .env.example .env
pnpm install
docker compose up -d postgres mariadb wordpress
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Ouvrez `http://localhost:3000`. Par défaut après le seed : `admin@wp-agent.local` / `change-me`. Changez immédiatement ces valeurs hors d’une machine locale.

Le `.env` de la racine est chargé automatiquement par le web, le worker et les commandes Prisma (`db:generate`, `db:migrate`, `db:seed`) via `process.loadEnvFile`, même si leur processus s’exécute dans un sous-dossier du monorepo.

Le script PowerShell `./infra/scripts/bootstrap.ps1` automatise les mêmes étapes. Le worker Codex doit généralement tourner directement sur la machine hôte pour réutiliser un environnement Codex déjà authentifié et pour créer ses workspaces isolés. Il n’a pas besoin d’être placé dans Docker.

## Commandes

```text
pnpm install
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
RUN_INTEGRATION=true pnpm test
pnpm test:e2e
pnpm build
```

## Parcours de démonstration

1. Connectez-vous et ouvrez « Nouveau projet ».
2. Choisissez « WordPress local » ou un site distant déjà connecté.
3. Lancez le workflow sur la page du projet.
4. Suivez Claude, Codex et le système dans la Salle des agents.
5. Approuvez le plan. Codex génère le thème et le ZIP ; Claude le relit.
6. Examinez les artefacts et approuvez le déploiement.
7. Pour une cible locale, Docker démarre WordPress et installe réellement le thème. Pour une cible distante, les pages approuvées sont réellement créées en brouillon via REST. Un succès n’est enregistré qu’après la réponse réelle.

## Fournisseurs réels

Passez `AGENT_MODE=real`, puis définissez `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` et `CODEX_MODEL`. `OPENAI_API_KEY` ou l’authentification locale Codex peut être utilisée selon l’environnement. Aucun modèle n’est codé en dur. Le SDK Codex officiel est exécuté uniquement côté worker, dans `ARTIFACTS_DIR/workspaces/<project>/<run>`, réseau désactivé. La bibliothèque TypeScript Codex est documentée pour un usage serveur avec Node.js 18+ : [documentation officielle Codex SDK](https://developers.openai.com/codex/sdk/).

## Structure principale

```text
apps/web                 Interface Next.js, API, SSE et tests Playwright
apps/worker              Worker pg-boss, verrou projet et persistance du workflow
packages/database        Prisma 7, migration et seed
packages/job-queue       File PostgreSQL pg-boss, retries, heartbeat et idempotence
packages/shared          Contrats Zod et erreurs normalisées
packages/security        AES-256-GCM, RBAC, CSRF, SSRF, redaction, commandes
packages/wordpress       REST, Docker local, thème de blocs et ZIP
packages/agent-providers Adaptateurs mock, Anthropic et Codex SDK
packages/orchestrator    Machine à états, contexte, mémoire et artefacts
packages/observability   Logs Pino structurés et masqués
wordpress/               Plugin compagnon et thème d’exemple
infra/                    Dockerfiles et scripts
docs/                     Architecture, API, sécurité et exploitation
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API interne](docs/API.md)
- [Sécurité](docs/SECURITY.md)
- [Déploiement](docs/DEPLOYMENT.md)
- [Déploiement Hostinger](docs/HOSTINGER.md)
- [Restauration](docs/RESTORE.md)
- [Limites du MVP](docs/LIMITS.md)

Les versions Docker retenues ont été vérifiées dans les images officielles : WordPress 7.0/PHP 8.3, PostgreSQL 18.4 Alpine et MariaDB 11.8.8. Prisma 7 utilise l’adaptateur PostgreSQL explicite exigé par sa documentation actuelle.
