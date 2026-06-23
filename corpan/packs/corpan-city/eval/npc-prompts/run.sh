#!/usr/bin/env bash
# run.sh — end-to-end NPC prompt study.
#   1. bundle + compose the prompt matrix via the REAL composeSystemPrompt
#   2. start (or reuse) llama-server with the SHIPPED Qwen3-4B GGUF
#   3. run multi-turn conversations through the model
#   4. score them (programmatic judge; optional strong LLM judge)
#   5. aggregate statistics + emit out/summary.json and the human report
#
# Usage:
#   ./run.sh                      # default: balanced subset, 3 reps, programmatic judge
#   REPS=5 MAX_PER_VARIANT=30 ./run.sh
#   LLM_JUDGE=openai ./run.sh     # add a strong LLM judge (needs OPENAI_API_KEY)
#   FULL=1 ./run.sh               # run every cell in the matrix (slow)
set -euo pipefail
cd "$(dirname "$0")"

SERVER="${SERVER:-http://127.0.0.1:8099}"
MODEL="${MODEL:-$HOME/Library/Application Support/com.corpora.corpan/corpan-packs/llm-base-qwen3-4b-v1/model/base.gguf}"
REPS="${REPS:-3}"
MAX_PER_VARIANT="${MAX_PER_VARIANT:-18}"
LLM_JUDGE="${LLM_JUDGE:-none}"
LLM_SAMPLE="${LLM_SAMPLE:-0}"
WORKERS="${WORKERS:-4}"
SLOTS="${SLOTS:-$WORKERS}"
PY=.venv/bin/python

if [ ! -x "$PY" ]; then
  echo "[run.sh] creating venv..."
  python3 -m venv .venv
  "$PY" -m pip install -q --upgrade pip
  "$PY" -m pip install -q requests numpy
fi

echo "[run.sh] 1/5 compose prompt matrix (real composeSystemPrompt)"
node scripts/bundle.mjs
node out/compose.mjs > out/cells.json
echo "       cells: $($PY -c 'import json;print(json.load(open("out/cells.json"))["cellCount"])')"

echo "[run.sh] 2/5 ensure llama-server (shipped Qwen3-4B GGUF)"
if ! curl -s "$SERVER/health" >/dev/null 2>&1; then
  echo "       starting llama-server on $SERVER ..."
  # -c is the TOTAL kv budget shared across slots, so give each slot ~4096.
  CTX=$((4096 * SLOTS))
  nohup llama-server -m "$MODEL" -c "$CTX" -ngl 99 --parallel "$SLOTS" \
    --host 127.0.0.1 --port "${SERVER##*:}" --jinja \
    > /tmp/wp-llama-server.log 2>&1 &
  for i in $(seq 1 120); do
    curl -s "$SERVER/health" | grep -q '"status":"ok"' && break || sleep 1
  done
fi
curl -s "$SERVER/health" | grep -q '"status":"ok"' || { echo "server not ready"; exit 1; }
echo "       server ready."

echo "[run.sh] 3/5 run conversations (reps=$REPS, max/variant=$MAX_PER_VARIANT)"
EXTRA=""
[ "${FULL:-0}" = "1" ] && MAX_PER_VARIANT=0
"$PY" run_model.py --server "$SERVER" --reps "$REPS" --workers "$WORKERS" \
  --max-cells-per-variant "$MAX_PER_VARIANT" --repeat-visits

echo "[run.sh] 4/5 judge"
"$PY" judge.py --llm-judge "$LLM_JUDGE" --llm-sample "$LLM_SAMPLE"
# Score the repeat-visit transcripts too (reuse judge on the flattened visits).
"$PY" - <<'PYEOF'
import json
# Flatten repeat_visits.jsonl into per-visit conversations and score them.
import subprocess, os
src = "out/repeat_visits.jsonl"
if os.path.exists(src):
    flat = "out/repeat_visits_flat.jsonl"
    with open(src) as fin, open(flat, "w") as fout:
        for line in fin:
            rec = json.loads(line)
            for v in rec["visits"]:
                v["_group"] = rec["variantId"]
                fout.write(json.dumps(v, ensure_ascii=False) + "\n")
    subprocess.run([".venv/bin/python", "judge.py",
                    "--transcripts", flat,
                    "--out", "out/repeat_visits_scores.jsonl"], check=True)
PYEOF

echo "[run.sh] 5/5 statistics"
"$PY" stats.py --repeat-visits-scores out/repeat_visits_scores.jsonl | tee out/report.txt

echo "[run.sh] fill study doc (docs/NPC_PROMPT_STUDY.md)"
"$PY" fill_doc.py || echo "[run.sh] fill_doc skipped (no summary)"

echo "[run.sh] done. Artifacts in out/ ; report at out/report.txt"
