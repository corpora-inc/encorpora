#!/usr/bin/env bash
# The query embedder and one LLM in a single guarded GPU job (the shared GPU lease is exclusive).
#   serve_pair.sh <embed-port> <llm-label> <llm-gguf> <llm-port> <max-seconds>
set -uo pipefail
EP=$1; L=$2; M=$3; LP=$4; T=$5; LAB=${LAB:-$HOME/crane-eval}; LS=${LLAMA_SERVER:?}
"$LS" -m "$LAB/home/models/embeddinggemma-2-Q8_0.gguf" --embedding --port "$EP" --host 127.0.0.1 \
  -c 8192 -b 8192 -ub 8192 -np 1 > "$LAB/logs/serve-embed-$EP.log" 2>&1 &
E=$!
"$LS" -m "$M" --host 127.0.0.1 --port "$LP" -c 12288 -np 3 --jinja --no-webui -ngl 99 -fa on \
  > "$LAB/logs/serve-$L.log" 2>&1 &
G=$!
( sleep "$T"; kill $E $G 2>/dev/null ) &
K=$!
trap 'kill $E $G $K 2>/dev/null' EXIT TERM INT
wait -n $E $G     # either server exiting (or the timer) ends the job
