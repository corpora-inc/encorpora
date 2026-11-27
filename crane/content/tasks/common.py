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
USAGE_CEILING = float(os.environ.get("HARVEST_USAGE_CEILING", "60"))
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
    node, so quotes copied from it verify.
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


def weekly_used() -> float:
    """Weekly usage percent. Fails closed: unreadable usage stops generation unless
    HARVEST_USAGE_UNKNOWN_OK=1 is set explicitly."""
    try:
        return float(json.loads(RATE_FILE.read_text())["seven_day"]["used_percentage"])
    except Exception as e:  # noqa: BLE001
        if os.environ.get("HARVEST_USAGE_UNKNOWN_OK") == "1":
            return 0.0
        raise UsageCeiling(f"cannot read weekly usage from {RATE_FILE}: {e}") from e


def guard():
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
    if p.returncode != 0:
        raise RuntimeError(f"claude exit {p.returncode}: {p.stderr[-800:]} {p.stdout[-400:]}")
    res = json.loads(p.stdout)
    if res.get("is_error") or "structured_output" not in res:
        raise RuntimeError(f"claude error: {str(res)[:800]}")
    return {"output": res["structured_output"], "model": ",".join(res.get("modelUsage", {}).keys()) or model,
            "usage": res.get("usage", {}), "cost_usd": res.get("total_cost_usd"), "seconds": round(time.time() - t0, 1)}


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
        p = self.key(item)
        return json.loads(p.read_text()) if p.exists() else None

    def run_one(self, item: dict) -> dict:
        p = self.key(item)
        if p.exists():
            return json.loads(p.read_text())
        r = call_claude(self.system, item["prompt"], self.schema, item.get("model", self.model))
        rec = {"task_id": self.task_id, "input_id": item["input_id"], "meta": item.get("meta", {}),
               "prompt_id": self.task_id, "prompt_version": self.version, "prompt_sha256": self.prompt_sha,
               "input_sha256": sha(item["prompt"]), "output_sha256": sha(json.dumps(r["output"], sort_keys=True)),
               "created_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
               "backend": "claude-cli", **r}
        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_suffix(".tmp")
        tmp.write_text(json.dumps(rec))
        tmp.replace(p)
        return rec

    def run(self, items: list[dict], concurrency: int = 4, log=print) -> dict:
        todo = [i for i in items if not self.key(i).exists()]
        log(f"{self.task_id}: {len(items)} inputs, {len(items) - len(todo)} cached, {len(todo)} to generate")
        done, failed = 0, []
        for b in range(0, len(todo), concurrency):
            batch = todo[b:b + concurrency]
            try:
                u = guard()
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
            if r and r in n["own"] and (best is None or k.count("(") > best[0].count("(")):
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
