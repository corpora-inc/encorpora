#!/usr/bin/env bash
#
# tail-device-log.sh — stream filtered device os_log from the paired
# iPhone/iPad to a file, in real time, NO sudo required.
#
# Uses `idevicesyslog -m FILTER -o OUT` from libimobiledevice. Backgrounds
# itself so subsequent shell commands return immediately. Re-running
# replaces any prior tail (kills the old process, starts a fresh one).
#
# Usage:
#   bash scripts/dev/tail-device-log.sh                        # default: "Whisper |" → /tmp/whisper-trace-live.txt
#   bash scripts/dev/tail-device-log.sh "TTS |"                # filter only
#   bash scripts/dev/tail-device-log.sh "IAP |" /tmp/iap.txt   # filter + output path
#
# To stop:
#   pkill -f idevicesyslog
#
# Read the live trace any time:
#   tail -f /tmp/whisper-trace-live.txt

set -euo pipefail

FILTER="${1:-Whisper |}"
OUT="${2:-/tmp/whisper-trace-live.txt}"

# Kill any existing tail; one device, one tail at a time.
pkill -f idevicesyslog 2>/dev/null || true
sleep 0.5

if ! command -v idevicesyslog >/dev/null 2>&1; then
    echo "idevicesyslog not found — install libimobiledevice (brew install libimobiledevice)" >&2
    exit 1
fi

nohup idevicesyslog -m "$FILTER" -o "$OUT" \
    > "/tmp/idevicesyslog-meta.log" 2>&1 &

PID=$!
sleep 1
if kill -0 "$PID" 2>/dev/null; then
    echo "Tailing device log (filter='$FILTER') → $OUT (pid=$PID)" >&2
    echo "Stop with: pkill -f idevicesyslog" >&2
else
    echo "idevicesyslog failed to start; check /tmp/idevicesyslog-meta.log" >&2
    exit 1
fi
