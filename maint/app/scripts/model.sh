#!/usr/bin/env bash
# The model for the live preview (real packs on 4340/4343/4345):
#   scripts/model.sh on    restart the preview's engines with --llm at MAINT_LLM_URL
#                          (and MAINT_LLM_MODEL, MAINT_PREFILL when set). Without MAINT_LLM_URL it
#                          starts nothing and says what is missing. It never downloads or starts a model.
#   scripts/model.sh off   restart them without a model.
# Restarting the engines gives the preview fresh device records (the fleet file is imported again).
# Then turn the model on in Records ("Use the model").
set -euo pipefail
cd "$(dirname "$0")/.."
case "${1:-}" in
  on)
    if [ -z "${MAINT_LLM_URL:-}" ]; then
      echo "model.sh on: MAINT_LLM_URL is not set, so nothing was started."
      echo "  Missing: an OpenAI-compatible endpoint with JSON-schema output, for example"
      echo "  MAINT_LLM_URL=http://<host>:<port>/v1 [MAINT_LLM_MODEL=<name>] [MAINT_PREFILL=minutes,parts] scripts/model.sh on"
      exit 0
    fi
    curl -s -o /dev/null --max-time 5 "${MAINT_LLM_URL%/}/models" || echo "model.sh: ${MAINT_LLM_URL} did not answer now; the engines start anyway and answer with the model off until it does."
    MAINT_REAL=1 scripts/loop.sh
    echo "preview engines ask the model at $MAINT_LLM_URL"
    ;;
  off)
    MAINT_LLM_URL="" MAINT_REAL=1 scripts/loop.sh
    echo "preview engines run without a model"
    ;;
  *) echo "usage: scripts/model.sh on|off" >&2; exit 2 ;;
esac
