"""Offline re-ranking of `symptom.search` hits from the per-hit numbers the engine returns.

A search with k >= the index size returns every symptom with `lexical` (Dice over content stems,
pack synonyms applied), `cosine` (dense, when it ran), `coverage`, `strong_hits` and
`strong_query_words` (query words outside the pack's weak-word list, and how many of them the best
phrase matched). Every ranker below uses only those numbers, so the engine can implement the winner
exactly with parameters in `pack_meta`.

Spec strings:
  engine        the engine's own order (current fusion: 0.6 lexical + 0.4 cosine)
  lex           lexical (Dice) alone, cosine breaks ties
  cos           cosine alone
  lin:W         W*lexical + (1-W)*cosine
  strong:W      W*(strong_hits/strong_query_words) + (1-W)*cosine
  rrf:K         1/(K+rank_lexical) + 1/(K+rank_cosine)
  z:W           W*z(lexical) + (1-W)*z(cosine), z-scored over the query's hits
  zs:W          W*z(strong coverage) + (1-W)*z(cosine)
"""
from __future__ import annotations

import statistics


def compact(h: dict) -> dict:
    return {"id": h["symptom"]["symptom_id"], "lex": h.get("lexical"), "cos": h.get("cosine"),
            "cov": h.get("coverage"), "sh": h.get("strong_hits"), "sq": h.get("strong_query_words"),
            "score": h.get("score"), "conf": h.get("confidence"), "margin": h.get("margin"),
            "signal": any(w.get("kind") == "signal" for w in h.get("why") or [])}


def _strong(h):
    return (h["sh"] or 0) / h["sq"] if h.get("sq") else 0.0


def _z(vals):
    m = statistics.mean(vals)
    s = statistics.pstdev(vals) or 1.0
    return [(v - m) / s for v in vals]


def score_list(hits: list[dict], spec: str) -> list[float]:
    lex = [h["lex"] or 0.0 for h in hits]
    cos = [h["cos"] if h.get("cos") is not None else 0.0 for h in hits]
    if spec == "engine":
        return [h["score"] for h in hits]
    if spec == "lex":
        return [l + 1e-6 * c for l, c in zip(lex, cos)]
    if spec == "cos":
        return cos
    kind, _, p = spec.partition(":")
    w = float(p) if p else 0.5
    if kind == "lin":
        return [w * l + (1 - w) * c for l, c in zip(lex, cos)]
    if kind == "strong":
        return [w * _strong(h) + (1 - w) * c for h, c in zip(hits, cos)]
    if kind == "rrf":
        rl = {i: r for r, i in enumerate(sorted(range(len(hits)), key=lambda i: -lex[i]), 1)}
        rc = {i: r for r, i in enumerate(sorted(range(len(hits)), key=lambda i: -cos[i]), 1)}
        return [1 / (w + rl[i]) + 1 / (w + rc[i]) for i in range(len(hits))]
    if kind == "z":
        zl, zc = _z(lex), _z(cos)
        return [w * a + (1 - w) * b for a, b in zip(zl, zc)]
    if kind == "zs":
        zl, zc = _z([_strong(h) for h in hits]), _z(cos)
        return [w * a + (1 - w) * b for a, b in zip(zl, zc)]
    raise ValueError(spec)


def rerank(hits: list[dict], spec: str) -> list[dict]:
    """Returns hits sorted by the spec, each with `fused` (its score) added."""
    if not hits:
        return []
    sc = score_list(hits, spec)
    out = [{**h, "fused": s} for h, s in zip(hits, sc)]
    return sorted(out, key=lambda h: -h["fused"])
