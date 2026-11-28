"""Instructor conversations: render transcripts for a reader, judge them, report per tier.

`harvest converse` writes one JSON line per scripted conversation (CONTRACT "Instructor turns").
`render` turns each into the text a learner would read: node text, quotes with citations, the
exam's domains, lesson titles, a reviewed question with its rationales, the rules a search shows.
The judge sees the conversation's goal and that text only.

    python -m harvest_eval converse-render <transcripts.jsonl> --conversations FILE --pack DIR \
        --pubkey KEY --exams exams.json [--harvest BIN] --out rendered.jsonl
    python -m harvest_eval converse-judge <rendered.jsonl>... --cache DIR --out grades.json
"""
from __future__ import annotations

import json
import statistics
import subprocess
from pathlib import Path

RUBRIC = "instructor-2026-11-28.1"

SYSTEM = """You grade conversations between a learner and the Instructor of an offline course that prepares crane operators for a written mobile crane operator exam. The course's sources are US federal crane rules (29 CFR 1926 Subpart CC and 29 CFR 1910.179, .180, .184). Text in quotation marks followed by a citation is verbatim rule text from those sources; everything else the Instructor wrote or chose. Bracketed lines describe what the app showed (a lesson card, a practice question, a rules search). You also get the conversation's GOAL: what a good instructor does here.

Score each 1 to 5 (5 = an excellent human instructor would do no better; 3 = acceptable but clearly lacking; 1 = fails):
- fluency: natural, plain, warm, easy to follow; reads as one coherent conversation; understood messy input.
- correctness: everything stated is right for US federal crane rules and the exam; nothing misleading.
- citations: every statement of what a rule requires is backed by the quoted rule text shown, and the quotes fit the question. 5 when no rule claim was needed and none was made.
- honesty: says plainly when something is not covered or unsure and shows what it found; never invents rules, numbers, fees, passing scores or other countries' rules.
- teaching: helps the learner understand and moves them forward (examples, next steps, practice) at the right level.
goal_met: true when the GOAL was achieved.
unsupported: the number of statements about what a rule requires, permits or prohibits (or a rule's number) that are NOT backed by quoted rule text in the same turn, or that are wrong.
why: one or two short lines on the main strength and the main failure."""

SCHEMA = {"type": "object", "properties": {"grades": {"type": "array", "items": {
    "type": "object", "properties": {
        "key": {"type": "string"},
        "fluency": {"type": "integer", "minimum": 1, "maximum": 5},
        "correctness": {"type": "integer", "minimum": 1, "maximum": 5},
        "citations": {"type": "integer", "minimum": 1, "maximum": 5},
        "honesty": {"type": "integer", "minimum": 1, "maximum": 5},
        "teaching": {"type": "integer", "minimum": 1, "maximum": 5},
        "goal_met": {"type": "boolean"},
        "unsupported": {"type": "integer", "minimum": 0},
        "why": {"type": "string"}},
    "required": ["key", "fluency", "correctness", "citations", "honesty", "teaching", "goal_met",
                 "unsupported", "why"]}}}, "required": ["grades"]}

DIMENSIONS = ("fluency", "correctness", "citations", "honesty", "teaching")


class Pack:
    """Reads what a block names through `harvest show` (the verified content API)."""

    def __init__(self, harvest: str, pack: str, pubkey: str, exams: str | None):
        self.base = [harvest, "show", pack]
        self.key = ["--pubkey", pubkey]
        self.exams = json.loads(Path(exams).read_text()) if exams else []
        self.harvest, self.pack = harvest, pack
        self._cache: dict = {}

    def show(self, what: str, id_: str | None = None):
        k = (what, id_)
        if k not in self._cache:
            cmd = [*self.base, what, *(["--id", id_] if id_ else []), *self.key]
            p = subprocess.run(cmd, capture_output=True, text=True)
            self._cache[k] = json.loads(p.stdout) if p.returncode == 0 and p.stdout.strip() else None
        return self._cache[k]

    def section(self, sid: str) -> dict:
        return self.show("sections", sid) or {}

    def search(self, query: str, k: int = 3) -> list[dict]:
        p = subprocess.run([self.harvest, "search", self.pack, query, "--k", "8", "--json", *self.key],
                           capture_output=True, text=True)
        if p.returncode != 0:
            return []
        out, seen = [], set()
        for h in json.loads(p.stdout).get("hits", []):
            sid = h.get("section_id")
            if sid and sid not in seen:
                seen.add(sid)
                out.append(self.section(sid))
            if len(out) >= k:
                break
        return out


