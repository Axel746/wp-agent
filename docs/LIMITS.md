# Limites du MVP

- Le stockage d’artefacts est local derrière une interface ; S3 n’est pas encore implémenté.
- Le déploiement distant automatique d’un thème/plugin nécessite SSH/WP‑CLI, est désactivé par défaut et demande un durcissement propre à l’hébergeur. Le ZIP manuel reste toujours disponible.
- L’authentification MVP est locale et mono-facteur ; SSO, invitation et récupération de mot de passe ne sont pas inclus.
- Les coûts Codex ne sont affichés que si le SDK les expose ; ils restent nuls en mock.
- `AUTOMATED_TESTS` exécute des contrôles réels et déterministes sur le thème généré (intégrité de l’archive, validité de `theme.json`, structure de `functions.php`, équilibre des commentaires de bloc) ; il n’exécute pas de navigateur. `STAGING_VALIDATION` lance un vrai navigateur Playwright headless contre le WordPress local une fois le thème installé, et capture les erreurs console, les liens cassés et un score d’accessibilité réel (calculé sur le DOM rendu). Pour une cible distante, le contenu reste en brouillon et cette validation en direct n’est pas exécutée : le score d’accessibilité et les rapports Playwright restent absents (« — » côté interface) plutôt que fabriqués.
- La restauration automatisée n’est exécutée que lorsqu’un `DeploymentChange.rollbackData` ou une sauvegarde existe. Sinon l’API refuse l’action.
- Les limites CPU/mémoire d’un Codex conteneurisé dépendent du déploiement ; le chemin recommandé du MVP est le worker hôte sandboxé par le SDK.
