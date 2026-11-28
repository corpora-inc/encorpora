"""T1 runs: the engine baseline (model off) and closed model decisions over the engine's candidates."""
from __future__ import annotations

import json
from collections import Counter, defaultdict

from . import rank, t1
from .runner import decide, equipment_labels, load_items, pmap, run_dir, write
from .stats import lat, prop


SEARCH_K = 200  # >= the index size: every symptom comes back with its numbers


def gold_rank(item: dict, ids: list[str]) -> int | None:
    for r, sid in enumerate(ids, 1):
        if sid in item["gold"]:
            return r
    return None


def run_t1(eng, a) -> dict:
    items = load_items(a)
    eq = equipment_labels(eng, items)
    cd = t1.Candidates(eng)
    flags = set(a.variant.split(","))
    use_syn, reason = "syn" in flags, "reason" in flags
    system = t1.SYSTEM_STRICT if "strict" in flags else t1.SYSTEM
    twostep, show_scores = "twostep" in flags, "scores" in flags
    sch = t1.schema(a.k, reason=reason, twostep=twostep)

    ranking = json.loads(a.ranking) if getattr(a, "ranking", "") else None

    def one(item: dict) -> dict:
        s = eng.symptom_search(item["pack_id"], item["text"], k=SEARCH_K, ranking=ranking)
        raw_hits = s.get("hits") or []
        comp = [rank.compact(h) for h in raw_hits]
        if a.rank != "engine":  # emulate a proposed fusion from the engine's own per-hit numbers
            order = rank.rerank(comp, a.rank)
            by_id = {h["symptom"]["symptom_id"]: h for h in raw_hits}
            hits = [by_id[c["id"]] for c in order]
            comp = order
        else:
            hits = raw_hits
        ids = [h["symptom"]["symptom_id"] for h in hits]
        cand_hits = hits[: a.k]
        cand_ids = ids[: a.k]
        row = {"id": item["id"], "kind": item["kind"], "register": item["register"], "pack_id": item["pack_id"],
               "gold": item["gold"], "rank": gold_rank(item, ids), "search_conf": s.get("confidence"),
               "dense": s.get("dense"), "thresholds": s.get("thresholds"),
               "top1_cov": hits[0]["coverage"] if hits else None,
               "top1_score": hits[0]["score"] if hits else None, "n_hits": len(hits), "cand_ids": cand_ids,
               # Per-hit numbers for calibrating ranking and auto-routing offline (first 5 in this order).
               "hits": [{**c, "lex_words": c.get("sh") or 0} for c in comp[:5]]}
        if a.system == "engine":
            row["all"] = comp  # every symptom's numbers, for offline re-ranking
        if a.system == "engine":
            dec = t1.engine_decision(s, a.k)
            row.update({"seconds": None, "ttft": None})
        elif not cand_hits:
            dec = {"decision": "none", "no_candidates": True}  # nothing to choose from: the model is not called
            row.update({"seconds": 0.0, "ttft": None, "skipped": True})
        else:
            cands = [cd.describe(item["pack_id"], h["symptom"], synonyms=use_syn) for h in cand_hits]
            for c, h in zip(cands, comp[: a.k]):
                c["match"] = h.get("fused", h.get("score"))
            user = t1.render(item["text"], eq[item["pack_id"]], cands, scores=show_scores, twostep=twostep)
            r = decide(a, system, user, sch, tag=f"t1:{a.part}")
            dec = t1.parse(r.get("output"), len(cand_hits)) if r.get("ok", True) else {"decision": "error"}
            o = r.get("output")
            while isinstance(o, dict) and "present" not in o and "answer" in o and "decision" not in o:
                o = o["answer"]
            if isinstance(o, dict) and "present" in o:
                row["present"] = o["present"]
            u = r.get("usage") or {}
            row.update({"seconds": r.get("seconds"), "ttft": r.get("ttft"), "in_tok": u.get("input_tokens"),
                        "out_tok": u.get("output_tokens"), "reason_tok": u.get("reasoning_tokens"),
                        "tps": (r.get("timings") or {}).get("predicted_per_second"),
                        "error": r.get("error"), "raw": r.get("output") if dec["decision"] == "error" else None})
        row["dec"] = dec
        row.update(t1.score(item, cand_ids, dec))
        return row

    rows = pmap(one, items, a.jobs)
    return write(run_dir(a), rows, summarize(rows, a.k), a)


