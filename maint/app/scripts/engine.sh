#!/usr/bin/env bash
# Engines for development and the flow test, all on the Model 40 fixture pack:
#   scripts/engine.sh hub        the hub on 127.0.0.1:4319 (review and publish; signs with the
#                                public test key; people sign in with the development tokens below)
#   scripts/engine.sh device A   device A on 127.0.0.1:4317, syncing through the hub
#   scripts/engine.sh device B   device B on 127.0.0.1:4320, its own records, the same hub
#   scripts/engine.sh device C   device C on 127.0.0.1:4323, never enrolled at the hub
# Each start uses fresh records. Everything lives in .engine/ (git-ignored). Run from maint/app.
#   HARVEST_BIN=<path to harvest> (default .engine/harvest)
set -euo pipefail
cd "$(dirname "$0")/.."
BIN="${HARVEST_BIN:-.engine/harvest}"
mkdir -p .engine
if [ ! -f .engine/pump40/manifest.json ]; then
  "$BIN" fixture .engine/pump40 --maint --samples .engine/pump40-samples >/dev/null
fi
STAMP="$(date +%s)"
ORIGINS=()
for p in 4340 4341 4342 4343 4344 4345 4346; do ORIGINS+=(--allow-origin "http://127.0.0.1:$p"); done
HUB="${MAINT_HUB:-http://127.0.0.1:4319}"
case "${1:-device}" in
  hub)
    # Development sign-in only: named people with bearer tokens and their roles.
    cat > .engine/reviewers.json <<'JSON'
[
  { "name": "Shop supervisor", "token": "dev-supervisor-token", "roles": ["reviewer", "publisher", "admin"] },
  { "name": "Line reviewer", "token": "dev-reviewer-only-token", "roles": ["reviewer"] }
]
JSON
    exec "$BIN" hub ".engine/hub-$STAMP.db" --stream pump40-fleet --dev-key --reviewers .engine/reviewers.json --bind 127.0.0.1:4319 "${ORIGINS[@]}"
    ;;
  device)
    NAME="${2:-A}"
    case "$NAME" in A) PORT=4317 ;; B) PORT=4320 ;; C) PORT=4323 ;; *) echo "device A, B or C" >&2; exit 2 ;; esac
    KEY="${HARVEST_PUBKEY:-$("$BIN" fixture .engine/fx --json | python3 -c 'import json,sys;print(json.load(sys.stdin)["pubkey"])')}"
    exec "$BIN" serve .engine/pump40 --records ".engine/records-$NAME-$STAMP.db" --pubkey "$KEY" \
      --bind "127.0.0.1:$PORT" --hub "$HUB" "${ORIGINS[@]}"
    ;;
  *) echo "usage: engine.sh hub | device A|B|C" >&2; exit 2 ;;
esac
