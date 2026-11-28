#!/usr/bin/env bash
# The whole loop for the preview: a hub (4319) and three devices, each fresh.
# Devices A (4317) and B (4320) are enrolled at the hub by the supervisor;
# device C (4323) is not, so its uploads stay queued.
# The apps: device A on 4340 (npm run dev), B on 4343 (npm run dev:b), C on 4345 (npm run dev:c).
# MAINT_OFFSET=<n> shifts every port by n, so a test run (100) can sit beside the preview.
# MAINT_IMPORT names the devices that get the fleet file up front (default: A B C).
# MAINT_REAL=1 serves the real packs (~/.cache/harvest/packs/maint-dev) for the preview, with
# pumps and a boat; without it, the fixture (what the tests use).
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "${MAINT_REAL:-}" = 1 ]; then
  export MAINT_PACKS="$HOME/.cache/harvest/packs/maint-dev/root" MAINT_PACKS_PUBKEY="$HOME/.cache/harvest/packs/maint-dev/pack.pub"
fi
OFF="${MAINT_OFFSET:-0}"
HUBP=$((4319 + OFF))
for port in $HUBP $((4317 + OFF)) $((4320 + OFF)) $((4323 + OFF)); do pkill -f "bind 127.0.0.1:$port" || true; done
up() { for _ in $(seq 1 40); do curl -s -o /dev/null "http://127.0.0.1:$1/" && return 0; sleep 0.25; done; echo "engine on $1 did not start" >&2; return 1; }
port_of() { case "$1" in A) echo $((4317 + OFF)) ;; B) echo $((4320 + OFF)) ;; C) echo $((4323 + OFF)) ;; esac; }
# The fixture's public test key, read once (devices verify the pack and the hub's bundles with it).
BIN="${HARVEST_BIN:-.engine/harvest}"
if [ ! -f .engine/pump40/manifest.json ]; then "$BIN" fixture .engine/pump40 --maint --samples .engine/pump40-samples >/dev/null; fi
export HARVEST_PUBKEY="$("$BIN" fixture .engine/fx --json | python3 -c 'import json,sys;print(json.load(sys.stdin)["pubkey"])')"
nohup scripts/engine.sh hub > ".engine/hub-$OFF.log" 2>&1 &
up $HUBP
for d in A B C; do nohup scripts/engine.sh device "$d" > ".engine/device-$d-$OFF.log" 2>&1 & done
for d in A B C; do up "$(port_of "$d")"; done
# Enroll A and B by the public key each device printed, as the supervisor (an admin).
for d in A B; do
  key="$(sed -n 's/.*(public key \([^)]*\)).*/\1/p' ".engine/device-$d-$OFF.log" | head -1)"
  [ -n "$key" ] || { echo "device $d printed no public key" >&2; exit 1; }
  curl -s -X POST -H 'Content-Type: application/json' -H 'Authorization: Bearer dev-supervisor-token' \
    --data "{\"public_key\": \"$key\", \"name\": \"Device $d\"}" "http://127.0.0.1:$HUBP/api/hub.enroll" | grep -q '"ok":true' || { echo "enrolling device $d failed" >&2; exit 1; }
done
imp() { curl -s -X POST -H 'Content-Type: application/json' --data-binary "{$2\"registry\": $(cat "$3")}" "http://127.0.0.1:$1/api/asset.import" | grep -q '"ok":true' || { echo "fleet import failed on $1 ($3)" >&2; exit 1; }; }
for d in ${MAINT_IMPORT:-A B C}; do
  if [ -n "${MAINT_PACKS:-}" ]; then
    imp "$(port_of "$d")" '"pack_id": "pump40v2-proof", ' scripts/preview/pumps.json
    imp "$(port_of "$d")" '"pack_id": "ardupilot-prearm", ' scripts/preview/boats.json
  else
    imp "$(port_of "$d")" "" .engine/pump40-samples/assets.json
  fi
done
echo "hub $HUBP; devices A $(port_of A) and B $(port_of B) enrolled, C $(port_of C) not; fleet file on: ${MAINT_IMPORT:-A B C}"
