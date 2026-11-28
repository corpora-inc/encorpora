"""Item quality gates and difficulty calibration for a multiple-choice question bank.

    python -m harvest_eval items --bank <file.jsonl | dir> [...] --sections <sections.jsonl | pack> \\
        --out <dir> [--strong URL|claude:MODEL] [--weak URL|claude:MODEL] [--judge URL|claude:MODEL] \\
        [--passes deterministic options_only no_context crane_aware review] [--sample N] [--alias PAT=REPL]

Items are the CONTRACT `question` rows (JSON lines): kind "mc" with `choices`, `answer` (0-based
index as a string), `rationales`, `section_ids`, `quotes`, `difficulty`. Free-text items get only
the deterministic checks.

Deterministic gates (no model):
  key_longest        the key is strictly the longest option (chance with 4 options: about 25%)
  key_most_like_rule the key shares strictly the most words with the item's own rule quote / fact
  rationales         every option has a non-empty rationale
  cites_exist        every cited section exists in the reference text (a basis "practice" item may cite none)
  quotes_verbatim    every quote is an exact substring (whitespace-normalized) of its section
  answer position    distribution of the key's position

Model passes (options shuffled per item with a fixed seed, so position carries no signal):
  options_only   the strong model sees the four options and no stem: guessable when it picks the key
  no_context     the weak and strong models answer with the stem and no crane text
  crane_aware    the strong model answers with the stem and the cited rule text
  review         a judge reads stem, options, key and the cited rule: is the key right per the rule,
                 does the cited rule support it, is each distractor wrong and how plausible is it

Every model answer is cached (by pass, model and item hash) under <out>/cache, so runs resume.
"""
from __future__ import annotations

import csv
import hashlib
import json
import os
import random
import re
import statistics
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from .corpus import Corpus
from .sections import Normalizer

LETTERS = "ABCDEFGH"
WORD = re.compile(r"[a-z0-9]+(?:[.,][0-9]+)*")
STOP = {"the", "a", "an", "to", "of", "is", "and", "or", "for", "on", "in", "be", "must", "by", "with", "that",
        "it", "as", "at", "are", "this", "any", "if", "not", "no", "only"}


def toks(s: str) -> set[str]:
    return set(WORD.findall((s or "").lower())) - STOP


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


# ---------------------------------------------------------------- loading
def load_bank(paths: list[str]) -> list[dict]:
    files: list[Path] = []
    for p in paths:
        q = Path(p)
        files += sorted(q.glob("*.jsonl")) if q.is_dir() else [q]
    items = []
    for f in files:
        for line in f.open():
            if line.strip():
                items.append(json.loads(line))
    return items


def load_corpus(path: str, aliases: list[tuple[str, str]]) -> Corpus:
    n = Normalizer(aliases)
    p = Path(path)
    return Corpus.from_jsonl(p, n) if p.suffix == ".jsonl" else Corpus.from_pack(p, n)


def perm(item: dict) -> list[int]:
    """A fixed shuffle of the options per item: position carries no signal for the models."""
    k = len(item["choices"])
    r = random.Random(int(hashlib.sha256(item["q_id"].encode()).hexdigest()[:12], 16))
    order = list(range(k))
    r.shuffle(order)
    return order


