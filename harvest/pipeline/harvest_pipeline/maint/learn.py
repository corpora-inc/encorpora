"""Practice items from a maintenance pack's own structure: code writes every item, models only check them.

Items are built from rows that shipped (trees, nodes, edges, facets, procedures, steps, guards,
signals), so every option is the manual's own text, of the same kind and similar length; the
careful-sounding complete option cannot give the key away:

  next      the symptom, the path so far (questions and their results, verbatim), a result just
            obtained: what does the manual say to do next? Key: the next node; distractors: the
            other branch's target, the next node on a sibling path, nodes of the nearest other tree.
  range     at a measured-value question: which reading leads to a given action (the branch labels).
  open      at a question: which possible problem is still listed (key) and which were ruled out
            earlier on the path (distractors), from the possible-problems facet.
  guard     before a given step: which warning or caution applies; distractors guard other steps.
  signal    a displayed code or status message: which cause, or where troubleshooting starts / what
            to do first; distractors from the most similar messages.
  order     in a procedure, after a given step: which step comes next.

Each item: section_ids, citation, a skill (per tree, task or message group) under a topic, and
rationales (the key quoted with its citation; each distractor's one line says where it really
belongs, from the structure). Gates (`gate()`): format (contract), a with-source solver that must
get the key, and two blind readers (options only; stem and options without the manual) whose
rates should sit near chance; an item both blind readers get right does not ship.
"""

from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

from ..contract import question_problems
from ..textutil import sha256_json, sha256_text, slug


def _norm(s: str) -> str:
    return " ".join((s or "").split()).lower().rstrip(".")


