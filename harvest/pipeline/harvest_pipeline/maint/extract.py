"""Structure extraction: a model reads a unit of pages (the page model as text, and the page images
when the backend takes them) and returns structure with pointers into the page model.

One schema covers everything a manual's pages hold: troubleshooting trees (questions, actions,
branches, the facet boxes, tree setup and warnings), procedures (test procedures and ordinary
tasks, their setup, steps and the warning, caution and note blocks that guard them), the symptom
index, displayed-code tables, equipment and applicability, and the headings that warnings guard.
Every text field is a span `{region, text}`: the region id from the page model and the words as
printed. Code checks each span against the text layer (`spans.py`) and stores the text layer's
words, never the model's. Identifiers that are not manual text (local node ids, outcomes, numeric
conditions, requirement kinds) are structure and are checked by other rules.

Units: consecutive pages, a new unit at a page whose first line matches `unit_break_regex` (a
tree or task title, a chapter) unless it says it continues, capped at `max_unit_pages`.
Every call goes through the response cache (a rebuild makes no calls) and is written to the
ledger (backend, model, tokens, seconds, cost).
"""

from __future__ import annotations

import datetime as dt
import json
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

from ..backends import BackendError, Request, Runner, UsageLimitReached, make_backend
from ..cache import ResponseCache
from ..textutil import sha256_json
from .layout import PageModel
from .render import page_text

TASK = "maint.extract"
PROMPT_VERSION = "1"

FACETS = ["test_option", "reason", "known", "possible"]
REQ_KINDS = ["tool", "part", "consumable", "personnel", "condition", "reference"]
NODE_KINDS = ["symptom", "check", "action", "goto", "escalate", "end"]
EXPECT_KINDS = ["yes_no", "pass_fail", "choice", "value", "ack"]
CHECK_KINDS = ["pass_fail", "value", "note"]


def _span(desc: str) -> dict:
    return {"type": "object", "additionalProperties": False, "required": ["region", "text"], "description": desc,
            "properties": {"region": {"type": "string", "description": "region id, e.g. p2.r14"},
                           "text": {"type": "string", "description": "the words exactly as printed"}}}


def _nullable(schema: dict) -> dict:
    return {"anyOf": [schema, {"type": "null"}]}


def _obj(props: dict, desc: str | None = None) -> dict:
    o = {"type": "object", "additionalProperties": False, "required": list(props), "properties": props}
    if desc:
        o["description"] = desc
    return o


def _arr(items: dict) -> dict:
    return {"type": "array", "items": items}


STR = {"type": "string"}
NSTR = {"type": ["string", "null"]}
NNUM = {"type": ["number", "null"]}

GUARD = _obj({"kind": {"type": "string", "enum": ["warning", "caution", "note"]},
              "text": _span("the block's text without its WARNING/CAUTION/NOTE heading"),
              "applies": _arr(_span("an applicability statement printed in or beside the block"))})
REQ = _obj({"kind": {"type": "string", "enum": REQ_KINDS},
            "text": _span("one item as printed, e.g. 'Digital multimeter' or 'Pump stopped, start key removed.'"),
            "ident": NSTR, "qty": NSTR})
EXPECT = _obj({"kind": {"type": "string", "enum": EXPECT_KINDS}, "unit": NSTR,
               "options": _arr(STR)}, "how the result is recorded; options only for choice, unit only for value")
COND = _obj({"op": {"type": "string", "enum": ["<", "<=", ">", ">=", "==", "between"]},
             "value": NNUM, "min": NNUM, "max": NNUM}, "numeric branch of a value question; between is min <= v < max")
