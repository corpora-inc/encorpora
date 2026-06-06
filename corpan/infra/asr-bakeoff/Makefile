# Portable, one-command, resumable ASR bake-off — GPU desktop leg (DGX Spark).
#
# Quickstart (on the DGX, CUDA box):
#   make setup            # project-local venv + CUDA deps + sherpa models
#   make north-star       # Qwen3-ASR-0.6B across all langs, BOTH tiers → DECISION.md
#   make full             # then the rest (whisper/parakeet/sensevoice), resumable
#   make report           # re-render DECISION.md anytime (reads results only)
#
# Everything is RESUMABLE (skips done lang/engine/source triples) and writes to
# results/rows.jsonl → results/DECISION.md. Run `make north-star` first: it
# emits Qwen3's full table (FLEURS + domain) before any heavy model, so the
# owner sees the answer without waiting for the 4-model matrix.
#
# DEVICE numbers (Android CPU latency, iOS co-resident-with-4B RAM) are NOT
# from this box — see device/RUNBOOK.md (mobile, owner-run). DGX = quality only.

VENV    ?= .venv
PY      := $(VENV)/bin/python
PIP     := $(VENV)/bin/pip
SAMPLES ?= 20
DEVICE  ?= cuda
# FLEURS-only IS the decision (owner's call). The domain tier (corpan_tts +
# common_voice + gold) is an OPTIONAL appendix — opt in with TIERS=fleurs,domain.
TIERS   ?= fleurs
ENGINES_FULL ?= qwen3,whisper,parakeet,sensevoice

.PHONY: setup models north-star full domain report list tests clean help

help:
	@grep -E '^[a-z-]+:.*?##' $(MAKEFILE_LIST) | sed 's/:.*##/\t/' | sort

setup: ## create venv + install CUDA deps + fetch sherpa models
	python3 -m venv $(VENV)
	$(PIP) install -U pip
	$(PIP) install -r requirements-cuda.txt
	bash fetch_models.sh
	@echo "Setup done. For the Common Voice tier: $(VENV)/bin/huggingface-cli login"

models: ## (re)download the sherpa onnx models only
	bash fetch_models.sh

north-star: ## Qwen3-ASR-0.6B FIRST, all langs, BOTH tiers → the owner's answer
	$(PY) run_bakeoff.py --engines qwen3 --tiers $(TIERS) \
		--samples $(SAMPLES) --device $(DEVICE)
	$(PY) build_report.py

full: ## the rest of the matrix (resumable; keeps Qwen3's rows)
	$(PY) run_bakeoff.py --engines $(ENGINES_FULL) --tiers $(TIERS) \
		--samples $(SAMPLES) --device $(DEVICE)
	$(PY) build_report.py

domain: ## domain tier only (after FLEURS), all engines
	$(PY) run_bakeoff.py --engines $(ENGINES_FULL) --tiers domain \
		--samples $(SAMPLES) --device $(DEVICE)
	$(PY) build_report.py

report: ## re-render results/DECISION.md from rows.jsonl (no model calls)
	$(PY) build_report.py

list: ## print the language plan
	$(PY) run_bakeoff.py --list

tests: ## run the harness logic tests (no models needed)
	$(PY) test_harness.py

clean: ## remove caches + results (keeps DECISION.md), NOT the venv/models
	rm -rf corpus/ results/rows.jsonl __pycache__ corpora/__pycache__ adapters/__pycache__
