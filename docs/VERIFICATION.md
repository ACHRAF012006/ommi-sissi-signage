# Vérification de livraison

## Version 1.0.2 — installation de Git en premier

- `install-git.sh` fonctionne seul, avant le clonage du dépôt, sans Node.js ni fichiers du projet. Il installe Git avec pacman ou apt si nécessaire et ignore une installation déjà disponible.
- `install.sh` appelle ce script avant la vérification de Node.js et l’installation des dépendances.
- Tests avec gestionnaire de paquets simulé : Git absent, Git déjà installé, erreurs de paquets, arguments invalides et ordre Git avant Node.js vérifiés. Aucun paquet système réel n’est modifié par les tests.
- `npm test` : 36 tests réussis sous CachyOS ; syntaxe Bash et `git diff --check` validés. GitHub Actions vérifie également la branche apt sur Ubuntu.

## Version 1.0.1 — démarrage au boot par défaut

- L’installation Linux active explicitement le service au boot, y compris après réinstallation, sans basculer un service déjà activé vers l’état désactivé.
- `--no-autostart` ignore la configuration systemd et conserve son état actuel.
- Test d’intégration avec gestionnaire de services simulé : installation, réinstallation, conservation de `.env`, opt-out, conflit avec une autre installation et erreurs d’arguments vérifiés. Aucun service réel n’est modifié par les tests.
- `npm test` : 33 tests réussis sous CachyOS ; syntaxe Bash et `git diff --check` validés.
- Le serveur démarre au prochain boot ; `./start.sh` permet de le démarrer immédiatement après installation.

## Préparation du dépôt public — 8 octobre 2026

Vérifications sur une copie propre du code, séparée des données locales, sous CachyOS avec Node.js 24.21.0 et npm 12.2.0 :

- `npm ci` puis `npm test` : 32 tests réussis, aucun échec ni test ignoré.
- `./install.sh` avec les dépendances de production : installation réussie ; nouveau `.env` avec secret aléatoire, base vide, aucun compte ni magasin préinstallé.
- `./start.sh` : `/health`, `/`, `/admin/login` et `/display` répondent en HTTP 200 ; arrêt propre par SIGTERM.
- `bash -n` : syntaxe des scripts Linux validée.
- Fichiers Git vérifiés : configuration privée, bases, uploads, logs, sauvegardes et `node_modules` exclus.
- Installation SQLite explicitement autorisée pour la version verrouillée avec npm 12 (`allowScripts` dans `package.json`).

Le workflow GitHub Actions vérifie les scripts, l'installation propre et les tests sur Ubuntu 24.04 avec Node.js 24 et npm 11/12. Son statut est disponible dans l'onglet Actions du dépôt.

## Vérifications précédentes

Vérifications initiales le 5 octobre 2026, lecteur et tests automatisés revérifiés le 6 octobre 2026 sur Linux (CachyOS/Arch), Node.js 24.21.0, Chromium headless via Playwright.

| Vérification | Résultat |
|---|---|
| `npm install` | Réussi |
| `npm run init-db` répété | Réussi ; données existantes conservées |
| `npm test` | 32 tests réussis |
| `npm run test:admin-browser` | Connexion avec ancien module en cache, routes admin, récupération après échec, plein écran et emplacement du bouton validés |
| Scripts Linux | Bash validé, service généré validé par systemd-analyze, toggle simulé on/off/statut et protections de dossier, arrêt réel de processus de test foreground/watch, démarrage/arrêt systemd et sélection PM2 simulés, démarrage réel isolé et refus des doublons validés ; serveur métier conservé |
| `npm audit` | 0 vulnérabilité signalée |
| `npm run test:browser` | Réussi, fichiers vidéo réels |
| Image A / vidéo B / image C / vidéo D | 5,02 / 97,00 / 8,02 / 20,00 secondes |
| Fin des vidéos | `ended` reçu ; `currentTime` = durée complète |
| Mise à jour pendant vidéo | Mise en attente, appliquée à la fin |
| Fermeture/reprise | Fonctionne après modification des horaires en direct |
| Authentification, création magasin/groupe/playlist | Formulaires navigateur validés |
| Upload multiple et miniatures | Validés |
| Ordre des playlists | Glisser-déposer et boutons accessibles validés |
| Setup et persistance TV | Inscription et rechargement validés |
| Heartbeat et diagnostics | Validés |
| Pages admin + mobile 390 px | Validées ; pas de débordement horizontal |
| Console navigateur | Aucune erreur JavaScript ou console |
| `npm run test:player-transition` | Glissement réel droite → gauche sans espace entre médias, nettoyage des couches, mode réduit et annulation des frames à la fermeture validés |
| `npm run test:player-frame` | Vidéo réelle jusqu’à `ended`, plein écran, surface 16:9 en 720p/1080p/1440p/4K/portrait/mobile/carré/ultrawide, exceptions, fermeture et reprise validés |
| `npm run test:landing-browser` | Accueil, liens admin/TV, plein écran entrée/sortie, responsive et console sans erreur validés |
| Base d’exploitation | Migration des rôles appliquée ; identifiants, hachages des mots de passe et données métier conservés, sauvegarde SQLite sans sessions créée avant migration |
| Rôles et migration | Un administrateur unique, conservation des données/mots de passe, restrictions API/pages, refus d’escalade et révocation de session/socket validés |
| `npm run test:roles-browser` | Création utilisateur par l’admin, rôle conservé à l’édition, connexion utilisateur, contrôles masqués, modification des horaires, routes restreintes, mobile et logout validés |
| Reverse proxy | IP/CIDR, CSRF derrière HTTPS avec hôte/port publics, Socket.IO polling et WebSocket validés avec proxy simulé ; en-têtes non fiables refusés |
| Compatibilité HTTP LAN | Éditeur et inscription TV vérifiés sans `crypto.randomUUID` |
| `npm run reset-admin` | Création/récupération et renommage en admin, bcrypt, conservation des autres données/sessions, répétition et refus des collisions validés ; exécuté sur demande avec connexion HTTP vérifiée |
| CLI administrateur | Vérifié dans une base temporaire, saisie masquée et bcrypt |
| Installateur Linux | Exécuté avec runtime Node.js disponible, `.env` et base conservés |
| Sauvegarde ZIP | Base cohérente, originaux et miniatures présents, sessions et `.env` exclus |
| Routes HTTP | `/`, `/health`, `/admin/login`, `/display`, `/display/setup`, `/display/player` : 200 ; `/admin` sans session : 302 ; API admin sans session : 401 |

Les captures dans `screenshots/` proviennent des données de test isolées. Aucune donnée démo n’a été ajoutée à la base d’exploitation. Les données locales et la configuration ne sont pas incluses dans les téléchargements publics.

Les installations système par apt/pacman, Windows PowerShell, activation réelle au boot par systemd/PM2 et reverse proxy n’ont pas été exécutées sur chaque plateforme cible. Scripts et exemples fournis ; déploiement à vérifier sur la machine cible. La lecture hors ligne dépend des médias disponibles dans le cache du navigateur. Les groupes partagent le contenu sans synchronisation de frame entre TVs.
