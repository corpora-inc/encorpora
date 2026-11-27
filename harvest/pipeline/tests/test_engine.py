import json
import re
import sqlite3

import pytest

from harvest_pipeline.backends.deterministic import ScriptedBackend
from harvest_pipeline.corpus import load_corpus
from harvest_pipeline.enrich import Engine
from harvest_pipeline.fetch import fetch
from harvest_pipeline.pipeline import build, build_stage, enrich, work_dir
from harvest_pipeline.cache import ResponseCache


def author_reply(req):
    p = req.prompt
    if req.name == "terms":
        if "[99cfr1999.11]" in p:
            return {"items": [
                {"term": "Gadget crane", "definition": "A machine that lifts and swings a hanging load.",
                 "quote": "Gadget crane means a machine that lifts and swings a suspended load.",
                 "section_id": "99cfr1999.11"},
                {"term": "Qualified rigger", "definition": "A trained rigger.",
                 "quote": "Qualified rigger means any rigger with a card.",          # not verbatim -> fail
                 "section_id": "99cfr1999.11"},
            ]}
        return {"items": []}
    if req.name == "facts":
        if "[99cfr1999.12(a)(1)]" in p:
            return {"items": [
                {"kind": "clearance", "statement": "Keep the boom at least 20 feet from lines up to 50 kV.",
                 "quote": "at least 20 feet from an energized line rated up to 50 kV",
                 "value": "20", "unit": "feet", "section_id": "99cfr1999.12(a)(1)"},
                {"kind": "clearance", "statement": "Keep the boom 25 feet away.",           # number not in quote
                 "quote": "at least 20 feet from an energized line", "value": "25", "unit": "feet",
                 "section_id": "99cfr1999.12(a)(1)"},
                {"kind": "interval", "statement": "Riggers train every 12 months.",
                 "quote": "must complete training every 12 months", "value": "12", "unit": "months",
                 "section_id": "99cfr1999.12(b)(1)(i)"},
            ]}
        return {"items": []}
    raise AssertionError(req.name)


def judge_reply(req):
    idx = [int(i) for i in re.findall(r"^\[(\d+)\]", req.prompt, re.M)]
    # fail anything mentioning "train", pass the rest
    out = []
    for i in idx:
        line = re.search(rf"^\[{i}\] (.*)$", req.prompt, re.M).group(1)
        out.append({"index": i, "verdict": "fail" if "train" in line else "pass", "reason": "test"})
    return {"verdicts": out}


@pytest.fixture
def corpus(corpus_dir):
    c = load_corpus(corpus_dir / "corpus.yaml")
    fetch(c)
    return c


def run(corpus, offline=False):
    p = corpus.profile()
    stage, _ = build_stage(corpus, work_dir(corpus, p) / "stage.sqlite", log=None)
    a = ScriptedBackend("author", responses=author_reply, model_id="author-model-1")
    j = ScriptedBackend("judge", responses=judge_reply, model_id="judge-model-1")
    reps = enrich(corpus, p, stage, offline=offline, author=None if offline else a,
                  judge=None if offline else j, log=None)
    return stage, {r.task: r for r in reps}, a, j


def test_verdicts_and_provenance(corpus):
    stage, reps, a, j = run(corpus)
    t, f = reps["terms"], reps["facts"]
    assert t.verdicts == {"pass": 1, "fail": 1, "needs_review": 0}
    assert f.verdicts == {"pass": 1, "fail": 2, "needs_review": 0}
    fails = [json.loads(r[0])["notes"] for r in stage.conn.execute(
        "SELECT notes FROM provenance WHERE verdict='fail'")]
    assert any("not verbatim" in n for n in fails)
    assert any("value number(s) 25 not in quote" in n for n in fails)
    assert "test" in fails                                         # judge reason
    prov = stage.conn.execute("SELECT * FROM provenance WHERE verdict='pass' AND prompt_id='harvest.facts'").fetchone()
    assert prov["model"] == "author-model-1" and prov["backend"] == "scripted"
    assert prov["verifier"] == "deterministic:v1+judge:scripted:judge"
    # only deterministic passes go to the judge
    assert all("25 feet" not in r.prompt for r in j.calls)


