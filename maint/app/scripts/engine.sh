#!/usr/bin/env bash
# Engines for development and the flow test, all on the Model 40 fixture pack:
#   scripts/engine.sh hub        the hub on 127.0.0.1:4319 (review and publish; signs with the
#                                public test key; people sign in with the development tokens below)
#   scripts/engine.sh device A   device A on 127.0.0.1:4317, syncing through the hub
#   scripts/engine.sh device B   device B on 127.0.0.1:4320, its own records, the same hub
#   scripts/engine.sh device C   device C on 127.0.0.1:4323, never enrolled at the hub
# Each start uses fresh records. Everything lives in .engine/ (git-ignored). Run from maint/app.
#   HARVEST_BIN=<path to harvest> (default .engine/harvest)
#   MAINT_PACKS=<packs root> and MAINT_PACKS_PUBKEY=<key file>: serve real packs instead of the
#   fixture (the preview; tests stay on the fixture).
#   MAINT_OFFSET=<n>: shift every port by n (a test run beside the running preview uses 100).
#   MAINT_LLM_URL=<…/v1>: the model the devices may ask (symptom.suggest, lesson.prefill, step.ask);
#   MAINT_LLM_MODEL names it (tests: the scripted endpoint, model "scripted"); MAINT_PREFILL lists the
#   fields lesson.prefill may fill (engine default: minutes,parts). Without a URL the model is off.
set -euo pipefail
cd "$(dirname "$0")/.."
BIN="${HARVEST_BIN:-.engine/harvest}"
mkdir -p .engine
if [ ! -f .engine/pump40/manifest.json ]; then
  "$BIN" fixture .engine/pump40 --maint --samples .engine/pump40-samples >/dev/null
fi
STAMP="$(date +%s)"
OFF="${MAINT_OFFSET:-0}"
ORIGINS=()
for p in 4340 4341 4342 4343 4344 4345 4346; do ORIGINS+=(--allow-origin "http://127.0.0.1:$((p + OFF))"); done
HUB="${MAINT_HUB:-http://127.0.0.1:$((4319 + OFF))}"
case "${1:-device}" in
  hub)
    # Development sign-in only: named people with bearer tokens and their roles.
    cat > .engine/reviewers.json <<'JSON'
[
  { "name": "Shop supervisor", "token": "dev-supervisor-token", "roles": ["reviewer", "publisher", "admin"] },
  { "name": "Line reviewer", "token": "dev-reviewer-only-token", "roles": ["reviewer"] }
]
JSON
    exec "$BIN" hub ".engine/hub-$STAMP.db" --stream pump40-fleet --dev-key --reviewers .engine/reviewers.json --bind "127.0.0.1:$((4319 + OFF))" "${ORIGINS[@]}"
    ;;
  device)
    NAME="${2:-A}"
    case "$NAME" in A) PORT=$((4317 + OFF)) ;; B) PORT=$((4320 + OFF)) ;; C) PORT=$((4323 + OFF)) ;; *) echo "device A, B or C" >&2; exit 2 ;; esac
    KEY="${HARVEST_PUBKEY:-$("$BIN" fixture .engine/fx --json | python3 -c 'import json,sys;print(json.load(sys.stdin)["pubkey"])')}"
    FIELD_KEY="$KEY"
    PACKS=.engine/pump40
    # The fixture's test key also signs the hub's field-note bundles (hub --dev-key).
    if [ -n "${MAINT_PACKS:-}" ]; then PACKS="$MAINT_PACKS"; KEY="$MAINT_PACKS_PUBKEY"; fi
    # MAINT_EMBEDDER: an embedding server's URL (search by meaning); lexical only without it.
    EMB=()
    if [ -n "${MAINT_EMBEDDER:-}" ]; then EMB=(--embedder "$MAINT_EMBEDDER"); fi
    LLM=()
    if [ -n "${MAINT_LLM_URL:-}" ]; then
      LLM=(--llm "$MAINT_LLM_URL")
      if [ -n "${MAINT_LLM_MODEL:-}" ]; then LLM+=(--llm-model "$MAINT_LLM_MODEL"); fi
      if [ -n "${MAINT_PREFILL:-}" ]; then LLM+=(--prefill "$MAINT_PREFILL"); fi
    fi
    exec "$BIN" serve "$PACKS" --field-pubkey "$FIELD_KEY" --records ".engine/records-$NAME-$STAMP.db" --pubkey "$KEY" \
      --bind "127.0.0.1:$PORT" --hub "$HUB" ${EMB[@]+"${EMB[@]}"} ${LLM[@]+"${LLM[@]}"} "${ORIGINS[@]}"
    ;;
  *) echo "usage: engine.sh hub | device A|B|C" >&2; exit 2 ;;
esac
