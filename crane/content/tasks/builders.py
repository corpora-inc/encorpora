"""Inputs (grounded prompts) and writers (verify + write) for each task."""

from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

import common
from common import CONTENT, HERE, ground, index, load_yaml, provenance, repair_quotes, sha

VERIFIER = "crane-content/verify v1 (exact substring of eCFR text, typography repair)"


def _dump_yaml(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)

    class D(yaml.SafeDumper):
        pass

    def str_rep(dumper, s):
        style = "|" if "\n" in s else None
        return dumper.represent_scalar("tag:yaml.org,2002:str", s, style=style)

    D.add_representer(str, str_rep)
    path.write_text(yaml.dump(data, Dumper=D, sort_keys=False, allow_unicode=True, width=110))


def _write_jsonl(path: Path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def blueprint():
    return load_yaml(CONTENT / "blueprint.yaml")


def skills():
    out = []
    for t in blueprint()["topics"]:
        for s in t["skills"]:
            out.append({**s, "topic_id": t["topic_id"], "topic_title": t["title"]})
    return out


def check_ids(ids):
    ix = index()
    return [s for s in ids if not ix.exists(s)]


# ================================================================ procedures

def procedures_inputs():
    items = []
    for b in load_yaml(HERE / "procedures" / "briefs.yaml"):
        text, _ = ground(b["section_ids"], cap=48000)
        prompt = (f"Procedure: {b['title']}\nKind: {b['kind']}\nRoles: {', '.join(b['roles'])}\n"
                  f"Author's notes: {b['notes']}\n\nRule text:\n{text}\n")
        items.append({"input_id": b["proc_id"], "prompt": prompt, "meta": b})
    return items


def procedures_write(task, items):
    stats = {"procedures": 0, "steps": 0, "quotes_ok": 0, "quotes_repaired": 0, "failures": []}
    for it in items:
        rec = task.cached(it)
        if not rec:
            continue
        out = json.loads(json.dumps(rec["output"]))
        b = it["meta"]
        ok, rep, errs = repair_quotes(out)
        steps = []
        for n, s in enumerate(out["steps"], 1):
            bad = check_ids(s["section_ids"] + ([s["deficiency"]["section_id"]] if s.get("deficiency") and s["deficiency"].get("section_id") else []))
            if bad:
                errs.append(f"step {n}: unknown ids {bad}")
            d = s.get("deficiency")
            if d and not s.get("practice_only") and s["check_kind"] in ("pass_fail", "value") and not (d.get("section_id") and d.get("quote")):
                errs.append(f"step {n}: deficiency without citation")
            steps.append({"ord": n, **s})
        verdict = "pass" if not errs else "fail"
        doc = {"proc_id": b["proc_id"], "title": out["title"], "kind": b["kind"], "summary": out["summary"],
               "roles": out["roles"], "lang": "en", "section_ids": b["section_ids"], "steps": steps,
               "prov": provenance(rec, VERIFIER, verdict, "; ".join(errs) or None)}
        _dump_yaml(CONTENT / "procedures" / f"{b['proc_id']}.yaml", doc)
        stats["procedures"] += 1
        stats["steps"] += len(steps)
        stats["quotes_ok"] += ok
        stats["quotes_repaired"] += rep
        if errs:
            stats["failures"].append({b["proc_id"]: errs})
    return stats


# ================================================================ shared helpers

EXAMS = None


def exam_outline():
    global EXAMS
    if EXAMS is None:
        EXAMS = {}
        for e in blueprint()["exams"]:
            EXAMS.update(e.get("outline", {}))
    return EXAMS


def skill_header(s):
    ex = exam_outline()
    outline = "; ".join(f"{k}: {ex[k]}" for k in s.get("exam", []) if k in ex) or "none"
    return (f"Topic: {s['topic_title']}\nSkill: {s['skill_id']}: {s['title']}\nSkill kind: {s['kind']}\n"
            f"Roles: {', '.join(s['levels'])}\nExam outline items: {outline}\n")


def norm_key(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def perm(seed: str, n: int) -> list[int]:
    """Deterministic permutation from a string seed (so answer positions are uniform)."""
    h = sha(seed)
    keys = [(int(h[i * 4:(i + 1) * 4], 16), i) for i in range(n)]
    return [i for _, i in sorted(keys)]


def segments_ok(body) -> list[str]:
    errs = []
    ix = index()
    has_support = False
    for seg in body:
        t = seg.get("t")
        if t in ("quote", "cite"):
            if not ix.exists(seg.get("section_id", "")):
                errs.append(f"unknown section_id {seg.get('section_id')}")
            has_support = True
        if t in ("text", "quote") and not seg.get("text"):
            errs.append(f"empty {t} segment")
    if not has_support:
        errs.append("no quote or cite")
    return errs


def _grader_norm(text: str) -> str:
    # mirrors harvest/practice/src/grade.ts normalize(): lowercase, non letters/digits -> space
    return " " + re.sub(r"[^\w]+|_", " ", text.lower()).strip() + " "


def rubric_matches(rubric: dict, answer: str) -> int:
    """How many rubric points the harvest/practice keyword grader finds in answer."""
    t = _grader_norm(answer)
    return sum(1 for p in rubric["points"] if any((n := _grader_norm(ph).strip()) and f" {n} " in t for ph in p["any"]))


# ================================================================ questions

def skill_text(s) -> str:
    """Grounding text for one skill; fails loudly when no rule text reaches the prompt."""
    text, ids = ground(s["section_ids"], cap=20000)
    if not ids:
        raise ValueError(f"{s['skill_id']}: no rule text for {s['section_ids']} (figure-only or oversized)")
    return text


def questions_inputs():
    items = []
    for s in skills():
        text = skill_text(s)
        prompt = skill_header(s) + f"\nRule text:\n{text}\n"
        items.append({"input_id": s["skill_id"], "prompt": prompt, "meta": {"skill_id": s["skill_id"], "topic_id": s["topic_id"]}})
    return items


# The writer must sound like the reference, not like a model describing its prompt.
META = re.compile(r"\b(supplied|provided|given|quoted) (federal )?(rule|rules|text|paragraph|paragraphs|section|sections|excerpt|passage)s?\b"
                  r"|\b(this|the) (paragraph|excerpt|passage|text) (alone|used here|given|provided|supplied|shown|above)\b"
                  r"|\btext (used|given|shown) here\b|\baccording to the text\b", re.I)


def meta_language(*texts) -> list[str]:
    hits = [m.group(0) for t in texts if t for m in [META.search(t)] if m]
    return [f"refers to its prompt: {hits[0]!r}"] if hits else []


_PLACEHOLDER = re.compile(r"placeholder|\bTBD\b|\bTODO\b|lorem ipsum|NOT FOR USE|\bXXX\b|\[(insert|fill|blank)[^\]]*\]", re.I)
_COMBO = re.compile(r"\b(all|none) of the (above|options|choices)\b|\bboth\b.*\band\b.*\b(above|options)\b|\b(options?|choices?) [a-d] and [a-d]\b", re.I)
_B30_OK = re.compile(r"ASME B30\.5(?:,? Chapter 5-[0-3](?: \([^)]*\))?)?$")


def _content(s: str) -> set:
    return {w for w in re.findall(r"[a-z0-9]+(?:\.[0-9]+)?", s.lower()) if w not in _STOP}


_STOP = frozenset("a an the of to in on at for by with or and is are be it its this that as from than then any each".split())


def choice_flaws(choices: list[str], answer: int) -> list[str]:
    """Testwiseness rules a test-wise candidate would exploit, checked without a model."""
    errs = []
    if len({norm_key(c) for c in choices}) != 4:
        errs.append("duplicate choices")
    if any(_COMBO.search(c) for c in choices):
        errs.append("combination option (all/none/both)")
    sets = [_content(c) for c in choices]
    for a in range(4):
        for b in range(a + 1, 4):
            A, B = sets[a], sets[b]
            # overlap: one option contained in another, or the same words reordered; near-miss
            # options that differ in one word or number are what the exam does, and are fine
            if A and B and (A == B or (len(A) >= 2 and A < B) or (len(B) >= 2 and B < A)):
                errs.append("choices overlap")
                break
        else:
            continue
        break
    lens = [len(c) for c in choices]
    mean = sum(lens) / 4
    if any(abs(n - mean) > max(0.2 * mean, 6) for n in lens):
        errs.append("options differ in length")
    return errs


def key_length_ranks(rows) -> dict:
    """How often the key is the longest, shortest or in between (ties count as in between)."""
    c = {"longest": 0, "shortest": 0, "middle": 0}
    for r in rows:
        lens = [len(x) for x in r["choices"]]
        k = lens[int(r["answer"])]
        if k == max(lens) and lens.count(k) == 1:
            c["longest"] += 1
        elif k == min(lens) and lens.count(k) == 1:
            c["shortest"] += 1
        else:
            c["middle"] += 1
    n = sum(c.values()) or 1
    return {**c, "longest_share": round(c["longest"] / n, 3), "shortest_share": round(c["shortest"] / n, 3)}


def _item_rows(rec: dict, out_items: list, skill_id: str, topic_id: str, rows: list, stats: dict, repair_of=lambda item: None):
    """Rows for one record's items with every deterministic check applied (gates not yet attached)."""
    for item in out_items:
        errs = []
        opts = item["options"]
        keys = [k for k, o in enumerate(opts) if o["key"]]
        if len(opts) != 4 or len(keys) != 1:
            errs.append("bad shape: need 4 options and exactly one key")
            opts = (opts + [{"text": "", "key": False, "why": "", "misconception": ""}] * 4)[:4]
        ch = [o["text"].strip() for o in opts]
        item["answer"] = keys[0] if len(keys) == 1 else 0
        item["rationales"] = [o["why"] for o in opts]
        item["misconceptions"] = [o["misconception"] for o in opts]
        if any(not (r or "").strip() for r in item["rationales"]):
            errs.append("missing rationale")
        if not (item.get("beyond") or "").strip():
            errs.append("missing beyond line for the key")
        texts = [item["stem"], *ch, *item["rationales"], item.get("point") or ""]
        if any(_PLACEHOLDER.search(x or "") for x in texts):
            errs.append("placeholder text")
        errs += meta_language(*texts)
        if not any(e.startswith("bad shape") for e in errs):
            errs += choice_flaws(ch, item["answer"])
        basis = item["basis"]
        quotes = []
        if basis == "rule":
            if not item.get("section_id") or not item.get("quote"):
                errs.append("rule item without quote")
            else:
                q = {"section_id": item["section_id"], "quote": item["quote"]}
                _, rep, e = repair_quotes(q)
                stats["quotes_repaired"] += rep
                errs += e
                quotes = [q]
        elif basis == "practice" and not (item.get("source") or "").strip():
            errs.append("practice item without source")
        src = item.get("source") or ""
        if "B30.5" in src and not all(_B30_OK.match(x.strip()) for x in re.findall(r"ASME B30\.5[^;]*", src)):
            errs.append("B30.5 cited below chapter level")
        if item.get("tier") not in (1, 2, 3):
            errs.append("bad tier")
        p = perm(item["stem"], 4) if len(ch) == 4 else [0, 1, 2, 3]
        choices = [ch[i] for i in p]
        answer = p.index(item["answer"]) if 0 <= item["answer"] < 4 else 0
        stats["items"] += 1
        stats["det_pass"] += not errs
        for r in errs:
            k = r.split(":")[0][:40]
            stats["fail_reasons"][k] = stats["fail_reasons"].get(k, 0) + 1
        rows.append({"repair_of": repair_of(item), "q_id": f"q.{skill_id}.{sha(item['stem'])[:10]}", "skill_id": skill_id, "topic_id": topic_id, "variant_of": None,
                     "kind": "mc", "tier": item["tier"], "stem": item["stem"], "choices": choices, "answer": str(answer),
                     "rationales": [item["rationales"][i] for i in p], "misconceptions": [item["misconceptions"][i] for i in p],
                     "section_ids": [quotes[0]["section_id"]] if quotes else [], "quotes": quotes,
                     "note": (item.get("beyond") or "").strip() or None, "fact": item.get("point"), "basis": basis, "source": item.get("source"), "difficulty": item["difficulty"],
                     "lang": "en", "_errs": errs, "_rec": rec})


def exam_rows(task, items) -> tuple[dict, dict]:
    """Round-0 rows: every writer's items for every skill (gates not yet attached)."""
    stats = {"skills": 0, "items": 0, "det_pass": 0, "quotes_repaired": 0, "fail_reasons": {}}
    by_topic: dict[str, list] = {}
    for it in items:
        recs = task.cached_all(it)
        if recs:
            stats["skills"] += 1
        for rec in recs:
            out = json.loads(json.dumps(rec["output"]))
            skill_id, topic_id = it["meta"]["skill_id"], it["meta"]["topic_id"]
            _item_rows(rec, out["items"], skill_id, topic_id, by_topic.setdefault(topic_id, []), stats)
    return by_topic, stats


def fix_rows(stats: dict) -> dict:
    """Round-1 rows: rewrites of round-0 items that failed a gate (tasks/questions_fix)."""
    task = common.Task(HERE / "questions_fix")
    by_topic: dict[str, list] = {}
    for it in questions_fix_inputs():
        rec = task.cached(it)
        if not rec or rec.get("prompt_version") != task.version:
            continue
        out = json.loads(json.dumps(rec["output"]))
        allowed = set(it["meta"]["q_ids"])
        keep = [x for x in out["items"] if x.get("replaces") in allowed]
        _item_rows(rec, keep, it["meta"]["skill_id"], it["meta"]["topic_id"], by_topic.setdefault(it["meta"]["topic_id"], []),
                   stats, repair_of=lambda item: item.get("replaces"))
    return by_topic


def _judge_for(writer_model: str) -> str:
    """A judge from another model family than the writer."""
    return "sonnet" if common.backend_of(writer_model.split(",")[0]) == "codex" else "codex:gpt-6-astra"


def _gate_blocks(kind: str, by_topic: dict, suffix: str) -> list:
    items = []
    for rows in by_topic.values():
        by_skill: dict[str, list] = {}
        for r in rows:
            if not r["_errs"]:
                w = common.backend_of(r["_rec"]["model"].split(",")[0])
                by_skill.setdefault(f"{r['skill_id']}@{w}{suffix}", []).append(r)
        for key, rs in sorted(by_skill.items()):
            letters = "ABCD"
            blocks = [f"id: {r['q_id']}\n{r['stem']}\n" + "\n".join(f"{letters[k]}. {c}" for k, c in enumerate(r["choices"])) for r in rs]
            judge = "codex:gpt-6-astra" if kind == "naive" else _judge_for(rs[0]["_rec"]["model"])
            items.append({"input_id": key, "prompt": "\n\n".join(blocks) + "\n", "model": judge,
                          "meta": {"skill_id": rs[0]["skill_id"], "q_ids": [r["q_id"] for r in rs]}})
    return items


def _gate_inputs(kind: str, rounds=(0, 1)):
    qtask = common.Task(HERE / "questions")
    out = []
    if 0 in rounds:
        out += _gate_blocks(kind, exam_rows(qtask, questions_inputs())[0], "")
    if 1 in rounds:
        out += _gate_blocks(kind, fix_rows({"items": 0, "det_pass": 0, "quotes_repaired": 0, "fail_reasons": {}}), "#fix")
    return out


def gate_naive_inputs():
    return _gate_inputs("naive")


def gate_solve_inputs():
    return _gate_inputs("solve")


NAIVE_MAX = 0.4     # a reader with no crane training may not pick the key with this much probability
SOLVE_MIN = 0.6     # the solver must pick the key with at least this confidence and flag nothing


def _gate_results(name: str, rounds=(0, 1)) -> dict:
    task = common.Task(HERE / name)
    out = {}
    for it in _gate_inputs("naive" if name == "gate_naive" else "solve", rounds):
        rec = task.cached(it)
        if rec:
            for x in rec["output"]["items"]:
                if x["id"] in it["meta"]["q_ids"]:
                    out[x["id"]] = {**x, "judge": rec["model"]}
    return out


def gate_verdict(r: dict, opts: dict, solve: dict) -> tuple[list[str], dict]:
    """Gate errors and results for one row that passed the deterministic checks."""
    errs, gates = [], {}
    o, s = opts.get(r["q_id"]), solve.get(r["q_id"])
    if not o or not s:
        return ["not gated"], gates
    k = int(r["answer"])
    pr = [max(0.0, float(x)) for x in o["probs"]]
    tot = sum(pr) or 1.0
    pr = [x / tot for x in pr]
    gates["naive"] = {"p_key": round(pr[k], 3), "top": pr.index(max(pr)), "cue": o["cue"], "judge": o["judge"]}
    if pr.index(max(pr)) == k and pr[k] >= NAIVE_MAX:
        errs.append(f"testwise: a reader with no crane training picked the key (p={pr[k]:.2f}; {o['cue'][:80]})")
    gates["solve"] = {"answer": s["answer"], "confidence": s["confidence"], "tier": s["tier"], "flaw": s["flaw"], "judge": s["judge"]}
    if s["answer"] != k or s["confidence"] < SOLVE_MIN or s["flaw"].strip():
        errs.append(f"solver disagrees: picked {s['answer']} at {s['confidence']}; {s['flaw'][:80]}")
    elif abs(s["tier"] - r["tier"]) > 1 or (r["tier"] == 3 and s["tier"] == 1):
        errs.append(f"tier {r['tier']} rated {s['tier']}")
    return errs, gates


def questions_write(task, items):
    by_topic, stats = exam_rows(task, items)
    fixes = fix_rows(stats)
    opts, solve = _gate_results("gate_naive"), _gate_results("gate_solve")
    fixed = {r["repair_of"] for rows in fixes.values() for r in rows if not r["_errs"] and not gate_verdict(r, opts, solve)[0]}
    for topic_id, rows in fixes.items():
        by_topic.setdefault(topic_id, []).extend(rows)
    g = stats["gates"] = {"naive_fail": 0, "solve_fail": 0, "tier_fail": 0, "not_gated": 0, "replaced_by_fix": 0}
    by_model: dict[str, dict] = {}
    for rows in by_topic.values():
        for r in rows:
            errs = r.pop("_errs")
            rec = r.pop("_rec")
            gates = {}
            if not errs:
                errs, gates = gate_verdict(r, opts, solve)
                for e in errs:
                    g["naive_fail" if e.startswith("testwise") else "solve_fail" if e.startswith("solver")
                      else "not_gated" if e.startswith("not gated") else "tier_fail"] += 1
            if r["q_id"] in fixed:
                errs = errs + ["replaced by a gated rewrite"]
                g["replaced_by_fix"] += 1
            verdict = "pass" if not errs else "fail"
            m = by_model.setdefault(rec["model"].split(",")[0] + (" (fix)" if r.get("repair_of") else ""), {"items": 0, "pass": 0})
            m["items"] += 1
            m["pass"] += verdict == "pass"
            r["gates"] = gates or None

            r["prov"] = provenance(rec, VERIFIER + "; gates: options-only + solver", verdict, "; ".join(errs) or None)
    stats["by_model"] = by_model
    shipped = [r for rows in by_topic.values() for r in rows if r["prov"]["verdict"] == "pass"]
    stats["key_length_rank"] = key_length_ranks(shipped)
    stats["pass"] = sum(m["pass"] for m in by_model.values())
    stats["fail"] = sum(m["items"] - m["pass"] for m in by_model.values())
    for topic_id, rows in by_topic.items():
        _write_jsonl(CONTENT / "data" / "questions" / f"{topic_id}.jsonl", rows)
    return stats


# ================================================================ questions_fix (one rewrite round for gate failures)

MIN_PER_SKILL = 8  # below this many passing items, a skill's failures from any writer get a rewrite

FIXABLE = ("testwise", "solver disagrees", "tier ", "options differ in length", "choices overlap",
           "combination option", "duplicate choices", "missing beyond")


def questions_fix_inputs():
    qtask = common.Task(HERE / "questions")
    by_topic, _ = exam_rows(qtask, questions_inputs())
    opts, solve = _gate_results("gate_naive", (0,)), _gate_results("gate_solve", (0,))
    sk = {s["skill_id"]: s for s in skills()}
    passing: dict[str, int] = {}
    for rows in by_topic.values():
        for r in rows:
            if not r["_errs"] and not gate_verdict(r, opts, solve)[0]:
                passing[r["skill_id"]] = passing.get(r["skill_id"], 0) + 1
    items = []
    for topic_id, rows in by_topic.items():
        by_skill: dict[str, list] = {}
        for r in rows:
            errs = r["_errs"] or gate_verdict(r, opts, solve)[0]
            w = common.backend_of(r["_rec"]["model"].split(",")[0])
            # Opus items get a rewrite; another writer's failures are dropped unless the skill is short of items
            if w != "claude" and passing.get(r["skill_id"], 0) >= MIN_PER_SKILL:
                continue
            if errs and all(e.startswith(FIXABLE) for e in errs):
                by_skill.setdefault(f"{r['skill_id']}@{w}", []).append((r, errs))
        for key, rs in sorted(by_skill.items()):
            skill_id = rs[0][0]["skill_id"]
            blocks = []
            for r, errs in rs:
                k = int(r["answer"])
                opts_txt = "\n".join(f"  - {'KEY ' if n == k else ''}{c}  [{r['misconceptions'][n]}]" for n, c in enumerate(r["choices"]))
                blocks.append(f"q_id: {r['q_id']}\ntier: {r['tier']}\npoint: {r['fact']}\nbasis: {r['basis']} {r['quotes'][0] if r['quotes'] else r.get('source') or ''}\n"
                              f"stem: {r['stem']}\noptions:\n{opts_txt}\nfailed: {'; '.join(errs)}\n")
            prompt = (skill_header(sk[skill_id]) + f"\nRule text:\n{skill_text(sk[skill_id])}\n\nItems to rewrite:\n\n" + "\n".join(blocks))
            items.append({"input_id": key, "prompt": prompt, "meta": {"skill_id": skill_id, "topic_id": topic_id, "q_ids": [r["q_id"] for r, _ in rs]}})
    return items


def questions_fix_write(task, items):
    return {"inputs": len(items), "items": sum(len(i["meta"]["q_ids"]) for i in items), "cached": sum(1 for it in items if task.cached(it))}


def gate_write(task, items):
    return {"inputs": len(items), "cached": sum(1 for it in items if task.cached(it))}


# ================================================================ answers

def answers_inputs():
    items = []
    for s in skills():
        text = skill_text(s)
        prompt = skill_header(s) + f"\nRule text:\n{text}\n"
        items.append({"input_id": s["skill_id"], "prompt": prompt, "meta": {"skill_id": s["skill_id"], "topic_id": s["topic_id"]}})
    return items


def answers_write(task, items):
    stats = {"skills": 0, "answers": 0, "aliases": 0, "pass": 0, "fail": 0, "quotes_ok": 0, "quotes_repaired": 0, "fail_reasons": {}}
    by_topic: dict[str, list] = {}
    for it in items:
        rec = task.cached(it)
        if not rec:
            continue
        out = json.loads(json.dumps(rec["output"]))
        skill_id, topic_id = it["meta"]["skill_id"], it["meta"]["topic_id"]
        stats["skills"] += 1
        rows = by_topic.setdefault(topic_id, [])
        for a in out["answers"]:
            ok, rep, errs = repair_quotes(a["body"])
            errs += segments_ok(a["body"])
            errs += direct_answer_first(a["question"], a["body"])
            errs += meta_language(a["question"], *[s.get("text") for s in a["body"] if s.get("t") == "text"])
            stats["quotes_ok"] += ok
            stats["quotes_repaired"] += rep
            seen = {norm_key(a["question"])}
            aliases = []
            for al in a["aliases"]:
                k = norm_key(al)
                if k and k not in seen:
                    seen.add(k)
                    aliases.append(al.strip())
            sids = []
            for seg in a["body"]:
                if seg.get("section_id") and seg["section_id"] not in sids:
                    sids.append(seg["section_id"])
            verdict = "pass" if not errs else "fail"
            stats[verdict] += 1
            for r in errs:
                stats["fail_reasons"][r.split(":")[0][:40]] = stats["fail_reasons"].get(r.split(":")[0][:40], 0) + 1
            stats["answers"] += 1
            stats["aliases"] += len(aliases)
            rows.append({"answer_id": f"a.{skill_id}.{sha(a['question'])[:10]}", "question": a["question"], "body": a["body"],
                         "section_ids": sids, "level": a["level"], "lang": "en", "skill_id": skill_id, "topic_id": topic_id,
                         "aliases": aliases, "prov": provenance(rec, VERIFIER, verdict, "; ".join(errs) or None)})
    intent_check([r for rows in by_topic.values() for r in rows], stats)
    for topic_id, rows in by_topic.items():
        _write_jsonl(CONTENT / "data" / "answers" / f"{topic_id}.jsonl", rows)
    return stats


_YES_NO = re.compile(r"^(is|are|am|was|were|do|does|did|can|could|must|may|might|should|shall|will|would|has|have|had|need|needs)\b", re.I)
_QUANT = re.compile(r"^(how (many|much|far|long|often|close|high|low|wide|heavy|fast|deep)|what('s| is| are)? (the )?(minimum|maximum|max|min|distance|clearance|interval|limit|percent|percentage|number))\b", re.I)
_NUMBERISH = re.compile(r"\d|\b(zero|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|hundred|half|quarter|once|twice|daily|weekly|monthly|annually|every (shift|day|week|month|year)|each (shift|day|week|month|year)|no (limit|minimum|maximum|set)|none)\b", re.I)


def direct_answer_first(question: str, body: list) -> list[str]:
    """The answer opens with a text segment whose first sentence is the direct answer:
    Yes/No for a yes/no question, a number (or interval) for a how-many/how-far question."""
    if not body or body[0].get("t") != "text" or not (body[0].get("text") or "").strip():
        return ["answer does not open with a text segment"]
    first = re.sub(r"^practice:\s*", "", body[0]["text"].strip(), flags=re.I)
    first = re.split(r"(?<=[.!?])\s", first, maxsplit=1)[0]
    q = question.strip()
    request = re.match(r"^(can|could|would) you (show|give|explain|walk|tell|list|describe|help)\b", q, re.I)
    if _YES_NO.match(q) and not request and " or " not in q.lower() and not re.match(r"^(yes|no|not|never|only|always)\b", first, re.I):
        return ["yes/no question not answered yes or no first"]
    if _QUANT.match(q) and not _NUMBERISH.search(first):
        return ["quantity question without a number first"]
    return []


def _neighbour_stems() -> list[tuple[str, str]]:
    """(skill_id, stem) for every passing practice question on disk."""
    out = []
    for f in sorted((CONTENT / "data" / "questions").glob("*.jsonl")):
        for line in f.read_text().splitlines():
            r = json.loads(line) if line.strip() else None
            if r and r["prov"]["verdict"] == "pass" and r["kind"] == "mc":
                out.append((r["skill_id"], r["stem"]))
    return out


def _collisions(texts: list[tuple], pairs):
    """Yield (n, m, score) for text pairs (n a row text, m any other) scoring >= intent.COLLIDE.

    `pairs(n, m)` filters candidate pairs before scoring."""
    from collections import Counter
    from itertools import chain

    import intent

    stems = [set(intent.concepts(x[2])) for x in texts]
    post: dict[str, list[int]] = {}
    for n, st in enumerate(stems):
        for s in st:
            post.setdefault(s, []).append(n)
    for n in range(len(texts)):
        if texts[n][0] < 0:
            continue
        for m, k in Counter(chain.from_iterable(post[s] for s in stems[n])).items():
            if m == n or not pairs(n, m):
                continue
            if 2 * k / (len(stems[n]) + len(stems[m])) < 0.5 * intent.COLLIDE:
                continue  # cheap prefilter: set Dice; a query that repeats a stem can score up to ~1.5x it
            score = intent.collision(texts[n][2], texts[m][2])
            if score >= intent.COLLIDE:
                yield n, m, score


def intent_check(rows: list[dict], stats: dict) -> None:
    """Every answer keeps its exact question plus paraphrases that point to it alone.

    1. An answer whose question reaches the cache threshold against an earlier answer's
       question duplicates it and fails.
    2. Among the remaining answers, an alias is dropped when it comes within
       intent.COLLIDE of another answer's question or alias, or of a practice question
       of another skill (those name neighbouring intents).
    3. Fewer than 3 surviving paraphrases fails."""
    import intent

    live = [i for i, r in enumerate(rows) if r["prov"]["verdict"] == "pass"]
    qs = [(i, rows[i]["skill_id"], rows[i]["question"], True) for i in live]
    hits: dict[int, list[tuple[float, int]]] = {}
    for n, m, score in _collisions(qs, lambda n, m: qs[m][0] < qs[n][0]):
        if score >= intent.CACHE_THRESHOLD:
            hits.setdefault(qs[n][0], []).append((score, qs[m][0]))
    dup: dict[int, tuple[str, float]] = {}
    for i in sorted(hits):  # a row only duplicates a row that is itself kept
        kept = [(s, j) for s, j in hits[i] if j not in dup]
        if kept:
            s, j = max(kept)
            dup[i] = (rows[j]["answer_id"], s)
    texts = []  # (row index or -1, skill_id, text, is_question)
    for i in live:
        if i in dup:
            continue
        texts.append((i, rows[i]["skill_id"], rows[i]["question"], True))
        texts += [(i, rows[i]["skill_id"], a, False) for a in rows[i]["aliases"]]
    texts += [(-1, sk, stem, True) for sk, stem in _neighbour_stems()]

    def pair(n, m):
        (i, sk, _, is_q), (j, sk2, _, _) = texts[n], texts[m]
        return not is_q and j != i and not (j < 0 and sk2 == sk)

    drop = {(texts[n][0], texts[n][2]) for n, m, _ in _collisions(texts, pair)}
    stats["aliases_dropped_intent"] = len(drop)
    stats["duplicate_intent"] = len(dup)
    for i, r in enumerate(rows):
        if r["prov"]["verdict"] != "pass":
            continue
        r["aliases"] = [a for a in r["aliases"] if (i, a) not in drop]
        errs = []
        if i in dup:
            errs.append(f"duplicate intent of {dup[i][0]}")
        if len(r["aliases"]) < 3:
            errs.append(f"only {len(r['aliases'])} paraphrases after intent check")
        if errs:
            r["prov"] = {**r["prov"], "verdict": "fail", "notes": "; ".join(errs)}
            stats["pass"] -= 1
            stats["fail"] += 1
            for e in errs:
                key = e.split(" of ")[0].split(" after")[0][:40]
                stats["fail_reasons"][key] = stats["fail_reasons"].get(key, 0) + 1
    stats["aliases"] = sum(len(r["aliases"]) for r in rows)


# ================================================================ lessons

DIAGRAMS = {
    "sling-angle-tension": "Sling leg tension rises as the sling angle drops (90, 60, 45, 30 degrees).",
    "load-chart-reading": "Reading a load chart cell; next-longer radius; structural vs stability region; gross to net.",
    "radius-vs-boom-angle": "Same boom at two angles: radius from center of rotation to the hook; lower angle, longer radius.",
    "swing-radius-clearance": "Plan view: counterweight swing radius barricade and the 360-degree work zone.",
    "outrigger-ground-bearing": "Outrigger float on a mat: ground bearing pressure = force / area, worked example.",
    "two-blocking": "Hook block contacting the boom tip; the anti-two-block device.",
    "power-line-table-a-zones": "Side view: the 20 ft zone and Table A clearances by voltage, with encroachment measures.",
    "hitches": "Vertical, choker and basket hitches.",
    "d-over-d": "D/d: bend diameter vs rope diameter.",
    "hand-signals": "The standard hand signals chart (Appendix A).",
}


def lessons_inputs():
    items = []
    diag = "\n".join(f"- {k}: {v}" for k, v in DIAGRAMS.items())
    for t in blueprint()["topics"]:
        sids = list(dict.fromkeys(t["section_ids"] + [x for s in t["skills"] for x in s["section_ids"]]))
        text, _ = ground(sids, cap=60000)
        sk = "\n".join(f"- {s['skill_id']}: {s['title']} ({s['kind']})" for s in t["skills"])
        prompt = (f"Topic: {t['title']}\nSummary: {t['summary']}\n\nSkills to cover:\n{sk}\n\nAvailable diagrams:\n{diag}\n\n"
                  f"Rule text:\n{text}\n")
        items.append({"input_id": t["topic_id"], "prompt": prompt, "meta": {"topic_id": t["topic_id"], "skills": [s["skill_id"] for s in t["skills"]]}})
    return items


def lessons_write(task, items):
    stats = {"topics": 0, "lessons": 0, "pass": 0, "fail": 0, "quotes_ok": 0, "quotes_repaired": 0, "diagram_slots": 0, "failures": []}
    for it in items:
        rec = task.cached(it)
        if not rec:
            continue
        out = json.loads(json.dumps(rec["output"]))
        topic_id = it["meta"]["topic_id"]
        stats["topics"] += 1
        lessons = []
        for n, les in enumerate(out["lessons"], 1):
            ok, rep, errs = repair_quotes(les["body"])
            errs += segments_ok(les["body"])
            stats["quotes_ok"] += ok
            stats["quotes_repaired"] += rep
            for seg in les["body"]:
                if seg.get("t") == "diagram":
                    stats["diagram_slots"] += 1
                    if seg.get("diagram_id") not in DIAGRAMS:
                        errs.append(f"unknown diagram {seg.get('diagram_id')}")
            bad_sk = [x for x in les["skills"] if x not in it["meta"]["skills"]]
            if bad_sk:
                errs.append(f"unknown skills {bad_sk}")
            verdict = "pass" if not errs else "fail"
            stats[verdict] += 1
            stats["lessons"] += 1
            if errs:
                stats["failures"].append({f"{topic_id}#{n}": errs})
            lessons.append({"lesson_id": f"l.{topic_id}.{n:02d}", "topic_id": topic_id, "ord": n, "title": les["title"],
                            "skills": les["skills"], "body": les["body"], "lang": "en",
                            "prov": provenance(rec, VERIFIER, verdict, "; ".join(errs) or None)})
        p = CONTENT / "data" / "lessons" / f"{topic_id}.json"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(lessons, ensure_ascii=False, indent=1) + "\n")
    return stats


# ================================================================ glossary

def _chunks(text: str, size: int = 9000):
    out, cur = [], ""
    for sent in re.split(r"(?<=\.) (?=[A-Z])", text):
        if len(cur) + len(sent) > size and cur:
            out.append(cur)
            cur = ""
        cur = (cur + " " + sent).strip()
    if cur:
        out.append(cur)
    return out


def glossary_inputs():
    items = []
    S = index().s
    for sid in ["29cfr1926.1401", "29cfr1910.179(a)", "29cfr1910.180(a)", "29cfr1910.184(b)", "29cfr1926.1402(a)"]:
        if sid == "29cfr1926.1401":
            for i, ch in enumerate(_chunks(S[sid]["own"])):
                items.append({"input_id": f"defs-1926.1401-{i}", "prompt": f"Definition text (one line):\n[{sid}] {ch}\n", "meta": {"basis": "rule"}})
        else:
            text, _ = ground([sid])
            items.append({"input_id": f"defs-{sid.replace('29cfr', '')}", "prompt": f"Definition text:\n{text}\n", "meta": {"basis": "rule"}})
    items.append({"input_id": "field-terms", "prompt": "List 80-120 field terms (crane parts, rigging hardware and hitches, load-chart terms, operations, inspection terms, signals). The rules already define the terms in 29 CFR 1926.1401, 1910.179(a), 1910.180(a) and 1910.184(b); do not repeat those.\n", "meta": {"basis": "practice"}})
    return items


def glossary_write(task, items):
    stats = {"terms": 0, "rule": 0, "practice": 0, "pass": 0, "fail": 0, "quotes_repaired": 0}
    terms: dict[str, dict] = {}
    for it in items:
        rec = task.cached(it)
        if not rec:
            continue
        out = json.loads(json.dumps(rec["output"]))
        for t in out["terms"]:
            errs = []
            if t["basis"] == "rule":
                ok, rep, errs = repair_quotes(t)
                stats["quotes_repaired"] += rep
                if not t.get("section_id") or not t.get("quote"):
                    errs.append("rule term without quote")
            k = norm_key(t["term"])
            if k in terms and terms[k]["basis"] == "rule" and t["basis"] == "practice":
                continue
            verdict = "pass" if not errs else "fail"
            terms[k] = {"term_id": "t." + re.sub(r"[^a-z0-9]+", "-", t["term"].lower()).strip("-") + ("" if t["basis"] == "rule" or k not in terms else ".p"),
                        "term": t["term"], "definition": t["definition"], "aliases": t["aliases"], "basis": t["basis"],
                        "section_id": t["section_id"], "quote": t["quote"], "lang": "en",
                        "prov": provenance(rec, VERIFIER, verdict, "; ".join(errs) or None)}
    rows = sorted(terms.values(), key=lambda r: r["term"].lower())
    for r in rows:
        stats["terms"] += 1
        stats[r["basis"]] += 1
        stats[r["prov"]["verdict"]] += 1
    _write_jsonl(CONTENT / "data" / "glossary.jsonl", rows)
    return stats



# ================================================================ course tree (instructor chat)

DOMAINS = [("core.site", "Site"), ("core.ops", "Operations"), ("core.tech", "Technical Knowledge"), ("core.lc", "Load Charts")]


def _skill_domains(s) -> list[str]:
    return [d for d, _ in DOMAINS if any(e.startswith(d + ".") for e in s.get("exam", []))]


def _misconceptions() -> dict:
    """skill_id -> [(misconception label, why it is wrong)] from the question bank's wrong options."""
    out: dict[str, list] = {}
    for f in sorted((CONTENT / "data" / "questions").glob("*.jsonl")):
        for line in f.read_text().splitlines():
            if not line.strip():
                continue
            r = json.loads(line)
            if r.get("kind") != "mc" or not r.get("misconceptions"):
                continue
            notes = (r["prov"].get("notes") or "")
            if r["prov"]["verdict"] != "pass" and not notes.startswith(("testwise", "replaced")):
                continue  # wrong options of items an expert disputed are not evidence of a misconception
            k = int(r["answer"])
            for n, (m, why) in enumerate(zip(r["misconceptions"], r["rationales"])):
                if n != k and m and m.lower() != "key":
                    out.setdefault(r["skill_id"], []).append((m, why))
    return out


def course_inputs():
    bp = blueprint()
    ex = exam_outline()
    mis = _misconceptions()
    items = []
    for t in bp["topics"]:
        blocks = []
        for s in t["skills"]:
            seen, ms = set(), []
            for m, why in mis.get(s["skill_id"], []):
                if norm_key(m) not in seen:
                    seen.add(norm_key(m))
                    ms.append(f"    - {m}: {why}")
            outline = "; ".join(f"{k}: {ex[k]}" for k in s.get("exam", []) if k in ex) or "none (not on the core exam)"
            blocks.append(f"- node_id: skill.{s['skill_id']}\n  skill: {s['title']} ({s['kind']})\n  exam outline: {outline}\n"
                          f"  misconceptions seen in practice items:\n" + ("\n".join(ms[:14]) or "    (none yet)"))
        sids = list(dict.fromkeys(t["section_ids"] + [x for s in t["skills"] for x in s["section_ids"]]))
        text, _ = ground(sids, cap=50000)
        prompt = (f"Write these nodes: topic.{t['topic_id']} and one node per skill below.\n\nTopic: {t['title']}\nSummary: {t['summary']}\n\n"
                  f"Skills:\n" + "\n".join(blocks) + f"\n\nRule text:\n{text}\n")
        items.append({"input_id": f"topic.{t['topic_id']}", "prompt": prompt,
                      "meta": {"nodes": [f"topic.{t['topic_id']}"] + [f"skill.{s['skill_id']}" for s in t["skills"]]}})
    # the top of the tree, from the topic nodes once they exist
    task = common.Task(HERE / "course")
    tops = {}
    for it in items:
        rec = task.cached(it)
        if rec and rec.get("prompt_version") == task.version:
            for n in rec["output"]["nodes"]:
                if n["node_id"].startswith("topic."):
                    tops[n["node_id"]] = " ".join(s.get("text") or "" for s in n["summary"] if s["t"] == "text")
    if len(tops) == len(bp["topics"]):
        core = next(e for e in bp["exams"] if e["exam_id"] == "mobile-core")
        lines = []
        for d, name in DOMAINS:
            w = next(x["weight"] for x in core["domains"] if x["domain_id"] == d)
            outl = "\n".join(f"    {k}: {v}" for k, v in core["outline"].items() if k.startswith(d + "."))
            tps = [t for t in bp["topics"] if any(d in _skill_domains(s) for s in t["skills"])]
            tl = "\n".join(f"    - {t['title']}: {tops.get('topic.' + t['topic_id'], '')}" for t in tps)
            lines.append(f"- node_id: domain.{d}\n  domain: {name}, {round(w * 100)}% of the core exam (handbook)\n  outline:\n{outl}\n  topics:\n{tl}")
        src = bp["exam_source"]
        w = {d["domain_id"]: round(d["weight"] * 100) for d in core["domains"]}
        facts = (f"Core exam: {core['items']} four-option questions in {core['minutes']} minutes, no calculator. Domain weights per the "
                 f"candidate handbook ({src['title']}, {src['edition'].split(';')[0]}): Site {w['core.site']}%, Operations {w['core.ops']}%, "
                 f"Technical Knowledge {w['core.tech']}%, Load Charts {w['core.lc']}%. Use exactly these numbers. "
                 "Specialty exams (one per crane type) follow, load-chart heavy, calculator allowed.")
        prompt = ("Write these nodes: guide (the course guide: the structure of the exam, how to study with this app, the hardest areas, where people fail and why), "
                  "exam.mobile-core (the core written exam itself), and one node per domain below.\n\n" + facts + "\n\nDomains:\n" + "\n".join(lines) + "\n")
        items.append({"input_id": "top", "prompt": prompt, "meta": {"nodes": ["guide", "exam.mobile-core"] + [f"domain.{d}" for d, _ in DOMAINS]}})
    return items


def kind_of(node_id: str) -> str:
    return node_id.split(".")[0]


def course_write(task, items):
    bp = blueprint()
    sk = {s["skill_id"]: s for s in skills()}
    lessons = []
    for f in sorted((CONTENT / "data" / "lessons").glob("*.json")):
        lessons += [x for x in json.loads(f.read_text()) if x["prov"]["verdict"] == "pass"]
    qpass: dict[str, int] = {}
    for f in sorted((CONTENT / "data" / "questions").glob("*.jsonl")):
        for line in f.read_text().splitlines():
            r = json.loads(line) if line.strip() else None
            if r and r["prov"]["verdict"] == "pass":
                qpass[r["skill_id"]] = qpass.get(r["skill_id"], 0) + 1
    diag_of = lambda ls: sorted({s["diagram_id"] for l in ls for s in l["body"] if s.get("t") == "diagram"})
    stats = {"nodes": 0, "pass": 0, "fail": 0, "quotes_ok": 0, "quotes_repaired": 0, "failures": []}
    nodes = []
    for it in items:
        rec = task.cached(it)
        if not rec or rec.get("prompt_version") != task.version:
            continue
        out = json.loads(json.dumps(rec["output"]))
        got = {n["node_id"]: n for n in out["nodes"] if n["node_id"] in it["meta"]["nodes"]}
        for nid in it["meta"]["nodes"]:
            n = got.get(nid)
            errs = [] if n else ["node missing from output"]
            if n:
                fields = [n["summary"], n["hard"], n["exam"], n["study"]] + [m["correction"] for m in n["mistakes"]]
                for f in fields:
                    ok, rep, e = repair_quotes(f)
                    stats["quotes_ok"] += ok
                    stats["quotes_repaired"] += rep
                    errs += e
                    errs += [x for x in (f"empty {s['t']} segment" for s in f if s["t"] in ("text", "quote") and not s.get("text"))]
                errs += meta_language(*[s.get("text") for f in fields for s in f if s.get("t") == "text"], *[m["mistake"] for m in n["mistakes"]])
                if not any(s.get("text") for s in n["summary"]):
                    errs.append("empty summary")
                if kind_of(nid) in ("guide", "exam", "domain", "topic") and len((n.get("intro") or "").split()) < 30:
                    errs.append("intro too short")
                errs += meta_language(n.get("intro") or "")
                if _PLACEHOLDER.search(n.get("intro") or ""):
                    errs.append("placeholder text")
                if any(_PLACEHOLDER.search(s.get("text") or "") for f in fields for s in f):
                    errs.append("placeholder text")
            kind = nid.split(".")[0]
            links: dict = {}
            title, domains = nid, []
            if kind == "skill":
                s = sk[nid[6:]]
                ls = [l for l in lessons if s["skill_id"] in l["skills"]]
                title, domains = s["title"], _skill_domains(s)
                links = {"lessons": [l["lesson_id"] for l in ls], "questions": qpass.get(s["skill_id"], 0), "diagrams": diag_of(ls),
                         "section_ids": s["section_ids"], "exam_outline": s.get("exam", [])}
            elif kind == "topic":
                tp = next(x for x in bp["topics"] if x["topic_id"] == nid[6:])
                ls = [l for l in lessons if l["topic_id"] == tp["topic_id"]]
                title = tp["title"]
                domains = sorted({d for s in tp["skills"] for d in _skill_domains(s)})
                links = {"lessons": [l["lesson_id"] for l in ls], "skills": [s["skill_id"] for s in tp["skills"]],
                         "questions": sum(qpass.get(s["skill_id"], 0) for s in tp["skills"]), "diagrams": diag_of(ls), "section_ids": tp["section_ids"]}
            elif kind == "domain":
                d = nid[7:]
                title = dict(DOMAINS)[d]
                links = {"topics": [t["topic_id"] for t in bp["topics"] if any(d in _skill_domains(s) for s in t["skills"])],
                         "skills": [s["skill_id"] for s in skills() if d in _skill_domains(s)],
                         "exam_outline": [k for k in exam_outline() if k.startswith(d + ".")]}
            elif kind == "exam":
                title, links = "Mobile crane operator core written exam", {"domains": [f"domain.{d}" for d, _ in DOMAINS]}
            else:
                title, links = "Course guide", {"exam": "exam.mobile-core"}
            verdict = "pass" if not errs else "fail"
            stats["nodes"] += 1
            stats[verdict] += 1
            if errs:
                stats["failures"].append({nid: errs[:3]})
            nodes.append({"node_id": nid, "kind": kind, "title": title, "domains": domains,
                          **({k: n[k] for k in ("intro", "summary", "hard", "mistakes", "exam", "study")} if n else {}),
                          "links": links, "lang": "en", "prov": provenance(rec, VERIFIER, verdict, "; ".join(errs) or None)})
    # the tree: exam -> domain -> topic -> skill (a skill under each domain its exam tags name)
    tree = {"node_id": "exam.mobile-core", "children": []}
    for d, name in DOMAINS:
        tps = []
        for t in bp["topics"]:
            ss = [f"skill.{s['skill_id']}" for s in t["skills"] if d in _skill_domains(s)]
            if ss:
                tps.append({"node_id": f"topic.{t['topic_id']}", "children": [{"node_id": x} for x in ss]})
        tree["children"].append({"node_id": f"domain.{d}", "children": tps})
    beyond = [{"node_id": f"skill.{s['skill_id']}"} for s in skills() if not _skill_domains(s)]
    edges = [{"parent_id": "guide", "child_id": "exam.mobile-core", "ord": 0}]

    def walk(n):
        for k, c in enumerate(n.get("children", [])):
            edges.append({"parent_id": n["node_id"], "child_id": c["node_id"], "ord": k})
            walk(c)

    walk(tree)
    p = CONTENT / "data" / "course" / "tree.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps({"tree": tree, "beyond_core_exam": beyond, "edges": edges, "nodes": nodes}, ensure_ascii=False, indent=1) + "\n")
    return stats


# ================================================================ skill lessons (tailored to the wrong answers)

def skill_lessons_inputs():
    ex = exam_outline()
    mis = _misconceptions()
    diag = "\n".join(f"- {k}: {v}" for k, v in DIAGRAMS.items())
    items = []
    for s in skills():
        seen, ms = set(), []
        for m, why in mis.get(s["skill_id"], []):
            if norm_key(m) not in seen:
                seen.add(norm_key(m))
                ms.append(f"- {m}: {why}")
        if not ms:
            continue  # tailored lessons follow the question bank
        outline = "; ".join(f"{k}: {ex[k]}" for k in s.get("exam", []) if k in ex) or "none"
        prompt = (skill_header(s) + f"Exam outline items: {outline}\n\nMisconceptions from practice items:\n" + "\n".join(ms[:16])
                  + f"\n\nAvailable diagrams:\n{diag}\n\nRule text:\n{skill_text(s)}\n")
        items.append({"input_id": s["skill_id"], "prompt": prompt, "meta": {"skill_id": s["skill_id"], "topic_id": s["topic_id"]}})
    return items


def skill_lessons_write(task, items):
    stats = {"skills": 0, "pass": 0, "fail": 0, "quotes_ok": 0, "quotes_repaired": 0, "failures": []}
    by_topic: dict[str, list] = {}
    for n, it in enumerate(items):
        rec = task.cached(it)
        if not rec or rec.get("prompt_version") != task.version:
            continue
        les = json.loads(json.dumps(rec["output"]["lesson"]))
        ok, rep, errs = repair_quotes(les["body"])
        errs += segments_ok(les["body"])
        errs += meta_language(*[s.get("text") for s in les["body"] if s.get("t") == "text"])
        errs += [f"unknown diagram {s.get('diagram_id')}" for s in les["body"] if s.get("t") == "diagram" and s.get("diagram_id") not in DIAGRAMS]
        if any(_PLACEHOLDER.search(s.get("text") or s.get("question") or "") for s in les["body"]):
            errs.append("placeholder text")
        if not any(s.get("t") == "check" for s in les["body"]):
            errs.append("no check questions")
        stats["quotes_ok"] += ok
        stats["quotes_repaired"] += rep
        verdict = "pass" if not errs else "fail"
        stats["skills"] += 1
        stats[verdict] += 1
        if errs:
            stats["failures"].append({it["input_id"]: errs[:3]})
        sid, tid = it["meta"]["skill_id"], it["meta"]["topic_id"]
        by_topic.setdefault(tid, []).append({"lesson_id": f"ls.{sid}", "topic_id": tid, "ord": 100 + n, "title": les["title"], "skills": [sid],
                                             "body": les["body"], "lang": "en", "prov": provenance(rec, VERIFIER, verdict, "; ".join(errs) or None)})
    for tid, rows in by_topic.items():
        p = CONTENT / "data" / "lessons" / f"{tid}.skills.json"
        p.write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n")
    return stats

INPUTS = {"procedures": procedures_inputs, "questions": questions_inputs, "answers": answers_inputs,
          "gate_naive": gate_naive_inputs, "gate_solve": gate_solve_inputs, "questions_fix": questions_fix_inputs, "course": course_inputs, "skill_lessons": skill_lessons_inputs,
          "lessons": lessons_inputs, "glossary": glossary_inputs}
WRITERS = {"procedures": procedures_write, "questions": questions_write, "answers": answers_write,
           "gate_naive": gate_write, "gate_solve": gate_write, "questions_fix": questions_fix_write, "course": course_write, "skill_lessons": skill_lessons_write,
           "lessons": lessons_write, "glossary": glossary_write}


# ================================================================ exams (deterministic)

def exams_write():
    """Exam blueprints in the harvest/practice ExamBlueprint shape, derived from blueprint.yaml.

    count per domain = round(weight * items), adjusted so counts sum to items.
    passPercent is a practice target; the certifier reports scaled scores and
    does not publish a percent cut in the handbook."""
    bp = blueprint()
    sk = skills()
    out = []
    for e in bp["exams"]:
        if not e.get("outline"):
            continue
        raw = [d["weight"] * e["items"] for d in e["domains"]]
        counts = [round(x) for x in raw]
        while sum(counts) != e["items"]:
            i = max(range(len(raw)), key=lambda j: (raw[j] - counts[j]) * (1 if sum(counts) < e["items"] else -1))
            counts[i] += 1 if sum(counts) < e["items"] else -1
        doms = []
        for d, c in zip(e["domains"], counts):
            ids = [s["skill_id"] for s in sk if any(x.startswith(d["domain_id"] + ".") for x in s.get("exam", []))]
            doms.append({"id": d["domain_id"], "title": d["title"], "weight": d["weight"], "count": c, "skillIds": ids})
        src = bp["exam_source"]
        out.append({"id": e["exam_id"], "title": e["title"], "items": e["items"], "minutes": e["minutes"], "calculator": e["calculator"],
                    "source": {"title": src["title"], "edition": src["edition"], "url": src["url"], "sha256": src["sha256"],
                               "retrieved_at": src["retrieved_at"]},
                    "passPercent": 70, "passPercentNote": "practice target; the certifier reports scaled scores",
                    "domains": doms})
    p = CONTENT / "exams.json"
    p.write_text(json.dumps(out, indent=1) + "\n")
    return {e["id"]: [d["count"] for d in e["domains"]] for e in out}


if __name__ == "__main__":
    print(exams_write())
