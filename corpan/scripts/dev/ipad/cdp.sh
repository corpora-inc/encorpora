#!/usr/bin/env bash
# Thin retry wrapper around ipad_cdp.py — the WebInspector tunnel setup
# occasionally hiccups on the first try, so retry a few times before giving up.
# Usage: cdp.sh eval "EXPR" | cdp.sh click SEL | cdp.sh rect SEL | ...
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="$(pipx environment --value PIPX_LOCAL_VENVS 2>/dev/null)/pymobiledevice3/bin/python"
[ -x "$PY" ] || { echo "pymobiledevice3 venv python not found" >&2; exit 3; }

# Fast path: if the persistent daemon (cdpd.py) is up, serve `eval` over its
# socket (a quick round-trip, no WebInspector reconnect). Falls through to the
# per-call path below when the daemon is down or returns the not-running
# sentinel. Other subcommands always use the per-call path.
SOCK="${CDPD_SOCK:-/tmp/corpan-cdpd.sock}"
if [ "${1:-}" = "eval" ] && [ -S "$SOCK" ]; then
  out="$(python3 "$HERE/cdpc.py" "${2:-}" 2>/dev/null)"
  case "$out" in
    ""|*'"error":"cdpd not running"'*) : ;;  # daemon gone → fall through
    *) echo "$out"; exit 0 ;;
  esac
fi

attempts="${CDP_ATTEMPTS:-3}"
for i in $(seq 1 "$attempts"); do
  out="$(timeout "${CDP_TIMEOUT:-40}" "$PY" "$HERE/ipad_cdp.py" "$@" 2>/dev/null)"
  if [ -n "$out" ]; then echo "$out"; exit 0; fi
  # WebInspector allows one session at a time; let the prior socket fully
  # tear down before reconnecting.
  sleep 1.5
done
echo "{\"error\":\"cdp failed after $attempts attempts\"}" >&2
exit 1
