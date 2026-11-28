"""Shared plumbing for crane content generation tasks.

Grounding, the headless frontier call, the cache and provenance. Every task
feeds the model the exact eCFR text of the sections it may cite, asks for a
strict JSON schema, and keeps the raw output in a content-addressed cache so a
batch stops cleanly and resumes without paying twice.

The call is the minimal-overhead headless Claude CLI, run from an empty
directory with no settings, tools, MCP or session persistence. The pipeline lane
(harvest/pipeline) can swap the backend; prompts, schemas and inputs stay here.
"""

from __future__ import annotations

import concurrent.futures as cf
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import sys
import threading
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONTENT = HERE.parent
sys.path.insert(0, str(CONTENT / "verify"))
import ecfr  # noqa: E402
from verify import Index  # noqa: E402

CACHE = Path(os.environ.get("HARVEST_CACHE", Path.home() / ".cache" / "crane-content")) / "gen"
EMPTY = Path(os.environ.get("HARVEST_EMPTY_DIR", "/tmp/harvest-empty"))
RATE_FILE = Path(os.environ.get("CLAUDE_CONFIG_DIR", Path.home() / ".claude")) / "rate-limits.json"
USAGE_CEILING = float(os.environ.get("HARVEST_USAGE_CEILING", "55"))
# Run budget, summed over every call recorded in the ledger of HARVEST_BUDGET_ID (all
# tasks, all backends, across resumes). Dollars are what the Claude CLI reports; Codex
# and Grok report tokens only, so they count against the token cap.
BUDGET_ID = os.environ.get("HARVEST_BUDGET_ID", "default")
BUDGET_USD = float(os.environ.get("HARVEST_BUDGET_USD", "60"))
BUDGET_OUTPUT_TOKENS = int(os.environ.get("HARVEST_BUDGET_OUTPUT_TOKENS", "4000000"))
MODELS = {"sonnet": "sonnet", "opus": "opus"}

_INDEX: Index | None = None


def index() -> Index:
    global _INDEX
    if _INDEX is None:
        _INDEX = Index(ecfr.load())
    return _INDEX


def sha(s: str | bytes) -> str:
    return hashlib.sha256(s.encode() if isinstance(s, str) else s).hexdigest()


def load_yaml(p: Path):
    import yaml

    return yaml.safe_load(Path(p).read_text())


# ---------------------------------------------------------------- grounding

def subtree(sid: str) -> list[str]:
    idx = index().idx
    order, S = idx["order"], idx["sections"]
    if sid not in S:
        raise KeyError(sid)
    out = []
    if S[sid]["kind"] in ("section", "appendix"):
        prefix = sid
        return [k for k in order if k == sid or k.startswith(prefix + "(")]
    for k in order:
        if k == sid or k.startswith(sid + "("):
            out.append(k)
    return out


def ground(section_ids: list[str], cap: int = 24000) -> tuple[str, list[str]]:
    """Format the exact text of the sections (and their paragraphs) for a prompt.

    One line per node: `[section_id] own text`. Quotes must be copied from a
    single line, so each quote is a substring of that node's text.
    A node longer than the whole budget (the 1926.1401 definitions, ~21k chars)
    is split into definitions (or sentences), one line each under the same id,
    and placed after the other sections in the remaining budget, definitions
    whose term appears in the other text first. Every line stays a verbatim span of its
    node. Table rows are shown space-joined (`own`); a quote copied from a row
    verifies after repair() maps it onto the ` | ` row in `text`.
    Returns (text, ids_included)."""
    S = index().s
    seen, lines, ids, big = set(), [], [], []
    total = 0
    truncated = False
    for sid in section_ids:
        for k in subtree(sid):
            if k in seen:
                continue
            seen.add(k)
            n = S[k]
            own = n["own"]
            head = f" ({n['heading']})" if n.get("heading") and n["kind"] == "section" else ""
            if not own and n["kind"] != "section":
                continue
            line = f"[{k}]{head} {own}".rstrip()
            if len(line) > cap:
                big.append((k, head, own))
                continue
            if truncated or total + len(line) > cap:
                truncated = True
                continue
            lines.append(line)
            ids.append(k)
            total += len(line)
        if truncated:
            break
    context = " ".join(lines).lower()
    for k, head, own in big:
        # one piece per definition ("<Term> means ..."), else per sentence
        pieces = re.split(r"(?<=[.;:”])\s+(?=[A-Z“][^.;]{0,80}? means )", own)
        if len(pieces) == 1:
            pieces = re.split(r"(?<=[.;:”])\s+(?=[A-Z“])", own)
        sents = [s for s in pieces if s]
        term = [s.split(" means ", 1)[0].lower() if " means " in s[:100] else "" for s in sents]
        rank = sorted(range(len(sents)), key=lambda i: (not (term[i] and term[i] in context), i))
        keep: set[int] = set()
        used = len(f"[{k}]{head}")
        for i in rank:
            add = len(sents[i]) + len(k) + 3
            if total + used + add > cap:
                truncated = True
                continue
            keep.add(i)
            used += add
        if keep:
            first = True
            for i in sorted(keep):
                lines.append(f"[{k}]{head if first else ''} {sents[i]}")
                first = False
            ids.append(k)
            total += used
    if truncated:
        lines.append(f"[... text truncated at {cap} characters; cite only the ids shown above ...]")
    return "\n".join(lines), ids


