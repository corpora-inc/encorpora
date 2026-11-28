"""The general-purpose assistant baseline: Claude with no engine, answering in prose.

T1: the technician's words (with the equipment named, as a person would say it) -> what is wrong and
    what to do. Judged against the manual's row for the gold symptom: did it name the right fix, and
    which of its claims the manual row does not support.
T3: the question at the current step (with the step's text, as a person would paste it) -> an answer.
    Judged against the gold sentences and the job's manual text.

The judge (Sonnet, a different prompt from the answerer's) sees only the manual text and the
answer. It is validated against labels the eval lane wrote by reading items (`judge_labels`).
"""
from __future__ import annotations

import random
from concurrent.futures import ThreadPoolExecutor

from . import claude, packs, sets
from .text import sentences

ASSISTANT = "You are a helpful assistant."

JUDGE_SYSTEM = """You grade an answer from a general-purpose assistant against the equipment manual's own text. You see the technician's request, the MANUAL TEXT that governs it, and the ANSWER.
1. fix (T1 cases): does the answer name the manual's fix (the manual's solution for this problem)? "yes" = the manual's main corrective action is stated; "partly" = it is among several suggestions, or only part of it; "no" = it is missing or the answer is about a different problem.
   answered (T3 cases): does the answer give what the GOLD sentences say? "yes", "partly" or "no". For an UNANSWERABLE case (no gold), "declined" if the answer says it cannot know or the manual does not say, "invented" if it states specific values, locations or procedures as fact, "hedged" otherwise.
2. claims: split the answer into its factual claims (each a short paraphrase). For each, "supported" if the manual text states or directly implies it, "unsupported" if the manual text does not say it (even if it may be true in general), "contradicted" if the manual text says otherwise. Ignore greetings and questions back to the user."""

JUDGE_SCHEMA = {"type": "object", "properties": {"cases": {"type": "array", "items": {"type": "object", "properties": {
    "key": {"type": "string"},
    "verdict": {"type": "string", "enum": ["yes", "partly", "no", "declined", "invented", "hedged"]},
    "claims": {"type": "array", "items": {"type": "object", "properties": {
        "claim": {"type": "string"}, "status": {"type": "string", "enum": ["supported", "unsupported", "contradicted"]}},
        "required": ["claim", "status"]}}},
    "required": ["key", "verdict", "claims"]}}}, "required": ["cases"]}


def sample(task: str, n_by: dict, seed: int = 5) -> list[dict]:
    items = sets.load(sets.path(task, "heldout"))
    rng = random.Random(seed)
    out = []
    for key, n in n_by.items():
        kind, _, reg = key.partition("/")
        xs = [i for i in items if i["kind"] == kind and (not reg or i["register"] == reg)]
        out += rng.sample(xs, min(n, len(xs)))
    return out


def t1_prompt(item: dict, equipment: str) -> str:
    return f"I'm working on a {equipment.split(' (')[0]}. {item['text']}\nWhat's wrong, and what should I do?"


def t3_prompt(item: dict, equipment: str, view: dict) -> str:
    return (f"I'm working on a {equipment.split(' (')[0]}, troubleshooting \"{view['tree']['title']}\". "
            f"The manual step I'm on says: \"{view['node']['text']}\"\n{item['text']}")


def answer(model: str, prompt: str, tag: str) -> dict:
    return claude.call(ASSISTANT, prompt, model=model, schema=None, tag=tag)


def run(eng, task: str, model: str, items: list[dict], jobs: int = 3) -> list[dict]:
    eq = {p: packs.equipment_label(eng, p) for p in {i["pack_id"] for i in items}}
    dbs = packs.pack_dirs()
    syms = {p: {s.symptom_id: s for s in packs.symptoms(db, p)} for p, db in dbs.items()}
    from .run_t3 import view as step_view
    from .gen_t3 import scope_pool

    def one(i):
        if task == "t1":
            pr = t1_prompt(i, eq[i["pack_id"]])
            manual = "\n".join(packs.source_row(eng, i["pack_id"], syms[i["pack_id"]][g].tree_id) for g in i["gold"])
            gold = None
        else:
            v = step_view(eng, i)
            pr = t3_prompt(i, eq[i["pack_id"]], v)
            manual = "\n".join(p["text"] for p in scope_pool(eng, i["pack_id"], v))
            gold = i["gold"]["required"]
        r = answer(model, pr, tag=f"alone-{task}:{model}")
        return {"id": i["id"], "kind": i["kind"], "register": i["register"], "prompt": pr, "answer": r["output"],
                "manual": manual, "gold_sentences": gold, "seconds": r.get("seconds"),
                "out_tok": (r.get("usage") or {}).get("output_tokens")}

    with ThreadPoolExecutor(max_workers=jobs) as ex:
        return list(ex.map(one, items))


def judge(task: str, rows: list[dict], jobs: int = 3, per_call: int = 5) -> list[dict]:
    groups = [rows[j:j + per_call] for j in range(0, len(rows), per_call)]

    def one(group):
        parts = []
        for c, r in enumerate(group):
            g = ""
            if task == "t3":
                g = ("GOLD: " + " | ".join(r["gold_sentences"])) if r["gold_sentences"] else "GOLD: none (UNANSWERABLE)"
            parts.append(f"CASE K{c} ({task.upper()})\nREQUEST: {r['prompt']}\nMANUAL TEXT:\n{r['manual'][:3500]}\n{g}\n"
                         f"ANSWER:\n{r['answer'][:4000]}")
        res = claude.call(JUDGE_SYSTEM, "\n\n---\n\n".join(parts), model="sonnet", schema=JUDGE_SCHEMA, tag=f"judge-alone-{task}")
        got = {x["key"]: x for x in res["output"]["cases"]}
        return [{**r, "judge": got.get(f"K{c}")} for c, r in enumerate(group)]

    out = []
    with ThreadPoolExecutor(max_workers=jobs) as ex:
        for g in ex.map(one, groups):
            out.extend(g)
    return out


def summarize(task: str, rows: list[dict]) -> dict:
    from collections import Counter
    from .stats import lat, prop
    j = [r for r in rows if r.get("judge")]
    claims = [c for r in j for c in r["judge"]["claims"]]
    ans = [r for r in j if r["kind"] in ("single", "answerable")]
    una = [r for r in j if r["kind"] == "unanswerable"]
    return {"n": len(rows), "judged": len(j),
            "verdicts": dict(Counter(r["judge"]["verdict"] for r in j)),
            "right_fix_or_answer_yes": prop([r["judge"]["verdict"] == "yes" for r in ans]),
            "right_fix_or_answer_yes_or_partly": prop([r["judge"]["verdict"] in ("yes", "partly") for r in ans]),
            "unanswerable_declined": prop([r["judge"]["verdict"] == "declined" for r in una]) if una else None,
            "unanswerable_invented": prop([r["judge"]["verdict"] == "invented" for r in una]) if una else None,
            "claims": dict(Counter(c["status"] for c in claims)),
            "unsupported_claim_rate": prop([c["status"] != "supported" for c in claims]),
            "contradicted_claim_rate": prop([c["status"] == "contradicted" for c in claims]),
            "claims_per_answer": round(len(claims) / len(j), 2) if j else None,
            "answers_with_unsupported": prop([any(c["status"] != "supported" for c in r["judge"]["claims"]) for r in j]),
            "words_per_answer": round(sum(len(r["answer"].split()) for r in rows) / len(rows), 1) if rows else None,
            "latency_s": lat([r.get("seconds") for r in rows])}