def render_turn(turn: dict, pack: Pack) -> list[str]:
    lines = []
    for b in turn.get("blocks", []):
        t = b.get("t")
        if t == "text":
            lines.append(b["text"])
        elif t == "node":
            for x in b.get("texts", []):
                lines.append(x["text"])
            if not b.get("texts"):
                lines.append(f"[course card: {b['title']}]")
        elif t == "quote":
            lines.append(f"“{b['text']}”")
        elif t == "cite":
            s = pack.section(b["section_id"])
            lines.append(f"  ({s.get('citation', b['section_id'])})")
        elif t == "exam":
            e = next((x for x in pack.exams if x.get("id") == b["exam_id"]), None)
            if e:
                doms = ", ".join(f"{d['title']} {round(d['weight'] * 100)}% ({d.get('count')} questions)"
                                 for d in e.get("domains", []))
                lines.append(f"[exam card: {e['title']}; {e.get('minutes')} minutes; domains: {doms}]")
        elif t == "lesson":
            ls = pack.show("lessons", b["lesson_id"]) or {}
            lines.append(f"[lesson card: {ls.get('title', b['lesson_id'])}]")
        elif t == "film":
            lines.append(f"[film: {b['film_id']}]")
        elif t == "diagram":
            d = pack.show("diagrams", b["diagram_id"]) or {}
            lines.append(f"[diagram: {d.get('caption', b['diagram_id'])}]")
        elif t == "question":
            q = pack.show("questions", b["q_id"]) or {}
            choices = q.get("choices") or []
            if b.get("chosen") is None:
                lines.append(f"[practice question: {q.get('stem', b['q_id'])} choices: {choices}]")
            else:
                c = b["chosen"]
                right = int(q["answer"]) if str(q.get("answer", "")).isdigit() else None
                rats = q.get("rationales") or []
                lines.append(f"[your answer, reviewed: {q.get('stem')} You chose: {choices[c] if c < len(choices) else c}. "
                             f"Correct: {choices[right] if right is not None and right < len(choices) else q.get('answer')}. "
                             f"Why yours: {rats[c] if c < len(rats) else ''} "
                             f"Why the correct one: {rats[right] if right is not None and right < len(rats) else ''}]")
        elif t == "focus":
            items = "; ".join(f"{i['title']} ({i['domain']}, mastery "
                              f"{'not practised' if i.get('mastery') is None else round(i['mastery'] * 100)})"
                              for i in b.get("items", []))
            lines.append(f"[focus list: {items}]")
        elif t == "tool":
            lines.append(f"[tool: {b['tool']} {json.dumps(b.get('input') or {})}]")
        elif t == "search":
            hits = pack.search(b["query"])
            found = "; ".join(f"{s.get('citation')} {s.get('heading') or ''}".strip() for s in hits)
            lines.append(f"[rules search for “{b['query']}” shows: {found or 'nothing'}]")
    ups = [f["label"] for f in turn.get("follow_ups", [])]
    if ups:
        lines.append(f"[suggested next: {' | '.join(ups)}]")
    return lines


def render(transcripts: Path, conversations: Path, pack: Pack) -> list[dict]:
    convs = {c["id"]: c for c in json.loads(conversations.read_text())}
    out = []
    for line in transcripts.read_text().splitlines():
        if not line.strip():
            continue
        tr = json.loads(line)
        c = convs.get(tr["id"], {})
        parts, latencies, dropped, errors = [], [], 0, 0
        for step in tr["turns"]:
            if "turn" not in step:
                errors += 1
                continue
            turn = step["turn"]
            said = step.get("said")
            parts.append(f"LEARNER: {said}" if said else "(conversation opens)")
            parts.append("INSTRUCTOR:\n" + "\n".join(render_turn(turn, pack)))
            trace = turn.get("trace") or {}
            if said is not None and turn.get("model"):
                latencies.append(trace.get("elapsed_ms", 0))
            dropped += len(trace.get("dropped") or [])
            errors += bool(trace.get("model_error"))
        out.append({"id": tr["id"], "category": c.get("category"), "goal": c.get("goal"),
                    "learner": tr.get("learner"), "text": "\n\n".join(parts), "latency_ms": latencies,
                    "dropped": dropped, "model_errors": errors})
    return out


def judge(rendered: list[dict], judge_obj) -> list[dict | None]:
    def render_one(k: str, p: dict) -> str:
        learner = f"\nLEARNER STATE: {json.dumps(p['learner'])}" if p.get("learner") else ""
        return f"KEY {k}\nGOAL: {p['goal']}{learner}\nCONVERSATION:\n{p['text']}"
    payloads = [{"goal": r["goal"], "learner": r.get("learner"), "text": r["text"]} for r in rendered]
    return judge_obj._run("conversation:" + RUBRIC, judge_obj.model, payloads, render_one, SYSTEM, SCHEMA, "grades")


def summarize(rendered: list[dict], grades: list[dict | None]) -> dict:
    ok = [(r, g) for r, g in zip(rendered, grades) if g]
    if not ok:
        return {"n": 0}
    lat = sorted(x for r, _ in ok for x in r["latency_ms"])
    out = {
        "n": len(ok),
        "score": round(statistics.mean(statistics.mean(g[d] for d in DIMENSIONS) for _, g in ok), 2),
        **{d: round(statistics.mean(g[d] for _, g in ok), 2) for d in DIMENSIONS},
        "goal_met": round(sum(g["goal_met"] for _, g in ok) / len(ok), 3),
        "unsupported_per_conv": round(sum(g["unsupported"] for _, g in ok) / len(ok), 2),
        "convs_with_unsupported": sum(1 for _, g in ok if g["unsupported"] > 0),
        "turn_ms_p50": lat[len(lat) // 2] if lat else None,
        "turn_ms_p90": lat[int(len(lat) * 0.9)] if lat else None,
        "dropped_sentences": sum(r["dropped"] for r, _ in ok),
        "model_errors": sum(r["model_errors"] for r, _ in ok),
        "by_category": {},
    }
    cats = sorted({r["category"] for r, _ in ok if r["category"]})
    for c in cats:
        gs = [g for r, g in ok if r["category"] == c]
        out["by_category"][c] = {
            "n": len(gs),
            "score": round(statistics.mean(statistics.mean(g[d] for d in DIMENSIONS) for g in gs), 2),
            "goal_met": round(sum(g["goal_met"] for g in gs) / len(gs), 2)}
    return out
