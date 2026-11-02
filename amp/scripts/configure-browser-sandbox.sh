#!/usr/bin/env bash
# Permit user namespaces for this Chrome executable on Ubuntu's AppArmor hosts.
# Does not disable AppArmor or change the host-wide user-namespace restriction.
set -euo pipefail
if [[ ! -r /proc/sys/kernel/apparmor_restrict_unprivileged_userns ]] ||
   [[ $(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns) != 1 ]]; then
  exit 0
fi
[[ $# == 1 && $EUID == 0 ]] || { echo 'Run as root with the installed Chrome executable path' >&2; exit 1; }
chrome_executable=$(realpath -- "$1")
[[ -f "$chrome_executable" && -x "$chrome_executable" ]]
# Reject AppArmor pattern/syntax characters before embedding an exact path.
[[ "$chrome_executable" =~ ^/[a-zA-Z0-9_./-]+$ ]] || { echo 'Unsupported AppArmor executable path' >&2; exit 1; }
profile=/etc/apparmor.d/corpora-chrome
cat > "$profile" <<EOF
abi <abi/4.0>,
include <tunables/global>
profile corpora-chrome "$chrome_executable" flags=(unconfined) {
  userns,
}
EOF
chmod 0644 "$profile"
apparmor_parser -r "$profile"
echo 'Configured executable-scoped Chrome user-namespace permission'
