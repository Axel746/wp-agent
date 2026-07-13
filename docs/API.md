# API interne

Toutes les réponses métier réussies suivent `{ "data": ... }`. Les erreurs suivent `{ "error": { "code", "message", "details?", "correlationId?" } }`. Les mutations exigent une session, l’autorisation RBAC et `X-CSRF-Token` fourni par `GET /api/auth/session`. Les sondes d’infrastructure publiques utilisent un format minimal distinct et ne renvoient aucune valeur de configuration.

| Méthode | Route | Effet |
|---|---|---|
| GET | `/api/health/live` | Confirme que le processus web répond, sans tester ses dépendances |
| GET | `/api/health` | Vérifie la configuration et PostgreSQL ; répond 503 si indisponible |
| POST | `/api/integrations/wordpress/test` | Teste sans stocker les identifiants |
| POST | `/api/integrations/anthropic/test` | Teste le fournisseur Claude actif |
| POST | `/api/integrations/codex/test` | Teste le fournisseur Codex actif |
| GET/POST | `/api/sites` | Liste ou enregistre un WordPress chiffré |
| GET | `/api/sites/:id` | Détail sans secret |
| POST | `/api/sites/:id/snapshot` | Capture site, contenus, médias, plugins, thèmes et types |
| GET/POST | `/api/projects` | Liste ou crée un projet validé par Zod |
| GET | `/api/projects/:id` | Projet, mémoire, run, approbations et artefacts |
| POST | `/api/projects/:id/runs` | Crée/reprend idempotemment un run et l’enfile |
| GET | `/api/projects/:id/runs/:runId` | État persistant et usage |
| POST | `/api/projects/:id/runs/:runId/pause` | Pause persistante |
| POST | `/api/projects/:id/runs/:runId/resume` | Reprise et ré-enfilage |
| POST | `/api/projects/:id/runs/:runId/cancel` | Demande d’annulation sûre |
| GET | `/api/projects/:id/messages` | Historique ordonné |
| GET | `/api/projects/:id/events` | Flux SSE avec reconnexion |
| POST | `/api/approvals/:id/approve` | Décision humaine et transition atomique |
| POST | `/api/approvals/:id/reject` | Refus commenté et annulation |
| GET | `/api/artifacts/:id` | Télécharge après contrôle de périmètre |
| GET/POST | `/api/deployments` | Historique ou plan avec approbation |
| POST | `/api/deployments/:id/rollback` | Demande une restauration si possible |

Les clés d’idempotence sont uniques par projet pour les runs et déploiements. Les écritures WordPress utilisent aussi une clé dérivée par ressource et mettent à jour une page de même slug au lieu de la dupliquer.