# ---------------------------------------------------------------- usage guard

class UsageCeiling(Exception):
    pass


class CallFailed(RuntimeError):
    """A model call that failed after it may have spent; `spend` is what it reported, if anything."""

    def __init__(self, msg: str, spend: dict | None = None):
        super().__init__(msg)
        self.spend = spend


def weekly_used() -> float:
    """Weekly usage percent. Fails closed: unreadable usage stops generation unless
    HARVEST_USAGE_UNKNOWN_OK=1 is set explicitly."""
    try:
        return float(json.loads(RATE_FILE.read_text())["seven_day"]["used_percentage"])
    except Exception as e:  # noqa: BLE001
        if os.environ.get("HARVEST_USAGE_UNKNOWN_OK") == "1":
            return 0.0
        raise UsageCeiling(f"cannot read weekly usage from {RATE_FILE}: {e}") from e


_LEDGER_LOCK = threading.Lock()


def ledger_path() -> Path:
    return CACHE / "budget" / f"{BUDGET_ID}.jsonl"


def spent() -> dict:
    """Totals of the run ledger: calls, dollars, output tokens, and per backend:model."""
    tot = {"calls": 0, "usd": 0.0, "output_tokens": 0, "by_model": {}}
    p = ledger_path()
    if not p.exists():
        return tot
    for line in p.read_text().splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        tot["calls"] += 1
        tot["usd"] += r.get("usd") or 0.0
        tot["output_tokens"] += r.get("output_tokens") or 0
        m = tot["by_model"].setdefault(r["model"], {"calls": 0, "usd": 0.0, "output_tokens": 0})
        m["calls"] += 1
        m["usd"] += r.get("usd") or 0.0
        m["output_tokens"] += r.get("output_tokens") or 0
    return tot


def record_spend(task_id: str, input_id: str, r: dict) -> None:
    row = {"at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "task": task_id, "input_id": input_id,
           "model": r["model"], "usd": r.get("cost_usd") or 0.0, "output_tokens": output_tokens(r.get("usage") or {})}
    with _LEDGER_LOCK:
        ledger_path().parent.mkdir(parents=True, exist_ok=True)
        with ledger_path().open("a") as f:
            f.write(json.dumps(row) + "\n")


