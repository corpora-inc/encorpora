"""The lab models and a runner that serves one at a time (through lab.sh and the lab machine's shared
job runner) and runs a list of configurations against it, then stops the server so the machine is free.

MAINT_LAB_MODELS names the directory on the lab machine that holds the model files below.

  python -m maint_eval.plan <model-key>[,<model-key>...] "<cli args> ; <cli args> ; ..."

Every configuration is `maint_eval run ...` arguments without --system (the model's system name is
filled in). US-developed open-weight models only.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

from .paths import EMPTY_DIR

M = os.environ.get("MAINT_LAB_MODELS", "$MAINT_LAB_MODELS")  # resolved before a model is served
MODELS = {
    # key: (system name, gguf, developer, device class, has thinking)
    "gemma4-e2b": ("gemma-4-e2b-qat", f"{M}/google__gemma-4-E2B-it-qat-q4_0-gguf/gemma-4-E2B_q4_0-it.gguf", "Google", "phone", True),
    "gemma4-e4b": ("gemma-4-e4b-qat", f"{M}/google__gemma-4-E4B-it-qat-q4_0-gguf/gemma-4-E4B_q4_0-it.gguf", "Google", "phone/tablet", True),
    "gemma4-12b": ("gemma-4-12b-qat", f"{M}/google__gemma-4-12B-it-qat-q4_0-gguf/gemma-4-12b-it-qat-q4_0.gguf", "Google", "laptop", True),
    "gemma4-26b": ("gemma-4-26b-a4b-qat", f"{M}/google__gemma-4-26B-A4B-it-qat-q4_0-gguf/gemma-4-26B_q4_0-it.gguf", "Google", "laptop/edge box", True),
    "granite42-3b": ("granite-4.2-3b-q4km", f"{M}/ibm-granite__granite-4.2-3b-GGUF/granite-4.2-3b-Q4_K_M.gguf", "IBM", "phone", True),
    "granite42-8b": ("granite-4.2-8b-q4km", f"{M}/ibm-granite__granite-4.2-8b-GGUF/granite-4.2-8b-Q4_K_M.gguf", "IBM", "tablet/laptop", True),
    "granite42-30b": ("granite-4.2-30b-q4km", f"{M}/ibm-granite__granite-4.2-30b-GGUF/granite-4.2-30b-Q4_K_M.gguf", "IBM", "edge box", True),
    "granite40-micro": ("granite-4.0-h-micro-q4km", f"{M}/ibm-granite__granite-4.0-h-micro-GGUF/granite-4.0-h-micro-Q4_K_M.gguf", "IBM", "phone", False),
    "granite40-tiny": ("granite-4.0-h-tiny-q4km", f"{M}/ibm-granite__granite-4.0-h-tiny-GGUF/granite-4.0-h-tiny-Q4_K_M.gguf", "IBM", "phone/tablet", False),
    "gptoss-20b": ("gpt-oss-20b-mxfp4", f"{M}/ggml-org__gpt-oss-20b-GGUF/gpt-oss-20b-MXFP4.gguf", "OpenAI", "laptop/edge box", True),
    "nemotron-e4b": ("nemotron-3.5-bolt-e4b-q4km", f"{M}/nvidia__NVIDIA-Nemotron-3.5-Bolt-E4B-4GB/Nemotron-3.5-Bolt-E4B-Q4_K_M.gguf", "NVIDIA", "phone/tablet", True),
    "llama32-3b": ("llama-3.2-3b-q4km", f"{M}/bartowski__Llama-3.2-3B-Instruct-GGUF/Llama-3.2-3B-Instruct-Q4_K_M.gguf", "Meta", "phone", False),
}
LAB = Path(__file__).resolve().parents[1] / "lab.sh"
P = sys.executable


def run_model(key: str, configs: list[list[str]], engine: str, start: bool = True) -> None:
    name, gguf, *_ = MODELS[key]
    if gguf.startswith("$MAINT_LAB_MODELS"):
        raise SystemExit("MAINT_LAB_MODELS is not set: the model directory on the lab machine")
    if start:
        # lab.sh leaves a tunnel running: give it no pipe of ours, or this call would never return.
        s = subprocess.run([str(LAB), "start", key, gguf, "16384"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                           stdin=subprocess.DEVNULL, text=True, timeout=4000)
        print(s.stdout.strip()[-400:], flush=True)
        if s.returncode:
            subprocess.run([str(LAB), "stop"], capture_output=True, text=True)
            return
    try:
        for c in configs:
            args = [P, "-m", "maint_eval", "--engine", engine, "run", *c, "--system", f"local:{name}"]
            env = {**os.environ, "MAINT_EVAL_EXPECT_GGUF": Path(gguf).name}
            p = subprocess.run(args, capture_output=True, text=True, cwd=str(EMPTY_DIR), env=env)
            if p.returncode:
                print(key, " ".join(c), "FAILED", p.stderr[-600:], flush=True)
                continue
            sm = json.loads(p.stdout)
            keep = {k: sm.get(k) for k in ("accuracy_all", "wrong_pick_rate", "all_accuracy", "answer_when_available",
                                           "unanswerable_declined", "connector_unsupported", "errors")}
            print(key, " ".join(c), json.dumps({k: (v.get("p") if isinstance(v, dict) else v) for k, v in keep.items()}),
                  "p50", sm.get("latency_s", {}).get("total", {}).get("p50"), flush=True)
    finally:
        subprocess.run([str(LAB), "stop"], capture_output=True, text=True)


def main() -> None:
    keys = sys.argv[1].split(",")
    configs = [c.split() for c in sys.argv[2].split(";") if c.split()]
    engine = sys.argv[3] if len(sys.argv) > 3 else "http://127.0.0.1:4392"
    start = "--no-start" not in sys.argv  # the first model's server is already up
    for i, k in enumerate(keys):
        run_model(k, configs, engine, start=start or i > 0)


if __name__ == "__main__":
    main()
