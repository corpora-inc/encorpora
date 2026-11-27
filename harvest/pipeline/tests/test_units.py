import base64
import json
import sqlite3

import numpy as np
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from harvest_pipeline.cache import ResponseCache
from harvest_pipeline.corpus import load_corpus
from harvest_pipeline.diff import diff_packs
from harvest_pipeline.embed import HashEmbedder, dequantize, quantize
from harvest_pipeline.fetch import fetch, read_raw
from harvest_pipeline.pipeline import build_stage
from harvest_pipeline.sign import sign_manifest, verify_manifest, verify_pack_dir
from harvest_pipeline.tasks.units import own_lines, section_units
from harvest_pipeline.textutil import locate, numbers_in
from harvest_pipeline.verify import check_inline_quotes, check_new_numbers, check_no_outside_standard, check_unit


def test_locate_is_strict_but_folds_quote_glyphs():
    src = "The operator’s  manual “must” be  kept—always."
    assert locate("operator's manual", src) == "operator’s manual"     # returns the source's glyphs
    assert locate('"must" be kept-always', src) == "“must” be kept—always"
    assert locate("operators manual", src) is None
    assert locate("", src) is None


def test_numbers_and_units():
    assert numbers_in("1,000 pounds at 0.75 kV and 1/2 inch") == ["1000", "0.75", "1/2"]
    assert check_unit("ft", "within 20 feet") == []
    assert check_unit("kV", "350 kV") == []
    assert check_unit("mph", "20 feet") != []
    assert check_new_numbers("twenty feet or 20 ft", "keep 20 feet") == []
    assert check_new_numbers("keep 25 feet", "keep 20 feet") != []


def test_standard_guard_and_inline_quotes():
    assert check_no_outside_standard(["See ASME B30.5 for details"], "complies with ASME B30.5-2004") == []
    assert check_no_outside_standard(["ASME B30.9 says slings ..."], "no standard here") != []
    assert check_inline_quotes('It says "keep the boom at least 20 feet away".', "keep the boom at least 20 feet away") == []
    assert check_inline_quotes('It says "the boom must be lowered every single night".', "other text") != []


def test_fetch_lock_statuses(corpus_dir):
    c = load_corpus(corpus_dir / "corpus.yaml")
    assert [f.status for f in fetch(c)] == ["new"]
    assert [f.status for f in fetch(c)] == ["unchanged"]
    lock = json.loads(c.lock_path.read_text())["sources"]["ecfr-99-1999-zz"]
    assert lock["edition"] == "test-1" and len(lock["sha256"]) == 64
    (corpus_dir / "raw" / "zz.xml").write_bytes((corpus_dir / "raw" / "zz.xml").read_bytes().replace(b"20 feet", b"25 feet"))
    res = fetch(c)
    assert res[0].status == "changed" and res[0].previous["sha256"] != res[0].record["sha256"]
    rec, data = read_raw(c, "ecfr-99-1999-zz")
    assert b"25 feet" in data


def test_cache_roundtrip_sort_and_prune(tmp_path):
    c = ResponseCache(tmp_path)
    for k in ("b", "a"):
        c.put({"task": "t", "prompt_version": "1", "input_sha256": k * 64, "model": "m", "key": k, "output": {}})
    c.close()
    lines = (tmp_path / "t.jsonl").read_text().splitlines()
    assert [json.loads(x)["key"] for x in lines] == ["a", "b"]
    c2 = ResponseCache(tmp_path)
    assert c2.get("t", "1", "a" * 64, "m")["key"] == "a"
    assert c2.get("t", "2", "a" * 64, "m") is None       # prompt version is part of the key
    c2.close(prune=True)
    assert len((tmp_path / "t.jsonl").read_text().splitlines()) == 1


