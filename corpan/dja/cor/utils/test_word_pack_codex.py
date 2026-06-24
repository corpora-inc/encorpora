# tests/test_word_pack_codex.py
#
# Tests for the CODEX backend of the word-explanation generator
# (dja/word_pack/generate_word_explanations.py). They run under plain pytest
# with only stdlib + pydantic -- the exact deps the CI `dja` gate installs.
#
# The real `codex exec` subprocess is NEVER called here: every test stubs
# `cor.utils.codex.run_json` (the single seam the driver uses) with an
# in-process fake. We cover the four behaviors the production run depends on:
#
#   1. compose_codex_prompt folds system+user into one JSON-only prompt.
#   2. run_codex_batch validates against the pydantic schema, retries on
#      parse/validation failure, and returns None (skip-and-log) when every
#      attempt fails -- so one bad batch can never wedge the whole run.
#   3. run_codex_stage applies results and checkpoints under a lock, with no
#      two workers writing the seed concurrently.
#   4. The seed selectors give resumable work-sets (a kill mid-run re-runs
#      only the unfinished words/langs).

import sys
import threading
from pathlib import Path

import pytest
from pydantic import BaseModel

# dja/word_pack lives two levels up from cor/utils/.
WORD_PACK = Path(__file__).resolve().parents[2] / "word_pack"
if str(WORD_PACK) not in sys.path:
    sys.path.insert(0, str(WORD_PACK))

import generate_word_explanations as gen  # noqa: E402


# ---------------------------------------------------------------------------
# Prompt composition: system + user folded into one JSON-only codex prompt.
# ---------------------------------------------------------------------------
def test_compose_codex_prompt_includes_system_user_and_json_demand():
    prompt = gen.compose_codex_prompt("SYS-RULES", "egg\nbank")
    assert "SYS-RULES" in prompt
    assert "egg\nbank" in prompt
    # Must demand JSON-only output (no prose / no fences).
    low = prompt.lower()
    assert "json" in low
    assert "only" in low


def test_english_system_has_surprising_origin_rule():
    # The origin-clarity instruction (operator guidance) must be present.
    sysmsg = gen.ENGLISH_SYSTEM.lower()
    assert "banca" in sysmsg or "bank" in sysmsg
    assert "surprising" in sysmsg or "counterintuitive" in sysmsg


# ---------------------------------------------------------------------------
# A fake codex module: stub `run_json` so no subprocess ever runs.
# ---------------------------------------------------------------------------
class _FakeCodexError(RuntimeError):
    pass


class FakeCodex:
    """Stand-in for `cor.utils.codex` injected into sys.modules."""

    CodexError = _FakeCodexError

    def __init__(self, responses):
        # responses: list of either a dict (returned as JSON obj) or an
        # Exception instance (raised). Consumed one per run_json() call.
        self._responses = list(responses)
        self.calls = []
        self._lock = threading.Lock()

    def run_json(self, prompt, **kwargs):
        with self._lock:
            self.calls.append((prompt, kwargs))
            resp = self._responses.pop(0)
        if isinstance(resp, Exception):
            raise resp
        return resp


@pytest.fixture
def install_fake_codex(monkeypatch):
    """Install a FakeCodex as the `cor.utils.codex` module the driver imports."""

    def _install(responses):
        fake = FakeCodex(responses)
        # The driver does `from cor.utils import codex`; intercept that import.
        monkeypatch.setitem(sys.modules, "cor.utils.codex", fake)
        return fake

    return _install


# ---------------------------------------------------------------------------
# run_codex_batch: validation, retry, skip-and-log.
# ---------------------------------------------------------------------------
def _english_obj(words):
    return {"items": [{"word": w, "explanation": f"about {w}"} for w in words]}


def test_run_codex_batch_validates_and_returns_model(install_fake_codex):
    install_fake_codex([_english_obj(["egg", "bank"])])
    res = gen.run_codex_batch(
        "SYS",
        "egg\nbank",
        gen.ExplanationBatch,
        reasoning="low",
        model=None,
        timeout=10.0,
        max_retries=2,
        label="english batch 1",
    )
    assert isinstance(res, gen.ExplanationBatch)
    assert {i.word for i in res.items} == {"egg", "bank"}


def test_run_codex_batch_retries_then_succeeds(install_fake_codex):
    # First call returns schema-invalid JSON, second is good -> 2 calls total.
    fake = install_fake_codex(
        [
            {"wrong": "shape"},  # ValidationError
            _english_obj(["egg"]),  # good
        ]
    )
    res = gen.run_codex_batch(
        "SYS", "egg", gen.ExplanationBatch,
        reasoning="low", model=None, timeout=10.0, max_retries=2,
        label="english batch 1",
    )
    assert res is not None and res.items[0].word == "egg"
    assert len(fake.calls) == 2


def test_run_codex_batch_skips_after_exhausting_retries(install_fake_codex):
    # 1 try + 2 retries = 3 bad responses -> returns None (skip-and-log).
    fake = install_fake_codex([ValueError("no json")] * 3)
    res = gen.run_codex_batch(
        "SYS", "egg", gen.ExplanationBatch,
        reasoning="low", model=None, timeout=10.0, max_retries=2,
        label="english batch 1",
    )
    assert res is None
    assert len(fake.calls) == 3


