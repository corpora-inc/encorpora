"""Open-weight models behind llama.cpp's `llama-server` (OpenAI-compatible), reached through an SSH tunnel.

Every request is schema-constrained (`response_format: json_schema`, which llama-server compiles to a
grammar), streamed so time to first token is measured, and cached and ledgered like a Claude call.
Thinking is switched per model family through the chat template:
* gemma / granite / nemotron / generic: chat_template_kwargs.enable_thinking = true|false
* gpt-oss: chat_template_kwargs.reasoning_effort = low|medium|high (it has no "off"; "off" maps to low)
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request

from . import ledger


def think_kwargs(model: str, think: str) -> dict:
    m = model.lower()
    if "gpt-oss" in m:
        return {"chat_template_kwargs": {"reasoning_effort": {"off": "low", "on": "medium"}.get(think, think)}}
    on = think not in ("off", "", None)
    # Gemma 4 and Nemotron read enable_thinking; Granite reads thinking. Unknown keys are ignored.
    return {"chat_template_kwargs": {"enable_thinking": on, "thinking": on}}


def chat(endpoint: str, model: str, system: str, user: str, schema: dict | None, think: str = "off",
         temperature: float = 0.0, seed: int = 0, max_tokens: int = 512, tag: str = "", timeout: float = 300,
         cache: bool = True) -> dict:
    payload = {"system": system, "user": user, "schema": schema, "think": think, "temperature": temperature,
               "seed": seed, "max_tokens": max_tokens}

    def run() -> dict:
        body = {"model": model, "temperature": temperature, "seed": seed, "max_tokens": max_tokens,
                "stream": True, "stream_options": {"include_usage": True},
                "messages": ([{"role": "system", "content": system}] if system else [])
                + [{"role": "user", "content": user}], **think_kwargs(model, think)}
        # At the default temperature distinct seeds per run give distinct samples (run-to-run agreement).
        if schema is not None:
            body["response_format"] = {"type": "json_schema", "json_schema": {"name": "decision", "schema": schema,
                                                                              "strict": True}}
        req = urllib.request.Request(f"{endpoint.rstrip('/')}/chat/completions", data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json"})
        t0 = time.perf_counter()
        ttft = None
        content, reasoning = [], []
        usage, timings, finish = {}, {}, None
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                for raw in r:
                    line = raw.decode("utf-8", "replace").strip()
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    ev = json.loads(data)
                    served = ev.get("model") or ""
                    want = os.environ.get("MAINT_EVAL_EXPECT_GGUF")
                    if want and served and want not in served:
                        # Another model answers on this port (the lab server changed): never record it.
                        return {"ok": False, "error": f"served by {served}, expected {want}", "seconds": 0.0}
                    if ev.get("usage"):
                        usage = ev["usage"]
                    if ev.get("timings"):
                        timings = ev["timings"]
                    for ch in ev.get("choices") or []:
                        d = ch.get("delta") or {}
                        if d.get("content") or d.get("reasoning_content"):
                            if ttft is None:
                                ttft = time.perf_counter() - t0
                        if d.get("content"):
                            content.append(d["content"])
                        if d.get("reasoning_content"):
                            reasoning.append(d["reasoning_content"])
                        if ch.get("finish_reason"):
                            finish = ch["finish_reason"]
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            return {"ok": False, "error": f"{type(e).__name__}: {e}", "seconds": time.perf_counter() - t0}
        secs = time.perf_counter() - t0
        text = "".join(content)
        out: object = text
        ok = True
        err = None
        if schema is not None:
            try:
                out = json.loads(text)
            except json.JSONDecodeError as e:
                ok, err = False, f"bad json ({finish}): {e}: {text[:200]}"
        rtext = "".join(reasoning)
        return {"ok": ok, "error": err, "output": out, "reasoning": rtext[:4000], "finish": finish,
                "seconds": secs, "ttft": ttft, "model_id": model,
                "usage": {"input_tokens": usage.get("prompt_tokens", timings.get("prompt_n", 0)),
                          "output_tokens": usage.get("completion_tokens", timings.get("predicted_n", 0)),
                          "reasoning_tokens": usage.get("completion_tokens_details", {}).get("reasoning_tokens", 0)
                          if isinstance(usage.get("completion_tokens_details"), dict) else 0,
                          "cost_usd": 0.0},
                "timings": timings}

    if not cache:
        return run()
    return ledger.cached("local", f"local:{model}", payload, run, tag=tag)
