#!/usr/bin/env bash
set -euo pipefail

[[ $# -le 1 ]] || { echo 'Usage : bash install-git.sh' >&2; exit 2; }
case "${1:-}" in
  '') ;;
  -h|--help) echo 'Usage : bash install-git.sh'; echo 'Installe Git si nécessaire sur CachyOS/Arch ou Ubuntu/Debian.'; exit 0 ;;
  *) echo 'Usage : bash install-git.sh' >&2; exit 2 ;;
esac

if command -v git >/dev/null 2>&1; then
  echo 'Git est déjà installé.'
  exit 0
fi

[[ "$(uname -s)" == Linux ]] || { echo 'Ce script nécessite Linux.' >&2; exit 1; }
if [[ -f /etc/os-release ]]; then source /etc/os-release; fi
if [[ $EUID -eq 0 ]]; then
  elevate=()
else
  command -v sudo >/dev/null 2>&1 || { echo 'sudo est requis pour installer Git.' >&2; exit 1; }
  elevate=(sudo)
fi

echo 'Installation de Git…'
case "${ID:-} ${ID_LIKE:-}" in
  *arch*|*cachyos*) "${elevate[@]}" pacman -Syu --needed git ;;
  *debian*|*ubuntu*) "${elevate[@]}" apt-get update; "${elevate[@]}" apt-get install -y git ;;
  *) echo 'Distribution non reconnue. Installez Git avec votre gestionnaire de paquets.' >&2; exit 1 ;;
esac

command -v git >/dev/null 2>&1 || { echo 'Git reste introuvable après installation.' >&2; exit 1; }
echo 'Git est prêt. Vous pouvez maintenant cloner le dépôt.'