BRANCH = _obj({
    "label": _nullable(_span("the printed branch label (YES, NO, PASS, 'Below 11.5 V'); null when none is printed")),
    "outcome": {"type": "string", "description": "yes|no|pass|fail|done, a choice option, or the value range label"},
    "cond": _nullable(COND),
    "to": {"type": "string", "description": "a node id of this tree, or '<tree ref>#<question number>' "
                                            "for a question in another unit"},
    "retry": {"type": "boolean", "description": "true only for a loop the manual makes on purpose (re-test)"},
})
NODE = _obj({
    "id": {"type": "string", "description": "your id for this node, unique in the tree (q1, a1, ...)"},
    "kind": {"type": "string", "enum": NODE_KINDS},
    "number": NSTR,
    "text": _span("the question or action as printed, without its printed number"),
    "expect": _nullable(EXPECT),
    "facets": _arr(_obj({"facet": {"type": "string", "enum": FACETS},
                         "text": _span("one item of a facet box, without its item number")})),
    "branches": _arr(BRANCH),
    "test_procedure": {"type": ["string", "null"], "description": "key of the procedure that tests this question"},
    "target": _nullable(_obj({"kind": {"type": "string", "enum": ["procedure", "tree"]},
                              "ref": {"type": "string", "description": "the printed reference, e.g. 'Task 4-3'"}})),
    "guards": _arr(GUARD),
})
TREE = _obj({
    "ref": {"type": "string", "description": "the printed identifier, e.g. 'Table 3-1'"},
    "title": _span("the tree's title as printed, without its identifier"),
    "applies": _arr(_span("applicability statement for the whole tree")),
    "setup": _arr(REQ),
    "guards": _arr(GUARD),
    "nodes": _arr(NODE),
})
STEP = _obj({"text": _span("the step as printed, without its number"),
             "check_kind": {"type": "string", "enum": CHECK_KINDS},
             "guards": _arr(GUARD)})
PROC = _obj({
    "key": {"type": "string", "description": "your key for this procedure (used by test_procedure)"},
    "ref": NSTR,
    "kind": {"type": "string", "enum": ["test", "maintenance"]},
    "title": _span("the procedure's title as printed"),
    "applies": _arr(_span("applicability statement for the whole procedure")),
    "setup": _arr(REQ),
    "guards": _arr(GUARD),
    "steps": _arr(STEP),
})
SCHEMA = _obj({
    "headings": _arr(_obj({"text": _span("a chapter or part heading"),
                           "guards": _arr(GUARD)})),
    "trees": _arr(TREE),
    "procedures": _arr(PROC),
    "symptoms": _arr(_obj({"title": _span("the symptom as printed in the index"), "tree_ref": STR})),
    "codes": _arr(_obj({"code": _span("the displayed code as printed"), "meaning": _span("its meaning"),
                        "tree_ref": STR, "question": NSTR})),
    "equipment": _arr(_obj({"name": _span("the variant or model name"), "parent": NSTR,
                            "model": _nullable(_span("model designation")),
                            "serials": _nullable(_span("serial number range as printed")),
                            "attrs": _arr(_obj({"key": STR, "value": _span("the value as printed")}))})),
})

SYSTEM = """You turn pages of a technical maintenance manual into structure. You get each page as a list of \
layout regions (ruled boxes, table cells, text blocks) with ids and positions in points from the top-left, \
the drawn arrows between regions, and sometimes the page images. Return only what the pages print.

Rules:
- Every text field is a span: the id of the region that holds it and the words exactly as printed there \
(copy them character for character; drop only a leading item or question number such as "1." and a \
WARNING/CAUTION/NOTE heading). A span never runs across two regions. Code checks every span against the \
text layer; a span it cannot find is dropped.
- A troubleshooting tree: each question box is a node of kind check; boxes that say what to do are action; \
"refer to field maintenance", "send to the repair shop", "report to ..." are escalate; "the fault is \
corrected" is end; a box that sends you to another tree is goto. A symptom statement at the top of a tree \
is a node of kind symptom with one branch (outcome "done", label null) and expect {"kind":"ack"}.
- Branches follow the drawn arrows: an arrow from box A to box B labelled YES is A's branch with outcome \
"yes" to B. Use the connectors list; when the arrows are not given, read the page image. A box with \
branches has expect: yes_no (YES/NO), pass_fail (PASS/FAIL), choice (named options; outcomes are the \
option words in lower case), value (a measurement with numeric ranges: outcome is the range label, cond \
is the numeric range, unit the unit as printed), or ack (one plain arrow; outcome "done"). An action that \
asks a yes/no question again (\"Does it work now?\") has yes_no branches. A box with no outgoing arrow has \
expect null and no branches.
- A loop back to an earlier question that the manual draws on purpose (repeat the test) is a branch with \
retry true. An off-page connector ("Go to Question 3, page 3-4") is not a node: the branch goes straight to \
"<tree ref>#<number>" (for example "Table 3-1#3"), and a box like "From Question 2, page 3-2" is skipped.
- Facet boxes beside a question (TEST OPTIONS, REASON FOR QUESTION, KNOWN INFO, POSSIBLE PROBLEMS) belong \
to the question they sit beside: facets test_option, reason, known, possible; one facet entry per \
numbered item.
- INITIAL SETUP lines become setup requirements, one per item: condition (equipment condition), tool, \
part, consumable, personnel, reference. Split a list of tools into one item each; keep the printed words.
- A test procedure (often on the facing page, "TEST PROCEDURE FOR QUESTION 2") is a procedure of kind \
test; set the question's test_procedure to its key. Numbered steps are steps. A WARNING, CAUTION or NOTE \
block printed directly before a step guards that step; one printed before the first step, or at the top \
of a procedure or tree, guards the whole procedure or tree; one under a chapter heading guards that \
heading. Every such block on the pages must appear exactly once.
- check_kind of a step: value when the step reads a measurement, note when it records something, \
otherwise pass_fail.
- An action that names a task or another table ("Refer to task 4-3") has target {kind, ref} with the \
reference as printed in a normalized form like "Task 4-3" or "Table 3-1".
- Applicability ("Diesel variant only.", "Electric variant.") is a span in applies of the tree, \
procedure or block it qualifies.
- The symptom index gives symptoms with the tree ref they point to; a code table gives codes with the \
tree ref and question number they point to; a variants table gives equipment (parent: the name of the \
machine they are variants of, or null), with model and serial range spans and other columns as attrs.
- Only what is on these pages; never invent a node, a branch target or a number."""