# ---------------------------------------------------------------- deterministic gates
def deterministic(item: dict, corpus: Corpus, n) -> dict:
    out: dict = {"q_id": item["q_id"], "kind": item["kind"], "skill_id": item.get("skill_id"),
                 "topic_id": item.get("topic_id"), "difficulty": item.get("difficulty"),
                 "variant": bool(item.get("variant_of"))}
    cites = [n(s) for s in item.get("section_ids") or []]
    # A practice item (basis "practice", e.g. a load-chart reading) may cite no rule; a rule item must.
    out["cites_exist"] = (None if not cites and item.get("basis") == "practice"
                          else bool(cites) and all(c in corpus.text for c in cites))
    quotes = item.get("quotes") or []
    out["quotes_verbatim"] = all(corpus.quote_ok(n(q["section_id"]), q["quote"]) for q in quotes) if quotes else None
    if item["kind"] != "mc":
        return out
    ch, key = item["choices"], int(item["answer"])
    lens = [len(c) for c in ch]
    out["key_longest"] = lens[key] > max(l for i, l in enumerate(lens) if i != key)
    rule = " ".join([q["quote"] for q in quotes] + [item.get("fact") or ""])
    rt = toks(rule)
    ov = [len(toks(c) & rt) / (len(toks(c) | rt) or 1) for c in ch]
    out["key_most_like_rule"] = ov[key] > max(o for i, o in enumerate(ov) if i != key)
    rat = item.get("rationales") or []
    out["rationales"] = len(rat) == len(ch) and all(norm(r) for r in rat)
    out["answer_pos"] = key
    return out


# ---------------------------------------------------------------- model client
class Model:
    """An OpenAI-compatible endpoint (URL[#model]) or claude:<model> (headless Claude, no tools)."""

    def __init__(self, spec: str, timeout: int = 600):
        self.spec, self.timeout = spec, timeout
        if spec.startswith("claude:"):
            self.kind, self.model, self.url = "claude", spec.split(":", 1)[1], None
        else:
            url, _, model = spec.partition("#")
            if not model:
                # The model name is the cache identity; an unlabelled endpoint would share answers.
                raise SystemExit(f"{spec}: name the model as URL#model (it keys the answer cache)")
            self.kind, self.url, self.model = "openai", url.rstrip("/"), model
        # Cache identity: the model, not where it is served.
        self.ident = f"{self.kind}:{self.model}"
        self.cost = 0.0
        self.lock = threading.Lock()

    def ask(self, system: str, user: str, schema: dict, max_tokens: int = 1200) -> dict:
        if self.kind == "claude":
            cmd = ["claude", "-p", "--setting-sources", "", "--strict-mcp-config", "--disable-slash-commands",
                   "--tools", "", "--no-session-persistence", "--model", self.model, "--system-prompt", system,
                   "--json-schema", json.dumps(schema), "--output-format", "json"]
            os.makedirs("/tmp/harvest-empty", exist_ok=True)
            p = subprocess.run(cmd, input=user, capture_output=True, text=True, cwd="/tmp/harvest-empty",
                               timeout=self.timeout)
            res = json.loads(p.stdout)
            with self.lock:
                self.cost += res.get("total_cost_usd") or 0
            if not res.get("structured_output"):
                raise RuntimeError(f"no structured output: {p.stdout[-300:]}")
            return res["structured_output"]
        body = {"model": self.model, "temperature": 0, "max_tokens": max_tokens,
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                "response_format": {"type": "json_schema", "json_schema": {"name": "out", "schema": schema,
                                                                            "strict": True}},
                "chat_template_kwargs": {"reasoning_effort": "low"}}
        req = urllib.request.Request(f"{self.url}/chat/completions", data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=self.timeout) as r:
            out = json.loads(r.read())
        text = out["choices"][0]["message"].get("content") or ""
        if not text.strip():
            raise RuntimeError(f"empty answer (finish_reason={out['choices'][0].get('finish_reason')})")
        return json.loads(text[text.find("{"): text.rfind("}") + 1])


class Cache:
    def __init__(self, d: Path):
        self.d = d
        d.mkdir(parents=True, exist_ok=True)

    def key(self, *parts) -> Path:
        h = hashlib.sha256(json.dumps(parts, sort_keys=True).encode()).hexdigest()
        return self.d / f"{h[:2]}" / f"{h}.json"

    def get(self, *parts):
        p = self.key(*parts)
        return json.loads(p.read_text()) if p.exists() else None

    def put(self, value, *parts) -> None:
        p = self.key(*parts)
        p.parent.mkdir(exist_ok=True)
        tmp = p.with_suffix(f".{os.getpid()}.{threading.get_ident()}.tmp")
        tmp.write_text(json.dumps(value))
        os.replace(tmp, p)


