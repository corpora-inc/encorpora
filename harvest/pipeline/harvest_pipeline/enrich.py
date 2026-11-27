"""The enrichment engine: run tasks over the stage through the cache, verify, judge, write rows.

For every task input:
  1. render the prompt; input_sha256 = hash(system, schema, prompt)
  2. author output from the cache, or from the author backend (unless offline)
  3. every item through the task's deterministic verifiers
  4. items that pass go to the judge (a different model), through the cache
  5. verdict per item: fail if any deterministic problem, else the judge's verdict
     (no judge configured -> needs_review; deterministic backend -> pass)
  6. a provenance row per item; the task's rows written with its prov_id
Only `pass` rows reach a release pack.
"""

from __future__ import annotations

import copy
import datetime as dt
import json
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

from .backends import Backend, BackendError, Request, Runner, UsageLimitReached, make_backend
from .cache import ResponseCache
from .stage import Stage
from .tasks import Task, TaskInput
from .textutil import canonical_json, sha256_json, sha256_text

JUDGE_VERSION = "1"
JUDGE_SYSTEM = (
    "You are a strict reviewer of generated study and reference material. You compare each item with "
    "the source text and the rubric, and you return a verdict for every item: pass (correct, faithful, "
    "useful), fail (wrong, unsupported, distorted, or adds content the source lacks), or needs_review "
    "(the source itself is ambiguous). Be brief in reasons."
)
JUDGE_SCHEMA = {
    "type": "object", "additionalProperties": False, "required": ["verdicts"],
    "properties": {"verdicts": {"type": "array", "items": {
        "type": "object", "additionalProperties": False, "required": ["index", "verdict", "reason"],
        "properties": {"index": {"type": "integer"},
                       "verdict": {"type": "string", "enum": ["pass", "fail", "needs_review"]},
                       "reason": {"type": "string"}}}}},
}


def spec_of(cfg: dict | None) -> str | None:
    if not cfg:
        return None
    return f"{cfg['backend']}:{cfg.get('model') or 'default'}"


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


@dataclass
class TaskReport:
    task: str
    inputs: int = 0
    author_cached: int = 0
    author_called: int = 0
    author_missing: int = 0
    author_failed: int = 0
    judge_cached: int = 0
    judge_called: int = 0
    judge_missing: int = 0
    items: int = 0
    verdicts: dict = field(default_factory=lambda: {"pass": 0, "fail": 0, "needs_review": 0})
    rows: dict = field(default_factory=dict)
    usage: dict = field(default_factory=dict)
    stopped: str | None = None
    errors: list = field(default_factory=list)


