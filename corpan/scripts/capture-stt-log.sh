#!/usr/bin/env bash
#
# capture-stt-log.sh — DEPRECATED. Redirects to the new dev loop.
#
# The old approach (`sudo log collect --device`) needed a password
# every time and froze briefly during collection. The new approach
# is `scripts/dev/tail-device-log.sh` which runs `idevicesyslog` in
# the background — no sudo, real-time, just `tail` the output file.
#
# This stub is left in place so older docs/instructions keep working.

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
echo "capture-stt-log.sh is deprecated. Starting the live tail instead…" >&2
exec "$HERE/dev/tail-device-log.sh" "Whisper |" "/tmp/whisper-trace-live.txt"