# ---------------------------------------------------------------- prompts
def answer_schema(k: int) -> dict:
    return {"type": "object", "properties": {"answer": {"type": "string", "enum": list(LETTERS[:k])}},
            "required": ["answer"], "additionalProperties": False}


OPTIONS_ONLY_SYS = ("You see the answer options of a multiple-choice question from a crane operator certification "
                    "practice exam. The question itself is hidden. Pick the option most likely to be the correct "
                    "answer, using any clue in the options themselves. Reply with JSON only.")
NO_CONTEXT_SYS = ("Answer the multiple-choice question. Choose the single best option. Reply with JSON only.")
AWARE_SYS = ("You are an expert mobile crane operator and instructor for US OSHA crane rules (29 CFR 1926 "
             "Subpart CC and 29 CFR 1910.179, .180, .184). Use the rule text given and your expertise to answer "
             "the multiple-choice question. Choose the single best option. Reply with JSON only.")
REVIEW_SYS = """You review one multiple-choice item for a crane operator certification practice bank. You get the stem, the options with the intended key, and the text of the rule the item cites. Judge strictly, from the rule text.
- key_correct: is the keyed option correct (yes / no / unclear)?
- rule_supports_key: does the cited rule text state or directly imply the key (yes / no)?
- single_best: is the key the only defensible answer?
- For each other option: wrong (yes = clearly wrong per the rule, no = also defensible, unclear), and plausible: 0 = obviously wrong to anyone, 1 = plausible to a novice, 2 = plausible to a trained operator who half-remembers the rule.
- note: one short line on the main problem, or "" if none."""


def review_schema(k: int) -> dict:
    return {"type": "object", "additionalProperties": False,
            "required": ["key_correct", "rule_supports_key", "single_best", "distractors", "note"],
            "properties": {
                "key_correct": {"type": "string", "enum": ["yes", "no", "unclear"]},
                "rule_supports_key": {"type": "string", "enum": ["yes", "no"]},
                "single_best": {"type": "boolean"},
                "distractors": {"type": "array", "items": {"type": "object", "additionalProperties": False,
                                "required": ["option", "wrong", "plausible"],
                                "properties": {"option": {"type": "string", "enum": list(LETTERS[:k])},
                                               "wrong": {"type": "string", "enum": ["yes", "no", "unclear"]},
                                               "plausible": {"type": "integer", "enum": [0, 1, 2]}}}},
                "note": {"type": "string"}}}


def render_options(item: dict, order: list[int]) -> str:
    return "\n".join(f"{LETTERS[i]}. {item['choices'][j]}" for i, j in enumerate(order))


def rule_text(item: dict, corpus: Corpus, n, limit: int = 6000) -> str:
    parts = []
    for s in item.get("section_ids") or []:
        s = n(s)
        if s in corpus.text:
            parts.append(corpus.subtree(s, limit=limit))
    return "\n".join(parts)[: limit * 2] or "(cited section not found)"


