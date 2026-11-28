#!/usr/bin/env bash
# The whole loop for the preview: a hub (4319) and three devices, each fresh.
# Devices A (4317) and B (4320) are enrolled at the hub by the supervisor;
# device C (4323) is not, so its uploads stay queued.
# The apps: device A on 4340 (npm run dev), B on 4343 (npm run dev:b), C on 4345 (npm run dev:c).
# MAINT_IMPORT names the devices that get the fleet file up front (default: A B C).
set -euo pipefail
cd "$(dirname "$0")/.."
for port in 4319 4317 4320 4323; do pkill -f "bind 127.0.0.1:$port" || true; done
up() { for _ in $(seq 1 40); do curl -s -o /dev/null "http://127.0.0.1:$1/" && return 0; sleep 0.25; done; echo "engine on $1 did not start" >&2; return 1; }
port_of() { case "$1" in A) echo 4317 ;; B) echo 4320 ;; C) echo 4323 ;; esac; }
# The fixture's public test key, read once (devices verify the pack and the hub's bundles with it).
BIN="${HARVEST_BIN:-.engine/harvest}"
if [ ! -f .engine/pump40/manifest.json ]; then "$BIN" fixture .engine/pump40 --maint --samples .engine/pump40-samples >/dev/null; fi
export HARVEST_PUBKEY="$("$BIN" fixture .engine/fx --json | python3 -c 'import json,sys;print(json.load(sys.stdin)["pubkey"])')"
nohup scripts/engine.sh hub > .engine/hub.log 2>&1 &
up 4319
for d in A B C; do nohup scripts/engine.sh device "$d" > ".engine/device-$d.log" 2>&1 & done
for d in A B C; do up "$(port_of "$d")"; done
# Enroll A and B by the public key each device printed, as the supervisor (an admin).
for d in A B; do
  key="$(sed -n 's/.*(public key \([^)]*\)).*/\1/p' ".engine/device-$d.log" | head -1)"
  [ -n "$key" ] || { echo "device $d printed no public key" >&2; exit 1; }
  curl -s -X POST -H 'Content-Type: application/json' -H 'Authorization: Bearer dev-supervisor-token' \
    --data "{\"public_key\": \"$key\", \"name\": \"Device $d\"}" http://127.0.0.1:4319/api/hub.enroll | grep -q '"ok":true' || { echo "enrolling device $d failed" >&2; exit 1; }
done
for d in ${MAINT_IMPORT:-A B C}; do
  curl -s -X POST -H 'Content-Type: application/json' --data-binary "{\"registry\": $(cat .engine/pump40-samples/assets.json)}" "http://127.0.0.1:$(port_of "$d")/api/asset.import" >/dev/null
done
echo "hub 4319; devices A 4317 and B 4320 enrolled, C 4323 not; fleet file on: ${MAINT_IMPORT:-A B C}"
