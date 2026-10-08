#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
autostart=true
[[ $# -le 1 ]] || { echo 'Usage : ./install.sh [--no-autostart]' >&2; exit 2; }
case "${1:-}" in
  '') ;;
  --no-autostart) autostart=false ;;
  -h|--help) echo 'Usage : ./install.sh [--no-autostart]'; echo 'Le démarrage au boot via systemd est activé par défaut (sudo peut être demandé).'; exit 0 ;;
  *) echo 'Usage : ./install.sh [--no-autostart]' >&2; exit 2 ;;
esac
if [[ -f /etc/os-release ]]; then source /etc/os-release; fi
node_ok=false
if command -v node >/dev/null 2>&1; then node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)' && node_ok=true; fi
if [[ "$node_ok" != true ]] || ! command -v npm >/dev/null 2>&1; then
  echo 'Node.js >= 22.12 et npm sont requis (Node.js 24 LTS recommandé).'
  read -r -p 'Installer les paquets de votre distribution ? [o/N] : ' response
  if [[ "${response,,}" != o ]]; then echo 'Installez Node.js 24 LTS depuis https://nodejs.org puis relancez ./install.sh'; exit 1; fi
  if [[ $EUID -eq 0 ]]; then elevate=(); else elevate=(sudo); fi
  case "${ID:-} ${ID_LIKE:-}" in
    *arch*|*cachyos*) "${elevate[@]}" pacman -Syu --needed nodejs-lts-krypton npm base-devel python ;;
    *debian*|*ubuntu*) "${elevate[@]}" apt-get update; "${elevate[@]}" apt-get install -y nodejs npm build-essential python3 ;;
    *) echo 'Distribution non reconnue. Installez Node.js 24 LTS depuis https://nodejs.org'; exit 1 ;;
  esac
fi
command -v npm >/dev/null || { echo 'npm introuvable. Installez npm puis relancez.'; exit 1; }
node -e 'const [a,b]=process.versions.node.split(".").map(Number);if(!(a>22||(a===22&&b>=12))){console.error("Votre dépôt fournit un Node.js trop ancien. Installez Node.js 24 LTS depuis nodejs.org, puis relancez.");process.exit(1)}'
mkdir -p data uploads/images uploads/videos uploads/thumbnails uploads/tmp logs backups
# Avoid Arch system libvips forcing a native Sharp build.
export SHARP_IGNORE_GLOBAL_LIBVIPS=1
npm ci --omit=dev
node scripts/setup-env.js
npm run init-db
chmod 700 data uploads logs backups
chmod 600 .env
chmod +x start.sh stop.sh toggle-autostart.sh
read -r -p 'Créer un administrateur maintenant ? [O/n] : ' response
if [[ "${response,,}" != n ]]; then npm run create-admin; else echo 'Créez le compte avec : npm run create-admin'; fi
if $autostart; then
  echo 'Activation du démarrage automatique au boot (sudo peut être demandé)…'
  ./toggle-autostart.sh on
else
  echo 'Configuration du démarrage au boot ignorée (--no-autostart).'
fi
printf '\nInstallation terminée.\nDéveloppement : npm run dev\nProduction : ./start.sh\nAdministration : http://localhost:3000/admin\nTV : http://IP-DU-SERVEUR:3000/display\n'
