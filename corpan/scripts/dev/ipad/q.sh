#!/usr/bin/env bash
# q.sh — reliable, ALWAYS-exit-0 wrapper around the CDP daemon for agent use.
#
# Why: cdpc.py exits 1 when cdpd is down or a call times out. In an agent that
# batches tool calls, ANY non-zero exit cancels every sibling call in the turn.
# This wrapper (a) auto-(re)starts cdpd if the socket is missing, (b) runs the
# eval, (c) ALWAYS exits 0 — the result (or an {"error":...} JSON) is on stdout.
#
# Usage:
#   q.sh eval "document.title"
#   q.sh up                 # ensure cdpd is running, print readiness
#   q.sh shot /tmp/x.png    # pixel screenshot (always exit 0)
set +e
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="$(pipx environment --value PIPX_LOCAL_VENVS 2>/dev/null)/pymobiledevice3/bin/python"
SOCK="${CDPD_SOCK:-/tmp/corpan-cdpd.sock}"

ensure_cdpd() {
  if [ -S "$SOCK" ]; then return 0; fi
  rm -f "$SOCK" 2>/dev/null
  "$PY" "$HERE/cdpd.py" >/tmp/cdpd.log 2>&1 &
  for _ in $(seq 1 15); do [ -S "$SOCK" ] && break; sleep 1; done
  # give the WebView a moment to expose a target
  sleep 3
}

cmd="${1:-eval}"
case "$cmd" in
  up)
    ensure_cdpd
    python3 "$HERE/cdpc.py" "document.title" 2>/dev/null || echo '{"error":"no eval"}'
    ;;
  eval)
    ensure_cdpd
    out="$(python3 "$HERE/cdpc.py" "${2:-1+1}" 2>/dev/null)"
    case "$out" in
      ""|*'cdpd not running'*)
        # one retry after a fresh daemon
        rm -f "$SOCK" 2>/dev/null; ensure_cdpd
        out="$(python3 "$HERE/cdpc.py" "${2:-1+1}" 2>/dev/null)"
        ;;
    esac
    echo "${out:-'{\"error\":\"empty\"}'}"
    ;;
  shot)
    "$PY" "$HERE/screenshot.py" "${2:-/tmp/q.png}" >/dev/null 2>&1 && echo "OK ${2:-/tmp/q.png}" || echo "SHOT_FAIL"
    ;;
  *)
    echo '{"error":"usage: q.sh up|eval EXPR|shot PATH"}'
    ;;
esac
exit 0