def summarize(rows: list[dict], k: int) -> dict:
    by_kind = defaultdict(list)
    for r in rows:
        by_kind[r["kind"]].append(r)
    single, dec, amb = by_kind["single"], by_kind["decline"], by_kind["ambiguous"]
    answerable = single + amb
    out: dict = {"n": len(rows), "n_by_kind": {kk: len(v) for kk, v in by_kind.items()}}
    # Retrieval (the engine's own ranking; identical across systems for the same items).
    out["retrieval_single"] = {f"top{n}": prop([r["rank"] is not None and r["rank"] <= n for r in single])
                               for n in (1, 3, 5, 10)}
    out["retrieval_ambiguous_any_gold"] = {f"top{n}": prop([r["rank"] is not None and r["rank"] <= n for r in amb])
                                           for n in (1, 3, 5)}
    out["engine_confidence"] = {kk: dict(Counter(r["search_conf"] for r in v)) for kk, v in by_kind.items()}
    conf_single = [r for r in single if r["search_conf"] == "confident"]
    out["engine_confident_precision_single"] = prop([r["rank"] == 1 for r in conf_single])
    # Decisions.
    out["accuracy_all"] = prop([r["correct"] for r in rows])
    out["accuracy"] = {kk: prop([r["correct"] for r in v]) for kk, v in by_kind.items()}
    out["accuracy_single_gold_in_candidates"] = prop([r["correct"] for r in single if r["gold_in_candidates"]])
    out["wrong_pick_rate"] = prop([r["wrong_pick"] for r in rows])
    out["wrong_pick_rate_by_kind"] = {kk: prop([r["wrong_pick"] for r in v]) for kk, v in by_kind.items()}
    pred_none = [r for r in rows if r["decision"] == "none"]
    out["decline"] = {"precision": prop([r["kind"] == "decline" for r in pred_none]),
                      "recall": prop([r["decision"] == "none" for r in dec])}
    out["clarify_rate"] = prop([r["decision"] == "clarify" for r in rows])
    out["clarify_rate_by_kind"] = {kk: prop([r["decision"] == "clarify" for r in v]) for kk, v in by_kind.items()}
    out["clarify_separates_ambiguous"] = prop([r.get("separates") for r in amb])
    out["clarify_on_single_has_gold"] = prop([r["clarify_has_gold"] for r in single if r["decision"] == "clarify"])
    # "Recoverable": right tree now, or a question whose options include the right one.
    out["reaches_gold_or_asks_with_it_single"] = prop([r["correct"] or r["clarify_has_gold"] for r in single])
    out["errors"] = sum(r["decision"] == "error" for r in rows)
    out["by_register_single"] = {g: prop([r["correct"] for r in v])
                                 for g, v in sorted(_group(single, "register").items())}
    out["by_pack"] = {g: prop([r["correct"] for r in v]) for g, v in sorted(_group(rows, "pack_id").items())}
    out["latency_s"] = {"total": lat([r.get("seconds") for r in rows if not r.get("skipped")]),
                        "ttft": lat([r.get("ttft") for r in rows])}
    out["tokens"] = {"in": lat([r.get("in_tok") for r in rows]), "out": lat([r.get("out_tok") for r in rows]),
                     "reasoning": lat([r.get("reason_tok") for r in rows]), "tok_per_s": lat([r.get("tps") for r in rows])}
    return out


def _group(rows, key):
    g = defaultdict(list)
    for r in rows:
        g[r[key]].append(r)
    return g
