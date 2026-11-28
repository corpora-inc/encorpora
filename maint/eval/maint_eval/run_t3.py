"""T3 runs: a question at a step, answered by choosing the manual's sentences (or declining)."""
from __future__ import annotations

from . import t3
from .runner import decide, equipment_labels, load_items, pmap, run_dir, write
from .stats import lat, prop

_views: dict = {}


def view(eng, item: dict) -> dict:
    k = (item["pack_id"], item["node_id"])
    if k not in _views:
        _views[k] = eng.call("job.start", {"pack_id": item["pack_id"], "tree_id": item["tree_id"],
                                           "node_id": item["node_id"], "level": "apprentice"})["step"]
    return _views[k]


def run_t3(eng, a) -> dict:
    items = load_items(a)
    eq = equipment_labels(eng, items)

    def one(item: dict) -> dict:
        v = view(eng, item)
        pool = t3.passages(eng, item["pack_id"], v, item["text"], k=a.k)
        row = {"id": item["id"], "kind": item["kind"], "register": item["register"], "pack_id": item["pack_id"],
               "n_pool": len(pool)}
        if a.system == "engine":
            # Model off: the app shows the passages; no answer is chosen. Equivalent to a decline.
            dec = {"kind": "decline"}
            row["seconds"] = None
        else:
            tm = "tmpl" in a.variant.split(",")
            user = t3.render(item["text"], eq[item["pack_id"]], v, pool, templates=tm)
            r = decide(a, t3.SYSTEM_TMPL if tm else t3.SYSTEM, user, t3.schema(len(pool), templates=tm),
                       tag=f"t3:{a.part}")
            dec = t3.parse(r.get("output"), pool) if r.get("ok", True) else {"kind": "error"}
            u = r.get("usage") or {}
            row.update({"seconds": r.get("seconds"), "ttft": r.get("ttft"), "in_tok": u.get("input_tokens"),
                        "out_tok": u.get("output_tokens"), "reason_tok": u.get("reasoning_tokens"),
                        "tps": (r.get("timings") or {}).get("predicted_per_second"), "error": r.get("error")})
        row["dec"] = dec
        row["shown"] = [p["text"] for p in pool if p["h"] in (dec.get("sentences") or [])]
        row.update(t3.score(item, pool, dec))
        return row

    rows = pmap(one, items, a.jobs)
    return write(run_dir(a), rows, summarize(rows), a)


def summarize(rows: list[dict]) -> dict:
    ans = [r for r in rows if r["kind"] == "answerable"]
    una = [r for r in rows if r["kind"] == "unanswerable"]
    avail = [r for r in ans if r["answerable_in_pool"]]
    answered = [r for r in rows if r["decision"] == "answer"]
    pred_dec = [r for r in rows if r["decision"] == "decline"]
    should_dec = [r for r in rows if r["kind"] == "unanswerable" or not r["answerable_in_pool"]]
    out = {"n": len(rows), "n_answerable": len(ans), "n_unanswerable": len(una),
           "retrieval_required_in_pool": prop([r["answerable_in_pool"] for r in ans]),
           "accuracy_all": prop([r["correct"] for r in rows]),
           "accuracy_vs_item": prop([r["correct_vs_item"] for r in rows]),
           "answer_when_available": prop([r["correct"] for r in avail]),
           "unanswerable_declined": prop([r["correct"] for r in una]),
           "decline": {"precision": prop([r["kind"] == "unanswerable" or not r["answerable_in_pool"] for r in pred_dec]),
                       "recall": prop([r["decision"] == "decline" for r in should_dec])},
           "answered_unanswerable": prop([r["decision"] == "answer" for r in una]),
           "selected_precision_mean": _mean([r["precision"] for r in answered if r["precision"] is not None]),
           "required_recall_mean_when_available": _mean([r["recall"] for r in avail if r["recall"] is not None]),
           "mean_sentences_shown": _mean([r["n_selected"] for r in answered]),
           "connector_present": prop([bool(r["connector"]) for r in answered]),
           # Every sentence shown is a source sentence by construction; the connector is the only text of
           # the model's own. Unsupported = a connector that states a number, a step or a requirement.
           "connector_unsupported": prop([r["conn_unsupported"] for r in answered]),
           "connector_own_content": prop([r["conn_own_content"] for r in answered]),
           "connector_unsupported_by_kind": {"number": prop([r["conn_number"] for r in answered if r["connector"]]),
                                             "step": prop([r["conn_step"] for r in answered if r["connector"]]),
                                             "requirement": prop([r["conn_requirement"] for r in answered if r["connector"]])},
           "errors": sum(r["decision"] == "error" for r in rows),
           "latency_s": {"total": lat([r.get("seconds") for r in rows]), "ttft": lat([r.get("ttft") for r in rows])},
           "tokens": {"in": lat([r.get("in_tok") for r in rows]), "out": lat([r.get("out_tok") for r in rows]),
                      "reasoning": lat([r.get("reason_tok") for r in rows]), "tok_per_s": lat([r.get("tps") for r in rows])}}
    return out


def _mean(v):
    v = [x for x in v if x is not None]
    return round(sum(v) / len(v), 4) if v else None