@dataclass
class Engine:
    stage: Stage
    cache: ResponseCache
    author_cfg: dict
    judge_cfg: dict | None
    offline: bool = False
    concurrency: int = 4
    author: Backend | None = None
    judge: Backend | None = None
    log: object = sys.stderr

    def __post_init__(self):
        self._lock = threading.Lock()
        a, j = spec_of(self.author_cfg), spec_of(self.judge_cfg)
        if j and a == j and self.author_cfg.get("backend") != "deterministic":
            raise SystemExit(f"judge model must differ from the author model (both {a})")
        if not self.offline:
            if self.author is None and self.author_cfg.get("backend") != "deterministic":
                self.author = make_backend(self.author_cfg)
            if self.judge is None and self.judge_cfg:
                self.judge = make_backend(self.judge_cfg)
        self.author_spec = self.author.spec if self.author else a
        self.judge_spec = (self.judge.spec if self.judge else j) if self.judge_cfg or self.judge else None
        conc = lambda cfg: int((cfg or {}).get("concurrency", self.concurrency))  # noqa: E731
        self.author_runner = Runner(self.author, conc(self.author_cfg),
                                    min_interval=float(self.author_cfg.get("min_interval", 0))) if self.author else None
        self.judge_runner = Runner(self.judge, conc(self.judge_cfg),
                                   min_interval=float((self.judge_cfg or {}).get("min_interval", 0))) if self.judge else None

    # ---------------------------------------------------------------------------------------
    def _say(self, msg: str) -> None:
        if self.log:
            print(msg, file=self.log, flush=True)

    def _bump(self, rep: TaskReport, name: str) -> None:
        with self._lock:
            setattr(rep, name, getattr(rep, name) + 1)

    def _cached_or_call(self, runner: Runner | None, task_key: str, version: str, req: Request, model_spec: str,
                        key: str, rep: TaskReport, phase: str) -> dict | None:
        isha = sha256_json({"system": req.system, "schema": req.schema, "prompt": req.prompt})
        hit = self.cache.get(task_key, version, isha, model_spec)
        if hit is not None:
            self._bump(rep, f"{phase}_cached")
            return hit
        if self.offline or runner is None:
            self._bump(rep, f"{phase}_missing")
            return None
        try:
            resp = runner.call(req)
        except UsageLimitReached as e:
            rep.stopped = str(e)
            self._bump(rep, f"{phase}_missing")
            return None
        except BackendError as e:
            rep.errors.append(f"{phase} {key}: {e}")
            if phase == "author":
                self._bump(rep, "author_failed")
            return None
        entry = {"task": task_key, "prompt_version": version, "input_sha256": isha, "model": model_spec,
                 "key": key, "backend": runner.backend.name, "model_id": resp.model_id, "created_at": now_iso(),
                 "output": resp.output, "usage": resp.usage}
        self.cache.put(entry)
        self._bump(rep, f"{phase}_called")
        return entry

    def _map(self, runner: Runner | None, fn, items: list):
        if runner is None or len(items) <= 1:
            return [fn(x) for x in items]
        with ThreadPoolExecutor(max_workers=runner.concurrency) as pool:
            return list(pool.map(fn, items))

    # ---------------------------------------------------------------------------------------
    def run(self, task: Task, limit: int | None = None, keys: set[str] | None = None) -> TaskReport:
        rep = TaskReport(task.name)
        inputs = [i for i in task.select(self.stage) if not keys or i.key in keys]
        if limit is not None:
            inputs = inputs[:limit]
        rep.inputs = len(inputs)
        deterministic = self.author_cfg.get("backend") == "deterministic"
        self._say(f"[{task.name}] {len(inputs)} inputs")

        # 1-2. author outputs
        def author_one(inp: TaskInput):
            if deterministic:
                out = task.deterministic(inp)
                if out is None:
                    self._bump(rep, "author_missing")
                    return None
                return {"output": out, "backend": "deterministic", "model_id": "rules", "created_at": "",
                        "input_sha256": sha256_text(inp.material), "usage": {}}
            req = Request(system=task.system, prompt=task.prompt(inp), schema=task.schema, name=task.name,
                          max_tokens=task.max_tokens)
            return self._cached_or_call(self.author_runner, task.name, task.prompt_version, req,
                                        self.author_spec, inp.key, rep, "author")

        authored = self._map(self.author_runner, author_one, inputs)

        # 3. deterministic checks
        staged: list[tuple[TaskInput, dict, list[tuple[dict, list[str]]]]] = []
        for inp, entry in zip(inputs, authored):
            if entry is None:
                continue
            results = []
            for raw in task.items(entry["output"]):
                item = copy.deepcopy(raw)
                try:
                    problems = task.check(item, inp, self.stage)
                except Exception as e:  # a verifier crash is a failed item, never a silent pass
                    problems = [f"verifier error: {e!r}"]
                results.append((item, problems))
            staged.append((inp, entry, results))

        # 4. judge
        def judge_one(arg):
            inp, entry, results = arg
            todo = [(i, it) for i, (it, probs) in enumerate(results) if not probs]
            if not todo or deterministic or not task.judge_rubric or not (self.judge_spec):
                return {}
            listing = "\n".join(f"[{i}] {task.describe_item(it)}" for i, it in todo)
            prompt = (f"<source>\n{inp.material}\n</source>\n<items>\n{listing}\n</items>\n"
                      f"<rubric>\n{task.judge_rubric}\n</rubric>\n"
                      f"Return one verdict per item index: {', '.join(str(i) for i, _ in todo)}.")
            req = Request(system=JUDGE_SYSTEM, prompt=prompt, schema=JUDGE_SCHEMA, name="verdicts")
            e = self._cached_or_call(self.judge_runner, f"{task.name}.judge",
                                     f"{task.prompt_version}.j{JUDGE_VERSION}", req, self.judge_spec, inp.key,
                                     rep, "judge")
            if e is None:
                return None
            return {"entry": e, "by_index": {v["index"]: v for v in e["output"].get("verdicts", [])}}

        judged = self._map(self.judge_runner, judge_one, staged)

        # 5-6. verdicts, provenance, rows
        verifier = "deterministic:v1" + (f"+judge:{self.judge_spec}" if self.judge_spec and task.judge_rubric else "")
        for (inp, entry, results), jd in zip(staged, judged):
            for i, (item, problems) in enumerate(results):
                rep.items += 1
                notes = None
                decided = "deterministic"
                if problems:
                    verdict, notes = "fail", "; ".join(problems)
                elif deterministic or not task.judge_rubric:
                    verdict = "pass"
                elif not self.judge_spec:
                    verdict, notes, decided = "needs_review", "no judge configured", "none"
                elif jd is None:
                    verdict, notes, decided = "needs_review", "judge output missing", "none"
                else:
                    v = jd["by_index"].get(i)
                    decided = "judge"
                    if v is None:
                        verdict, notes = "needs_review", "judge gave no verdict"
                    else:
                        verdict, notes = v["verdict"], v.get("reason")
                rep.verdicts[verdict] += 1
                out_sha = sha256_text(canonical_json(item))
                prov_id = sha256_text(f"{task.name}|{entry['input_sha256']}|{self.author_spec}|{i}|{out_sha}")[:20]
                self.stage.add_provenance({
                    "prov_id": prov_id, "backend": entry.get("backend", self.author_cfg.get("backend")),
                    "model": entry.get("model_id") or self.author_spec, "prompt_id": task.pid,
                    "prompt_version": task.prompt_version, "prompt_sha256": task.prompt_sha256,
                    "input_sha256": entry["input_sha256"], "output_sha256": out_sha,
                    "created_at": entry.get("created_at") or "", "verifier": verifier, "verdict": verdict,
                    "notes": json.dumps({"key": inp.key, "index": i, "decided_by": decided, "notes": notes},
                                        ensure_ascii=False),
                })
                try:
                    tables = task.rows(item, inp, self.stage)
                except Exception as e:
                    rep.errors.append(f"writer {inp.key}[{i}]: {e!r}")
                    continue
                for table, rows in tables.items():
                    for row in rows:
                        r = dict(row)
                        cols = {c for c in self._cols(table)}
                        if "prov_id" in cols:
                            r["prov_id"] = prov_id
                        if self.stage.insert(table, r, prov_id=prov_id):
                            rep.rows[table] = rep.rows.get(table, 0) + 1
        self.stage.commit()
        usage = {}
        if self.author_runner:
            usage["author"] = self.author_runner.usage.as_dict()
        if self.judge_runner:
            usage["judge"] = self.judge_runner.usage.as_dict()
        rep.usage = usage
        self._say(f"[{task.name}] items {rep.items} {rep.verdicts} author cached/called/missing "
                  f"{rep.author_cached}/{rep.author_called}/{rep.author_missing} judge "
                  f"{rep.judge_cached}/{rep.judge_called}/{rep.judge_missing}"
                  + (f" STOPPED: {rep.stopped}" if rep.stopped else ""))
        for e in rep.errors[:5]:
            self._say(f"[{task.name}] error: {e}")
        return rep

    _colcache: dict = None

    def _cols(self, table: str) -> list[str]:
        if self._colcache is None:
            self._colcache = {}
        if table not in self._colcache:
            from .schema import table_columns
            self._colcache[table] = table_columns(self.stage.conn, table)
        return self._colcache[table]


def order_tasks(tasks: list[Task]) -> list[Task]:
    """Topological order by `after`, stable otherwise."""
    by = {t.name: t for t in tasks}
    out, seen = [], set()

    def visit(t: Task, path: tuple = ()):
        if t.name in seen:
            return
        if t.name in path:
            raise SystemExit(f"task dependency cycle: {' -> '.join(path + (t.name,))}")
        for dep in t.after:
            if dep in by:
                visit(by[dep], path + (t.name,))
        seen.add(t.name)
        out.append(t)

    for t in tasks:
        visit(t)
    return out