@dataclass
class Unit:
    key: str
    pages: list[int]


def units(models: list[PageModel], options: dict | None = None) -> list[Unit]:
    o = options or {}
    brk = re.compile(o.get("unit_break_regex",
                           r"^(?:CHAPTER\s+\d+|Chapter\s+\d+|Table\s+\d+-\d+\.|Task\s+\d+-\d+\.|TASK\s+\d+-\d+)"))
    cont = re.compile(o.get("unit_continue_regex", r"\((?:Sheet\s+[2-9]\d*\s+of|Continued|CONTINUED|Cont)"))
    cap = int(o.get("max_unit_pages", 8))
    out: list[Unit] = []
    for pm in models:
        first = next((r for r in pm.regions if r.words and r.kind not in ("header", "footer")), None)
        t = pm.region_text(first) if first else ""
        new = not out or (brk.search(t) and not cont.search(t)) or len(out[-1].pages) >= cap
        if new:
            out.append(Unit(f"{pm.source_id}@{pm.label or pm.index}", [pm.index]))
        else:
            out[-1].pages.append(pm.index)
    return out


@dataclass
class Arm:
    """One way of running the extraction: a backend, a model, with or without page images.
    `system_extra`: the corpus's own conventions, appended to the system prompt (its text is part
    of the cache key, so changing it re-extracts)."""
    name: str
    author: dict
    images: bool = True
    coords: bool = True
    system_extra: str = ""

    # options that change only how a call is made, never what the model returns
    TRANSPORT = {"backend", "model", "timeout", "max_week_pct", "concurrency", "min_interval", "retries", "base_url",
                 "api_key_env", "binary", "workdir", "rate_limits_file"}

    @property
    def spec(self) -> str:
        """The cache identity: backend, model, image or not, and a hash of every option that can change
        the output (sampling, reasoning, chat-template switches)."""
        s = f"{self.author['backend']}:{self.author.get('model') or 'default'}" + ("+img" if self.images else "")
        opts = {k: v for k, v in self.author.items() if k not in self.TRANSPORT}
        return s + (f"#{sha256_json(opts)[:8]}" if opts else "")


def prompt(unit: Unit, pages: dict[int, PageModel], coords: bool = True) -> str:
    body = "\n\n".join(page_text(pages[i], coords=coords) for i in unit.pages)
    return (f"Pages {', '.join(pages[i].label or str(i) for i in unit.pages)} of the manual.\n\n{body}\n\n"
            "Return the structure these pages print.")


def page_images(unit: Unit, pages: dict[int, PageModel]) -> list[tuple[str, bytes]]:
    out = []
    for i in unit.pages:
        p = pages[i].image
        if p and Path(p).exists():
            out.append(("image/webp", Path(p).read_bytes()))
    return out


@dataclass
class Ledger:
    path: Path

    def add(self, rec: dict) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a") as fh:
            fh.write(json.dumps(rec, sort_keys=True) + "\n")

    def rows(self) -> list[dict]:
        if not self.path.exists():
            return []
        return [json.loads(x) for x in self.path.read_text().splitlines() if x.strip()]


