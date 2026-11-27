#!/usr/bin/env bash
# Build the crane pack from an exported tree, with the embedder as a separate llama-server whose
# log goes to a file (the pipeline's own embedder start stalls: its llama-server stderr is a pipe
# nobody reads, and the server blocks once the pipe fills).
#   LAB=~/crane-eval LLAMA_SERVER=<llama.cpp>/build-cuda/bin/llama-server build_pack.sh <tree> <tag>
set -euo pipefail
SRC=$1; TAG=$2; LAB=${LAB:-$HOME/crane-eval}
export HARVEST_HOME=$LAB/home HARVEST_SIGNING_KEY_FILE=$LAB/keys/eval.pem
PORT=${PORT:-18096}
"${LLAMA_SERVER:?}" -m $HARVEST_HOME/models/embeddinggemma-2-Q8_0.gguf --embedding --port $PORT \
  --host 127.0.0.1 -c 8192 -b 8192 -ub 8192 -np 1 > $LAB/logs/embed-$TAG.log 2>&1 &
SRV=$!
trap "kill $SRV 2>/dev/null || true" EXIT
ok=0
for i in $(seq 120); do curl -sf "http://127.0.0.1:$PORT/health" >/dev/null && { ok=1; break; }; sleep 1; done
test $ok = 1 || { echo "embedder did not become healthy; see $LAB/logs/embed-$TAG.log" >&2; exit 1; }
cd "$SRC/crane/content"
cp corpus.sources.lock.json corpus.eval.sources.lock.json
sed "s|^embedder: {kind: embeddinggemma-2}|embedder: {kind: embeddinggemma-2, base_url: \"http://127.0.0.1:$PORT\"}|" \
  corpus.yaml > corpus.eval.yaml
$LAB/venv/bin/harvest-bake build corpus.eval.yaml
