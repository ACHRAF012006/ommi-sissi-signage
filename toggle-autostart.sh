#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/scripts/linux-common.sh"
require_linux
command -v systemctl >/dev/null || { echo 'systemd/systemctl est requis.' >&2; exit 1; }
[[ -d /run/systemd/system ]] || { echo 'systemd doit être le gestionnaire de services de cette machine.' >&2; exit 1; }
action="${1:-toggle}"
case "$action" in on|off|status|toggle|print) ;; *) echo 'Usage : ./toggle-autostart.sh [on|off|toggle|status|print]' >&2; exit 2 ;; esac
[[ $# -le 1 ]] || { echo 'Une seule action est acceptée.' >&2; exit 2; }
if [[ "$action" == print ]]; then
  command -v node >/dev/null || { echo 'Node.js introuvable.' >&2; exit 1; }
  service_user="${SUDO_USER:-$(id -un)}"
  node "$OMMI_ROOT/scripts/systemd-service.js" "$(id -u "$service_user")"
  exit
fi
loaded="$(unit_state)"
if [[ "$loaded" != not-found && -n "$loaded" ]]; then check_unit_directory; fi
enabled=false
if [[ "$(systemctl is-enabled "$OMMI_SERVICE" 2>/dev/null || true)" == enabled ]]; then enabled=true; fi
if [[ "$action" == status ]]; then
  if $enabled; then echo 'Démarrage au boot : activé'; else echo 'Démarrage au boot : désactivé'; fi
  exit
fi
if [[ "$action" == toggle ]]; then if $enabled; then action=off; else action=on; fi; fi
if [[ "$action" == off ]]; then
  if [[ "$loaded" == loaded ]]; then privileged systemctl disable "$OMMI_SERVICE"; fi
  echo 'Démarrage au boot : désactivé. Le serveur en cours reste actif.'
  exit
fi
if [[ "$loaded" != loaded ]]; then
  command -v node >/dev/null || { echo 'Node.js introuvable. Lancez ./install.sh' >&2; exit 1; }
  service_user="${SUDO_USER:-$(id -un)}"
  service_uid="$(id -u "$service_user")"
  [[ "$service_uid" != 0 ]] || { echo 'Lancez ce script depuis le compte non-root qui utilise l’application (sudo sera demandé si nécessaire).' >&2; exit 1; }
  unit_file="$(mktemp)"
  trap 'rm -f -- "$unit_file"' EXIT
  node "$OMMI_ROOT/scripts/systemd-service.js" "$service_uid" > "$unit_file"
  privileged install -m 644 -- "$unit_file" "/etc/systemd/system/$OMMI_SERVICE"
  privileged systemctl daemon-reload
fi
privileged systemctl enable "$OMMI_SERVICE"
echo 'Démarrage au boot : activé. Le serveur démarrera au prochain boot.'
echo 'Pour démarrer le service maintenant : sudo systemctl start ommi-sissi.service'
