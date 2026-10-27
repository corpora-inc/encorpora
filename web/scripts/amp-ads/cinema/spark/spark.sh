#!/usr/bin/env bash
# shellcheck disable=SC2029,SC1091,SC2153  # remote paths expand locally on purpose
# Local helper for the GPU host. Every remote command here is read-only except
# `launch`, which copies a new batch dir and starts its supervisor.
#   spark.sh preflight                     load, memory, GPU, running batches (read-only)
#   spark.sh launch <local-batch-dir>      rsync the batch, start supervise.sh under nohup
#   spark.sh status <batch>                tail the supervisor log + job states
#   spark.sh sync <batch> <local-dir> [--watch]   pull finished clips + receipts, rebuild the gallery
# Requires AMP_SPARK_HOST (ssh alias) and AMP_SPARK_ROOT (amp-cinema dir on the host);
# sync also needs AMP_SPARK_OUTPUTS (where the generator writes <name>.mp4/.json).
set -euo pipefail
: "${AMP_SPARK_HOST:?set AMP_SPARK_HOST to the GPU host ssh alias}"
: "${AMP_SPARK_ROOT:?set AMP_SPARK_ROOT to the amp-cinema directory on the GPU host}"
HERE="$(cd "$(dirname "$0")/../.." && pwd)"   # web/scripts/amp-ads
cmd="${1:-}"
case "$cmd" in
  preflight)
    ssh "$AMP_SPARK_HOST" 'uptime; free -g | head -2; nvidia-smi --query-gpu=utilization.gpu,temperature.gpu,memory.used --format=csv,noheader 2>/dev/null || true; echo "running batches:"; pgrep -af "supervise.sh|guard-v1/batch.py" || echo "  none"'
    ;;
  launch)
    dir="${2:?local batch dir}"
    # shellcheck source=/dev/null
    . "$dir/batch.env"
    if ssh "$AMP_SPARK_HOST" "test -e '$AMP_SPARK_ROOT/$BATCH'"; then
      echo "$AMP_SPARK_ROOT/$BATCH already exists on the host; batches are never overwritten" >&2; exit 1
    fi
    rsync -a "$dir/" "$AMP_SPARK_HOST:$AMP_SPARK_ROOT/$BATCH/"
    ssh "$AMP_SPARK_HOST" "cd '$AMP_SPARK_ROOT/$BATCH' && nohup bash supervise.sh . > supervise.log 2>&1 < /dev/null &"
    echo "launched $BATCH; it queues behind any running batch. Check: spark.sh status $BATCH"
    ;;
  status)
    b="${2:?batch}"
    ssh "$AMP_SPARK_HOST" "tail -3 '$AMP_SPARK_ROOT/$b/supervise.log'; python3 -c \"import json,collections;s=json.load(open('$AMP_SPARK_ROOT/$b/status.json'));print(dict(collections.Counter(v.get('status') for v in s.values())))\" 2>/dev/null || true"
    ;;
  sync)
    b="${2:?batch}"
    : "${AMP_SPARK_OUTPUTS:?set AMP_SPARK_OUTPUTS to the generator output dir on the host}"
    mkdir -p "${3:?local dir}/clips"
    local_dir="$(cd "$3" && pwd)"
    while :; do
      scp -q "$AMP_SPARK_HOST:$AMP_SPARK_ROOT/$b/plan.json" "$AMP_SPARK_HOST:$AMP_SPARK_ROOT/$b/batch.env" "$local_dir/"
      prefix=$(. "$local_dir/batch.env" && echo "$PREFIX")
      rsync -a --include="$prefix-*.mp4" --include="$prefix-*.json" --exclude='*' \
        "$AMP_SPARK_HOST:$AMP_SPARK_OUTPUTS/" "$local_dir/clips/"
      ssh "$AMP_SPARK_HOST" "tail -1 '$AMP_SPARK_ROOT/$b/supervise.log'" > "$local_dir/spark-status.txt" 2>/dev/null || true
      (cd "$HERE" && python3 -m cinema gallery "$local_dir")
      [ "${4:-}" = "--watch" ] || break
      sleep 300
    done
    ;;
  *)
    sed -n '3,10p' "$0"; exit 2
    ;;
esac
