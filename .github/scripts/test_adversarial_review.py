"""Tests for the adversarial-review gate.

These are the invariants that, when they regress, make the gate PASS WRONGLY —
which is undetectable by definition. Every one of them exists because the
pre-fix script violated it and still reported green:

  * chunk coverage is exact (the diff was truncated, and the audit said 100%)
  * parse_findings returns None, not [], for anything unreadable
  * ANY lens/chunk error fails closed (only an all-lens failure used to)
  * severity matching is alias-aware, and an unreadable severity blocks
  * a bad SHA / git failure is an error, never a silent substitution

Run: python -m pytest .github/scripts -q
"""

import io
import json
import subprocess
import urllib.error
import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

import adversarial_review as ar  # noqa: E402


# --------------------------------------------------------------------- chunking


def _diff(files):
    """Build a syntactically real unified diff from {path: added_body}."""
    out = []
    for path, body in files.items():
        out.append(
            f"diff --git a/{path} b/{path}\n"
            f"index 1111111..2222222 100644\n"
            f"--- a/{path}\n+++ b/{path}\n"
        )
        out.append(f"@@ -1,1 +1,{max(1, body.count(chr(10)) + 1)} @@\n")
        out.extend(f"+{line}\n" for line in body.split("\n"))
    return "".join(out)


@pytest.mark.parametrize("budget", [4000, 8000, 50000, 200000])
def test_chunk_coverage_is_exact_at_every_budget(budget):
    diff = _diff(
        {
            "a.ts": "const a = 1;\n" * 400,
            "b/big.ts": "x".join(["const b = 2;"] * 3000),
            "c.md": "# doc\n" * 50,
        }
    )
    chunks, _, _ = ar.chunk_diff(diff, budget)
    assert "".join(c.text for c in chunks) == diff
    assert all(len(c.text) <= budget for c in chunks)


def test_chunk_empty_diff():
    chunks, oversized, hard = ar.chunk_diff("", ar.MIN_CHUNK_CHARS)
    assert (chunks, oversized, hard) == ([], [], [])


def test_chunk_single_over_budget_line_terminates_and_is_reported():
    """A minified bundle has no line boundary to split on. It must still
    terminate, still cover exactly, and be REPORTED as hard-split — the audit
    line used to claim 'no lens sees a partial line' in exactly this case."""
    diff = _diff({"dist/app.js": "z" * 300_000})
    start = time.monotonic()
    chunks, oversized, hard = ar.chunk_diff(diff, ar.MIN_CHUNK_CHARS)
    assert time.monotonic() - start < 5
    assert "".join(c.text for c in chunks) == diff
    assert oversized == ["dist/app.js"]
    assert hard == ["dist/app.js"]


def test_chunk_below_minimum_budget_is_an_error():
    with pytest.raises(ar.ReviewError):
        ar.chunk_diff(_diff({"a.ts": "x"}), ar.MIN_CHUNK_CHARS - 1)


def test_split_on_lines_does_not_break_on_unicode_line_separators():
    """str.splitlines() also breaks on U+2028/U+2029/U+0085/\\x0b/\\x0c, all of
    which are legal inside JS source. Only "\\n" is a line boundary here."""
    text = "+const s = 'a b cd\x0be\x0cf';\n" * 3
    pieces, hard = ar._split_on_lines(text, 4000)
    assert "".join(pieces) == text
    assert hard is False
    assert all(p.endswith("\n") for p in pieces)


def test_continuation_context_is_not_counted_as_coverage():
    diff = _diff({"big.ts": "const q = 1;\n" * 2000})
    chunks, _, _ = ar.chunk_diff(diff, ar.MIN_CHUNK_CHARS)
    assert len(chunks) > 1
    assert any(c.context for c in chunks[1:])
    assert "".join(c.text for c in chunks) == diff  # context excluded
    assert chunks[1].prompt().startswith("# Continuation")


# ---------------------------------------------------------------- parse_findings