@dataclass
class RunReport:
    arm: str
    units: int = 0
    cached: int = 0
    called: int = 0
    missing: int = 0
    failed: int = 0
    stopped: str | None = None
    errors: list = field(default_factory=list)
    usage: dict = field(default_factory=dict)


def request_for(unit: Unit, pages: dict[int, PageModel], arm: Arm, images_ok: bool) -> tuple[Request, str]:
    imgs = page_images(unit, pages) if arm.images and images_ok else []
    system = SYSTEM + ("\n\nThis manual's conventions:\n" + arm.system_extra.strip() if arm.system_extra.strip() else "")
    req = Request(system=system, prompt=prompt(unit, pages, arm.coords), schema=SCHEMA, name="manual_structure",
                  max_tokens=32000, images=imgs)
    isha = sha256_json({"system": req.system, "schema": req.schema, "prompt": req.prompt,
                        "images": [pages[i].image_id for i in unit.pages] if arm.images else []})
    return req, isha


def run(unit_list: list[Unit], pages: dict[int, PageModel], arm: Arm, cache_dir: Path, offline: bool,
        ledger: Ledger | None = None, concurrency: int = 2, log=sys.stderr) -> tuple[dict[str, dict], RunReport]:
    """Outputs by unit key (cache entries), calling the backend only for cache misses."""
    if arm.author.get("backend") == "rules":
        return run_rules(unit_list, pages, arm, cache_dir, offline, ledger, log)
    cache = ResponseCache(cache_dir)
    rep = RunReport(arm.name, units=len(unit_list))
    backend = None if offline else make_backend(arm.author)
    if backend and arm.images and not backend.supports_images:
        raise SystemExit(f"arm {arm.name}: {backend.name} takes no images here; set images: false")
    images_ok = arm.images
    runner = Runner(backend, concurrency) if backend else None
    out: dict[str, dict] = {}

    def one(u: Unit):
        req, isha = request_for(u, pages, arm, images_ok)
        hit = cache.get(TASK, PROMPT_VERSION, isha, arm.spec)
        if hit is not None:
            rep.cached += 1
            return u.key, hit
        if runner is None:
            rep.missing += 1
            return u.key, None
        t0 = time.monotonic()
        try:
            resp = runner.call(req)
        except UsageLimitReached as e:
            rep.stopped = str(e)
            rep.missing += 1
            return u.key, None
        except BackendError as e:
            rep.failed += 1
            rep.errors.append(f"{u.key}: {e}")
            if ledger:
                ledger.add({"at": _now(), "arm": arm.name, "backend": arm.author["backend"], "unit": u.key,
                            "model": arm.author.get("model"), "error": str(e)[:300],
                            "seconds": round(time.monotonic() - t0, 2)})
            return u.key, None
        secs = round(time.monotonic() - t0, 2)
        entry = {"task": TASK, "prompt_version": PROMPT_VERSION, "input_sha256": isha, "model": arm.spec,
                 "key": u.key, "backend": backend.name, "model_id": resp.model_id, "created_at": _now(),
                 "output": resp.output, "usage": {**resp.usage, "seconds": secs}, "pages": u.pages,
                 "images": len(req.images)}
        cache.put(entry)
        rep.called += 1
        if ledger:
            ledger.add({"at": entry["created_at"], "arm": arm.name, "backend": backend.name, "model": resp.model_id,
                        "unit": u.key, "pages": len(u.pages), "images": len(req.images),
                        "input_tokens": resp.usage.get("input_tokens", 0),
                        "output_tokens": resp.usage.get("output_tokens", 0),
                        "cost_usd": round(float(resp.usage.get("cost_usd", 0.0)), 6), "seconds": secs})
        if log:
            print(f"[extract:{arm.name}] {u.key}: {resp.usage.get('input_tokens', 0)} in, "
                  f"{resp.usage.get('output_tokens', 0)} out, {secs}s", file=log, flush=True)
        return u.key, entry

    try:
        if runner is None or concurrency <= 1 or len(unit_list) <= 1:
            results = [one(u) for u in unit_list]
        else:
            from concurrent.futures import ThreadPoolExecutor
            with ThreadPoolExecutor(max_workers=concurrency) as pool:
                results = list(pool.map(one, unit_list))
    finally:
        cache.close()
    for k, e in results:
        if e is not None:
            out[k] = e
    if runner:
        rep.usage = runner.usage.as_dict()
    return out, rep