def test_units_split_long_sections(corpus_dir):
    c = load_corpus(corpus_dir / "corpus.yaml")
    fetch(c)
    stage, _ = build_stage(c, log=None)
    assert own_lines(stage, "99cfr1999.10(b)") == ["(b) Exclusions. This subpart does not cover:"]
    whole = {u.key: u for u in section_units(stage)}
    assert "99cfr1999.12" in whole and "[99cfr1999.12(k)(ii)(a)] (a) Italic level." in whole["99cfr1999.12"].material()
    parts = [u for u in section_units(stage, max_chars=300) if u.root_id == "99cfr1999.12"]
    assert len(parts) > 1 and parts[0].key == "99cfr1999.12#1"
    # every line appears exactly once across the parts
    all_lines = [ln for u in parts for ln in u.lines]
    assert len(all_lines) == len(set(all_lines)) == len(whole["99cfr1999.12"].lines)


def test_int8_quantization_roundtrip():
    v = HashEmbedder(64).embed(["crane boom clearance", "rigging sling angle"])
    for row in v:
        blob, scale = quantize(row)
        back = dequantize(blob, scale)
        assert len(blob) == 64 and np.max(np.abs(back - row)) <= scale / 2 + 1e-6
    assert float(v[0] @ v[0]) == pytest.approx(1.0, abs=1e-5)


def test_sign_and_verify(tmp_path, monkeypatch):
    key = Ed25519PrivateKey.generate()
    m = {"pack_id": "p", "version": "1", "schema_version": 1, "files": []}
    s = sign_manifest(m, key)
    assert verify_manifest(s, key.public_key())
    assert not verify_manifest({**s, "version": "2"}, key.public_key())
    assert not verify_manifest(s, Ed25519PrivateKey.generate().public_key())
    # pack dir: file hash tamper is caught
    (tmp_path / "f.sqlite").write_bytes(b"abc")
    from harvest_pipeline.textutil import sha256_bytes
    m = sign_manifest({**m, "files": [{"path": "f.sqlite", "sha256": sha256_bytes(b"abc"), "bytes": 3}]}, key)
    (tmp_path / "manifest.json").write_text(json.dumps(m))
    assert verify_pack_dir(tmp_path, key.public_key()) == []
    (tmp_path / "f.sqlite").write_bytes(b"abd")
    assert verify_pack_dir(tmp_path, key.public_key()) == ["hash mismatch f.sqlite"]


def test_build_signs_with_env_key(corpus_dir, monkeypatch):
    from harvest_pipeline.pipeline import build
    key = Ed25519PrivateKey.generate()
    from cryptography.hazmat.primitives import serialization
    seed = key.private_bytes(serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption())
    monkeypatch.setenv("HARVEST_SIGNING_KEY", base64.b64encode(seed).decode())
    c = load_corpus(corpus_dir / "corpus.yaml")
    fetch(c)
    res = build(c, c.profile(), log=None)
    assert res["signed"]
    from pathlib import Path
    assert verify_pack_dir(Path(res["manifest"]).parent, key.public_key()) == []


def test_diff(tmp_path, corpus_dir):
    from harvest_pipeline.pipeline import build
    c = load_corpus(corpus_dir / "corpus.yaml")
    fetch(c)
    old = build(c, c.profile(), out_dir=tmp_path / "old", log=None)["path"]
    raw = corpus_dir / "raw" / "zz.xml"
    raw.write_bytes(raw.read_bytes().replace(b"at least 20 feet", b"at least 25 feet")
                    .replace(b"<P>(2) Conveyors.</P>\n", b""))
    fetch(c)
    new = build(c, c.profile(), out_dir=tmp_path / "new", log=None)["path"]
    d = diff_packs(old, new)
    assert [r["section_id"] for r in d["removed"]] == ["99cfr1999.10(b)(2)"]
    changed = {r["section_id"] for r in d["changed"]}
    assert "99cfr1999.12(a)(1)" in changed and "99cfr1999.10(b)" in changed
    assert d["added"] == []
    assert sqlite3.connect(new).execute("SELECT COUNT(*) FROM section").fetchone()[0] > 10
