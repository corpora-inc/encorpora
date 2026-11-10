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
#   scripts/design-preview.sh check    # after a merge or a CSS/module edit
#
# Ports: AMP_WEB_PORT (4700) and AMP_API_PORT (4701). Never 4310.
set -euo pipefail
cd "$(dirname "$0")/.."
WEB_PORT="${AMP_WEB_PORT:-4700}"
API_PORT="${AMP_API_PORT:-4701}"
RENDER_PORT="${AMP_RENDER_PORT:-4702}"
# A loopback-only token for the local render service (not a secret).
RENDER_TOKEN="local-design-preview-render-token-0123456789"
DB_NAME="${AMP_PREVIEW_DB:-amp_design_pass}"
PG="postgres://amp:amp@127.0.0.1:55490"
DB_URL="$PG/$DB_NAME"
ORIGIN="http://127.0.0.1:$WEB_PORT"
RUN="${AMP_PREVIEW_RUN:-${TMPDIR:-/tmp}/amp-design-preview}"
mkdir -p "$RUN"
# Machine-local settings stay out of this public repository: $RUN/preview.env
# (KEY=value lines) is loaded and exported on every start and restart. Phone
# access over a private network, for example, needs the host it is served on:
#   __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=<host>
#   AMP_ACCOUNTS_TRUSTED_ORIGINS=https://<host>:<port>
if [ -f "$RUN/preview.env" ]; then set -a; . "$RUN/preview.env"; set +a; fi
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
start_render() {
  running render && return 0
  set -m
  AMP_RENDER_TOKEN="$RENDER_TOKEN" AMP_RENDER_PORT="$RENDER_PORT" AMP_RENDER_HOST=127.0.0.1 \
    nohup npx tsx src/render-service/main.ts >"$RUN/render.log" 2>&1 &
  echo $! >"$RUN/render.pid"
  set +m
  for _ in $(seq 1 60); do
    grep -q "render service listening" "$RUN/render.log" 2>/dev/null && return 0
    sleep 1
  done
  echo "The render service did not start; see $RUN/render.log"; return 1
}
start_api() {
  running api && return 0
  set -m
  AMP_RENDER_URL="http://127.0.0.1:$RENDER_PORT" AMP_RENDER_TOKEN="$RENDER_TOKEN" \
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
    start_render; start_api; start_web; seed
    echo "Preview: $ORIGIN/dev/personas" ;;
  stop) stop_one web; stop_one api; stop_one render ;;
  restart) stop_one web; stop_one api; stop_one render; start_render; start_api; start_web; echo "Preview: $ORIGIN/dev/personas" ;;
  reseed)
    stop_one web; stop_one api; stop_one render
    psql "$PG/postgres" -c "DROP DATABASE IF EXISTS $DB_NAME WITH (FORCE)" >/dev/null
    psql "$PG/postgres" -c "CREATE DATABASE $DB_NAME" >/dev/null
    "$0" start ;;
  status)
    running api && echo "api up (pid $(cat "$RUN/api.pid"))" || echo "api down"
    running web && echo "web up (pid $(cat "$RUN/web.pid"))" || echo "web down"
    running render && echo "render up (pid $(cat "$RUN/render.pid"))" || echo "render down"
    echo "logs: $RUN" ;;
  check)
    # Fast health check: no conflict markers, a production build (CSS and
    # imports), types, the pages answering, one persona signing in.
    fail=0
    if git grep -nE '^(<<<<<<< |=======$|>>>>>>> )' -- . >/dev/null; then
      echo "FAIL conflict markers:"; git grep -nE '^(<<<<<<< |=======$|>>>>>>> )' -- . | head; fail=1
    fi
    out="$RUN/check-build"
    npx vite build --logLevel error --outDir "$out" --emptyOutDir >"$RUN/check-build.log" 2>&1 ||
      { echo "FAIL vite build (see $RUN/check-build.log)"; tail -20 "$RUN/check-build.log"; fail=1; }
    npm run -s tsc >"$RUN/check-tsc.log" 2>&1 ||
      { echo "FAIL tsc"; grep "error TS" "$RUN/check-tsc.log" | head -20; fail=1; }
    for path in / /dev/personas; do
      code=$(curl -s -o /dev/null -w "%{http_code}" "$ORIGIN$path")
      [ "$code" = 200 ] || { echo "FAIL $path answered $code"; fail=1; }
    done
    code=$(curl -s -o /dev/null -w "%{http_code}" -H "Origin: $ORIGIN" -H "Content-Type: application/json" \
      -d '{"email":"family@personas.amp.test","password":"design pass persona passphrase"}' \
      "$ORIGIN/api/auth/sign-in/email")
    [ "$code" = 200 ] || { echo "FAIL persona sign-in answered $code"; fail=1; }
    running render || { echo "FAIL the render service is down (PDFs would fall back to HTML)"; fail=1; }
    [ "$fail" = 0 ] && echo "check: healthy" || { echo "check: FAILED"; exit 1; } ;;
  *) echo "start | restart | stop | reseed | status | check"; exit 1 ;;
esac