@pytest.mark.parametrize(
    "reply",
    [
        "",
        "   ",
        "I reviewed the diff and it looks fine to me.",
        '{"ok": true}',
        '{"findings": [{"severity": "high"',  # truncated mid-object
        '{"findings": "none"}',
        '{"findings": ["a string, not an object"]}',
    ],
)
def test_unreadable_replies_are_none_not_empty(reply):
    """None (a lens error) vs [] (a clean pass) is THE distinction. Every one of
    these used to return [] and pass the gate."""
    assert ar.parse_findings(reply) is None


def test_well_formed_replies_parse():
    assert ar.parse_findings('{"findings": []}') == []
    assert ar.parse_findings('```json\n{"findings": []}\n```') == []
    out = ar.parse_findings('prose {"findings": [{"severity": "high"}]} trailing')
    assert out == [{"severity": "high"}]


def test_explicit_null_findings_is_a_clean_pass():
    """Deliberate asymmetry, documented in _coerce_findings: the key is present
    and says 'nothing', so this passes rather than blocking every clean PR from
    a model that spells [] as null."""
    assert ar.parse_findings('{"findings": null}') == []


def test_brace_scan_is_bounded_on_degenerate_input():
    start = time.monotonic()
    assert ar.parse_findings("{" * 20000) is None
    assert time.monotonic() - start < 2


# --------------------------------------------------------------------- severity


@pytest.mark.parametrize(
    "value",
    ["high", "HIGH ", "High severity", "critical", "CRITICAL", "blocker", "major",
     "Major", "severe", "fatal"],
)
def test_blocking_severities(value):
    assert ar.normalize_severity(value) == "high"


@pytest.mark.parametrize("value", [ar.MISSING, None, "", "   ", "!!!", "123"])
def test_unreadable_severity_blocks(value):
    """An omitted or unreadable severity is unreadable INPUT, and unreadable
    input fails closed everywhere else in this script."""
    assert ar.normalize_severity(value) == "high"


@pytest.mark.parametrize("value", ["medium", "moderate", "warn"])
def test_medium_severities(value):
    assert ar.normalize_severity(value) == "medium"


@pytest.mark.parametrize("value", ["low", "minor", "nit", "informational"])
def test_low_severities(value):
    assert ar.normalize_severity(value) == "low"


def test_unrecognized_but_readable_severity_warns_rather_than_blocks():
    """The one carve-out: a readable word we don't know is not a reason to
    block every merge in the repo."""
    assert ar.normalize_severity("spicy") == "unknown"


def test_finding_severity_reads_the_missing_key():
    assert ar.finding_severity({"title": "x"}) == "high"
    assert ar.has_unreadable_severity({"title": "x"}) is True
    assert ar.has_unreadable_severity({"severity": "low"}) is False


# ------------------------------------------------------------------ retry logic


@pytest.mark.parametrize(
    "raw,expected",
    [("30", 30.0), ("6s", 6.0), ("1.5s", 1.5), ("6m0s", 360.0), ("250ms", 0.25)],
)
def test_parse_duration(raw, expected):
    assert ar.parse_duration(raw) == pytest.approx(expected)


def test_retry_delay_prefers_server_headers():
    assert ar.retry_delay_from({"retry-after": "45"}) == 45.0
    assert ar.retry_delay_from({"x-ratelimit-reset-tokens": "6m0s"}) == 360.0
    assert ar.retry_delay_from({}) is None
    assert ar.retry_delay_from(None) is None


def test_backoff_spans_a_rate_limit_window():
    """2s/4s could never outlast a token-per-minute window, so a 429 became a
    lens error, i.e. a repo-wide block."""
    total = sum(ar.RETRY_BACKOFF_S * (2**i) for i in range(ar.REQUEST_ATTEMPTS - 1))
    assert total >= 55


class _Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _stub_urlopen(monkeypatch, sequence):
    """Serve `sequence` items in order: an Exception is raised, else returned."""
    seen = {"n": 0}

    def fake(req, timeout=None):
        seen["n"] += 1
        item = sequence[min(seen["n"] - 1, len(sequence) - 1)]
        if isinstance(item, Exception):
            raise item
        return _Resp(item)

    monkeypatch.setattr(ar.urllib.request, "urlopen", fake)
    return seen


