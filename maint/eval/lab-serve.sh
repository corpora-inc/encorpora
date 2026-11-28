#!/usr/bin/env bash
# The serve script lab.sh starts on the lab machine (copy it to $MAINT_LAB_SERVE there).
# llama-server, OpenAI-compatible, with the model's chat template (--jinja) so json_schema
# constrained output and the thinking switches work.
#   usage: lab-serve.sh MODEL_GGUF PORT CTX [extra llama-server args]
#   LLAMA_SERVER: path to a CUDA build of llama-server on that machine
set -euo pipefail
B=${LLAMA_SERVER:?set LLAMA_SERVER}
export LD_LIBRARY_PATH="$(dirname "$B")${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
exec nice -n 20 "$B" -m "$1" --host 127.0.0.1 --port "$2" -c "$3" -np 1 -ngl 99 \
  --jinja --no-webui --metrics "${@:4}"
