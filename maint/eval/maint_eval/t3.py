"""T3, a question about the current step, answered only with the manual's own sentences.

Passages, all from the engine: the current step's view (its text, facets with their headings,
guards, test procedure, requirements) and the sections a `manual.search` scoped to the job's tree
returns for the question. They are split into sentences with handles S1..Sn. The model returns
  {"kind": "answer", "sentences": ["S3", "S7"], "connector": "<one short line or empty>"}
  {"kind": "decline"}
The app shows the selected sentences verbatim and the connector. The connector may not state a
number, a step or a requirement (checked by `text.states_*`). On decline the app shows the nearest
passages.
"""
from __future__ import annotations

from .engine import Engine
import re

from .text import content_stems, norm_sentence, sentences, states_number, states_requirement, states_step

# Words a connecting line may use to frame the shown sentences without adding content.
FRAMING = set(content_stems("""address issue problem message error mean means indicat indicates related relate reason
cause causes solution fix fixes action actions step steps first next sequence check checks test tests tool tools need
needed required requires require manual says said point points shown show follow following follows these this those
here listed list figure section persist persists continue continues sure ensure safety safe before proceed proceeding
regarding about involve involves specified specify trying try can should must do done"""))

PROMPT_VERSION = "t3-2026-11-28.1"
MAX_SENTENCES = 48


def step_passages(view: dict) -> list[tuple[str, str]]:
    """(label, text) blocks from the engine's step view."""
    out = [("Current step", view["node"]["text"])]
    for g in view.get("guards") or []:
        out.append(((g.get("heading") or g.get("kind") or "Note").upper(), g["text"]))
    for fg in view.get("facets") or []:
        for t in fg.get("texts") or []:
            out.append((fg.get("label") or fg["facet"], t["text"] if isinstance(t, dict) else str(t)))
    tp = view.get("test_procedure")
    if tp:
        for g in tp.get("guards") or []:
            out.append(((g.get("heading") or g.get("kind") or "Note").upper(), g["text"]))
        for s in tp.get("steps") or []:
            out.append((f"{tp.get('title') or 'Test procedure'}, step {s['ord']}", s["text"]))
            for g in s.get("guards") or []:
                out.append(((g.get("heading") or g.get("kind") or "Note").upper(), g["text"]))
    for r in (view.get("requirements") or []) + (view.get("setup") or []):
        out.append((f"Needs ({r['kind']})", r["text"] + (f" ({r['ident']})" if r.get("ident") else "")))
    if view.get("reference"):
        out.append(("Reference", view["reference"]))
    return out


def search_passages(eng: Engine, pack_id: str, tree_id: str, question: str, k: int,
                    seen_sections: set[str]) -> list[tuple[str, str, str]]:
    res = eng.call("manual.search", {"pack_id": pack_id, "query": question, "k": k, "scope": {"tree_id": tree_id}})
    out = []
    for h in res.get("hits") or []:
        sid = h.get("section_id")
        if not sid or sid in seen_sections:
            continue
        seen_sections.add(sid)
        v = eng.section(pack_id, sid)
        out.append((h.get("citation") or sid, v["section"]["text"], sid))
    return out


def build_pool(blocks: list[tuple[str, str]]) -> list[dict]:
    pool, seen = [], set()
    for label, text in blocks:
        for s in sentences(text):
            n = norm_sentence(s)
            if n in seen or not n:
                continue
            seen.add(n)
            pool.append({"h": f"S{len(pool) + 1}", "label": label, "text": s})
            if len(pool) >= MAX_SENTENCES:
                return pool
    return pool


def passages(eng: Engine, pack_id: str, view: dict, question: str, k: int = 5) -> list[dict]:
    blocks = step_passages(view)
    seen = {view["node"]["section_id"]}
    for cite, text, _ in search_passages(eng, pack_id, view["node"]["tree_id"], question, k, seen):
        blocks.append((cite, text))
    return build_pool(blocks)


SYSTEM = """You answer a technician's question about the maintenance step they are on, using ONLY the manual's sentences shown. Each sentence has a handle (S1, S2, ...).
- If some of the sentences answer the question, choose the fewest that fully answer it (1 to 4), by handle. You may add one short connecting line in plain words (at most 20 words) to tie them to the question. The connecting line must not state any number, measurement, step, instruction or requirement of its own: those come only from the chosen sentences. Leave it empty if not needed.
- If the sentences do not answer the question, decline. Do not choose sentences that are merely related.
Answer with JSON only."""


# Closed connecting lines (variant "tmpl"): the model picks one; it can state nothing of its own.
TEMPLATES = ["", "The manual says:", "The reason the manual gives:", "What the manual says to do:",
             "The manual's test for this:", "What you need:", "Safety first:", "Where the manual points:",
             "What this message means:", "If that does not fix it:"]

SYSTEM_TMPL = SYSTEM.replace(
    "You may add one short connecting line in plain words (at most 20 words) to tie them to the question. The connecting line must not state any number, measurement, step, instruction or requirement of its own: those come only from the chosen sentences. Leave it empty if not needed.",
    "Choose a heading for them from the list given (or the empty one).")


