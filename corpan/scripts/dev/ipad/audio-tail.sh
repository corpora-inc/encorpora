#!/usr/bin/env bash
#
# audio-tail.sh — robust, self-healing device os_log tail.
#
# Problem: a bare `idevicesyslog -m FILTER -o OUT` silently FREEZES when the
# device connection is reset (during `dvt launch`, an `ios dev` redeploy, a
# lock, or a USB hiccup) — the process stays alive but stops receiving lines,
# so the log looks "running" while capturing nothing.
#
# This wraps idevicesyslog in a supervisor that:
#   - respawns it whenever it exits, and
#   - a watchdog force-restarts it if OUT goes stale for STALE_S while the
#     device is still connected (catches the silent-hang case).
# It uses a DEDICATED tag so it never kills the `tauri ios dev` idevicesyslog.
#
# Usage:
#   audio-tail.sh start [FILTER] [OUT]   # default FILTER=AUDIO_KEEPALIVE, OUT=/tmp/audio-trace.txt
#   audio-tail.sh refresh                # force an immediate reconnect now
#   audio-tail.sh status                 # supervisor/child PIDs + freshness
#   audio-tail.sh stop
#
# Read the trace any time: tail -f /tmp/audio-trace.txt
set -uo pipefail

ACTION="${1:-start}"
FILTER="${2:-AUDIO_KEEPALIVE}"
OUT="${3:-/tmp/audio-trace.txt}"

SUP_PID="/tmp/audio-tail.sup.pid"      # supervisor pid
CHILD_PID="/tmp/audio-tail.child.pid"  # current idevicesyslog pid
META="/tmp/audio-tail.meta.log"
STALE_S=60                             # restart if no new line for this long (device present).
                                       # idevicesyslog EXITS on a real drop (handled by exit-respawn);
                                       # this watchdog only catches the silent-hang case, so keep it
                                       # long enough not to churn during quiet steady playback.

now() { date +%s; }
mtime() { stat -f %m "$1" 2>/dev/null || echo 0; }
device_present() { idevice_id -l 2>/dev/null | grep -q .; }

start_child() {
  # Fresh idevicesyslog; record its pid. -m filters, -o appends to OUT.
  nohup idevicesyslog -m "$FILTER" -o "$OUT" >>"$META" 2>&1 &
  echo $! > "$CHILD_PID"
}

kill_child() {
  [ -f "$CHILD_PID" ] && kill "$(cat "$CHILD_PID")" 2>/dev/null || true
  rm -f "$CHILD_PID"
}

supervise() {
  echo "[audio-tail] supervisor up $(date '+%H:%M:%S') filter='$FILTER' out=$OUT" >>"$META"
  trap 'kill_child; exit 0' TERM INT
  start_child
  local last_size; last_size=$(wc -c < "$OUT" 2>/dev/null || echo 0)
  local last_grow; last_grow=$(now)
  while :; do
    sleep 5
    # respawn if the child died
    if [ ! -f "$CHILD_PID" ] || ! kill -0 "$(cat "$CHILD_PID" 2>/dev/null)" 2>/dev/null; then
      echo "[audio-tail] child gone — respawning $(date '+%H:%M:%S')" >>"$META"
      start_child; last_grow=$(now); continue
    fi
    # growth check
    local size; size=$(wc -c < "$OUT" 2>/dev/null || echo 0)
    if [ "$size" != "$last_size" ]; then last_size=$size; last_grow=$(now); continue; fi
    # stale: if device is present but no new bytes for STALE_S, the connection
    # silently dropped — force a reconnect.
    if device_present && [ $(( $(now) - last_grow )) -ge "$STALE_S" ]; then
      echo "[audio-tail] stale ${STALE_S}s w/ device present — reconnecting $(date '+%H:%M:%S')" >>"$META"
      kill_child; sleep 1; start_child; last_grow=$(now)
    fi
  done
}

stop_all() {
  [ -f "$SUP_PID" ] && kill "$(cat "$SUP_PID")" 2>/dev/null || true
  kill_child
  rm -f "$SUP_PID"
  echo "[audio-tail] stopped"
}

case "$ACTION" in
  start)
    stop_all 2>/dev/null
    : > "$OUT"  # truncate for a clean session
    nohup bash "$0" __supervise "$FILTER" "$OUT" >>"$META" 2>&1 &
    echo $! > "$SUP_PID"
    sleep 1.5
    echo "Supervised tail started (filter='$FILTER' → $OUT, sup pid=$(cat "$SUP_PID"))."
    echo "Refresh: $0 refresh   Stop: $0 stop   Read: tail -f $OUT"
    ;;
  __supervise) supervise ;;  # internal entrypoint
  refresh)
    # force an immediate reconnect without restarting the supervisor
    kill_child; sleep 1
    if [ -f "$SUP_PID" ] && kill -0 "$(cat "$SUP_PID")" 2>/dev/null; then
      echo "Refreshed (supervisor will respawn idevicesyslog within ~5s)."
    else
      echo "No supervisor running — starting one."; exec bash "$0" start "$FILTER" "$OUT"
    fi
    ;;
  status)
    if [ -f "$SUP_PID" ] && kill -0 "$(cat "$SUP_PID")" 2>/dev/null; then
      echo "supervisor: UP (pid $(cat "$SUP_PID"))"
    else echo "supervisor: DOWN"; fi
    if [ -f "$CHILD_PID" ] && kill -0 "$(cat "$CHILD_PID")" 2>/dev/null; then
      echo "idevicesyslog: UP (pid $(cat "$CHILD_PID"))"
    else echo "idevicesyslog: DOWN"; fi
    echo "out: $OUT ($(wc -l < "$OUT" 2>/dev/null || echo 0) lines, age $(( $(now) - $(mtime "$OUT") ))s)"
    echo "device present: $(device_present && echo yes || echo no)"
    ;;
  stop) stop_all ;;
  *) echo "usage: $0 {start|refresh|status|stop} [FILTER] [OUT]"; exit 1 ;;
esac
