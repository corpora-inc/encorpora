import json
import shutil
import sqlite3
from pathlib import Path

from harvest_pipeline.cli import main

FIXTURES = Path(__file__).parent / "fixtures"


def deterministic_corpus(corpus_dir: Path) -> Path:
    shutil.copy(FIXTURES / "regex_terms.py", corpus_dir / "regex_terms.py")
    y = (corpus_dir / "corpus.yaml").read_text()
    y = y.replace("tasks: [terms, facts]", "task_modules: [regex_terms.py]\ntasks: [regex_terms]")
    y = y.replace("default_profile: test", "  rules:\n    author: {backend: deterministic, model: rules}\n"
                  "    cache_dir: cache/rules\ndefault_profile: rules")
    (corpus_dir / "corpus.yaml").write_text(y)
    return corpus_dir / "corpus.yaml"


def test_all_stats_review_verify_diff(corpus_dir, capsys, tmp_path):
    y = deterministic_corpus(corpus_dir)
    assert main(["all", str(y)]) == 0
    out = capsys.readouterr().out
    pack = json.loads(out[out.index("{\n"):])
    conn = sqlite3.connect(pack["path"])
    terms = conn.execute("SELECT term, section_id FROM term ORDER BY term").fetchall()
    assert terms == [("Gadget crane", "99cfr1999.11"), ("Qualified rigger", "99cfr1999.11")]
    prov = conn.execute("SELECT backend, verdict, verifier FROM provenance").fetchall()
    assert set(prov) == {("deterministic", "pass", "deterministic:v1")}

    assert main(["stats", str(y)]) == 0
    stats = json.loads(capsys.readouterr().out)
    assert stats["verdicts"]["harvest.regex_terms"]["pass"] == 2
    assert stats["pack"]["counts"]["term"] == 2

    assert main(["review", str(y), "--task", "regex_terms", "--n", "1"]) == 0
    assert "pass" in capsys.readouterr().out

    assert main(["verify", str(Path(pack["path"]).parent)]) == 0
    assert main(["diff", pack["path"], pack["path"]]) == 0
    assert capsys.readouterr().out.startswith("ok\nadded 0, removed 0, changed 0")


def test_parse_and_tasks(corpus_dir, capsys):
    y = deterministic_corpus(corpus_dir)
    main(["fetch", str(y)])
    capsys.readouterr()
    assert main(["parse", str(y)]) == 0
    info = json.loads(capsys.readouterr().out)
    assert info["sections"]["section"] == 3 and info["xrefs"]["standard"] == 1
    assert main(["tasks", str(y)]) == 0
    names = capsys.readouterr().out.split()
    assert {"terms", "facts", "explanations", "applicability", "regex_terms"} <= set(names)


def test_keygen(tmp_path, capsys):
    k = tmp_path / "k.pem"
    assert main(["keygen", str(k)]) == 0
    assert k.exists() and (tmp_path / "k.pub").exists()
    assert oct(k.stat().st_mode)[-3:] == "600"
