"""Evaluate one (language, system-prompt, Params) config across the battery.

A config's score is the pass-RATE over battery × seeds (≥5 seeds → a stable
estimate with a bootstrap 95% CI). Every individual generation is appended to
results/rows.jsonl so a run can resume and so the report can audit any reply.
"""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass

import metrics
import prompts
from langs import Lang
from server import Params, Server

# Override with TUTO_EVAL_RESULTS=results-0.6b to isolate a run from the 4B's
# cached rows.jsonl (the rid is not keyed by model, so a shared dir would reuse
# the wrong model's cached generations).
RESULTS_DIR = os.environ.get(
    "TUTO_EVAL_RESULTS", os.path.join(os.path.dirname(__file__), "results")
)
ROWS_PATH = os.path.join(RESULTS_DIR, "rows.jsonl")

DEFAULT_SEEDS = [11, 23, 37, 53, 71]


def _config_id(lang: Lang, prompt_tag: str, p: Params) -> str:
    h = hashlib.sha1(prompts_text_key(lang, prompt_tag, p).encode()).hexdigest()[:12]
    return h


def prompts_text_key(lang: Lang, prompt_tag: str, p: Params) -> str:
    return f"{lang.code}|{prompt_tag}|{p.key()}"


class RowLog:
    """Append-only JSONL log with an in-memory index for resume/dedup."""

    def __init__(self, path: str = ROWS_PATH):
        self.path = path
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.seen: set[str] = set()
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                for line in f:
                    try:
                        row = json.loads(line)
                        self.seen.add(row["rid"])
                    except Exception:
                        continue
        self._fh = open(path, "a", encoding="utf-8")

    def has(self, rid: str) -> bool:
        return rid in self.seen

    def get(self, rid: str) -> dict | None:
        if rid not in self.seen:
            return None
        with open(self.path, encoding="utf-8") as f:
            for line in f:
                try:
                    row = json.loads(line)
                    if row.get("rid") == rid:
                        return row
                except Exception:
                    continue
        return None

    def write(self, row: dict) -> None:
        self._fh.write(json.dumps(row, ensure_ascii=False) + "\n")
        self._fh.flush()
        self.seen.add(row["rid"])

    def close(self) -> None:
        self._fh.close()


@dataclass
class ConfigResult:
    lang: str
    prompt_tag: str
    params: Params
    n: int
    n_pass: int
    pass_rate: float
    ci_lo: float
    ci_hi: float
    mean_in_script: float
    mean_repeat: float
    samples: list[dict]  # a few scrubbed replies for the Claude judge

    def summary(self) -> dict:
        d = {
            "lang": self.lang,
            "prompt_tag": self.prompt_tag,
            "params": self.params.__dict__,
            "n": self.n,
            "n_pass": self.n_pass,
            "pass_rate": round(self.pass_rate, 3),
            "ci": [round(self.ci_lo, 3), round(self.ci_hi, 3)],
            "mean_in_script": round(self.mean_in_script, 3),
            "mean_repeat": round(self.mean_repeat, 3),
        }
        return d


def _wilson_ci(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """Wilson score interval for a binomial proportion (good for small n)."""
    if n == 0:
        return 0.0, 0.0
    p = k / n
    denom = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denom
    half = (z * ((p * (1 - p) / n + z * z / (4 * n * n)) ** 0.5)) / denom
    return max(0.0, center - half), min(1.0, center + half)


def eval_config(
    server: Server,
    log: RowLog,
    lang: Lang,
    system_prompt: str,
    prompt_tag: str,
    params: Params,
    battery: list[str],
    seeds: list[int] = DEFAULT_SEEDS,
    max_samples: int = 4,
) -> ConfigResult:
    n = n_pass = 0
    sum_in_script = sum_repeat = 0.0
    samples: list[dict] = []
    for ui, user in enumerate(battery):
        prompt = prompts.build_prompt(lang, system_prompt, user)
        for seed in seeds:
            rid = f"{lang.code}|{prompt_tag}|{params.key()}|u{ui}|s{seed}"
            row = log.get(rid) if log.has(rid) else None
            if row is None:
                raw = server.complete(prompt, params, seed)
                sc = metrics.score_reply(raw, lang)
                row = {
                    "rid": rid,
                    "lang": lang.code,
                    "prompt_tag": prompt_tag,
                    "params": params.__dict__,
                    "user_idx": ui,
                    "user": user,
                    "seed": seed,
                    **sc.to_dict(),
                }
                log.write(row)
            n += 1
            n_pass += 1 if row["passed"] else 0
            sum_in_script += row["in_script"]
            sum_repeat += row["repeat"]
            if len(samples) < max_samples:
                samples.append({
                    "user": user,
                    "reply": row["scrubbed"][:600],
                    "passed": row["passed"],
                })
    rate = n_pass / n if n else 0.0
    lo, hi = _wilson_ci(n_pass, n)
    return ConfigResult(
        lang=lang.code, prompt_tag=prompt_tag, params=params, n=n, n_pass=n_pass,
        pass_rate=rate, ci_lo=lo, ci_hi=hi,
        mean_in_script=sum_in_script / n if n else 0.0,
        mean_repeat=sum_repeat / n if n else 0.0,
        samples=samples,
    )