# ---------------------------------------------------------------- passes
def run_pass(name: str, model: Model, items: list[dict], corpus: Corpus, n, cache: Cache, jobs: int,
             cache_only: bool = False) -> dict:
    out: dict[str, dict] = {}
    lock = threading.Lock()
    errors = []

    def one(item):
        order = perm(item)
        k = len(order)
        key_letter = LETTERS[order.index(int(item["answer"]))]
        if name == "options_only":
            system, user, schema = OPTIONS_ONLY_SYS, render_options(item, order), answer_schema(k)
        elif name == "no_context":
            system, user, schema = NO_CONTEXT_SYS, f"{item['stem']}\n\n{render_options(item, order)}", answer_schema(k)
        elif name == "crane_aware":
            system = AWARE_SYS
            user = f"RULE TEXT\n{rule_text(item, corpus, n)}\n\nQUESTION\n{item['stem']}\n\n{render_options(item, order)}"
            schema = answer_schema(k)
        else:  # review
            system = REVIEW_SYS
            user = (f"STEM\n{item['stem']}\n\nOPTIONS\n{render_options(item, order)}\n\nKEY: {key_letter}\n\n"
                    f"CITED RULE TEXT\n{rule_text(item, corpus, n)}")
            schema = review_schema(k)
        ck = (name, model.ident, system, user)
        res = cache.get(*ck)
        if res is None:
            # Answers cached before the key was the model's identity were keyed by its endpoint.
            res = cache.get(name, model.spec, system, user)
            if res is not None:
                cache.put(res, *ck)
        if res is None and cache_only:
            return
        if res is None:
            for attempt in range(3):
                try:
                    res = model.ask(system, user, schema)
                    cache.put(res, *ck)
                    break
                except (RuntimeError, ValueError, urllib.error.URLError, TimeoutError, OSError, KeyError,
                        IndexError, TypeError, json.JSONDecodeError, subprocess.TimeoutExpired) as e:
                    if attempt == 2:
                        with lock:
                            errors.append((item["q_id"], f"{type(e).__name__}: {e}"))
                        print(f"[{name}] {item['q_id']}: {type(e).__name__}: {e}", file=sys.stderr, flush=True)
                        return
                    time.sleep(2 * (attempt + 1))
        row = {"key": key_letter}
        if name == "review":
            row.update(res)
        else:
            row["answer"] = res.get("answer")
            row["correct"] = res.get("answer") == key_letter
        with lock:
            out[item["q_id"]] = row

    with ThreadPoolExecutor(max_workers=max(1, jobs)) as ex:
        list(ex.map(one, items))
    return {"rows": out, "errors": errors}


# ---------------------------------------------------------------- report
def rate(xs) -> float | None:
    xs = [x for x in xs if x is not None]
    return round(sum(1 for x in xs if x) / len(xs), 4) if xs else None


