#!/usr/bin/env bash
# The whole loop for the preview: a hub (4319), device A (4317) and device B
# (4320), each fresh, with the fleet file imported on both devices.
# The app for device A runs on 4340 (npm run dev); for device B:
#   MAINT_PORT=4343 MAINT_ENGINE=http://127.0.0.1:4320 npm run dev
set -euo pipefail
cd "$(dirname "$0")/.."
for pat in "bind 127.0.0.1:4319" "bind 127.0.0.1:4317" "bind 127.0.0.1:4320"; do pkill -f "$pat" || true; done
up() { for _ in $(seq 1 40); do curl -s -o /dev/null "http://127.0.0.1:$1/" && return 0; sleep 0.25; done; echo "engine on $1 did not start" >&2; return 1; }
# The fixture's public test key, read once (the devices verify the pack and the hub's bundles with it).
BIN="${HARVEST_BIN:-.engine/harvest}"
export HARVEST_PUBKEY="$("$BIN" fixture .engine/fx --json | python3 -c 'import json,sys;print(json.load(sys.stdin)["pubkey"])')"
nohup scripts/engine.sh hub > .engine/hub.log 2>&1 &
up 4319
nohup scripts/engine.sh device A > .engine/device-A.log 2>&1 &
nohup scripts/engine.sh device B > .engine/device-B.log 2>&1 &
up 4317
up 4320
# MAINT_IMPORT names the devices that get the fleet file up front (the flow test imports A's itself).
for d in ${MAINT_IMPORT:-A B}; do
  port=$([ "$d" = A ] && echo 4317 || echo 4320)
  curl -s -X POST -H 'Content-Type: application/json' --data-binary "{\"registry\": $(cat .engine/pump40-samples/assets.json)}" "http://127.0.0.1:$port/api/asset.import" >/dev/null
done
echo "hub 4319, device A 4317, device B 4320; fleet imported on: ${MAINT_IMPORT:-A B}"