def _http_429(retry_after):
    return urllib.error.HTTPError(
        "https://example/v1", 429, "Too Many Requests", {"retry-after": retry_after}, None
    )


def test_post_waits_the_server_supplied_retry_after(monkeypatch):
    slept = []
    monkeypatch.setattr(ar.time, "sleep", slept.append)
    monkeypatch.setattr(ar.random, "uniform", lambda a, b: 0.0)
    _stub_urlopen(monkeypatch, [_http_429("17"), _http_429("17"), b'{"ok": true}'])
    assert ar._post("https://example/v1", {}, {}) == {"ok": True}
    assert slept == [17.0, 17.0]  # not the 8/16 default backoff


def test_post_falls_back_to_exponential_backoff_without_headers(monkeypatch):
    slept = []
    monkeypatch.setattr(ar.time, "sleep", slept.append)
    monkeypatch.setattr(ar.random, "uniform", lambda a, b: 0.0)
    _stub_urlopen(monkeypatch, [OSError("connection reset"), b'{"ok": true}'])
    assert ar._post("https://example/v1", {}, {}) == {"ok": True}
    assert slept == [float(ar.RETRY_BACKOFF_S)]


def test_post_does_not_retry_a_non_transient_status(monkeypatch):
    slept = []
    monkeypatch.setattr(ar.time, "sleep", slept.append)
    err = urllib.error.HTTPError("https://example/v1", 400, "Bad Request", {}, None)
    seen = _stub_urlopen(monkeypatch, [err])
    with pytest.raises(RuntimeError):
        ar._post("https://example/v1", {}, {})
    assert seen["n"] == 1 and slept == []


def test_post_never_sleeps_past_the_review_budget(monkeypatch):
    """Retries must not outlive the job: a runner kill is a red check with no
    explanation, where an in-script budget error at least says why."""
    slept = []
    monkeypatch.setattr(ar.time, "sleep", slept.append)
    monkeypatch.setattr(ar.random, "uniform", lambda a, b: 0.0)
    monkeypatch.setattr(ar, "_DEADLINE", time.monotonic() + 3)
    _stub_urlopen(monkeypatch, [_http_429("300")])
    with pytest.raises(RuntimeError):
        ar._post("https://example/v1", {}, {})
    assert slept == []


# ----------------------------------------------------------------- SSE decoding


def test_read_anthropic_stream_accumulates_text_and_stop_reason():
    events = [
        {"type": "message_start", "message": {}},
        {"type": "content_block_delta", "delta": {"type": "text_delta", "text": '{"fin'}},
        {"type": "content_block_delta", "delta": {"type": "thinking_delta", "thinking": "hm"}},
        {"type": "content_block_delta", "delta": {"type": "text_delta", "text": 'dings": []}'}},
        {"type": "message_delta", "delta": {"stop_reason": "end_turn"}},
    ]
    body = "".join(f"event: {e['type']}\ndata: {json.dumps(e)}\n\n" for e in events)
    text, stop = ar.read_anthropic_stream(io.BytesIO(body.encode()))
    assert (text, stop) == ('{"findings": []}', "end_turn")
    assert ar.parse_findings(text) == []


def test_read_anthropic_stream_raises_on_error_event():
    body = 'data: {"type": "error", "error": {"type": "overloaded_error"}}\n\n'
    with pytest.raises(RuntimeError):
        ar.read_anthropic_stream(io.BytesIO(body.encode()))


# --------------------------------------------------------------- range / git