def mean_spend(model: str) -> dict:
    """The mean call of this backend so far (the run's mean before it has one)."""
    s = spent()
    mine = [m for k, m in s["by_model"].items() if backend_of(k) == backend_of(model)] or list(s["by_model"].values())
    calls = sum(m["calls"] for m in mine)
    if not calls:
        return {"cost_usd": 0.0, "usage": {}}
    return {"cost_usd": sum(m["usd"] for m in mine) / calls, "usage": {"output_tokens": sum(m["output_tokens"] for m in mine) // calls}}


def output_tokens(usage: dict) -> int:
    """Claude counts thinking inside output_tokens; Codex reports reasoning separately."""
    return int(usage.get("output_tokens") or 0) + int(usage.get("reasoning_output_tokens") or 0)


def guard(model: str = "sonnet", batch: int = 1):
    """Stop before a batch that could pass the run budget or, on Claude, the weekly ceiling.

    The projection adds `batch` calls at the mean cost of the same backend so far (the
    run's overall mean before that backend has a call). Only Claude calls cost dollars."""
    s = spent()
    b = backend_of(model)
    mine = [m for k, m in s["by_model"].items() if backend_of(k) == b]
    calls = sum(m["calls"] for m in mine) or s["calls"]
    usd = sum(m["usd"] for m in mine) if mine else s["usd"]
    out = sum(m["output_tokens"] for m in mine) if mine else s["output_tokens"]
    mean_usd, mean_out = (usd / calls, out / calls) if calls else (0.0, 0.0)
    if b == "claude" and s["usd"] + batch * mean_usd > BUDGET_USD:
        raise UsageCeiling(f"run budget: ${s['usd']:.2f} spent + {batch} x ${mean_usd:.2f} > ${BUDGET_USD:.0f}")
    if s["output_tokens"] + batch * mean_out > BUDGET_OUTPUT_TOKENS:
        raise UsageCeiling(f"run budget: {s['output_tokens']} output tokens + {batch} x {mean_out:.0f} > {BUDGET_OUTPUT_TOKENS}")
    if b != "claude":
        return None
    u = weekly_used()
    if u >= USAGE_CEILING:
        raise UsageCeiling(f"weekly usage {u}% >= ceiling {USAGE_CEILING}%")
    return u


# ---------------------------------------------------------------- the call

def call_claude(system: str, prompt: str, schema: dict, model: str, timeout: int = 900) -> dict:
    EMPTY.mkdir(parents=True, exist_ok=True)
    cmd = ["claude", "-p", "--setting-sources", "", "--strict-mcp-config", "--disable-slash-commands",
           "--tools", "", "--no-session-persistence", "--model", MODELS.get(model, model),
           "--system-prompt", system, "--json-schema", json.dumps(schema), "--output-format", "json"]
    t0 = time.time()
    p = subprocess.run(cmd, input=prompt, capture_output=True, text=True, cwd=EMPTY, timeout=timeout)
    try:
        res = json.loads(p.stdout)
    except json.JSONDecodeError:
        res = None
    if p.returncode != 0 or not isinstance(res, dict) or res.get("is_error") or "structured_output" not in res:
        spend = None
        if isinstance(res, dict) and (res.get("total_cost_usd") is not None or res.get("usage")):
            spend = {"model": ",".join(res.get("modelUsage", {}).keys()) or model, "cost_usd": res.get("total_cost_usd"),
                     "usage": res.get("usage") or {}}
        raise CallFailed(f"claude exit {p.returncode}: {p.stderr[-600:]} {p.stdout[-600:]}", spend)
    return {"output": res["structured_output"], "model": ",".join(res.get("modelUsage", {}).keys()) or model,
            "usage": res.get("usage", {}), "cost_usd": res.get("total_cost_usd"), "seconds": round(time.time() - t0, 1)}


def backend_of(model: str) -> str:
    """'opus' / 'sonnet' -> claude; 'codex:<model>' -> codex; 'grok:<model>' -> grok."""
    return model.split(":", 1)[0] if ":" in model else "claude"


def call_codex(system: str, prompt: str, schema: dict, model: str, timeout: int = 1200) -> dict:
    """`codex exec` with a strict output schema, read-only sandbox, ephemeral, from an empty dir."""
    import tempfile

    EMPTY.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="crane-codex-") as td:
        sf, of = Path(td) / "schema.json", Path(td) / "out.json"
        sf.write_text(json.dumps(strict_schema(schema)))
        # --ignore-user-config: no personal config or MCP servers, so the output depends on the prompt alone
        cmd = ["codex", "exec", "--ignore-user-config", "--skip-git-repo-check", "--ephemeral", "--sandbox", "read-only", "--json",
               "--output-schema", str(sf), "-o", str(of), "-C", str(EMPTY), "-m", model, "-"]
        t0 = time.time()
        p = subprocess.run(cmd, input=f"{system}\n\n{prompt}\n\nReply only with the JSON object the schema describes.",
                           capture_output=True, text=True, timeout=timeout)
        usage: dict = {}
        for line in p.stdout.splitlines():
            if '"turn.completed"' in line:
                usage = json.loads(line).get("usage", {})
        spend = {"model": f"codex:{model}", "cost_usd": None, "usage": usage} if usage else None
        if not of.exists():
            raise CallFailed(f"codex exit {p.returncode}: {p.stderr[-800:]} {p.stdout[-400:]}", spend)
        try:
            out = json.loads(of.read_text())
        except json.JSONDecodeError as e:
            raise CallFailed(f"codex: invalid JSON: {e}", spend) from e
    return {"output": out, "model": f"codex:{model}", "usage": usage, "cost_usd": None, "seconds": round(time.time() - t0, 1)}


def strict_schema(schema):
    """OpenAI structured output needs every property required; optional ones become nullable."""
    if isinstance(schema, list):
        return [strict_schema(x) for x in schema]
    if not isinstance(schema, dict):
        return schema
    s = {k: strict_schema(v) for k, v in schema.items()}
    ty = s.get("type")
    if (ty == "object" or (isinstance(ty, list) and "object" in ty)) and "properties" in s:
        req = set(s.get("required", []))
        for k, v in s["properties"].items():
            if k not in req and isinstance(v, dict):
                if "type" in v:
                    v["type"] = list(dict.fromkeys((v["type"] if isinstance(v["type"], list) else [v["type"]]) + ["null"]))
                if "enum" in v and None not in v["enum"]:
                    v["enum"] = v["enum"] + [None]
        s["required"] = list(s["properties"])
        s["additionalProperties"] = False
    return s


def call_model(system: str, prompt: str, schema: dict, model: str) -> dict:
    b = backend_of(model)
    if b == "claude":
        return call_claude(system, prompt, schema, model)
    if b == "codex":
        return call_codex(system, prompt, schema, model.split(":", 1)[1])
    raise ValueError(f"unknown backend {b!r} for model {model!r}")


# ---------------------------------------------------------------- tasks

class Task:
    def __init__(self, task_dir: Path):
        self.dir = Path(task_dir)
        self.spec = load_yaml(self.dir / "task.yaml")
        self.task_id = self.spec["task_id"]
        self.version = str(self.spec["prompt_version"])
        self.model = self.spec.get("model", "sonnet")
        self.system = (self.dir / "system.md").read_text()
        self.schema = json.loads((self.dir / "schema.json").read_text())
        self.prompt_sha = sha(self.system + json.dumps(self.schema, sort_keys=True) + self.version)
        self.cache = CACHE / self.task_id

    def key(self, item: dict) -> Path:
        h = sha(self.prompt_sha + item["prompt"] + item.get("model", self.model))[:16]
        return self.cache / f"{item['input_id']}--{h}.json"

    def cached(self, item):
        """The output for this exact prompt and model; else the output for the same input
        text from another model at this prompt version (the configured backend's first,
        then the newest); else, for versions listed under `accept_versions` in task.yaml,
        an older prompt's output (newest version first), so a partial re-run never drops
        verified rows."""
        p = self.key(item)
        if p.exists():
            return json.loads(p.read_text())
        accept = [self.version] + [str(v) for v in self.spec.get("accept_versions", [])]
        want = sha(item["prompt"])
        best, best_rank = None, None
        for f in self.cache.glob(f"{item['input_id']}--*.json"):
            rec = json.loads(f.read_text())
            v = rec.get("prompt_version")
            if rec.get("input_id") != item["input_id"] or rec.get("input_sha256") != want or v not in accept:
                continue
            if v == self.version and rec.get("prompt_sha256") != self.prompt_sha:
                continue
            rank = (v == self.version, int(v), backend_of(self.model) == backend_of(rec.get("model", "")), rec.get("created_at", ""))
            if best_rank is None or rank > best_rank:
                best, best_rank = rec, rank
        return best

    def cached_all(self, item) -> list[dict]:
        """Every output for this input text at the current prompt, one per writing model
        (for tasks with `multi_writer: true`, where each model's output is kept)."""
        want = sha(item["prompt"])
        out = []
        for f in sorted(self.cache.glob(f"{item['input_id']}--*.json")):
            rec = json.loads(f.read_text())
            if (rec.get("input_id") == item["input_id"] and rec.get("input_sha256") == want
                    and rec.get("prompt_version") == self.version and rec.get("prompt_sha256") == self.prompt_sha):
                out.append(rec)
        return out

    def done(self, item, model: str) -> bool:
        """Whether this input needs no call: it has a current-prompt output (from the same
        backend as `model` when the task keeps every writer's output)."""
        if self.spec.get("multi_writer"):
            return any(backend_of(r.get("model", "").split(",")[0]) == backend_of(item.get("model", model))
                       for r in self.cached_all(item))
        c = self.cached(item)
        return bool(c and c.get("prompt_version") == self.version)

    def run_one(self, item: dict) -> dict:
        p = self.key(item)
        if p.exists():
            return json.loads(p.read_text())
        model = item.get("model", self.model)
        try:
            r = call_model(self.system, item["prompt"], self.schema, model)
        except Exception as e:
            # a failed call may still have spent: record what it reported, else the backend's mean so far
            spend = getattr(e, "spend", None) or mean_spend(model)
            record_spend(self.task_id, item["input_id"], {"model": model, **spend} if "model" not in spend else spend)
            raise
        record_spend(self.task_id, item["input_id"], r)
        rec = {"task_id": self.task_id, "input_id": item["input_id"], "meta": item.get("meta", {}),
               "prompt_id": self.task_id, "prompt_version": self.version, "prompt_sha256": self.prompt_sha,
               "input_sha256": sha(item["prompt"]), "output_sha256": sha(json.dumps(r["output"], sort_keys=True)),
               "created_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
               "backend": "claude-cli" if backend_of(r["model"]) == "claude" else backend_of(r["model"]) + "-cli", **r}
        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_suffix(".tmp")
        tmp.write_text(json.dumps(rec))
        tmp.replace(p)
        return rec

    def run(self, items: list[dict], concurrency: int = 4, log=print) -> dict:
        # an input is done when it has an output for the current prompt from any model
        todo = [i for i in items if not self.done(i, self.model)]
        model = self.model
        log(f"{self.task_id}: {len(items)} inputs, {len(items) - len(todo)} cached, {len(todo)} to generate")
        done, failed = 0, []
        for b in range(0, len(todo), concurrency):
            batch = todo[b:b + concurrency]
            try:
                u = guard(model, len(batch))
            except UsageCeiling as e:
                log(f"STOP: {e}; {len(todo) - b} left, resume later")
                return {"done": done, "failed": failed, "stopped": str(e)}
            with cf.ThreadPoolExecutor(len(batch)) as ex:
                futs = {ex.submit(self.run_one, i): i for i in batch}
                for f in cf.as_completed(futs):
                    i = futs[f]
                    try:
                        rec = f.result()
                        done += 1
                        log(f"  ok {i['input_id']} {rec.get('seconds')}s ${rec.get('cost_usd')} (week {u}%)")
                    except Exception as e:  # noqa: BLE001
                        failed.append(i["input_id"])
                        log(f"  FAIL {i['input_id']}: {str(e)[:300]}")
        return {"done": done, "failed": failed, "stopped": None}


def provenance(rec: dict, verifier: str, verdict: str, notes: str | None = None) -> dict:
    return {"prov_id": sha(rec["output_sha256"] + rec["input_id"] + verifier)[:20], "backend": rec["backend"],
            "model": rec["model"], "prompt_id": rec["prompt_id"], "prompt_version": rec["prompt_version"],
            "prompt_sha256": rec["prompt_sha256"], "input_sha256": rec["input_sha256"],
            "output_sha256": rec["output_sha256"], "created_at": rec["created_at"], "verifier": verifier,
            "verdict": verdict, "notes": notes}


def repair_quotes(obj) -> tuple[int, int, list[str]]:
    """Walk obj; for each {section_id, quote|text(t=quote)} make the quote the exact
    source span when it matches modulo typography. Returns (ok, repaired, errors)."""
    ix = index()
    ok = rep = 0
    errs: list[str] = []

    def fix(d, key):
        nonlocal ok, rep
        sid, q = d.get("section_id"), d.get(key)
        if not isinstance(sid, str) or not ix.exists(sid):
            errs.append(f"unknown section_id {sid}")
            return
        if not isinstance(q, str) or not q.strip():
            errs.append(f"empty quote {sid}")
            return
        if ix.has_quote(sid, q):
            ok += 1
            return
        r = ix.repair(sid, q)
        if r:
            d[key] = r
            rep += 1
            return
        # the quote may sit in a sibling paragraph of the same section: re-point the
        # citation to the most specific paragraph that contains it verbatim
        base = sid.split("(")[0]
        best = None
        for k, n in ix.s.items():
            if k.split("(")[0] != base:
                continue
            r = ix.repair(k, q) if n["own"] else None
            if r and r in n.get("own_cells", n["own"]) and (best is None or k.count("(") > best[0].count("(")):
                best = (k, r)
        if best:
            d["section_id"], d[key] = best
            rep += 1
            return
        # a section heading is not section text: a "quote" of the heading becomes a cite
        head = (ix.s[sid].get("heading") or "").rstrip(". ")
        qn = ecfr.norm(q).rstrip(". ")
        if d.get("t") == "quote" and head and qn and (head.endswith(qn) or qn.endswith(head)):
            d["t"] = "cite"
            d.pop("text", None)
            rep += 1
            return
        # the prompt shows a section line as "[id] (heading) text": a quote that copied the
        # "(heading) " prefix is repaired to the text after it
        raw_head = ix.s[sid].get("heading") or ""
        qn2 = ecfr.norm(q)
        if raw_head and qn2.startswith(f"({raw_head}) "):
            r = ix.repair(sid, qn2[len(raw_head) + 3:])
            if r:
                d[key] = r
                rep += 1
                return
        errs.append(f"quote not in {sid}: {q[:100]}")

    def walk(n):
        if isinstance(n, dict):
            if n.get("t") == "quote":
                fix(n, "text")
            elif "quote" in n and "section_id" in n and n.get("quote") is not None:
                fix(n, "quote")
            for v in n.values():
                walk(v)
        elif isinstance(n, list):
            for v in n:
                walk(v)

    walk(obj)
    return ok, rep, errs
