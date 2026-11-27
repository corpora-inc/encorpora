"""LLM judges, batched and cached by input hash.

Two judgments, kept apart so neither sees what it should not:

* correctness -- sees the question, the gold answer and the system's answer.
* support     -- sees the system's claims and only the text of the sections the
  system cited (from the pack, or the reference sections for baselines). It
  never sees the gold answer.

Every call goes through headless Claude (no tools, no settings, empty cwd).
A cache entry is keyed by sha256 over (task, rubric version, model, item
payload), so re-runs and resumed runs cost nothing for unchanged inputs.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from .backends import CLAUDE_FLAGS, EMPTY_DIR

RUBRIC_VERSION = "2026-11-27.1"

CORRECTNESS_SYSTEM = """You grade answers from a question-answering system against a gold answer written from the governing regulation. Grade each item independently and literally.

declined: true if the system's answer refuses, says it cannot answer, or only points elsewhere without answering. Otherwise false.

score, for an ANSWERABLE item:
  2 = correct: every key fact in the gold answer that the question asks for (numbers, distances, intervals, who/when/conditions, exceptions) is stated correctly, and nothing stated contradicts the gold answer.
  1 = partly correct: the core is right but a key condition, number or exception is missing or imprecise, or a minor wrong detail would not change what a worker does.
  0 = wrong: contradicts the gold answer, gets the core wrong, answers a different question, or declined.
Extra correct detail is fine. Wording does not matter; substance does. Units and numbers must match.

score, for a MUST-DECLINE item (the sources cannot answer it):
  2 = declined, or clearly said the sources do not cover it and gave no invented specifics as fact.
  1 = hedged but still gave specific values, procedures or legal conclusions as if they applied.
  0 = answered with specifics as if authoritative.

why: one short line naming what was right or missing."""

CORRECTNESS_SCHEMA = {"type": "object", "properties": {"grades": {"type": "array", "items": {
    "type": "object", "properties": {
        "key": {"type": "string"}, "declined": {"type": "boolean"},
        "score": {"type": "integer", "enum": [0, 1, 2]}, "why": {"type": "string"}},
    "required": ["key", "declined", "score", "why"]}}}, "required": ["grades"]}

SUPPORT_SYSTEM = """You check whether each claim in an answer is supported by the source text the answer cited. You see only the claims and the cited text. Judge each claim on its own.

supported: the cited text states it or directly implies it (a faithful paraphrase, or a correct reading of a number or condition).
unsupported: the cited text does not say it, says something different, or the claim adds a number, condition or duty the text does not contain. If no text was cited, every factual claim is unsupported.
not_a_claim: no factual content (a greeting, a restated question, "see the section below", a statement that it cannot answer).

