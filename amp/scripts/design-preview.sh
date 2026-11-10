#!/usr/bin/env bash
# The local design preview: the API (accounts mode, hot reload) and Vite on
# loopback over a dedicated database, seeded with the people of
# src/web/features/dev/persona-list.ts. Open $ORIGIN/dev/personas.
#
#   scripts/design-preview.sh start    # start both (seeds an empty database)
#   scripts/design-preview.sh restart  # restart both, keeping the data
#   scripts/design-preview.sh stop     # stop what this script started
#   scripts/design-preview.sh reseed   # stop, recreate the database, start, seed
#   scripts/design-preview.sh status
#
# Ports: AMP_WEB_PORT (4700) and AMP_API_PORT (4701). Never 4310.
set -euo pipefail
cd "$(dirname "$0")/.."
WEB_PORT="${AMP_WEB_PORT:-4700}"
API_PORT="${AMP_API_PORT:-4701}"
DB_NAME="${AMP_PREVIEW_DB:-amp_design_pass}"
PG="postgres://amp:amp@127.0.0.1:55490"
DB_URL="$PG/$DB_NAME"
ORIGIN="http://127.0.0.1:$WEB_PORT"
RUN="${AMP_PREVIEW_RUN:-${TMPDIR:-/tmp}/amp-design-preview}"
mkdir -p "$RUN"
[ "$WEB_PORT" = 4310 ] && { echo "Port 4310 is the founder's"; exit 1; }

running() { [ -f "$RUN/$1.pid" ] && kill -0 "$(cat "$RUN/$1.pid")" 2>/dev/null; }
stop_one() {
  if running "$1"; then
    # Each was started as its own process group (set -m below).
    kill -TERM -- "-$(cat "$RUN/$1.pid")" 2>/dev/null || true
    sleep 1
  fi
  [ -f "$RUN/$1.pid" ] && mv "$RUN/$1.pid" "$RUN/$1.pid.old"
  return 0
}
wait_for() {
  for _ in $(seq 1 120); do
    curl -fsS -o /dev/null "$1" 2>/dev/null && return 0
    sleep 1
  done
  echo "Timed out waiting for $1"; return 1
}
start_api() {
  running api && return 0
  set -m
  AMP_DATABASE_URL="$DB_URL" AMP_AUTH_MODE=accounts AMP_HOSTED_PILOT_READY=true \
    AMP_ACCOUNTS_URL="$ORIGIN" \
    AMP_ACCOUNTS_SECRET=local-design-preview-secret-0123456789abcdef \
    AMP_PORT="$API_PORT" AMP_HOST=127.0.0.1 NODE_ENV=development \
    nohup npx tsx watch --clear-screen=false src/server/main.ts >"$RUN/api.log" 2>&1 &
  echo $! >"$RUN/api.pid"
  set +m
  wait_for "http://127.0.0.1:$API_PORT/api/v1/auth-config" || wait_for "http://127.0.0.1:$API_PORT/api/auth/ok"
}
start_web() {
  running web && return 0
  set -m
  AMP_WEB_PORT="$WEB_PORT" AMP_API_PORT="$API_PORT" AMP_PREVIEW_PRICES=1 \
    AMP_DATABASE_URL="$DB_URL" nohup npx vite --host 127.0.0.1 --port "$WEB_PORT" --strictPort >"$RUN/web.log" 2>&1 &
  echo $! >"$RUN/web.pid"
  set +m
  wait_for "$ORIGIN/"
}
seed() {
  AMP_DATABASE_URL="$DB_URL" AMP_PREVIEW_ORIGIN="$ORIGIN" npx tsx scripts/design-personas.ts
}
case "${1:-start}" in
  start)
    psql "$PG/postgres" -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 ||
      psql "$PG/postgres" -c "CREATE DATABASE $DB_NAME" >/dev/null
    # The API migrates nothing itself; the seed script does, so run it first
    # against an empty database with the API not yet answering.
    AMP_DATABASE_URL="$DB_URL" npx tsx -e "import('./scripts/migrate.ts').then(m=>m.migrate(process.env.AMP_DATABASE_URL)).then(()=>process.exit(0))"
    start_api; start_web; seed
    echo "Preview: $ORIGIN/dev/personas" ;;
  stop) stop_one web; stop_one api ;;
  restart) stop_one web; stop_one api; start_api; start_web; echo "Preview: $ORIGIN/dev/personas" ;;
  reseed)
    stop_one web; stop_one api
    psql "$PG/postgres" -c "DROP DATABASE IF EXISTS $DB_NAME WITH (FORCE)" >/dev/null
    psql "$PG/postgres" -c "CREATE DATABASE $DB_NAME" >/dev/null
    "$0" start ;;
  status)
    running api && echo "api up (pid $(cat "$RUN/api.pid"))" || echo "api down"
    running web && echo "web up (pid $(cat "$RUN/web.pid"))" || echo "web down"
    echo "logs: $RUN" ;;
  *) echo "start | restart | stop | reseed | status"; exit 1 ;;
esac