def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


RULES_VERSION = "1"


def run_rules(unit_list: list[Unit], pages: dict[int, PageModel], arm: Arm, cache_dir: Path, offline: bool,
              ledger: Ledger | None, log=sys.stderr) -> tuple[dict[str, dict], RunReport]:
    """The rules arm: structure by deterministic rules; closed questions to the arm's `resolver`
    model (cached and ledgered like any call). Without a resolver the rules' defaults stand."""
    from . import resolve
    from .rules import derive
    rep = RunReport(arm.name, units=len(unit_list))
    resolver_cfg = arm.author.get("resolver")
    rules_opts = arm.author.get("rules") or {}
    cache = ResponseCache(cache_dir)
    backend = make_backend(resolver_cfg) if resolver_cfg and not offline else None
    runner = Runner(backend, 1) if backend else None
    rspec = None
    if resolver_cfg:
        rspec = Arm("resolver", resolver_cfg, images=False).spec
    out: dict[str, dict] = {}
    rep.usage = {"questions": 0, "resolved": 0, "defaults": 0}
    try:
        for u in unit_list:
            structure, questions = derive(u.pages, pages, rules_opts)
            rep.usage["questions"] += len(questions)
            entry_usage: dict = {}
            answers = None
            isha = sha256_json({"rules": RULES_VERSION, "pages": [pages[i].image_id or i for i in u.pages],
                                "questions": [(q.id, q.text, q.options) for q in questions]})
            if questions and resolver_cfg:
                req = resolve.request(questions, resolve.pages_text(u.pages, pages))
                qsha = sha256_json({"system": req.system, "schema": req.schema, "prompt": req.prompt})
                hit = cache.get("maint.resolve", RULES_VERSION, qsha, rspec)
                if hit is not None:
                    rep.cached += 1
                    answers = hit["output"]["answers"]
                    entry_usage = hit.get("usage") or {}
                elif runner is not None:
                    t0 = time.monotonic()
                    try:
                        resp = runner.call(req)
                        secs = round(time.monotonic() - t0, 2)
                        answers = resp.output["answers"]
                        entry_usage = {**resp.usage, "seconds": secs}
                        cache.put({"task": "maint.resolve", "prompt_version": RULES_VERSION, "input_sha256": qsha,
                                   "model": rspec, "key": u.key, "backend": backend.name, "model_id": resp.model_id,
                                   "created_at": _now(), "output": resp.output, "usage": entry_usage})
                        rep.called += 1
                        if ledger:
                            ledger.add({"at": _now(), "arm": arm.name, "backend": backend.name, "model": resp.model_id,
                                        "unit": u.key, "pages": len(u.pages), "images": 0, "questions": len(questions),
                                        "input_tokens": resp.usage.get("input_tokens", 0),
                                        "output_tokens": resp.usage.get("output_tokens", 0),
                                        "cost_usd": round(float(resp.usage.get("cost_usd", 0.0)), 6), "seconds": secs})
                    except (BackendError, UsageLimitReached) as e:
                        rep.failed += 1
                        rep.errors.append(f"{u.key}: {e}")
                else:
                    rep.missing += 1
            for q in questions:
                if answers is not None and q.id in answers:
                    choice, by = int(answers[q.id]), rspec
                    rep.usage["resolved"] += 1
                else:
                    choice, by = q.default, "rules default"
                    rep.usage["defaults"] += 1
                resolve.apply(structure, q, choice, by)
            out[u.key] = {"task": TASK, "prompt_version": RULES_VERSION, "input_sha256": isha, "model": arm.spec,
                          "key": u.key, "backend": "rules", "created_at": "",
                          "model_id": f"rules:v{RULES_VERSION}" + (f"+{rspec}" if questions and resolver_cfg else ""),
                          "output": structure, "usage": entry_usage, "pages": u.pages,
                          "questions": [{"id": q.id, "text": q.text, "options": q.options, "default": q.default,
                                         "answer": (answers or {}).get(q.id)} for q in questions]}
            if log:
                print(f"[extract:{arm.name}] {u.key}: {len(questions)} closed question(s)", file=log, flush=True)
    finally:
        cache.close()
    return out, rep
