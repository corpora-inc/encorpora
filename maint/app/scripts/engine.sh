#!/usr/bin/env bash
# The engine for development and the flow test: the Model 40 fixture pack,
# served by `harvest serve` on 127.0.0.1:4317 with a fresh records file.
#   HARVEST_BIN=<path to harvest>  scripts/engine.sh   (default: .engine/harvest)
# Everything lives in .engine/ (git-ignored). Run from maint/app.
set -euo pipefail
cd "$(dirname "$0")/.."
BIN="${HARVEST_BIN:-.engine/harvest}"
PORT="${MAINT_ENGINE_PORT:-4317}"
mkdir -p .engine
if [ ! -f .engine/pump40/manifest.json ]; then
  "$BIN" fixture .engine/pump40 --maint --samples .engine/pump40-samples >/dev/null
fi
KEY="$("$BIN" fixture .engine/fx --json | python3 -c 'import json,sys;print(json.load(sys.stdin)["pubkey"])')"
STAMP="$(date +%s)"
exec "$BIN" serve .engine/pump40 --records ".engine/records-$STAMP.db" --pubkey "$KEY" \
  --bind "127.0.0.1:$PORT" --outbox-dir ".engine/outbox-$STAMP" \
  --allow-origin http://127.0.0.1:4340 --allow-origin http://127.0.0.1:4341 --allow-origin http://127.0.0.1:4342
