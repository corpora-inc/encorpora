#!/usr/bin/env bash
# One-time setup for the tutomaton-eval harness: a venv with py3langid
# (pure-Python language ID; no compiler, no model download).
# llama-server / the GGUF are assumed already present (see README).
set -euo pipefail
cd "$(dirname "$0")"

python3 -m venv .venv
source .venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
echo "setup done. Activate with: source infra/tutomaton-eval/.venv/bin/activate"
