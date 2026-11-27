#!/usr/bin/env bash
# Query-side EmbeddingGemma 2 for `harvest --embedder http://127.0.0.1:PORT --embedder-gguf FILE`:
# the bake's GGUF with the bake's server arguments.  LLAMA_SERVER=<llama.cpp>/build-cuda/bin/llama-server
#   serve_embed.sh <port> <max-seconds>
set -euo pipefail
P=$1; T=$2; LAB=${LAB:-$HOME/crane-eval}
exec timeout "$T" "${LLAMA_SERVER:?}" -m "$LAB/home/models/embeddinggemma-2-Q8_0.gguf" \
  --embedding --port "$P" --host 127.0.0.1 -c 8192 -b 8192 -ub 8192 -np 1 > "$LAB/logs/serve-embed-$P.log" 2>&1
