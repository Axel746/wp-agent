# Limites du MVP

- Le stockage d’artefacts est local derrière une interface ; S3 n’est pas encore implémenté.
- Le déploiement distant automatique d’un thème/plugin nécessite SSH/WP‑CLI, est désactivé par défaut et demande un durcissement propre à l’hébergeur. Le ZIP manuel reste toujours disponible.
- L’authentification MVP est locale et mono-facteur ; SSO, invitation et récupération de mot de passe ne sont pas inclus.
- Les coûts Codex ne sont affichés que si le SDK les expose ; ils restent nuls en mock.
- Les captures Playwright et le score d’accessibilité affichent le dernier rapport disponible. Une exécution sans navigateur conserve « — » au lieu d’inventer une valeur.
- La restauration automatisée n’est exécutée que lorsqu’un `DeploymentChange.rollbackData` ou une sauvegarde existe. Sinon l’API refuse l’action.
- Les limites CPU/mémoire d’un Codex conteneurisé dépendent du déploiement ; le chemin recommandé du MVP est le worker hôte sandboxé par le SDK.
