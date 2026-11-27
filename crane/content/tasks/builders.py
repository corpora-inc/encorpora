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
        n = "8-12" if s["kind"] in ("knowledge", "judgment", "procedure") else "4-8"
        prompt = (skill_header(s) + f"Write {n} facts for this skill (fewer only if the text truly supports fewer).\n\n"
                  f"Rule text:\n{text}\n")
        items.append({"input_id": s["skill_id"], "prompt": prompt, "meta": {"skill_id": s["skill_id"], "topic_id": s["topic_id"]}})
    return items


def key_stands_out(choices: list[str], answer: int) -> bool:
    """The key gives itself away by length: over 1.5x the longest distractor and 20+ chars longer."""
    key = len(choices[answer])
    other = max(len(c) for i, c in enumerate(choices) if i != answer)
    return key > 1.5 * other and key - other >= 20


def questions_write(task, items):
    stats = {"skills": 0, "facts": 0, "mc": 0, "free_text": 0, "pass": 0, "fail": 0, "quotes_repaired": 0, "answer_pos": [0, 0, 0, 0], "fail_reasons": {}}
    by_topic: dict[str, list] = {}
    for it in items:
        rec = task.cached(it)
        if not rec:
            continue
        out = json.loads(json.dumps(rec["output"]))
        skill_id, topic_id = it["meta"]["skill_id"], it["meta"]["topic_id"]
        stats["skills"] += 1
        rows = by_topic.setdefault(topic_id, [])
        for fact in out["facts"]:
            stats["facts"] += 1
            errs = []
            if fact["basis"] == "rule":
                ok, rep, e = repair_quotes(fact)
                stats["quotes_repaired"] += rep
                errs += e
                if not fact.get("section_id") or not fact.get("quote"):
                    errs.append("rule fact without quote")
            group = None
            for item in fact["items"]:
                e2 = list(errs)
                ch = item["choices"]
                if len({norm_key(c) for c in ch}) != 4:
                    e2.append("duplicate choices")
                if not 0 <= item["answer"] < 4 or len(item["rationales"]) != 4:
                    e2.append("bad answer/rationales")
                elif key_stands_out(ch, item["answer"]):
                    e2.append("key conspicuously longest")
                p = perm(item["stem"], 4)
                choices = [ch[i] for i in p]
                rats = [item["rationales"][i] for i in p]
                answer = p.index(item["answer"]) if 0 <= item["answer"] < 4 else -1
                q_id = f"q.{skill_id}.{sha(item['stem'])[:10]}"
                group = group or q_id
                verdict = "pass" if not e2 else "fail"
                stats[verdict] += 1
                for r in e2:
                    stats["fail_reasons"][r.split(":")[0][:40]] = stats["fail_reasons"].get(r.split(":")[0][:40], 0) + 1
                if verdict == "pass":
                    stats["answer_pos"][answer] += 1
                    lens = [len(c) for c in choices]
                    stats["key_longest"] = stats.get("key_longest", 0) + (lens[answer] == max(lens) and lens.count(max(lens)) == 1)
                stats["mc"] += 1
                rows.append({"q_id": q_id, "skill_id": skill_id, "topic_id": topic_id, "variant_of": None if group == q_id else group,
                             "kind": "mc", "stem": item["stem"], "choices": choices, "answer": str(answer), "rationales": rats,
                             "section_ids": [fact["section_id"]] if fact.get("section_id") else [],
                             "quotes": [{"section_id": fact["section_id"], "quote": fact["quote"]}] if fact["basis"] == "rule" and fact.get("quote") else [],
                             "fact": fact["fact"], "basis": fact["basis"], "difficulty": item["difficulty"], "lang": "en",
                             "prov": provenance(rec, VERIFIER, verdict, "; ".join(e2) or None)})
        for ft in out["free_text"]:
            ok, rep, errs = repair_quotes(ft)
            stats["quotes_repaired"] += rep
            bad = [x for x in ft["section_ids"] if not index().exists(x)]
            if bad:
                errs.append(f"unknown ids {bad}")
            rub = ft["rubric"]
            if not 1 <= rub["pass"] <= len(rub["points"]):
                errs.append("rubric pass out of range")
            if rubric_matches(rub, rub["sample_answer"]) < rub["pass"]:
                errs.append("sample answer fails its own rubric")
            verdict = "pass" if not errs else "fail"
            stats[verdict] += 1
            stats["free_text"] += 1
            q_id = f"q.{skill_id}.{sha(ft['stem'])[:10]}"
            rows.append({"q_id": q_id, "skill_id": skill_id, "topic_id": topic_id, "variant_of": None, "kind": "free_text",
                         "stem": ft["stem"], "choices": None, "answer": ft["rubric"], "rationales": None,
                         "section_ids": ft["section_ids"], "quotes": ft["quotes"], "fact": None, "basis": "rule",
                         "difficulty": ft["difficulty"], "lang": "en", "prov": provenance(rec, VERIFIER, verdict, "; ".join(errs) or None)})
    for topic_id, rows in by_topic.items():
        _write_jsonl(CONTENT / "data" / "questions" / f"{topic_id}.jsonl", rows)
    return stats


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
_NUMBERISH = re.compile(r"\d|\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|hundred|half|quarter|once|twice|every|each|daily|weekly|monthly|annually|no limit|none|not)\b", re.I)


def direct_answer_first(question: str, body: list) -> list[str]:
    """The answer opens with a text segment whose first sentence is the direct answer:
    Yes/No for a yes/no question, a number (or interval) for a how-many/how-far question."""
    if not body or body[0].get("t") != "text" or not body[0].get("text", "").strip():
        return ["answer does not open with a text segment"]
    first = re.sub(r"^practice:\s*", "", body[0]["text"].strip(), flags=re.I)
    first = re.split(r"(?<=[.!?])\s", first, maxsplit=1)[0]
    q = question.strip()
    request = re.match(r"^(can|could|would) you\b", q, re.I)
    if _YES_NO.match(q) and not request and " or " not in q.lower() and not re.match(r"^(yes|no)\b", first, re.I):
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
            if 2 * k / (len(stems[n]) + len(stems[m])) < 0.75 * intent.COLLIDE:
                continue  # cheap prefilter: set Dice; repeated query stems can lift the real score a little
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
    dup: dict[int, tuple[str, float]] = {}
    for n, m, score in _collisions(qs, lambda n, m: qs[m][0] < qs[n][0]):
        i, j = qs[n][0], qs[m][0]
        if score >= intent.CACHE_THRESHOLD and score > dup.get(i, ("", 0.0))[1]:
            dup[i] = (rows[j]["answer_id"], score)
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


INPUTS = {"procedures": procedures_inputs, "questions": questions_inputs, "answers": answers_inputs,
          "lessons": lessons_inputs, "glossary": glossary_inputs}
WRITERS = {"procedures": procedures_write, "questions": questions_write, "answers": answers_write,
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
        out.append({"id": e["exam_id"], "title": e["title"], "minutes": e["minutes"], "calculator": e["calculator"],
                    "passPercent": 70, "passPercentNote": "practice target; the certifier reports scaled scores",
                    "domains": doms})
    p = CONTENT / "exams.json"
    p.write_text(json.dumps(out, indent=1) + "\n")
    return {e["id"]: [d["count"] for d in e["domains"]] for e in out}


if __name__ == "__main__":
    print(exams_write())