section_id: for a supported claim, the bracketed id of the text that supports it; otherwise null."""

SUPPORT_SCHEMA = {"type": "object", "properties": {"items": {"type": "array", "items": {
    "type": "object", "properties": {
        "key": {"type": "string"},
        "claims": {"type": "array", "items": {"type": "object", "properties": {
            "n": {"type": "integer"},
            "verdict": {"type": "string", "enum": ["supported", "unsupported", "not_a_claim"]},
            "section_id": {"anyOf": [{"type": "null"}, {"type": "string"}]}},
            "required": ["n", "verdict", "section_id"]}}},
    "required": ["key", "claims"]}}}, "required": ["items"]}


def claude_json(system: str, schema: dict, prompt: str, model: str, binary: str = "claude",
                timeout: int = 1200) -> tuple[dict, list[str], float | None]:
    os.makedirs(EMPTY_DIR, exist_ok=True)
    cmd = [binary, "-p", *CLAUDE_FLAGS, "--model", model, "--system-prompt", system,
           "--json-schema", json.dumps(schema), "--output-format", "json"]
    p = subprocess.run(cmd, input=prompt, capture_output=True, text=True, cwd=EMPTY_DIR, timeout=timeout)
    try:
        out = json.loads(p.stdout)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"judge failed (exit {p.returncode}): {p.stderr[-500:]} {p.stdout[-500:]}") from e
    if out.get("is_error") or not out.get("structured_output"):
        raise RuntimeError(f"judge returned no structured output: {str(out)[:500]}")
    return out["structured_output"], list((out.get("modelUsage") or {}).keys()), out.get("total_cost_usd")


class Judge:
    def __init__(self, cache_dir: Path, model: str = "opus", binary: str = "claude", per_call: int = 6,
                 jobs: int = 3, call=claude_json):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.model = model
        self.binary = binary
        self.per_call = per_call
        self.jobs = min(jobs, 3)
        self.call = call
        self.cost_usd = 0.0
        self.calls = 0
        self.models: set[str] = set()
        self._lock = threading.Lock()

    def _key(self, task: str, model: str, payload: dict) -> str:
        blob = json.dumps({"task": task, "rubric": RUBRIC_VERSION, "model": model, "payload": payload},
                          sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(blob.encode()).hexdigest()

    def _get(self, h: str) -> dict | None:
        f = self.cache_dir / f"{h}.json"
        return json.loads(f.read_text()) if f.exists() else None

    def _put(self, h: str, v: dict) -> None:
        tmp = self.cache_dir / f".{h}.{os.getpid()}.{threading.get_ident()}.tmp"
        tmp.write_text(json.dumps(v, ensure_ascii=False))
        os.replace(tmp, self.cache_dir / f"{h}.json")  # atomic: a crash never leaves half an entry

    def _run(self, task: str, model: str, payloads: list[dict], render, system: str, schema: dict,
             list_key: str) -> list[dict | None]:
        hashes = [self._key(task, model, p) for p in payloads]
        results: list[dict | None] = [self._get(h) for h in hashes]
        todo = [i for i, r in enumerate(results) if r is None]
        groups = [todo[i:i + self.per_call] for i in range(0, len(todo), self.per_call)]

        def work(group: list[int]) -> None:
            prompt = "\n\n---\n\n".join(render(f"K{j}", payloads[i]) for j, i in enumerate(group))
            out, models, cost = self.call(system, schema, prompt, model, self.binary)
            with self._lock:
                self.calls += 1
                self.cost_usd += cost or 0.0
                self.models.update(models)
            got = {r["key"]: r for r in out[list_key]}
            for j, i in enumerate(group):
                r = got.get(f"K{j}")
                if r is not None:
                    r = {**r, "judge_model": models[0] if models else model}
                    r.pop("key", None)
                    self._put(hashes[i], r)
                    results[i] = r

        with ThreadPoolExecutor(max_workers=self.jobs) as ex:
            for fut in [ex.submit(work, g) for g in groups]:
                try:
                    fut.result()
                except Exception as e:  # noqa: BLE001 - one bad batch must not sink the run
                    print(f"judge error: {e}", file=sys.stderr, flush=True)
        return results

    # -- correctness -------------------------------------------------------
    def correctness(self, payloads: list[dict], model: str | None = None) -> list[dict | None]:
        """payload: {question, must_decline, gold_answer, gold_quote, answer}"""
        def render(k: str, p: dict) -> str:
            kind = "MUST-DECLINE" if p["must_decline"] else "ANSWERABLE"
            quote = f"\nGOLD KEY QUOTE: {p['gold_quote']}" if p.get("gold_quote") else ""
            return (f"KEY {k}\nTYPE {kind}\nQUESTION: {p['question']}\nGOLD ANSWER: {p['gold_answer']}{quote}\n"
                    f"SYSTEM ANSWER:\n{p['answer'] or '(empty)'}")
        return self._run("correctness", model or self.model, payloads, render, CORRECTNESS_SYSTEM,
                         CORRECTNESS_SCHEMA, "grades")

    # -- support -----------------------------------------------------------
    def support(self, payloads: list[dict], model: str | None = None) -> list[dict | None]:
        """payload: {claims: [str], cited_text: str}"""
        def render(k: str, p: dict) -> str:
            claims = "\n".join(f"{n}. {c}" for n, c in enumerate(p["claims"], 1))
            return f"KEY {k}\nCLAIMS:\n{claims}\nCITED TEXT:\n{p['cited_text'] or '(nothing cited)'}"
        return self._run("support", model or self.model, payloads, render, SUPPORT_SYSTEM, SUPPORT_SCHEMA,
                         "items")