def _words(s: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", (s or "").lower()))


def _stems(s: str) -> set[str]:
    """Crude stems ("accels", "accel", "accelerometer" -> "accel"), for word overlap between messages."""
    return {w[:5] for w in _words(s) if len(w) > 2 and w not in {"the", "and", "not", "for", "has", "too"}}


@dataclass
class Pack:
    db: sqlite3.Connection
    sections: dict
    vecs: dict
    trees: dict = field(default_factory=dict)
    nodes: dict = field(default_factory=dict)
    edges: dict = field(default_factory=dict)        # from -> [edge rows]
    facets: dict = field(default_factory=dict)       # node -> facet -> [texts]
    procs: dict = field(default_factory=dict)
    steps: dict = field(default_factory=dict)        # proc -> [step rows]
    guards: list = field(default_factory=list)       # (guard section row, target section id)
    signals: list = field(default_factory=list)
    cite: dict = field(default_factory=dict)


def load(pack_db: str) -> Pack:
    c = sqlite3.connect(pack_db)
    c.row_factory = sqlite3.Row
    has = lambda t: c.execute("SELECT 1 FROM sqlite_master WHERE name=?", (t,)).fetchone() is not None  # noqa: E731
    secs = {r["section_id"]: dict(r) for r in c.execute("SELECT * FROM section")}
    vecs = {}
    if has("chunk_vec"):
        import numpy as np
        for cid, blob, scale in c.execute("SELECT chunk_id, vec, scale FROM chunk_vec"):
            if cid.startswith("s:"):
                v = np.frombuffer(blob, dtype=np.int8).astype("float32") * scale
                n = float(np.linalg.norm(v)) or 1.0
                vecs[cid[2:]] = v / n
    p = Pack(c, secs, vecs, cite={k: v["citation"] for k, v in secs.items()})
    if has("fault_tree"):
        p.trees = {r["tree_id"]: dict(r) for r in c.execute("SELECT * FROM fault_tree")}
        p.nodes = {r["node_id"]: dict(r) for r in c.execute("SELECT * FROM fault_node")}
        for r in c.execute("SELECT * FROM fault_edge ORDER BY from_node, ord"):
            p.edges.setdefault(r["from_node"], []).append(dict(r))
        for r in c.execute("SELECT * FROM fault_facet ORDER BY node_id, facet, ord"):
            p.facets.setdefault(r["node_id"], {}).setdefault(r["facet"], []).append(r["text"])
        if has("signal_map"):
            p.signals = [dict(r) for r in c.execute("SELECT * FROM signal_map")]
    p.procs = {r["proc_id"]: dict(r) for r in c.execute("SELECT * FROM procedure")}
    for r in c.execute("SELECT * FROM proc_step ORDER BY proc_id, ord"):
        p.steps.setdefault(r["proc_id"], []).append(dict(r))
    for r in c.execute("SELECT from_id, to_id FROM xref WHERE kind='guards'"):
        if r["from_id"] in secs and r["to_id"] in secs:
            p.guards.append((secs[r["from_id"]], r["to_id"]))
    return p


def _sim(p: Pack, a_sec: str, b_sec: str, a_text: str, b_text: str) -> float:
    va, vb = p.vecs.get(a_sec), p.vecs.get(b_sec)
    if va is not None and vb is not None:
        return float(va @ vb)
    wa, wb = _words(a_text), _words(b_text)
    return len(wa & wb) / (len(wa | wb) or 1)


def _pick(key: str, cands: list[tuple[str, str, float]], n: int = 3) -> list[tuple[str, str]]:
    """Distractors: distinct from the key and each other; most similar first, then closest in length."""
    out, seen = [], {_norm(key)}
    for text, why, sim in sorted(cands, key=lambda c: (-round(c[2], 2), abs(len(c[0]) - len(key)))):
        if _norm(text) in seen or not text.strip():
            continue
        seen.add(_norm(text))
        out.append((text, why))
        if len(out) == n:
            break
    return out


def _item(kind: str, qid: str, skill: str, stem: str, key: tuple[str, str], distractors: list[tuple[str, str]],
          section_ids: list[str], difficulty: float = 0.5, note: str | None = None) -> dict | None:
    if len(distractors) < 2:
        return None
    ws = lambda t: " ".join((t or "").split())  # noqa: E731
    key = (ws(key[0]), ws(key[1]))
    distractors = [(ws(a), ws(b)) for a, b in distractors]
    stem = ws(stem)
    opts = [key] + distractors
    k = int(hashlib.sha256(qid.encode()).hexdigest(), 16) % len(opts)
    order = opts[1:]
    order.insert(k, key)
    return {"q_id": qid, "skill_id": skill, "variant_of": None, "kind": "mc", "stem": stem,
            "choices": [o[0] for o in order], "answer": str(k), "rationales": [o[1] for o in order],
            "section_ids": [s for s in dict.fromkeys(section_ids) if s], "difficulty": difficulty, "note": note,
            "_type": kind}


def _q(s: str) -> str:
    return f"“{s.strip()}”"


def _label(e: dict) -> str:
    return e["label"]


def build_items(p: Pack, skills_by_first_word: int = 30) -> tuple[list[dict], list[dict], list[dict]]:
    """(items, topics, skills)."""
    items, topics, skills = [], {}, {}

    def topic(tid, title, summary):
        topics.setdefault(tid, {"topic_id": tid, "parent_id": None, "ord": len(topics) + 1, "title": title,
                                "summary": summary, "lang": "en"})
        return tid

    group = len(p.trees) > skills_by_first_word

    def tree_skill(tid):
        t = p.trees[tid]
        if group:      # many small trees (a message table): one skill per leading component word
            w = (t["title"].split() or ["other"])[0].rstrip(":,")
            sid = f"skill:msg-{slug(w, 30)}"
            top = topic("topic:messages", "Messages and their causes", "What each message means and what to do.")
            skills.setdefault(sid, {"skill_id": sid, "topic_id": top, "title": f"{w} messages", "lang": "en"})
            return sid
        sid = f"skill:{tid}"
        top = topic("topic:troubleshooting", "Troubleshooting", "Walking the manual's troubleshooting trees.")
        skills.setdefault(sid, {"skill_id": sid, "topic_id": top, "title": f"Troubleshoot: {t['title']}", "lang": "en"})
        return sid

    def proc_skill(pid):
        sid = f"skill:{pid}"
        top = topic("topic:tasks", "Maintenance tasks", "The order and the safety of the manual's tasks.")
        skills.setdefault(sid, {"skill_id": sid, "topic_id": top, "title": p.procs[pid]["title"], "lang": "en"})
        return sid

    # ---- tree walks ------------------------------------------------------------------------
    for tid, t in p.trees.items():
        paths = []        # (node, [(question node, edge)]) from the entry, breadth first, no retries
        stack = [(t["entry_node"], [])]
        seen = set()
        while stack:
            nid, path = stack.pop(0)
            if nid in seen or nid not in p.nodes:
                continue
            seen.add(nid)
            paths.append((nid, path))
            for e in p.edges.get(nid, []):
                if not e["retry"]:
                    stack.append((e["to_node"], path + [(nid, e)]))
        path_of = dict(paths)
        entry = p.nodes[t["entry_node"]]
        others = [n for n in p.nodes.values() if n["tree_id"] != tid and n["kind"] in ("check", "action", "escalate", "end")]
        for nid, path in paths:
            n = p.nodes[nid]
            out_e = p.edges.get(nid, [])
            if n["kind"] not in ("check", "action") or len(out_e) < 2:
                continue
            so_far = "; ".join(f"{_q(p.nodes[q]['text'])}: {_label(e)}" for q, e in path if p.nodes[q]["kind"] != "symptom")
            for e in out_e:
                nxt = p.nodes.get(e["to_node"])
                if nxt is None:
                    continue
                qid = f"q:{slug(tid, 30)}:next:{slug(nid, 20)}:{e['ord']}"
                stem = (f"Symptom: {_q(entry['text'])}. " + (f"So far: {so_far}. " if so_far else "")
                        + f"At {_q(n['text'])} the result is {_label(e)}. What does the manual say to do next?")
                cands = []
                for o in out_e:
                    if o is not e and o["to_node"] in p.nodes:
                        cands.append((p.nodes[o["to_node"]]["text"],
                                      f"That follows the result {_label(o)} at this question, not {_label(e)}.", 2.0))
                for sib, sp in paths:          # nodes on other paths of the same tree
                    s = p.nodes[sib]
                    if sib not in (nid, nxt["node_id"]) and s["kind"] in ("check", "action", "escalate", "end") \
                            and s["kind"] != "symptom":
                        last = sp[-1] if sp else None
                        why = (f"That comes after {_label(last[1])} at {_q(p.nodes[last[0]]['text'])}." if last
                               else "That is where the tree starts.")
                        cands.append((s["text"], why, 1.0 + _sim(p, nxt["section_id"], s["section_id"], nxt["text"], s["text"])))
                for s in others:
                    cands.append((s["text"], f"That belongs to the tree {_q(p.trees[s['tree_id']]['title'])}.",
                                  _sim(p, nxt["section_id"], s["section_id"], nxt["text"], s["text"])))
                key = (nxt["text"], f"The manual: {_q(nxt['text'])} ({p.cite.get(nxt['section_id'], '')}).")
                it = _item("next", qid, tree_skill(tid), stem, key, _pick(nxt["text"], cands),
                           [n["section_id"], nxt["section_id"]] + [p.nodes[q]["section_id"] for q, _ in path],
                           0.3 + 0.1 * min(len(path), 5))
                if it:
                    items.append(it)
            # value ranges: which reading leads to this action
            if n["expect"] and '"value"' in n["expect"] and len(out_e) >= 3:
                for e in out_e:
                    nxt = p.nodes.get(e["to_node"])
                    if not nxt:
                        continue
                    qid = f"q:{slug(tid, 30)}:range:{slug(nid, 20)}:{e['ord']}"
                    stem = f"At {_q(n['text'])}, which reading leads the manual to {_q(nxt['text'])}?"
                    cands = [(_label(o), f"That reading leads to {_q(p.nodes[o['to_node']]['text'])}.", 1.0)
                             for o in out_e if o is not e and o["to_node"] in p.nodes]
                    it = _item("range", qid, tree_skill(tid), stem, (_label(e), f"The manual's branch {_label(e)} leads "
                               f"there ({p.cite.get(n['section_id'], '')})."), _pick(_label(e), cands),
                               [n["section_id"], nxt["section_id"]], 0.5)
                    if it:
                        items.append(it)
            # what is still open: possible problems listed here versus ruled out earlier on the path
            here = p.facets.get(nid, {}).get("possible", [])
            if here and path:
                earlier = []
                for q, _ in path:
                    for x in p.facets.get(q, {}).get("possible", []):
                        if _norm(x) not in {_norm(h) for h in here} and _norm(x) not in {_norm(y) for y in earlier}:
                            earlier.append(x)
                if len(earlier) >= 2:
                    for k, key_t in enumerate(here[:2]):
                        qid = f"q:{slug(tid, 30)}:open:{slug(nid, 20)}:{k}"
                        stem = (f"Symptom: {_q(entry['text'])}. So far: {so_far}. Which possible problem does the manual "
                                f"still list at {_q(n['text'])}?")
                        cands = [(x, "The checks so far have ruled that out: the manual no longer lists it here.", 1.0)
                                 for x in earlier]
                        it = _item("open", qid, tree_skill(tid), stem, (key_t, f"The manual still lists {_q(key_t)} at "
                                   f"this question ({p.cite.get(n['section_id'], '')})."), _pick(key_t, cands),
                                   [n["section_id"]] + [p.nodes[q]["section_id"] for q, _ in path], 0.6)
                        if it:
                            items.append(it)
    # ---- guards ------------------------------------------------------------------------------
    step_of = {}
    for pid, sts in p.steps.items():
        for s in sts:
            for sid in json.loads(s["section_ids"] or "[]"):
                step_of[sid] = (pid, s)
    for g, target in p.guards:
        if target not in step_of:
            continue
        pid, s = step_of[target]
        qid = f"q:guard:{slug(g['section_id'], 50)}"
        stem = (f"In {_q(p.procs[pid]['title'])}, before the step {_q(s['text'])}, which "
                f"warning, caution or note does the manual give?")
        cands = []
        for g2, t2 in p.guards:
            if g2["section_id"] == g["section_id"]:
                continue
            where = step_of.get(t2)
            why = (f"That guards {_q(where[1]['text'])} in {_q(p.procs[where[0]]['title'])}." if where
                   else f"That guards {_q(p.sections[t2]['heading'] or p.sections[t2]['citation'])}.")
            cands.append((g2["text"], why, (1.0 if g2["kind"] == g["kind"] else 0.0)
                          + _sim(p, g["section_id"], g2["section_id"], g["text"], g2["text"])))
        it = _item("guard", qid, proc_skill(pid), stem, (g["text"], f"The manual's {g['kind']}: {_q(g['text'])} "
                   f"({p.cite.get(g['section_id'], '')})."), _pick(g["text"], cands), [target, g["section_id"]], 0.5)
        if it:
            items.append(it)
    # ---- procedure order -------------------------------------------------------------------------
    for pid, sts in p.steps.items():
        for k in range(len(sts) - 1):
            a, b = sts[k], sts[k + 1]
            qid = f"q:order:{slug(pid, 40)}:{a['ord']}"
            stem = f"In {_q(p.procs[pid]['title'])}, after {_q(a['text'])}, what is the next step?"
            cands = [(s["text"], f"That is step {s['ord']} of this task.", 1.0) for s in sts if s is not a and s is not b]
            for pid2, sts2 in p.steps.items():
                if pid2 != pid:
                    cands += [(s["text"], f"That is a step of {_q(p.procs[pid2]['title'])}.", 0.5) for s in sts2]
            secs = json.loads(b["section_ids"] or "[]") + json.loads(a["section_ids"] or "[]")
            it = _item("order", qid, proc_skill(pid), stem, (b["text"], f"Step {b['ord']}: {_q(b['text'])}."),
                       _pick(b["text"], cands), secs, 0.4)
            if it:
                items.append(it)
    # ---- signals ---------------------------------------------------------------------------------
    sig = [s for s in p.signals if s.get("tree_id") in p.trees]
    for s in sig:
        t = p.trees[s["tree_id"]]
        entry = p.nodes.get(s["node_id"] or t["entry_node"])
        shown = s["quote"] or s["title"]
        cause = p.facets.get(t["entry_node"], {}).get("possible", [])
        # nearest messages: shared words first (a cause that repeats the message's words is then no giveaway),
        # embedding similarity second
        def _near(x):
            ws, wx = _stems(s["title"]), _stems(x["title"])
            return -(2 * len(ws & wx) / (len(ws | wx) or 1)
                     + _sim(p, s["section_id"] or "", x["section_id"] or "", s["title"], x["title"]))
        near = sorted((x for x in sig if x["tree_id"] != s["tree_id"]), key=_near)
        if cause:
            qid = f"q:signal-cause:{slug(s['tree_id'], 50)}"
            stem = f"The machine shows {_q(shown)}. What cause does the manual give?"
            cands = []
            for rank, x in enumerate(near[:12]):
                c2 = p.facets.get(p.trees[x["tree_id"]]["entry_node"], {}).get("possible", [])
                if c2:
                    cands.append((c2[0], f"That is the cause the manual gives for {_q(x['quote'] or x['title'])}.",
                                  1.0 - rank / 100))
            it = _item("signal", qid, tree_skill(s["tree_id"]), stem, (cause[0], f"The manual: {_q(cause[0])} "
                       f"({p.cite.get(s['section_id'] or '', '')})."), _pick(cause[0], cands),
                       [s["section_id"], entry["section_id"] if entry else None], 0.5)
            if it:
                items.append(it)
        first = None
        if entry is not None:
            first = entry
            if entry["kind"] == "symptom":
                e = (p.edges.get(entry["node_id"]) or [None])[0]
                first = p.nodes.get(e["to_node"]) if e else None
        if first is not None:
            qid = f"q:signal-next:{slug(s['tree_id'], 40)}:{slug(s['pattern'], 20)}"
            stem = f"The machine shows {_q(shown)}. What does the manual say to do first?"
            cands = []
            for rank, x in enumerate(near[:12]):
                t2 = p.trees[x["tree_id"]]
                e2 = p.nodes.get(x["node_id"] or t2["entry_node"])
                if e2 and e2["kind"] == "symptom":
                    ed = (p.edges.get(e2["node_id"]) or [None])[0]
                    e2 = p.nodes.get(ed["to_node"]) if ed else None
                if e2:
                    cands.append((e2["text"], f"That is the first step for {_q(x['quote'] or x['title'])}.",
                                  1.0 - rank / 100))
            if len(cands) < 3:      # few codes: other trees' questions, nearest first
                for n2 in p.nodes.values():
                    if n2["tree_id"] != s["tree_id"] and n2["kind"] == "check":
                        cands.append((n2["text"], f"That is a question of {_q(p.trees[n2['tree_id']]['title'])}.",
                                      0.5 * _sim(p, first["section_id"], n2["section_id"], first["text"], n2["text"])))
            it = _item("signal", qid, tree_skill(s["tree_id"]), stem, (first["text"], f"The manual: {_q(first['text'])} "
                       f"({p.cite.get(first['section_id'], '')})."), _pick(first["text"], cands),
                       [s["section_id"], first["section_id"]], 0.4)
            if it:
                items.append(it)
    return items, list(topics.values()), list(skills.values())


# ---- gates -------------------------------------------------------------------------------------------
READERS = {
    "with_source": ("You answer multiple-choice questions about a maintenance manual using only the manual text "
                    "given. Answer each with the number of the correct option."),
    "options_only": ("Each block lists the options of a multiple-choice question whose question you cannot see. "
                     "Pick the option most likely to be the correct answer."),
    "no_source": ("Answer each multiple-choice question about equipment maintenance from your own knowledge. "
                  "Answer with the number of the option."),
}


def _prompt(reader: str, batch: list[dict], p: Pack) -> str:
    parts = []
    for it in batch:
        opts = "\n".join(f"  {k}: {c}" for k, c in enumerate(it["choices"]))
        if reader == "options_only":
            parts.append(f"[{it['q_id']}]\n{opts}")
        elif reader == "no_source":
            parts.append(f"[{it['q_id']}] {it['stem']}\n{opts}")
        else:
            src = "\n".join(f"({p.cite.get(s, s)}) {p.sections[s]['text']}" for s in it["section_ids"] if s in p.sections)
            parts.append(f"[{it['q_id']}]\nManual:\n{src}\nQuestion: {it['stem']}\n{opts}")
    return "\n\n".join(parts)


def gate(items: list[dict], p: Pack, readers: dict, cache_dir: Path, call: bool, ledger=None,
         batch: int = 15, log=sys.stderr) -> dict:
    """Answers from each reader (cached; model calls only with `call`). readers: name -> author cfg."""
    from ..backends import BackendError, Request, Runner, UsageLimitReached, make_backend
    from ..cache import ResponseCache
    from .extract import Arm, _now
    answers: dict = {}
    usage: dict = {}
    for rname, (reader, author) in readers.items():
        spec = Arm(rname, author, images=False).spec
        cache = ResponseCache(cache_dir / rname)
        backend = make_backend(author) if call else None
        runner = Runner(backend, 1) if backend else None
        got: dict = {}
        u = usage.setdefault(rname, {"calls": 0, "cached": 0, "missing": 0, "input_tokens": 0, "output_tokens": 0,
                                     "cost_usd": 0.0, "seconds": 0.0})
        try:
            for i in range(0, len(items), batch):
                b = items[i:i + batch]
                props = {it["q_id"]: {"type": "integer", "enum": list(range(len(it["choices"])))} for it in b}
                schema = {"type": "object", "additionalProperties": False, "required": ["answers"],
                          "properties": {"answers": {"type": "object", "additionalProperties": False,
                                                     "required": list(props), "properties": props}}}
                req = Request(system=READERS[reader], prompt=_prompt(reader, b, p), schema=schema, name="answers",
                              max_tokens=2000)
                isha = sha256_json({"system": req.system, "schema": schema, "prompt": req.prompt})
                hit = cache.get("maint.learn.gate", "1", isha, spec)
                if hit is not None:
                    u["cached"] += 1
                    got.update(hit["output"]["answers"])
                    continue
                if runner is None:
                    u["missing"] += 1
                    continue
                t0 = time.monotonic()
                try:
                    resp = runner.call(req)
                except (BackendError, UsageLimitReached) as e:
                    print(f"[learn] {rname} batch {i}: {e}", file=log)
                    continue
                secs = round(time.monotonic() - t0, 2)
                cache.put({"task": "maint.learn.gate", "prompt_version": "1", "input_sha256": isha, "model": spec,
                           "key": f"{reader} {i}", "backend": backend.name, "model_id": resp.model_id,
                           "created_at": _now(), "output": resp.output, "usage": {**resp.usage, "seconds": secs}})
                got.update(resp.output["answers"])
                u["calls"] += 1
                u["input_tokens"] += resp.usage.get("input_tokens", 0)
                u["output_tokens"] += resp.usage.get("output_tokens", 0)
                u["cost_usd"] = round(u["cost_usd"] + float(resp.usage.get("cost_usd", 0.0)), 4)
                u["seconds"] = round(u["seconds"] + secs, 1)
                if ledger:
                    ledger.add({"at": _now(), "arm": f"learn:{rname}", "backend": backend.name, "model": resp.model_id,
                                "unit": f"{reader} {i}", "questions": len(b),
                                "input_tokens": resp.usage.get("input_tokens", 0),
                                "output_tokens": resp.usage.get("output_tokens", 0),
                                "cost_usd": round(float(resp.usage.get("cost_usd", 0.0)), 6), "seconds": secs})
        finally:
            cache.close()
        answers[rname] = got
    return {"answers": answers, "usage": usage}


def verdicts(items: list[dict], answers: dict, readers: dict) -> tuple[dict, dict]:
    """Per item pass/fail with reasons; per type the rates (format, solver, blind readers, chance)."""
    out, table = {}, {}
    for it in items:
        probs = question_problems({**it, "answer": it["answer"]})
        right = {r: (str(answers.get(r, {}).get(it["q_id"])) == it["answer"]) if it["q_id"] in answers.get(r, {}) else None
                 for r in readers}
        solvers = [r for r, (reader, _) in readers.items() if reader == "with_source"]
        blind = [r for r, (reader, _) in readers.items() if reader != "with_source"]
        if any(right[r] is None for r in solvers):
            probs.append("not checked by the with-source solver")
        elif not all(right[r] for r in solvers):
            probs.append("the with-source solver missed the key")
        sonnet_blind = [r for r in blind if r.endswith("sonnet")]
        if sonnet_blind and all(right[r] for r in sonnet_blind) and len(sonnet_blind) >= 2:
            probs.append("both blind readers found the key without the manual")
        out[it["q_id"]] = {"pass": not probs, "problems": probs, "right": right}
        t = table.setdefault(it["_type"], {"items": 0, "pass": 0, "chance": 0.0, **{r: [0, 0] for r in readers}})
        t["items"] += 1
        t["pass"] += not probs
        t["chance"] += 1 / len(it["choices"])
        for r, v in right.items():
            if v is not None:
                t[r][0] += v
                t[r][1] += 1
    for t in table.values():
        t["chance"] = round(t["chance"] / t["items"], 3)
        for r in readers:
            ok, n = t[r]
            t[r] = round(ok / n, 3) if n else None
    return out, table


def write(stage_conn: sqlite3.Connection, items: list[dict], topics: list[dict], skills: list[dict],
          verdict: dict, readers: dict) -> dict:
    """Topics, skills and questions into a stage; each question with its own provenance row."""
    for t in topics:
        stage_conn.execute("INSERT OR REPLACE INTO topic (topic_id, parent_id, ord, title, summary, lang) "
                           "VALUES (:topic_id,:parent_id,:ord,:title,:summary,:lang)", t)
    for s in skills:
        stage_conn.execute("INSERT OR REPLACE INTO skill (skill_id, topic_id, title, lang) VALUES "
                           "(:skill_id,:topic_id,:title,:lang)", s)
    n = {"pass": 0, "fail": 0}
    for it in items:
        v = verdict.get(it["q_id"], {"pass": False, "problems": ["not gated"]})
        pid = sha256_text(f"learn|{it['q_id']}")[:20]
        stage_conn.execute(
            "INSERT OR REPLACE INTO provenance (prov_id, backend, model, prompt_id, prompt_version, prompt_sha256, "
            "input_sha256, output_sha256, created_at, verifier, verdict, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (pid, "deterministic", "learn-structure:v1", "harvest.maint.learn", "1", sha256_text("learn-structure:v1"),
             sha256_json(it["section_ids"]), sha256_json({k: v for k, v in it.items() if not k.startswith("_")}), "",
             "contract+gates:" + ",".join(f"{r}={a.get('model', '')}" for r, (_, a) in readers.items()),
             "pass" if v["pass"] else "fail", json.dumps({"type": it["_type"], "problems": v["problems"],
                                                           "readers": v.get("right")}, ensure_ascii=False)))
        stage_conn.execute(
            "INSERT OR REPLACE INTO question (q_id, skill_id, variant_of, kind, stem, choices, answer, rationales, "
            "section_ids, difficulty, lang, prov_id, note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (it["q_id"], it["skill_id"], None, "mc", it["stem"], json.dumps(it["choices"], ensure_ascii=False),
             it["answer"], json.dumps(it["rationales"], ensure_ascii=False), json.dumps(it["section_ids"]),
             it["difficulty"], "en", pid, it.get("note")))
        n["pass" if v["pass"] else "fail"] += 1
    return n


def run(corpus, pack_dir: Path, call: bool, log=sys.stderr) -> dict:
    """Items from a built pack, gated by the corpus's readers (`maint.learn.readers`); cache only unless `call`."""
    from .build import cfg, ledger
    lc = cfg(corpus).get("learn") or {}
    readers = {name: (r["reader"], r["author"]) for name, r in (lc.get("readers") or {}).items()}
    p = load(str(next(Path(pack_dir).glob("*.sqlite"))))
    items, topics, skills = build_items(p)
    g = gate(items, p, readers, (corpus.dir / lc.get("cache_dir", "cache/learn")).resolve(), call, ledger(corpus), log=log)
    v, table = verdicts(items, g["answers"], readers)
    return {"items": items, "topics": topics, "skills": skills, "verdicts": v, "table": table, "usage": g["usage"],
            "readers": readers, "pass": sum(1 for x in v.values() if x["pass"]), "total": len(items)}
