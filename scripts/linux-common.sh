#!/usr/bin/env bash
OMMI_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
OMMI_SERVICE='ommi-sissi.service'
require_linux() {
  [[ "$(uname -s)" == Linux ]] || { echo 'Cette commande nécessite Linux.' >&2; return 1; }
}
privileged() {
  if [[ $EUID -eq 0 ]]; then "$@";
  elif command -v sudo >/dev/null 2>&1; then sudo -- "$@";
  else echo 'sudo est requis pour gérer le service système.' >&2; return 1;
  fi
}
unit_state() { systemctl show "$OMMI_SERVICE" --property=LoadState --value 2>/dev/null || true; }
unit_directory() { systemctl show "$OMMI_SERVICE" --property=WorkingDirectory --value 2>/dev/null || true; }
unit_belongs_to_project() {
  local installed_dir
  installed_dir="$(unit_directory)"
  [[ -n "$installed_dir" && "$(realpath -m -- "$installed_dir")" == "$OMMI_ROOT" ]]
}
check_unit_directory() {
  local installed_dir
  installed_dir="$(unit_directory)"
  [[ -n "$installed_dir" && "$(realpath -m -- "$installed_dir")" == "$OMMI_ROOT" ]] || {
    echo "Le service $OMMI_SERVICE appartient à une autre installation : ${installed_dir:-chemin inconnu}." >&2
    return 1
  }
}