def summarize(items, det, passes, tiers) -> dict:
    mc = [it for it in items if it["kind"] == "mc"]
    by = {d["q_id"]: d for d in det}
    s: dict = {"items": len(items), "mc": len(mc), "free_text": len(items) - len(mc),
               "variants": sum(1 for it in items if it.get("variant_of")),
               "intended_difficulty": dict(sorted(Counter(it.get("difficulty") for it in items).items()))}
    s["deterministic"] = {
        "key_longest": rate(by[i["q_id"]]["key_longest"] for i in mc),
        "key_most_like_rule": rate(by[i["q_id"]]["key_most_like_rule"] for i in mc),
        "rationales_complete": rate(by[i["q_id"]]["rationales"] for i in mc),
        "cites_exist": rate(d["cites_exist"] for d in det),
        "quotes_verbatim": rate(d["quotes_verbatim"] for d in det),
        "answer_position": dict(sorted(Counter(by[i["q_id"]]["answer_pos"] for i in mc).items())),
        "chance": round(1 / 4, 4)}
    s["passes"] = {}
    for name, p in passes.items():
        rows = p["rows"]
        if name.startswith("review"):
            rv = list(rows.values())
            dis = [d for r in rv for d in r.get("distractors", [])]
            s["passes"][name] = {
                "n": len(rv), "errors": len(p["errors"]),
                "key_correct": rate(r["key_correct"] == "yes" for r in rv),
                "key_wrong": rate(r["key_correct"] == "no" for r in rv),
                "rule_supports_key": rate(r["rule_supports_key"] == "yes" for r in rv),
                "single_best": rate(r["single_best"] for r in rv),
                "distractors_wrong": rate(d["wrong"] == "yes" for d in dis),
                "distractor_plausibility_mean": round(statistics.mean(d["plausible"] for d in dis), 3) if dis else None,
                "distractor_plausibility": dict(sorted(Counter(d["plausible"] for d in dis).items())),
                "items_with_an_obvious_distractor": rate(any(d["plausible"] == 0 for d in r.get("distractors", []))
                                                          for r in rv)}
        else:
            rv = list(rows.values())
            s["passes"][name] = {"n": len(rv), "errors": len(p["errors"]), "correct": rate(r["correct"] for r in rv)}
    # Calibration by intended tier.
    cal = {}
    for t in tiers:
        tier_items = [i for i in mc if i.get("difficulty") == t]
        answered = [i for i in tier_items if any(i["q_id"] in p["rows"] for n_, p in passes.items()
                                                  if not n_.startswith("review"))]
        cal[str(t)] = {"n": len(answered), "n_bank": len(tier_items)}
        for name, p in passes.items():
            if name.startswith("review"):
                continue
            cal[str(t)][name] = rate(p["rows"][i["q_id"]]["correct"] for i in tier_items if i["q_id"] in p["rows"])
            cal[str(t)][f"{name}.n"] = sum(1 for i in tier_items if i["q_id"] in p["rows"])
    s["calibration_by_tier"] = cal
    ans = [n for n in passes if not n.startswith("review")]
    answered_all = [i for i in mc if ans and all(i["q_id"] in passes[n]["rows"] for n in ans)]
    everyone = [i["q_id"] for i in answered_all if all(passes[n]["rows"][i["q_id"]]["correct"] for n in ans)]
    s["everyone_correct"] = {"n": len(everyone), "of": len(answered_all),
                             "rate": round(len(everyone) / len(answered_all), 4) if answered_all else None,
                             "passes": ans}
    # How much of options-only success the rule-wording tell explains.
    if "options_only" in passes:
        oo = passes["options_only"]["rows"]
        split = {}
        for flag in (True, False):
            sub = [i for i in mc if i["q_id"] in oo and by[i["q_id"]]["key_most_like_rule"] is flag]
            split["key_most_like_rule" if flag else "other"] = {
                "n": len(sub), "options_only_correct": rate(oo[i["q_id"]]["correct"] for i in sub)}
        s["options_only_by_rule_wording"] = split
    by_topic = defaultdict(list)
    for i in mc:
        by_topic[i.get("topic_id")].append(i)
    s["by_topic"] = {}
    for tpc, its in sorted(by_topic.items()):
        row = {"n_bank": len(its), "key_longest": rate(by[i["q_id"]]["key_longest"] for i in its),
               "key_most_like_rule": rate(by[i["q_id"]]["key_most_like_rule"] for i in its),
               "n": sum(1 for i in its if any(i["q_id"] in p["rows"] for n_, p in passes.items()
                                             if not n_.startswith("review")))}
        for name in ans:
            row[name] = rate(passes[name]["rows"][i["q_id"]]["correct"] for i in its if i["q_id"] in passes[name]["rows"])
        s["by_topic"][tpc] = row
    return s, everyone


