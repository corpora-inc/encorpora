"""T2 runs: the close-out note and the job context in, the lesson record's fields out."""
from __future__ import annotations

from . import t2
from .runner import decide, equipment_labels, load_items, pmap, run_dir, write
from .stats import lat, prop


def run_t2(eng, a) -> dict:
    items = load_items(a)
    eq = equipment_labels(eng, items)

    def one(item: dict) -> dict:
        ctx = item["context"]
        user = t2.render_context(ctx, eq[item["pack_id"]]) + f"\n\nTechnician's note: \"{item['text']}\"\n\nRecord as JSON."
        row = {"id": item["id"], "register": item["register"], "pack_id": item["pack_id"], "gold": item["gold"]}
        if a.system == "engine":
            # Model off: the app fills nothing; the technician types every field. Score the empty record.
            pred = {"cause": {"kind": "unknown"}, "action": {"kind": "unknown"}, "parts": [], "minutes": None, "note": ""}
            row.update({"seconds": None})
        else:
            v1 = "v1" in a.variant.split(",")
            r = decide(a, t2.SYSTEM if v1 else t2.SYSTEM_V2, user, t2.schema(ctx) if v1 else t2.schema_v2(ctx),
                       tag=f"t2:{a.part}")
            pred = r.get("output") if r.get("ok", True) else None
            if isinstance(pred, dict) and "answer" in pred and "cause" not in pred:
                pred = pred["answer"]
            if not v1:
                pred = t2.from_v2(pred)
            u = r.get("usage") or {}
            row.update({"seconds": r.get("seconds"), "ttft": r.get("ttft"), "in_tok": u.get("input_tokens"),
                        "out_tok": u.get("output_tokens"), "reason_tok": u.get("reasoning_tokens"),
                        "tps": (r.get("timings") or {}).get("predicted_per_second"), "error": r.get("error")})
        row["pred"] = pred
        row.update(t2.score(item["gold"], pred))
        return row

    rows = pmap(one, items, a.jobs)
    return write(run_dir(a), rows, summarize(rows), a)


def summarize(rows: list[dict]) -> dict:
    out = {"n": len(rows), "errors": sum(r["error"] is True for r in rows if isinstance(r.get("error"), bool))
           + sum(1 for r in rows if r.get("pred") is None)}
    for f in ("cause", "action", "parts", "minutes", "all"):
        out[f"{f}_accuracy"] = prop([r[f] for r in rows])
    out["parts_f1_mean"] = round(sum(r.get("parts_f1", 0) for r in rows) / len(rows), 4) if rows else None
    out["unknown_kept_unknown"] = {
        "cause": prop([not r["invented_cause"] for r in rows if r["gold_cause_unknown"]]),
        "minutes": prop([not r["invented_minutes"] for r in rows if r["gold_minutes_null"]])}
    out["invented"] = {k: prop([r[f"invented_{k}"] for r in rows]) for k in ("cause", "action", "minutes", "parts")}
    # Product rule: the model's choices are prefills the technician accepts; "unknown" is the default.
    # A prefill is wrong when the model filled a value (not unknown / not empty / not null) that is wrong.
    def wrong_prefill(r, f):
        p = r.get("pred") or {}
        if f in ("cause", "action"):
            return (p.get(f) or {}).get("kind") not in (None, "unknown") and not r[f]
        if f == "parts":
            return bool(p.get("parts")) and not r["parts"]
        return p.get("minutes") is not None and not r["minutes"]
    out["wrong_prefill"] = {f: prop([wrong_prefill(r, f) for r in rows]) for f in ("cause", "action", "parts", "minutes")}
    out["record_with_any_wrong_prefill"] = prop([any(wrong_prefill(r, f) for f in ("cause", "action", "parts", "minutes"))
                                                 for r in rows])
    by: dict = {}
    for r in rows:
        by.setdefault(r["register"], []).append(r["all"])
    out["all_by_register"] = {k: prop(v) for k, v in sorted(by.items())}
    out["latency_s"] = {"total": lat([r.get("seconds") for r in rows]), "ttft": lat([r.get("ttft") for r in rows])}
    out["tokens"] = {"in": lat([r.get("in_tok") for r in rows]), "out": lat([r.get("out_tok") for r in rows]),
                     "reasoning": lat([r.get("reason_tok") for r in rows]), "tok_per_s": lat([r.get("tps") for r in rows])}
    return out
