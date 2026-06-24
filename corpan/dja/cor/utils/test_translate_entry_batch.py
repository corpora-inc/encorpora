# tests/test_translate_entry_batch.py
#
# Regression tests for the #486 data-corruption bug in
# cor.utils.llm.translate_entry_batch:
#   1. A failed LLM call used to be swallowed (printed) and then fall through
#      to an UNBOUND `result` -> UnboundLocalError masked the real failure.
#   2. There was NO completeness/alignment check before bulk_create, so a
#      short / garbled / misaligned LLM response silently persisted FEWER (or
#      wrong-id) translations than requested -> languages quietly missing
#      content in the shipped DB while the build "succeeded".
#
# These tests run under plain pytest. `cor.utils.llm` imports Django models
# and a corpora_ai provider at module load, neither of which is needed to
# exercise the reconcile-and-raise logic, so we install lightweight stubs in
# sys.modules BEFORE importing the module under test. The LLM call itself is
# mocked (never hits a real API).

import sys
import types

import pytest


# ---------------------------------------------------------------------------
# Stub the external dependencies that cor.utils.llm imports at module load.
# ---------------------------------------------------------------------------
def _install_stubs():
    # corpora_ai.llm_interface.ChatCompletionTextMessage
    llm_interface = types.ModuleType("corpora_ai.llm_interface")

    class ChatCompletionTextMessage:  # minimal stand-in
        def __init__(self, role=None, text=None):
            self.role = role
            self.text = text

        def __repr__(self):
            return f"Msg({self.role!r})"

    llm_interface.ChatCompletionTextMessage = ChatCompletionTextMessage

    # corpora_ai.provider_loader.load_llm_provider
    provider_loader = types.ModuleType("corpora_ai.provider_loader")

    def load_llm_provider(_name):
        # Default module-level provider; tests pass their own mock `llm=`.
        return object()

    provider_loader.load_llm_provider = load_llm_provider

    corpora_ai = types.ModuleType("corpora_ai")
    corpora_ai.llm_interface = llm_interface
    corpora_ai.provider_loader = provider_loader

    # cor.models: Domain, Entry, Language, Translation
    cor_models = types.ModuleType("cor.models")

    class _CapturingManager:
        """Records bulk_create calls so tests can assert nothing persisted."""

        def __init__(self):
            self.bulk_created = []

        def get(self, **kwargs):
            # Language.objects.get(code=...) -> object exposing .code/.name.
            ns = types.SimpleNamespace(**kwargs)
            if not hasattr(ns, "name"):
                ns.name = kwargs.get("code", "Test")
            return ns

        def bulk_create(self, objs, ignore_conflicts=False):
            self.bulk_created.append(list(objs))
            return objs

    class Translation:
        objects = _CapturingManager()

        def __init__(self, entry_id=None, language=None, text=None):
            self.entry_id = entry_id
            self.language = language
            self.text = text

    class Language:
        objects = _CapturingManager()

    class Domain:
        pass

    class Entry:
        pass

    cor_models.Domain = Domain
    cor_models.Entry = Entry
    cor_models.Language = Language
    cor_models.Translation = Translation

    sys.modules.setdefault("corpora_ai", corpora_ai)
    sys.modules["corpora_ai.llm_interface"] = llm_interface
    sys.modules["corpora_ai.provider_loader"] = provider_loader
    sys.modules["cor.models"] = cor_models


_install_stubs()

from cor.utils import llm as llm_mod  # noqa: E402


# ---------------------------------------------------------------------------
# Mock LLM provider
# ---------------------------------------------------------------------------
class _Item:
    def __init__(self, entry_id, translated_text):
        self.entry_id = entry_id
        self.translated_text = translated_text


class _Resp:
    def __init__(self, items):
        self.translations = items


class MockLLM:
    """Returns a canned TranslationResponse-shaped object, or raises."""

    def __init__(self, items=None, raises=None):
        self._items = items
        self._raises = raises
        self.calls = 0

    def get_data_completion(self, messages, schema):
        self.calls += 1
        if self._raises is not None:
            raise self._raises
        return _Resp(self._items)