@pytest.fixture()
def repo(tmp_path, monkeypatch):
    """A real git repo where main advances after the branch is cut."""
    def git(*args):
        subprocess.run(["git", "-C", str(tmp_path), *args], check=True,
                       capture_output=True)

    def rev(ref):
        return subprocess.run(
            ["git", "-C", str(tmp_path), "rev-parse", ref],
            check=True, capture_output=True, text=True,
        ).stdout.strip()

    git("init", "-q", "-b", "main")
    git("config", "user.email", "t@example.com")
    git("config", "user.name", "t")
    (tmp_path / "base.txt").write_text("base\n")
    git("add", "-A")
    git("commit", "-qm", "base")
    root = rev("HEAD")

    git("checkout", "-q", "-b", "feature")
    (tmp_path / "feature.txt").write_text("feature change\n")
    # Two more files, each comfortably over MIN_CHUNK_CHARS/2, so the branch
    # diff spans several chunks at the minimum budget — that is the only way to
    # exercise the multi-chunk exit paths.
    (tmp_path / "wide_a.txt").write_text("const a = 1;\n" * 400)
    (tmp_path / "wide_b.txt").write_text("const b = 2;\n" * 400)
    git("add", "-A")
    git("commit", "-qm", "feature")
    head = rev("HEAD")

    git("checkout", "-q", "main")
    (tmp_path / "unrelated.txt").write_text("landed on main after the cut\n")
    git("add", "-A")
    git("commit", "-qm", "unrelated")
    main_tip = rev("HEAD")

    monkeypatch.chdir(tmp_path)
    return {"root": root, "head": head, "main_tip": main_tip}


def test_range_is_the_merge_base_not_the_base_branch_tip(repo, monkeypatch):
    """github.event.pull_request.base.sha is main's TIP at event time. Two-dot
    from there reviews main's own commits inverted and can drop the branch's
    work — while the audit line still claims 100% coverage."""
    monkeypatch.setenv("BASE_SHA", repo["main_tip"])
    monkeypatch.setenv("HEAD_SHA", repo["head"])
    rng = ar.resolve_range()
    assert rng.base == repo["root"]
    assert rng.requested_base == repo["main_tip"]

    diff = ar.get_diff(rng.spec)
    assert "feature.txt" in diff
    assert "unrelated.txt" not in diff  # the two-dot bug leaked this in

    two_dot = ar.get_diff(f"{repo['main_tip']}..{repo['head']}")
    assert "unrelated.txt" in two_dot  # ...proving the difference is real


def test_merge_group_range_is_unchanged(repo, monkeypatch):
    """merge_group.base_sha is the previous entry's head — already an ancestor —
    so merge-base resolution is a no-op there and each entry still sees exactly
    its own delta."""
    monkeypatch.setenv("BASE_SHA", repo["root"])
    monkeypatch.setenv("HEAD_SHA", repo["head"])
    rng = ar.resolve_range()
    assert rng.base == repo["root"]
    assert rng.spec == f"{repo['root']}..{repo['head']}"


def test_bad_sha_is_an_error_not_a_substitution(repo, monkeypatch):
    monkeypatch.setenv("BASE_SHA", "not-a-sha")
    monkeypatch.setenv("HEAD_SHA", repo["head"])
    with pytest.raises(ar.ReviewError):
        ar.resolve_range()


def test_absent_sha_is_an_error(repo, monkeypatch):
    monkeypatch.setenv("BASE_SHA", "0" * 40)
    monkeypatch.setenv("HEAD_SHA", repo["head"])
    with pytest.raises(ar.ReviewError):
        ar.resolve_range()


def test_git_failure_is_not_an_empty_diff(monkeypatch):
    monkeypatch.setattr(ar, "run", lambda cmd: (128, "", "fatal: bad revision"))
    with pytest.raises(ar.ReviewError):
        ar.get_diff("a..b")


def test_empty_stdout_with_changed_files_fails_closed(monkeypatch):
    def fake_run(cmd):
        if "--name-only" in cmd:
            return (0, "some/file.ts\n", "")
        return (0, "", "")

    monkeypatch.setattr(ar, "run", fake_run)
    with pytest.raises(ar.ReviewError):
        ar.get_diff("a..b")


# ------------------------------------------------------------------ exit paths