def test_run_codex_batch_handles_codex_error(install_fake_codex):
    fake = install_fake_codex([_FakeCodexError("codex exited 1")] * 3)
    res = gen.run_codex_batch(
        "SYS", "egg", gen.ExplanationBatch,
        reasoning="low", model=None, timeout=10.0, max_retries=2,
        label="english batch 1",
    )
    assert res is None
    assert len(fake.calls) == 3


# ---------------------------------------------------------------------------
# run_codex_stage: concurrent batches, results applied + checkpointed safely.
# ---------------------------------------------------------------------------
def test_run_codex_stage_applies_all_batches_and_checkpoints(install_fake_codex):
    words = ["a", "b", "c", "d", "e"]
    batches = gen.chunk(words, 2)  # [a,b],[c,d],[e]
    # one response per batch
    install_fake_codex([_english_obj(b) for b in batches])

    seed = {}
    saves = []
    lock = threading.Lock()

    def apply(res):
        for item in res.items:
            seed.setdefault(item.word, {"explanation": {}})["explanation"][
                "en"
            ] = item.explanation

    def save():
        # snapshot how many words are committed at each checkpoint
        saves.append(len(seed))

    gen.run_codex_stage(
        batches,
        lambda b: (gen.ENGLISH_SYSTEM, "\n".join(b)),
        gen.ExplanationBatch,
        apply,
        concurrency=4,
        reasoning="low",
        model=None,
        timeout=10.0,
        max_retries=2,
        save=save,
        save_lock=lock,
        stage="english",
    )

    assert set(seed) == set(words)
    # save() called once per successful batch
    assert len(saves) == len(batches)
    # final checkpoint sees all words
    assert max(saves) == len(words)


def test_run_codex_stage_skips_bad_batch_keeps_rest(install_fake_codex):
    batches = [["a", "b"], ["c", "d"]]
    # first batch always fails (3 bad), second always succeeds.
    install_fake_codex(
        [ValueError("bad")] * 3 + [_english_obj(["c", "d"])]
    )
    seed = {}
    lock = threading.Lock()

    def apply(res):
        for item in res.items:
            seed.setdefault(item.word, {"explanation": {}})["explanation"][
                "en"
            ] = item.explanation

    gen.run_codex_stage(
        batches,
        lambda b: ("SYS", "\n".join(b)),
        gen.ExplanationBatch,
        apply,
        concurrency=1,  # deterministic ordering for the fake's response queue
        reasoning="low",
        model=None,
        timeout=10.0,
        max_retries=2,
        save=lambda: None,
        save_lock=lock,
        stage="english",
    )
    # bad batch dropped, good batch survived -> run is never wedged.
    assert set(seed) == {"c", "d"}


def test_run_codex_stage_empty_is_noop(install_fake_codex):
    fake = install_fake_codex([])
    called = []
    gen.run_codex_stage(
        [],
        lambda b: ("SYS", "x"),
        gen.ExplanationBatch,
        lambda r: called.append(r),
        concurrency=4,
        reasoning="low",
        model=None,
        timeout=10.0,
        max_retries=2,
        save=lambda: called.append("save"),
        save_lock=threading.Lock(),
        stage="english",
    )
    assert called == []
    assert fake.calls == []


# ---------------------------------------------------------------------------
# Resume semantics: save_seed/load_seed merge-by-word survives a "kill".
# A re-run must only target words/langs not yet present in the seed.
# ---------------------------------------------------------------------------
def test_resume_roundtrip_only_targets_missing(tmp_path):
    path = tmp_path / "full.json"
    # Simulate a partial run: 'egg' done in en+es, 'bank' only en, 'cat' nothing.
    data = {
        "egg": {"explanation": {"en": "An egg.", "es": "Un huevo."},
                "origin_confidence": "high"},
        "bank": {"explanation": {"en": "A bank."}},
    }
    gen.save_seed(path, data)
    seed = gen.load_seed(path)

    words = ["egg", "bank", "cat"]

    # English authoring must only target 'cat' (egg+bank already have en).
    missing_en = [
        w for w in words if "en" not in seed.get(w, {}).get("explanation", {})
    ]
    assert missing_en == ["cat"]

    # Verify must only target 'bank' (egg has confidence, cat has no en yet).
    to_verify = [
        w
        for w in words
        if "en" in seed.get(w, {}).get("explanation", {})
        and not seed[w].get("origin_confidence")
    ]
    assert to_verify == ["bank"]

    # es-translation must only target 'bank' (egg already has es; cat has no en).
    todo_es = [
        w
        for w in words
        if "en" in seed.get(w, {}).get("explanation", {})
        and "es" not in seed[w]["explanation"]
    ]
    assert todo_es == ["bank"]

    # Metadata survives the roundtrip intact.
    assert seed["egg"]["origin_confidence"] == "high"
    assert seed["egg"]["explanation"]["es"] == "Un huevo."
