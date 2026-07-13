# Guide de restauration

1. Mettez le run en pause et identifiez le déploiement par son identifiant et son `correlationId`.
2. Vérifiez que `rollbackData` ou `backupArtifactId` existe. L’API refuse une restauration sans donnée vérifiée.
3. Demandez la restauration avec `POST /api/deployments/:id/rollback`; cela crée une approbation humaine, jamais une action directe.
4. Pour les contenus REST, restaurez les valeurs `before` conservées dans `DeploymentChange`, en gardant les contenus en brouillon jusqu’à validation.
5. Pour un thème via WP‑CLI, restaurez la sauvegarde, réactivez le thème précédent avec une commande autorisée, puis contrôlez santé et pages clés.
6. Conservez le résultat exact et marquez le déploiement `ROLLED_BACK` seulement après vérification.

Pour réinitialiser uniquement l’instance de démonstration locale : `docker compose down --volumes`, puis relancez le bootstrap. Cette commande détruit les données locales et ne doit pas être utilisée sur un environnement partagé.

Une sauvegarde PostgreSQL de production doit inclure le schéma métier et le schéma défini par `PG_BOSS_SCHEMA` (par défaut `pgboss`). Après restauration, démarrez d’abord le worker : pg-boss vérifie sa version de schéma et reprend les travaux créés ou en retry. Examinez les runs actifs avant de réautoriser les déploiements.
