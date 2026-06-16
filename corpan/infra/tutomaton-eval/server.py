"""llama-server lifecycle + a faithful /completion client.

We hit the RAW /completion endpoint (not /v1/chat/completions) with our own
ChatML string, because the plugin hand-rolls ChatML and does NOT apply the
GGUF's jinja chat template. The sampler is reproduced in the plugin's exact
order (state.rs build_sampler):
    penalties(last_n=64, repeat, freq=0, presence) → top_k → top_p → min_p →
    temp → dist(seed);  temp<=0 ⇒ greedy.
"""

from __future__ import annotations

import json
import os
import signal
import subprocess
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field

# Default = the installed 4B base; override with TUTO_EVAL_MODEL=/path/to.gguf to
# evaluate the smaller tiers (0.6B/1.7B). Pair with TUTO_EVAL_NOTHINK=1 for the
# hybrid models so the eval matches their real non-thinking shipping config.
MODEL = os.environ.get(
    "TUTO_EVAL_MODEL",
    os.path.expanduser(
        "~/Library/Application Support/com.corpora.corpan/corpan-packs/"
        "llm-base-qwen3-4b-v1/model/base.gguf"
    ),
)
LLAMA_SERVER = "/opt/homebrew/bin/llama-server"
HOST = "127.0.0.1"
PORT = 8089
BASE = f"http://{HOST}:{PORT}"

# Sampler chain order, matching state.rs:830-837. `dist` is the implicit final
# pick; `penalties` carries repeat_last_n + frequency(0) + presence separately.
SAMPLER_ORDER = ["penalties", "top_k", "top_p", "min_p", "temperature"]


@dataclass(frozen=True)
class Params:
    """The 7 numeric levers (systemPrompt is handled in prompts.py). Defaults =
    the pack's current DEFAULT_MODEL_OPTIONS (modelTuning.ts:12-20)."""
    temperature: float = 0.6
    top_p: float = 0.95
    top_k: int = 20
    min_p: float = 0.0
    repeat_penalty: float = 1.0
    presence_penalty: float = 0.0
    max_tokens: int = 700

    def key(self) -> str:
        return (f"t{self.temperature}_p{self.top_p}_k{self.top_k}_mp{self.min_p}"
                f"_rp{self.repeat_penalty}_pp{self.presence_penalty}"
                f"_mt{self.max_tokens}")


class Server:
    def __init__(self, parallel: int = 1, ctx: int = 4096, ngl: int = 999):
        self.parallel = parallel
        self.ctx = ctx
        self.ngl = ngl
        self.proc: subprocess.Popen | None = None

    def start(self, timeout: float = 180.0) -> None:
        if not os.path.exists(MODEL):
            raise FileNotFoundError(MODEL)
        cmd = [
            LLAMA_SERVER, "-m", MODEL,
            "--host", HOST, "--port", str(PORT),
            "--ctx-size", str(self.ctx * self.parallel),
            "--n-gpu-layers", str(self.ngl),
            "--parallel", str(self.parallel),
            "--no-webui",
        ]
        self.proc = subprocess.Popen(
            cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        deadline = time.time() + timeout
        while time.time() < deadline:
            if self.proc.poll() is not None:
                raise RuntimeError("llama-server exited during startup")
            try:
                with urllib.request.urlopen(f"{BASE}/health", timeout=2) as r:
                    if json.loads(r.read()).get("status") == "ok":
                        return
            except Exception:
                time.sleep(1.0)
        raise TimeoutError("llama-server did not become healthy")

    def stop(self) -> None:
        if self.proc and self.proc.poll() is None:
            self.proc.send_signal(signal.SIGTERM)
            try:
                self.proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        self.proc = None

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, *a):
        self.stop()

    def complete(self, prompt: str, p: Params, seed: int,
                 timeout: float = 120.0) -> str:
        body = {
            "prompt": prompt,
            "n_predict": p.max_tokens,
            "temperature": p.temperature,
            "top_p": p.top_p,
            "top_k": p.top_k,
            "min_p": p.min_p,
            "repeat_penalty": p.repeat_penalty,
            "repeat_last_n": 64,
            "frequency_penalty": 0.0,
            "presence_penalty": p.presence_penalty,
            "samplers": SAMPLER_ORDER,
            "seed": seed,
            "cache_prompt": True,
            "stop": ["<|im_end|>", "<|im_start|>"],
            "stream": False,
        }
        data = json.dumps(body).encode()
        # Resilience for the unattended multi-hour run: retry transient failures,
        # and from the 2nd attempt restart the server (recovers a wedged/dead
        # llama-server). A persistent per-request 500 (e.g. a poison prompt) is
        # raised after the retries so the caller can record an empty row and move
        # on instead of aborting the whole sweep.
        last_err: Exception | None = None
        for attempt in range(4):
            try:
                req = urllib.request.Request(
                    f"{BASE}/completion", data=data,
                    headers={"Content-Type": "application/json"},
                )
                with urllib.request.urlopen(req, timeout=timeout) as r:
                    return json.loads(r.read()).get("content", "")
            except Exception as e:  # noqa: BLE001 — any error is retryable here
                last_err = e
                if attempt >= 1:
                    try:
                        self.stop()
                        self.start()
                    except Exception:
                        pass
                time.sleep(1.5 * (attempt + 1))
        raise last_err if last_err else RuntimeError("complete failed")