def schema(n: int, templates: bool = False) -> dict:
    handles = [f"S{i}" for i in range(1, n + 1)]
    conn = {"type": "string", "enum": TEMPLATES} if templates else {"type": "string", "maxLength": 140}
    ans = {"type": "object", "properties": {"kind": {"const": "answer"},
                                            "sentences": {"type": "array", "items": {"type": "string", "enum": handles},
                                                          "minItems": 1, "maxItems": 4},
                                            "connector": conn},
           "required": ["kind", "sentences", "connector"], "additionalProperties": False}
    dec = {"type": "object", "properties": {"kind": {"const": "decline"}}, "required": ["kind"],
           "additionalProperties": False}
    return {"anyOf": [ans, dec]}


def render(question: str, equipment: str, view: dict, pool: list[dict], templates: bool = False) -> str:
    lines = [f"Equipment: {equipment}", f"Troubleshooting: {view['tree']['title']}",
             f"Current step: {view['node']['text']}", f"Question: \"{question}\"", "", "Manual sentences:"]
    last = None
    for p in pool:
        if p["label"] != last:
            lines.append(f"[{p['label']}]")
            last = p["label"]
        lines.append(f"{p['h']}: {p['text']}")
    if templates:
        lines.append("\nHeadings: " + " | ".join(t or "(none)" for t in TEMPLATES))
    lines.append("\nAnswer as JSON.")
    return "\n".join(lines)


def parse(out, pool: list[dict]) -> dict:
    if isinstance(out, dict) and "answer" in out and "kind" not in out:
        out = out["answer"]
    if not isinstance(out, dict):
        return {"kind": "error"}
    if out.get("kind") == "decline":
        return {"kind": "decline"}
    if out.get("kind") == "answer":
        hs = {p["h"] for p in pool}
        sel = [h for h in dict.fromkeys(out.get("sentences") or []) if h in hs]
        if not sel:
            return {"kind": "error"}
        return {"kind": "answer", "sentences": sel[:4], "connector": (out.get("connector") or "").strip()}
    return {"kind": "error"}


def _match(a: str, b: str) -> bool:
    """Same sentence, allowing small splitting differences: equal after normalisation, or one inside
    the other when they are nearly the same length. A short sentence inside a long one is NOT a match
    (a step title inside a merged table row does not carry the row's content)."""
    na, nb = norm_sentence(a), norm_sentence(b)
    if na == nb:
        return True
    short, long_ = sorted((na, nb), key=len)
    return len(short) > 20 and short in long_ and len(short) >= 0.8 * len(long_)


def score(item: dict, pool: list[dict], dec: dict) -> dict:
    req = item["gold"].get("required") or []
    ok_extra = item["gold"].get("acceptable") or []
    answerable = item["kind"] == "answerable"
    in_pool = [any(_match(g, p["text"]) for p in pool) for g in req]
    avail = answerable and bool(req) and all(in_pool)
    sel = [p for p in pool if p["h"] in (dec.get("sentences") or [])]
    good = [p for p in sel if any(_match(g, p["text"]) for g in req + ok_extra)]
    got_req = [any(_match(g, p["text"]) for p in sel) for g in req]
    conn = dec.get("connector") or ""
    r = {"kind": item["kind"], "decision": dec.get("kind"), "answerable_in_pool": avail,
         "req_in_pool_share": (sum(in_pool) / len(in_pool)) if in_pool else None,
         "selected": [p["h"] for p in sel], "n_selected": len(sel),
         "precision": (len(good) / len(sel)) if sel else None,
         "recall": (sum(got_req) / len(req)) if req and dec.get("kind") == "answer" else (0.0 if req else None),
         "connector": conn, "conn_number": states_number(conn), "conn_step": states_step(conn),
         "conn_requirement": states_requirement(conn)}
    r["conn_unsupported"] = bool(conn) and (r["conn_number"] or r["conn_step"] or r["conn_requirement"])
    # Stricter reading of "of its own": the line adds a number, or a step or requirement whose content
    # words are not in the sentences shown (or the question). Restating a shown sentence is not its own.
    shown = " ".join(p["text"] for p in sel) + " " + item.get("text", "")
    shown_st = set(content_stems(shown))
    new = [w for w in content_stems(conn) if w not in shown_st and w not in FRAMING]
    nums_new = [n for n in re.findall(r"\d+(?:\.\d+)?", conn) if n not in shown]
    r["conn_new_words"] = new
    r["conn_own_content"] = bool(conn) and (bool(nums_new) or ((r["conn_step"] or r["conn_requirement"]) and bool(new)))
    if answerable:
        # Correct: every required sentence chosen. When retrieval did not bring them, declining is correct.
        r["correct"] = (dec.get("kind") == "answer" and all(got_req)) if avail else dec.get("kind") == "decline"
        r["correct_vs_item"] = dec.get("kind") == "answer" and bool(req) and all(got_req)
    else:
        r["correct"] = dec.get("kind") == "decline"
        r["correct_vs_item"] = r["correct"]
    return r