def write_outputs(out: Path, items, det, passes, summary, everyone) -> None:
    out.mkdir(parents=True, exist_ok=True)
    (out / "summary.json").write_text(json.dumps(summary, indent=1))
    by = {d["q_id"]: d for d in det}
    names = list(passes)
    cols = ["q_id", "kind", "topic_id", "skill_id", "difficulty", "variant", "key_longest", "key_most_like_rule",
            "rationales", "cites_exist", "quotes_verbatim", "answer_pos"]
    for nme in names:
        cols += [f"{nme}.correct"] if not nme.startswith("review") else [
            f"{nme}.key_correct", f"{nme}.rule_supports_key", f"{nme}.single_best", f"{nme}.min_plausible",
            f"{nme}.note"]
    cols.append("everyone_correct")
    ev = set(everyone)
    with (out / "items.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for it in items:
            row = dict(by[it["q_id"]])
            for nme in names:
                r = passes[nme]["rows"].get(it["q_id"])
                if not r:
                    continue
                if nme.startswith("review"):
                    row.update({f"{nme}.key_correct": r["key_correct"], f"{nme}.rule_supports_key": r["rule_supports_key"],
                                f"{nme}.single_best": r["single_best"],
                                f"{nme}.min_plausible": min((d["plausible"] for d in r["distractors"]), default=None),
                                f"{nme}.note": r.get("note", "")})
                else:
                    row[f"{nme}.correct"] = r["correct"]
            row["everyone_correct"] = it["q_id"] in ev
            w.writerow(row)
    d = summary["deterministic"]
    lines = ["# Item quality and difficulty", "",
             f"{summary['items']} items ({summary['mc']} multiple choice, {summary['free_text']} free text, "
             f"{summary['variants']} variants). Intended difficulty: {summary['intended_difficulty']}.", "",
             "## Deterministic gates", "", "| Gate | Rate | Expected for a good bank |", "|---|---|---|",
             f"| Key is the longest option | {d['key_longest']} | about 0.25 (4 options) |",
             f"| Key shares the most words with the rule quote and fact | {d['key_most_like_rule']} | a signal, not a target (a correct key agrees with the rule) |",
             f"| Every option has a rationale | {d['rationales_complete']} | 1.0 |",
             f"| Every cited section exists | {d['cites_exist']} | 1.0 |",
             f"| Every quote verbatim | {d['quotes_verbatim']} | 1.0 |",
             f"| Key position (0-based) | {d['answer_position']} | even |", "", "## Model passes", "",
             "| Pass | n | Result |", "|---|---|---|"]
    for nme, p in summary["passes"].items():
        if nme.startswith("review"):
            lines.append(f"| {nme} | {p['n']} | key correct {p['key_correct']}, key wrong {p['key_wrong']}, rule supports "
                         f"key {p['rule_supports_key']}, single best {p['single_best']}, distractors wrong "
                         f"{p['distractors_wrong']}, plausibility mean {p['distractor_plausibility_mean']} "
                         f"{p['distractor_plausibility']}, items with an obvious distractor "
                         f"{p['items_with_an_obvious_distractor']} |")
        else:
            lines.append(f"| {nme} | {p['n']} | correct {p['correct']} (errors {p['errors']}) |")
    lines += ["", "## Calibration by intended difficulty", "",
              "| Intended | items in bank | " + " | ".join(f"{n} (n)" for n in summary["passes"]
                                                   if not n.startswith("review")) + " |",
              "|---|---|" + "---|" * len([n for n in summary["passes"] if not n.startswith("review")])]
    for t, c in summary["calibration_by_tier"].items():
        lines.append(f"| {t} | {c['n_bank']} | " + " | ".join(f"{c.get(n)} ({c.get(n + '.n')})" for n in summary["passes"]
                                                             if not n.startswith("review")) + " |")
    e = summary["everyone_correct"]
    lines += ["", f"Items every answering pass gets right ({', '.join(e['passes'])}): {e['n']} of the {e['of']} "
              f"every pass answered ({e['rate']}).", ""]
    if summary.get("options_only_by_rule_wording"):
        sp = summary["options_only_by_rule_wording"]
        lines += [f"Options-only success when the key is the option most like the rule: "
                  f"{sp['key_most_like_rule']['options_only_correct']} (n={sp['key_most_like_rule']['n']}); "
                  f"otherwise {sp['other']['options_only_correct']} (n={sp['other']['n']}).", ""]
    lines += ["",
              "## By topic", "", "| Topic | items in bank | key longest | key most like the rule | items asked | "
              + " | ".join(e["passes"]) + " |", "|---|---|---|---|---|" + "---|" * len(e["passes"])]
    for t, r in summary["by_topic"].items():
        lines.append(f"| {t} | {r['n_bank']} | {r['key_longest']} | {r['key_most_like_rule']} | {r['n']} | "
                     + " | ".join(str(r.get(n)) for n in e["passes"]) + " |")
    (out / "report.md").write_text("\n".join(lines) + "\n")


def items_cmd(a) -> int:
    aliases = [tuple(x.split("=", 1)) for x in a.alias or []]
    n = Normalizer(aliases)
    corpus = load_corpus(a.sections, aliases)
    items = load_bank(a.bank)
    if a.limit:
        items = items[: a.limit]
    mc_all = [i for i in items if i["kind"] == "mc"]
    model_ids = {i["q_id"] for i in mc_all}
    if a.ids:
        model_ids &= {l.strip() for l in Path(a.ids).read_text().split() if l.strip()}
    if a.per_tier:
        # Stratified by intended difficulty, every skill first: up to per_tier items per tier.
        r = random.Random(a.seed)
        by_tier = defaultdict(list)
        for i in mc_all:
            if i["q_id"] in model_ids:
                by_tier[i.get("difficulty")].append(i)
        keep = set()
        for t, its in by_tier.items():
            r.shuffle(its)
            seen, first, rest = set(), [], []
            for i in its:
                (first if i["skill_id"] not in seen else rest).append(i)
                seen.add(i["skill_id"])
            keep |= {i["q_id"] for i in (first + rest)[: a.per_tier]}
        model_ids = keep
    review_ids = set(sorted(model_ids, key=lambda q: hashlib.sha256(f"{a.seed}{q}".encode()).hexdigest())
                     [: a.review_sample]) if a.review_sample else model_ids
    det = [deterministic(it, corpus, n) for it in items]
    mc = [it for it in items if it["kind"] == "mc"]
    out = Path(a.out)
    cache = Cache(Path(a.cache) if a.cache else out / "cache")
    passes = {}
    models = {"strong": a.strong, "weak": a.weak, "judge": a.judge or a.strong}
    if models["weak"] and models["strong"] and Model(models["weak"]).ident == Model(models["strong"]).ident:
        raise SystemExit("--weak and --strong name the same model; their no_context answers would share the cache")
    for p in a.passes:
        if p == "deterministic":
            continue
        targets = [i for i in mc if i["q_id"] in (review_ids if p == "review" else model_ids)]
        if p == "no_context":
            for which in ("weak", "strong"):
                if models[which]:
                    m = Model(models[which])
                    passes[f"no_context.{which}"] = run_pass("no_context", m, targets, corpus, n, cache, a.jobs,
                                                             a.cache_only)
                    print(f"[no_context.{which}] {len(passes[f'no_context.{which}']['rows'])} done", file=sys.stderr)
            continue
        spec = models["judge"] if p == "review" else models["strong"]
        if not spec:
            raise SystemExit(f"pass {p} needs --strong (or --judge for review)")
        m = Model(spec)
        passes[p] = run_pass(p, m, targets, corpus, n, cache, a.jobs, a.cache_only)
        print(f"[{p}] {len(passes[p]['rows'])} done, cost ${m.cost:.2f}", file=sys.stderr)
    tiers = sorted({it.get("difficulty") for it in mc if it.get("difficulty") is not None})
    summary, everyone = summarize(items, det, passes, tiers)
    ran = [p for p in a.passes if p != "deterministic"]
    used = {"strong": any(p in ("options_only", "crane_aware") for p in ran) or "no_context" in ran,
            "weak": "no_context" in ran, "judge": "review" in ran}
    summary["models"] = {k: v for k, v in models.items() if v and used[k]}
    summary["per_tier"] = a.per_tier
    summary["cache_only"] = a.cache_only
    summary["targets"] = {"model_passes": len(model_ids) if ran else 0,
                          "review": len(review_ids) if "review" in ran else 0}
    summary["passes_run"] = ran
    write_outputs(out, items, det, passes, summary, everyone)
    print((out / "report.md").read_text())
    return 0
