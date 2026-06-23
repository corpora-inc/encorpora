"""Coordinate-descent / one-parameter-at-a-time search over the 7 numeric levers.

From a start point, sweep each lever over a small candidate bracket holding the
others at the running best, adopt the winner, move on. Two passes ≈ 45 configs
(matches the owner's "~50 combos for EN"). This is the tractable, A/B-honest
form of the "binary search on individual parameter combinations" the owner asked
for: each lever is optimised against a fixed control.

Winner = highest pass-rate; ties broken by higher mean in-script then lower
repetition. A challenger only displaces the incumbent if it is strictly better
on that ordering (so equal configs keep the simpler/cheaper incumbent).
"""

from __future__ import annotations

from dataclasses import replace

from evaluate import ConfigResult, RowLog, eval_config
from langs import Lang
from server import Params, Server

# Candidate values per lever. temperature 0.0 ⇒ greedy (plugin special-case).
CANDIDATES: dict[str, list] = {
    "temperature": [0.0, 0.2, 0.4, 0.6, 0.8],
    "top_p": [0.8, 0.9, 0.95, 1.0],
    "top_k": [10, 20, 40, 100],
    "min_p": [0.0, 0.05, 0.1, 0.2],
    "repeat_penalty": [1.0, 1.05, 1.1, 1.2],
    "presence_penalty": [0.0, 0.5, 1.0],
    "max_tokens": [256, 512, 700],
}

# Lever order: highest-impact first (so later, cheaper levers tune around a good
# core). Pass 2 refines only the high-impact subset.
PASS1 = ["temperature", "repeat_penalty", "min_p", "top_p", "top_k",
         "presence_penalty", "max_tokens"]
PASS2 = ["temperature", "repeat_penalty", "min_p", "top_p"]


def _better(a: ConfigResult, b: ConfigResult) -> bool:
    """Is a strictly better than b on (pass_rate, in_script, -repeat)?"""
    ka = (a.pass_rate, a.mean_in_script, -a.mean_repeat)
    kb = (b.pass_rate, b.mean_in_script, -b.mean_repeat)
    return ka > kb


def coordinate_descent(
    server: Server,
    log: RowLog,
    lang: Lang,
    system_prompt: str,
    prompt_tag: str,
    battery: list[str],
    seeds: list[int],
    start: Params,
    levers_per_pass: list[list[str]] = (PASS1, PASS2),
    on_eval=None,
) -> tuple[Params, ConfigResult, list[ConfigResult]]:
    """Returns (best_params, best_result, all_results)."""
    best_p = start
    best_r = eval_config(server, log, lang, system_prompt, prompt_tag, best_p,
                         battery, seeds)
    history = [best_r]
    if on_eval:
        on_eval(best_r)
    for levers in levers_per_pass:
        for lever in levers:
            cur = getattr(best_p, lever)
            for val in CANDIDATES[lever]:
                if val == cur:
                    continue
                cand_p = replace(best_p, **{lever: val})
                r = eval_config(server, log, lang, system_prompt, prompt_tag,
                                cand_p, battery, seeds)
                history.append(r)
                if on_eval:
                    on_eval(r)
                if _better(r, best_r):
                    best_r, best_p = r, cand_p
                    cur = val
    return best_p, best_r, history
