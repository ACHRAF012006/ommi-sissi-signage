#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/scripts/linux-common.sh"
cd -- "$OMMI_ROOT"
command -v node >/dev/null || { echo 'Node.js introuvable. Lancez ./install.sh'; exit 1; }
[[ $# -eq 0 ]] || { echo 'Usage : ./start.sh' >&2; exit 2; }
if [[ "$(uname -s)" == Linux ]]; then
  if node "$OMMI_ROOT/scripts/app-running.js"; then
    echo 'Le serveur de cette installation est déjà en cours.'
    exit
  else
    result=$?
    [[ "$result" == 1 ]] || exit "$result"
  fi
  if command -v systemctl >/dev/null 2>&1; then
    if [[ "$(unit_state)" == loaded ]] && unit_belongs_to_project; then
      if systemctl is-active --quiet "$OMMI_SERVICE"; then
        echo 'Le service OMMI SISSI est déjà actif.'
      else
        privileged systemctl start "$OMMI_SERVICE"
        systemctl is-active --quiet "$OMMI_SERVICE" || { echo 'Le service n’a pas démarré. Consultez : journalctl -u ommi-sissi.service' >&2; exit 1; }
        echo 'Application démarrée via systemd.'
      fi
      exit
    fi
    user_dir="$(systemctl --user show "$OMMI_SERVICE" --property=WorkingDirectory --value 2>/dev/null || true)"
    if [[ -n "$user_dir" && "$(realpath -m -- "$user_dir")" == "$OMMI_ROOT" ]]; then
      systemctl --user start "$OMMI_SERVICE"
      systemctl --user is-active --quiet "$OMMI_SERVICE" || { echo 'Le service utilisateur n’a pas démarré.' >&2; exit 1; }
      echo 'Application démarrée via le service utilisateur systemd.'
      exit
    fi
  fi
fi
echo 'Démarrage de OMMI SISSI. Gardez ce terminal ouvert ; Ctrl+C ou ./stop.sh pour arrêter.'
exec node "$OMMI_ROOT/server.js"
