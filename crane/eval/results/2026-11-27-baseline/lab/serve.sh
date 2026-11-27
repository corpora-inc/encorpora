#!/usr/bin/env bash
# One baseline model behind llama-server, 3 slots of 4,096 tokens, all layers on the GPU.
#   LLAMA_SERVER=<llama.cpp>/build-cuda/bin/llama-server serve.sh <label> <gguf> <port> <max-seconds>
set -euo pipefail
L=$1; M=$2; P=$3; T=$4; shift 4; LAB=${LAB:-$HOME/crane-eval}
exec timeout $T "${LLAMA_SERVER:?}" -m "$M" --host 127.0.0.1 --port $P \
  -c 12288 -np 3 --jinja --no-webui -ngl 99 -fa on "$@" > $LAB/logs/serve-$L.log 2>&1
