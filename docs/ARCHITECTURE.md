# Architecture

```mermaid
flowchart LR
    U["Utilisateur"] --> W["Next.js Web + API"]
    W --> P[("PostgreSQL métier + pg-boss")]
    P --> K["Worker hôte"]
    K --> O["Orchestrateur explicite"]
    O --> C["Claude provider"]
    O --> X["Codex provider"]
    X --> G["Workspace Git isolé"]
    O --> A["Stockage local d’artefacts"]
    O --> WP["WordPressConnector"]
    WP --> L["WordPress local Docker"]
    WP --> D["WordPress distant REST"]
    W -. "SSE" .-> U
```

Le web ne reçoit jamais un secret déchiffré. Le worker charge les secrets seulement au moment de l’opération WordPress. Claude reçoit le brief et les rapports utiles ; Codex reçoit la spécification et travaille dans un répertoire dédié. Les contenus distants sont placés dans une section non fiable du contexte.

```mermaid
stateDiagram-v2
    [*] --> INTAKE
    INTAKE --> WORDPRESS_SNAPSHOT
    WORDPRESS_SNAPSHOT --> SPECIFICATION_BY_CLAUDE
    SPECIFICATION_BY_CLAUDE --> TECHNICAL_PLAN_BY_CODEX
    TECHNICAL_PLAN_BY_CODEX --> PLAN_REVIEW_BY_CLAUDE
    PLAN_REVIEW_BY_CLAUDE --> WAITING_FOR_PLAN_APPROVAL
    WAITING_FOR_PLAN_APPROVAL --> IMPLEMENTATION_BY_CODEX: approbation humaine
    IMPLEMENTATION_BY_CODEX --> AUTOMATED_TESTS
    AUTOMATED_TESTS --> REVIEW_BY_CLAUDE: succès
    AUTOMATED_TESTS --> FIXES_BY_CODEX: échec
    REVIEW_BY_CLAUDE --> FIXES_BY_CODEX: corrections
    FIXES_BY_CODEX --> AUTOMATED_TESTS
    REVIEW_BY_CLAUDE --> WAITING_FOR_DEPLOYMENT_APPROVAL: conforme
    WAITING_FOR_DEPLOYMENT_APPROVAL --> STAGING_DEPLOYMENT: approbation humaine
    STAGING_DEPLOYMENT --> STAGING_VALIDATION
    STAGING_VALIDATION --> COMPLETED: cible locale
    STAGING_VALIDATION --> PRODUCTION_DEPLOYMENT: cible distante
    PRODUCTION_DEPLOYMENT --> COMPLETED
    INTAKE --> CANCELLED
    STAGING_DEPLOYMENT --> FAILED
```

Chaque transition vérifie une version optimiste, écrit un `AuditLog` et accepte un rejeu idempotent vers le même état. pg-boss utilise un schéma PostgreSQL séparé, des retries exponentiels, un heartbeat et une clé singleton par run. `JobLock` garantit en plus une seule mutation active par projet et expire automatiquement.
