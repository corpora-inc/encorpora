#!/usr/bin/env bash
# Runs ON THE GPU HOST. Feeds plan.json through the guarded batch runner
# ($AMP_SPARK_ROOT/guard-v1/batch.py: memory, thermal and shared-workload-lock
# guards). A failed or guard-aborted job is quarantined (evidence kept, never
# retried) and the batch continues; a deferred/cancelled run stops for a human; three consecutive failures with no progress stop the run.
# A second batch waits for the runner's queue lease instead of competing.
# Usage: bash supervise.sh <batch-dir>     (the dir holding batch.env + plan.json)
set -u
D="$(cd "${1:-.}" && pwd)"
# shellcheck source=/dev/null
. "$D/batch.env"
B="$AMP_SPARK_ROOT"
ATT="$B/guard-runs/$BATCH"
[ -f "$D/active-plan.json" ] || cp "$D/plan.json" "$D/active-plan.json"
fails=0
done_prev=x
while :; do
  python3 "$B/guard-v1/batch.py" --plan "$D/active-plan.json" --outputs "$AMP_SPARK_OUTPUTS" --models "$B" \
    --status "$D/status.json" --attempts "$ATT" --lock "$B/workload.lock" \
    --start-free-gib "$START_FREE_GIB" --stop-free-gib "$STOP_FREE_GIB" \
    --emergency-free-gib "$EMERGENCY_FREE_GIB" --max-seconds "$MAX_SECONDS" --max-temp-c "$MAX_TEMP_C" \
    --wait-for-queue-seconds 86400 && { echo "ALL DONE $(date)"; exit 0; }
  # failed/aborted are the job's own outcome: quarantine. deferred/cancelled/other mean the
  # host or queue stopped the run (memory, temperature, lease): stop for a human instead.
  bad=$(python3 -c "import json,sys;s=json.load(open(sys.argv[1]));print(' '.join(k for k,v in s.items() if v.get('status') in ('failed','aborted')))" "$D/status.json")
  other=$(python3 -c "import json,sys;s=json.load(open(sys.argv[1]));print(' '.join(k+'='+str(v.get('status')) for k,v in s.items() if v.get('status') not in ('complete','failed','aborted')))" "$D/status.json")
  [ -n "$other" ] && { echo "stopped without a job failure ($other); inspect $D/status.json"; exit 1; }
  [ -z "$bad" ] && { echo "stopped with no failed job; inspect $D/status.json"; exit 1; }
  done_now=$(python3 -c "import json,sys;print(sum(v.get('status')=='complete' for v in json.load(open(sys.argv[1])).values()))" "$D/status.json")
  [ "$done_now" != "$done_prev" ] && fails=0
  done_prev=$done_now
  fails=$((fails + 1))
  [ "$fails" -ge 3 ] && { echo "3 consecutive failures, stopping: $bad"; exit 1; }
  mkdir -p "$ATT-failed"
  for n in $bad; do
    echo "QUARANTINE $n $(date)"
    [ -d "$ATT/$n" ] && mv "$ATT/$n" "$ATT-failed/"
  done
  # shellcheck disable=SC2086  # one argument per failed job
  python3 - "$D" $bad <<'PY'
import json, sys
d, bad = sys.argv[1], set(sys.argv[2:])
plan = json.load(open(d + '/active-plan.json'))
json.dump([j for j in plan if j['name'] not in bad], open(d + '/active-plan.json', 'w'), indent=2)
status = json.load(open(d + '/status.json'))
for b in bad:
    status.pop(b, None)
json.dump(status, open(d + '/status.json', 'w'), indent=2)
PY
  sleep "${QUARANTINE_PAUSE:-30}"
done