def test_cache_reused_and_offline_build_is_deterministic(corpus):
    run(corpus)
    stage2, reps2, a2, j2 = run(corpus)          # second online run: all cache hits
    assert a2.calls == [] and j2.calls == []
    assert reps2["facts"].author_cached > 0
    p = corpus.profile()
    r1 = build(corpus, p, log=None)
    sha1 = json.load(open(r1["manifest"]))["files"][0]["sha256"]
    r2 = build(corpus, p, log=None)
    sha2 = json.load(open(r2["manifest"]))["files"][0]["sha256"]
    assert sha1 == sha2
    conn = sqlite3.connect(r1["path"])
    assert conn.execute("SELECT COUNT(*) FROM fact").fetchone()[0] == 1           # release keeps pass only
    assert conn.execute("SELECT COUNT(*) FROM term").fetchone()[0] == 1
    n_prov = conn.execute("SELECT COUNT(*) FROM provenance").fetchone()[0]
    assert n_prov == 2 and conn.execute("SELECT COUNT(*) FROM provenance WHERE verdict!='pass'").fetchone()[0] == 0
    hits = conn.execute("SELECT c.chunk_id FROM chunk_fts f JOIN chunk c ON c.rowid=f.rowid "
                        "WHERE chunk_fts MATCH 'energized'").fetchall()
    assert ("s:99cfr1999.12(a)(1)",) in hits
    meta = dict(conn.execute("SELECT key, value FROM pack_meta"))
    assert meta["embedder_id"] == "hash-v1-64" and meta["embed_dim"] == "64"
    assert conn.execute("SELECT COUNT(*) FROM chunk_vec").fetchone()[0] == conn.execute(
        "SELECT COUNT(*) FROM chunk").fetchone()[0]


def test_cache_file_is_sorted_jsonl(corpus):
    run(corpus)
    lines = (corpus.profile().cache_dir / "facts.jsonl").read_text().splitlines()
    keys = [json.loads(x)["key"] for x in lines]
    assert keys == sorted(keys)
    assert all(json.loads(x)["model"] == "scripted:author" for x in lines)


def test_offline_misses_are_reported_not_called(corpus):
    stage, reps, _, _ = run(corpus, offline=True)
    assert reps["facts"].author_missing == reps["facts"].inputs > 0
    assert stage.conn.execute("SELECT COUNT(*) FROM fact").fetchone()[0] == 0


def test_judge_must_differ_from_author(corpus):
    stage, _ = build_stage(corpus, log=None)
    with pytest.raises(SystemExit):
        Engine(stage, ResponseCache(corpus.dir / "c"), {"backend": "claude-cli", "model": "sonnet"},
               {"backend": "claude-cli", "model": "sonnet"}, offline=True)


def test_limit_and_keys(corpus):
    p = corpus.profile()
    stage, _ = build_stage(corpus, log=None)
    a = ScriptedBackend("author", responses=author_reply)
    reps = enrich(corpus, p, stage, offline=False, task_names=["facts"], keys={"99cfr1999.12"},
                  author=a, judge=ScriptedBackend("judge", responses=judge_reply), log=None)
    assert reps[0].inputs == 1 and len(a.calls) == 1


def test_compare_two_profiles(corpus, tmp_path):
    from harvest_pipeline.compare import compare
    from harvest_pipeline.corpus import load_corpus
    run(corpus)                                   # profile "test"
    y = corpus.path
    y.write_text(y.read_text().replace("default_profile: test", "  alt:\n    author: {backend: scripted, model: alt}\n"
                                       "    judge: {backend: scripted, model: judge}\n    cache_dir: cache/alt\n"
                                       "default_profile: test"))
    c = load_corpus(y)
    p = c.profile("alt")
    stage, _ = build_stage(c, log=None)

    def alt_author(req):
        out = author_reply(req)
        for it in out["items"]:
            if it.get("term") == "Qualified rigger":
                it["quote"] = "Qualified rigger means a rigger who meets the criteria in § 1999.12(b)."
                it["definition"] = "A rigger who meets the listed criteria."
        return out

    enrich(c, p, stage, offline=False, author=ScriptedBackend("alt", responses=alt_author),
           judge=ScriptedBackend("judge", responses=judge_reply), log=None)
    s = compare(c, "test", "alt", tmp_path / "cmp.jsonl")
    t = s["tasks"]["harvest.terms"]
    assert t["test"]["pass"] == 1 and t["alt"]["pass"] == 2 and t["matched"] == 2
    assert t["test"]["quote_ok"] == 1 and t["alt"]["quote_ok"] == 2
    rows = [json.loads(x) for x in (tmp_path / "cmp.jsonl").read_text().splitlines()]
    rig = next(r for r in rows if r["task"] == "terms" and r["test"]["row"]["term"] == "Qualified rigger")
    assert rig["verdict_agree"] is False and rig["alt"]["judge"]["verdict"] == "pass"
    assert rig["test"]["deterministic_ok"] is False and rig["test"]["judge"] is None
    f = s["tasks"]["harvest.facts"]
    assert f["matched"] == 3 and f["matched_verdict_agree"] == 3