@pytest.fixture(autouse=True)
def _reset_capture():
    # Clear any persisted state between tests.
    llm_mod.Translation.objects.bulk_created.clear()
    yield
    llm_mod.Translation.objects.bulk_created.clear()


ENTRIES = [(1, "Hello"), (2, "Goodbye"), (3, "Thanks")]


# ---------------------------------------------------------------------------
# Happy path: full, aligned response -> persists all, identical behavior.
# ---------------------------------------------------------------------------
def test_full_aligned_response_persists_all():
    mock = MockLLM(items=[_Item(1, "Hola"), _Item(2, "Adiós"), _Item(3, "Gracias")])
    result = llm_mod.translate_entry_batch("es", ENTRIES, llm=mock, dry_run=False)
    assert {t.entry_id for t in result.translations} == {1, 2, 3}
    # Exactly one bulk_create with all three rows.
    assert len(llm_mod.Translation.objects.bulk_created) == 1
    persisted = llm_mod.Translation.objects.bulk_created[0]
    assert {o.entry_id for o in persisted} == {1, 2, 3}
    assert {o.text for o in persisted} == {"Hola", "Adiós", "Gracias"}


def test_dry_run_does_not_persist():
    mock = MockLLM(items=[_Item(1, "Hola"), _Item(2, "Adiós"), _Item(3, "Gracias")])
    llm_mod.translate_entry_batch("es", ENTRIES, llm=mock, dry_run=True)
    assert llm_mod.Translation.objects.bulk_created == []


# ---------------------------------------------------------------------------
# Bug #1: LLM exception must propagate, NOT fall through to unbound result.
# ---------------------------------------------------------------------------
def test_llm_exception_raises_and_does_not_persist():
    mock = MockLLM(raises=RuntimeError("boom: rate limited"))
    with pytest.raises(Exception) as exc:
        llm_mod.translate_entry_batch("es", ENTRIES, llm=mock, dry_run=False)
    # Not an UnboundLocalError (the old masking failure).
    assert not isinstance(exc.value, UnboundLocalError)
    assert llm_mod.Translation.objects.bulk_created == []


# ---------------------------------------------------------------------------
# Bug #2: incomplete / misaligned responses must RAISE, never bulk_create.
# ---------------------------------------------------------------------------
def test_short_response_raises_and_does_not_persist():
    # Missing entry id 3.
    mock = MockLLM(items=[_Item(1, "Hola"), _Item(2, "Adiós")])
    with pytest.raises(ValueError) as exc:
        llm_mod.translate_entry_batch("es", ENTRIES, llm=mock, dry_run=False)
    assert "3" in str(exc.value)
    assert llm_mod.Translation.objects.bulk_created == []


def test_unknown_id_raises_and_does_not_persist():
    # Returns an id (99) that was never requested -> misalignment.
    mock = MockLLM(items=[_Item(1, "Hola"), _Item(2, "Adiós"), _Item(99, "???")])
    with pytest.raises(ValueError):
        llm_mod.translate_entry_batch("es", ENTRIES, llm=mock, dry_run=False)
    assert llm_mod.Translation.objects.bulk_created == []


def test_null_id_raises_and_does_not_persist():
    mock = MockLLM(items=[_Item(1, "Hola"), _Item(2, "Adiós"), _Item(None, "Gracias")])
    with pytest.raises(ValueError):
        llm_mod.translate_entry_batch("es", ENTRIES, llm=mock, dry_run=False)
    assert llm_mod.Translation.objects.bulk_created == []


def test_duplicate_id_raises_and_does_not_persist():
    # Two rows for id 1, none for id 3 -> wrong count + dupe.
    mock = MockLLM(items=[_Item(1, "Hola"), _Item(1, "Hola2"), _Item(2, "Adiós")])
    with pytest.raises(ValueError):
        llm_mod.translate_entry_batch("es", ENTRIES, llm=mock, dry_run=False)
    assert llm_mod.Translation.objects.bulk_created == []
