#!/usr/bin/env bash
# Serve one model on the lab machine for the duration of an eval run, through the machine's shared job
# runner (workload lock and heat guard), and tunnel it to localhost.
#   lab.sh start NAME GGUF [CTX] [extra llama-server args...]   -> http://127.0.0.1:$MAINT_LAB_LOCAL_PORT/v1
#   lab.sh stop                                                  -> stops the server; the job and its lock end
# One model at a time. Stop it as soon as the run ends: other work shares the machine.
#
# Everything about the lab comes from the environment (nothing here names a host or a directory):
#   MAINT_LAB_HOST     ssh destination of the lab machine
#   MAINT_LAB_PORT     port the model server listens on there
#   MAINT_LAB_DIR      a directory on the lab machine for this harness's serve script and logs
#   MAINT_LAB_SERVE    the serve script there (llama-server with --jinja; see lab-serve.sh)
#   MAINT_LAB_RUN_JOB  the shared job runner there: <runner> --name N --min-free-gib G --max-seconds S -- <cmd...>
#   MAINT_LAB_GUARD    a pattern matching that runner's supervisor for one job, without the job name
#   MAINT_LAB_LOCAL_PORT  local end of the tunnel (default 8090)
set -euo pipefail
HOST=${MAINT_LAB_HOST:?set MAINT_LAB_HOST}
RPORT=${MAINT_LAB_PORT:?set MAINT_LAB_PORT}
LDIR=${MAINT_LAB_DIR:?set MAINT_LAB_DIR}
SERVE=${MAINT_LAB_SERVE:?set MAINT_LAB_SERVE}
RUN_JOB=${MAINT_LAB_RUN_JOB:?set MAINT_LAB_RUN_JOB}
GUARD=${MAINT_LAB_GUARD:?set MAINT_LAB_GUARD}
LPORT=${MAINT_LAB_LOCAL_PORT:-8090}
STATE=${MAINT_EVAL_STATE:?set MAINT_EVAL_STATE}
mkdir -p "$STATE/logs"
# A pattern that never matches the shell running pkill itself: bracket its first letter.
self_safe() { printf '[%s]%s' "${1:0:1}" "${1:1}"; }

case "${1:-}" in
start)
  name=$2; gguf=$3; ctx=${4:-8192}; shift 4 || shift $#
  job="maint-eval-$(echo "$name" | tr 'A-Z.' 'a-z-')-$(date +%H%M%S)"
  # Never two servers: stop anything of ours on the port first (its job and lock end with it).
  ssh "$HOST" "pkill -f '$(self_safe "llama-server .*--port $RPORT")' || true"; sleep 2
  ssh -n "$HOST" "mkdir -p $LDIR/logs && cd $LDIR && echo $job > logs/current.job && setsid nohup $RUN_JOB \
     --name $job --min-free-gib 30 --max-seconds 14400 -- $SERVE \
     $gguf $RPORT $ctx $* > logs/$job.log 2>&1 < /dev/null &" > /dev/null 2>&1 &
  sleep 3
  pkill -f "ssh -N -L $LPORT:127.0.0.1:$RPORT" 2>/dev/null || true
  ssh -N -L "$LPORT:127.0.0.1:$RPORT" "$HOST" > "$STATE/logs/tunnel.log" 2>&1 < /dev/null &
  for _ in $(seq 1 1800); do  # waits for the shared lease too (up to an hour)
    # Ready only when the server answering is the model we asked for.
    if curl -sf "http://127.0.0.1:$LPORT/v1/models" 2>/dev/null | grep -q "$(basename "$gguf")"; then echo "ready: $job"; exit 0; fi
    sleep 2
  done
  echo "not ready; see the lab log logs/$job.log" >&2; ssh "$HOST" "tail -20 $LDIR/logs/$job.log"; exit 1
  ;;
stop)
  # Also cancel a job of ours still waiting for the lease, so it can never take the lock unattended.
  ssh "$HOST" "pkill -f '$(self_safe "$GUARD") --name maint-eval-' || true; pkill -f '$(self_safe "llama-server .*--port $RPORT")' || true; sleep 2; tail -3 $LDIR/logs/\$(cat $LDIR/logs/current.job).log"
  pkill -f "ssh -N -L $LPORT:127.0.0.1:$RPORT" 2>/dev/null || true
  echo stopped
  ;;
*)
  echo "usage: lab.sh start NAME GGUF [CTX] [args] | stop" >&2; exit 2;;
esac
