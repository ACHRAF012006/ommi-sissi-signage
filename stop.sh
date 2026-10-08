#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/scripts/linux-common.sh"
require_linux
command -v node >/dev/null || { echo 'Node.js introuvable.' >&2; exit 1; }
if command -v systemctl >/dev/null 2>&1; then
  if [[ "$(unit_state)" == loaded ]] && unit_belongs_to_project; then
    privileged systemctl stop "$OMMI_SERVICE"
  fi
  # Also support an existing per-user unit when it belongs to this project.
  user_dir="$(systemctl --user show "$OMMI_SERVICE" --property=WorkingDirectory --value 2>/dev/null || true)"
  if [[ -n "$user_dir" && "$(realpath -m -- "$user_dir")" == "$OMMI_ROOT" ]]; then systemctl --user stop "$OMMI_SERVICE"; fi
fi
node "$OMMI_ROOT/scripts/stop-app.js" "$@"