@pytest.fixture()
def gate(repo, monkeypatch, tmp_path):
    """main() wired to a real repo and a stubbed model."""
    monkeypatch.setenv("OPENAI_KEY", "test-key")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("BASE_SHA", repo["root"])
    monkeypatch.setenv("HEAD_SHA", repo["head"])
    monkeypatch.delenv("PR_NUMBER", raising=False)
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(tmp_path / "summary.md"))

    def install(reply):
        """`reply` is a str, an Exception to raise, or a callable(user)->str."""
        def fake(provider, key, model, system, user):
            value = reply(user) if callable(reply) else reply
            if isinstance(value, Exception):
                raise value
            return value

        monkeypatch.setattr(ar, "call_model", fake)

    return install


def test_clean_diff_passes(gate):
    gate('{"findings": []}')
    assert ar.main() == 0


def test_high_finding_blocks(gate):
    gate('{"findings": [{"severity": "high", "file": "a", "title": "t", "detail": "d"}]}')
    assert ar.main() == 1


def test_low_finding_passes(gate):
    gate('{"findings": [{"severity": "low", "file": "a", "title": "t", "detail": "d"}]}')
    assert ar.main() == 0


@pytest.mark.parametrize("severity", ["critical", "blocker", "HIGH ", "major", "urgent"])
def test_severity_aliases_and_unknowns_at_the_exit_code(gate, severity):
    """"major" and "urgent" used to exit 0. "major" is now an alias; "urgent"
    is unreadable-to-us but still a REPORTED finding, so it must not silently
    pass — it warns only if it normalizes to a known non-blocking level."""
    gate(json.dumps({"findings": [{"severity": severity, "file": "a", "title": "t"}]}))
    rc = ar.main()
    assert rc == (1 if severity != "urgent" else 0), severity


def test_finding_with_no_severity_blocks(gate):
    gate('{"findings": [{"file": "a", "title": "t", "detail": "d"}]}')
    assert ar.main() == 1


def test_lens_error_blocks(gate):
    gate(RuntimeError("HTTP 429"))
    assert ar.main() == 1


def test_unparseable_reply_blocks(gate):
    gate("sure, the code looks good")
    assert ar.main() == 1


def test_one_lens_failing_out_of_three_blocks(gate):
    """The old code required ALL lenses to fail; two of three timing out
    reported a pass."""
    state = {"n": 0}

    def reply(_user):
        state["n"] += 1
        return RuntimeError("boom") if state["n"] == 1 else '{"findings": []}'

    gate(reply)
    assert ar.main() == 1


def test_high_in_a_non_first_chunk_blocks(gate, monkeypatch):
    monkeypatch.setenv("MAX_CHUNK_CHARS", str(ar.MIN_CHUNK_CHARS))
    seen = []

    def reply(user):
        seen.append(user)
        if "chunk 1 of" in user:
            return '{"findings": []}'
        return '{"findings": [{"severity": "high", "file": "z", "title": "t"}]}'

    gate(reply)
    assert ar.main() == 1
    # Guard against the test passing vacuously on a single-chunk diff.
    assert any("chunk 2 of" in u for u in seen)


def test_error_path_posts_the_sticky_comment(gate, monkeypatch):
    """A lens error is the most confusing red the gate can produce, and it used
    to leave a stale green '✅ No findings' comment standing next to it."""
    posted = []
    monkeypatch.setattr(ar, "post_sticky_comment", posted.append)
    gate(RuntimeError("boom"))
    assert ar.main() == 1
    assert len(posted) == 1
    assert "Blocked" in posted[0] and ar.MARKER in posted[0]


def test_no_key_blocks(gate, monkeypatch):
    monkeypatch.delenv("OPENAI_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert ar.main() == 1


def test_bad_numeric_config_blocks(gate, monkeypatch):
    gate('{"findings": []}')
    monkeypatch.setenv("MAX_CHUNK_CHARS", "not-a-number")
    assert ar.main() == 1


def test_audit_line_names_the_range_and_covers_the_diff(gate, capsys):
    gate('{"findings": []}')
    assert ar.main() == 0
    out = capsys.readouterr().out
    assert "merge base" in out
    assert "100% of that diff" in out
