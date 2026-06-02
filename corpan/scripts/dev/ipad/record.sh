#!/usr/bin/env bash
# Build (if stale) and run the headless iPad screen+audio recorder.
#
#   record.sh --out /tmp/t.mov [--udid <UDID>] [--name iPad]
#   record.sh --list            # enumerate capture devices and exit
#
# Records on launch; send SIGINT/SIGTERM to finalize the .mov and exit cleanly.
# Requires macOS Camera permission for the controlling terminal (first run
# triggers the TCC prompt). See SCENARIOS.md / STUDIO.md.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/ipad-record.swift"
BIN="$HERE/ipad-record"

# Recompile when the source is newer than the binary (or the binary is missing).
if [ ! -x "$BIN" ] || [ "$SRC" -nt "$BIN" ]; then
  echo "compiling ipad-record…" >&2
  swiftc -O "$SRC" -o "$BIN"
fi

exec "$BIN" "$@"
