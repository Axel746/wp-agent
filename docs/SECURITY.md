# Guide de sécurité

## Secrets

Les secrets sont isolés dans `IntegrationSecret`, chiffrés par AES‑256‑GCM avec un IV aléatoire de 96 bits et une donnée associée versionnée. `ENCRYPTION_KEY` doit être une valeur base64 de 32 octets et provenir exclusivement de l’environnement. La révocation renseigne `revokedAt`; un secret révoqué n’est plus utilisable. Les logs Pino masquent les en-têtes, cookies, mots de passe, clés et jetons récursivement.

## Frontière réseau

Les URL WordPress acceptent seulement HTTP(S), interdisent les identifiants dans l’URL, exigent HTTPS en production, résolvent DNS avant l’appel et après chaque redirection, bloquent localhost, réseaux privés, link-local, multicast et métadonnées cloud. Les cibles privées exigent à la fois une option du site et `ENABLE_PRIVATE_NETWORK_TARGETS=true`. Les appels ont un timeout, trois redirections maximum et une limite de taille.

La connexion TCP/TLS est épinglée sur l’adresse IP déjà validée (dispatcher `undici` avec `lookup` personnalisé) : `fetch` ne refait jamais sa propre résolution DNS au moment de se connecter, ce qui ferme la fenêtre de contournement par DNS rebinding entre la validation et l’appel réel.

## Autorisations

Les rôles ADMIN, EDITOR et VIEWER sont vérifiés côté serveur. Les mutations vérifient l’origine et un jeton CSRF lié à la session. Les cookies de session sont HttpOnly, SameSite=Strict et Secure en production. Les deux portes d’approbation exigent un acteur `user`; un modèle ne peut pas déclencher une transition destructive.

## Agents et prompt injection

Le contenu WordPress est marqué non fiable, séparé du contexte système et ne peut pas devenir une instruction. Le sélecteur borne la taille, conserve la provenance et masque les secrets. Codex reçoit un workspace isolé sans fichier `.env`, en mode `workspace-write` et sans réseau. Claude ne reçoit jamais les secrets d’intégration.

## WP-CLI et plugin

La garde de commande refuse les opérateurs shell et n’accepte qu’une liste fixe d’opérations WP‑CLI. Le plugin compagnon expose santé, capacités et journal, avec `permission_callback`. Il n’écrit aucun fichier et n’exécute aucun PHP ou processus arbitraire.

En production, remplacez les identifiants de démonstration, utilisez un gestionnaire de secrets, terminez TLS devant Next.js, limitez l’accès PostgreSQL au réseau privé et sauvegardez les volumes. Le rôle PostgreSQL doit pouvoir gérer le schéma `PG_BOSS_SCHEMA`, sans recevoir de privilèges superutilisateur.
