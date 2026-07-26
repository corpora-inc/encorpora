"""Tests for the adversarial-review gate.

These are the invariants that, when they regress, make the gate PASS WRONGLY —
which is undetectable by definition. Every one of them exists because the
pre-fix script violated it and still reported green:

  * chunk coverage is exact (the diff was truncated, and the audit said 100%)
  * parse_findings returns None, not [], for anything unreadable
  * ANY lens/chunk error fails closed (only an all-lens failure used to)
  * severity matching is alias-aware, and an unreadable severity blocks
  * a bad SHA / git failure is an error, never a silent substitution

The confirmation-pass tests below guard the same property from the other side:
the second pass is the only thing in this gate that makes a blocking finding
stop blocking, so every way it can go wrong — an API error, an unreadable
verdict, a file it cannot read — must still block, and a clearance must stay
visible rather than deleting the finding.

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


@pytest.mark.parametrize(
    "value",
    ["very high", "severity: high", "Severity: HIGH", "medium-high", "high/critical",
     "quite serious", "1 - critical"],
)
def test_severity_is_matched_at_every_token_not_just_the_first(value):
    """Scanning only the first token meant "High severity" blocked but "very
    high" did not: it normalized to unknown and exited 0 on a REPORTED finding.
    Two levels in one string resolve to the higher — the fail-closed direction."""
    assert ar.normalize_severity(value) == "high"


@pytest.mark.parametrize(
    "value",
    ["urgent", "P0", "p1", "sev0", "S1", "must-fix", "showstopper", "breaking",
     "important", "serious", "error", "blocking"],
)
def test_top_of_ladder_vocabulary_blocks(value):
    """Documented decision (see BLOCKING_ALIASES): a model that ignores the
    high|medium|low enum and grades a REPORTED defect at the top of some other
    scale has not said the diff is safe to merge."""
    assert ar.normalize_severity(value) == "high"


@pytest.mark.parametrize("value", ["bug", "defect", "issue", "regression", "spicy"])
def test_kind_words_are_not_grades_and_only_warn(value):
    """The other half of that decision, stated so the hole is explicit: these
    name what a finding IS, not how bad it is, so they warn rather than block."""
    assert ar.normalize_severity(value) == "unknown"


@pytest.mark.parametrize(
    "value,expected",
    [("low (non-blocking)", "low"), ("medium, not critical", "medium"),
     ("not high", "unknown")],
)
def test_a_negated_blocking_word_is_not_a_blocking_grade(value, expected):
    """"low (non-blocking)" is the model saying it is SAFE. Blocking on the
    substring would wedge the queue on the very words that mean the opposite."""
    assert ar.normalize_severity(value) == expected


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


def test_retry_after_ms_is_milliseconds_not_seconds():
    """OpenAI's preferred spelling on some 429s. Reading '1500' as 1500 SECONDS
    would blow the whole review budget on one retry."""
    assert ar.retry_delay_from({"retry-after-ms": "1500"}) == 1.5


def test_retry_delay_takes_the_max_of_the_headers():
    """The classic RPM-429 shape. First-wins returned 0.0 from the healthy token
    bucket and threw away the 45s that was actually throttling us."""
    assert ar.retry_delay_from({"retry-after": "45"}) == 45.0
    assert ar.retry_delay_from({"x-ratelimit-reset-tokens": "6m0s"}) == 360.0
    assert (
        ar.retry_delay_from(
            {"x-ratelimit-reset-tokens": "0s", "x-ratelimit-reset-requests": "45s"}
        )
        == 45.0
    )
    assert ar.retry_delay_from({}) is None
    assert ar.retry_delay_from(None) is None


class _Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _stub_urlopen(monkeypatch, sequence):
    """Serve `sequence` items in order: an Exception is raised, else returned."""
    seen = {"n": 0, "requests": []}

    def fake(req, timeout=None):
        seen["n"] += 1
        seen["requests"].append(req)
        item = sequence[min(seen["n"] - 1, len(sequence) - 1)]
        if isinstance(item, Exception):
            raise item
        return _Resp(item)

    monkeypatch.setattr(ar.urllib.request, "urlopen", fake)
    return seen


def _http(status, headers=None):
    return urllib.error.HTTPError(
        "https://example/v1", status, "err", headers or {}, None
    )


def _http_429(retry_after):
    return _http(429, {"retry-after": retry_after})


def _drive_post(monkeypatch, sequence, deadline=None):
    """Run the REAL _post against a stub transport. Returns (attempts, sleeps)."""
    slept = []
    monkeypatch.setattr(ar.time, "sleep", slept.append)
    monkeypatch.setattr(ar.random, "uniform", lambda a, b: 0.0)
    monkeypatch.setattr(ar, "_DEADLINE", time.monotonic() + (deadline or 20 * 60))
    seen = _stub_urlopen(monkeypatch, sequence)
    try:
        ar._post("https://example/v1", {}, {})
    except Exception:  # noqa: BLE001  — the caller asserts on the waits
        pass
    return seen["n"], slept


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


def test_backoff_spans_a_rate_limit_window(monkeypatch):
    """Drives the REAL _post. The previous version of this test recomputed the
    constants and asserted on the arithmetic, so it passed while _post itself
    slept 0.0 three times."""
    attempts, slept = _drive_post(monkeypatch, [_http(503)])
    assert attempts == ar.REQUEST_ATTEMPTS
    assert slept == [8.0, 16.0, 32.0]
    assert sum(slept) >= 55  # a token-per-minute window


@pytest.mark.parametrize(
    "headers",
    [
        {"x-ratelimit-reset-tokens": "0s"},
        {"x-ratelimit-reset-requests": "0s"},
        {"x-ratelimit-reset-tokens": "6ms"},
        {"x-ratelimit-reset-tokens": "0s", "x-ratelimit-reset-requests": "0s"},
    ],
)
def test_a_healthy_rate_limit_header_does_not_collapse_the_backoff(
    monkeypatch, headers
):
    """THE wedge. Providers stamp x-ratelimit-* on essentially every response and
    a healthy bucket reads 0s. Letting the hint replace the floor burned all four
    attempts in milliseconds on one transient 5xx, turning it into a lens error
    and a red required check for every PR in flight."""
    attempts, slept = _drive_post(monkeypatch, [_http(503, headers)])
    assert attempts == ar.REQUEST_ATTEMPTS
    assert slept == [8.0, 16.0, 32.0]


def test_post_honours_a_retry_after_longer_than_a_minute(monkeypatch):
    """A 60s constant ceiling spent every attempt inside a 6-minute window and
    gave up with most of the 20-minute budget unused. The budget is the only
    ceiling now."""
    attempts, slept = _drive_post(
        monkeypatch, [_http(429, {"retry-after": "300"}), b'{"ok": true}']
    )
    assert attempts == 2
    assert slept == [300.0]


def test_post_honours_a_reset_tokens_window_longer_than_a_minute(monkeypatch):
    attempts, slept = _drive_post(
        monkeypatch, [_http(429, {"x-ratelimit-reset-tokens": "6m0s"}), b'{"ok": true}']
    )
    assert attempts == 2
    assert slept == [360.0]


def test_post_does_not_retry_a_non_transient_status(monkeypatch):
    slept = []
    monkeypatch.setattr(ar.time, "sleep", slept.append)
    err = urllib.error.HTTPError("https://example/v1", 400, "Bad Request", {}, None)
    seen = _stub_urlopen(monkeypatch, [err])
    with pytest.raises(RuntimeError):
        ar._post("https://example/v1", {}, {})
    assert seen["n"] == 1 and slept == []


@pytest.mark.parametrize("status", [429, 500, 502, 503, 504, 522, 524, 529])
def test_transient_statuses_are_retried(monkeypatch, status):
    """529 is Anthropic's documented overloaded_error. Treating it as permanent
    made provider overload an instant repo-wide block."""
    attempts, _ = _drive_post(monkeypatch, [_http(status)])
    assert attempts == ar.REQUEST_ATTEMPTS


def test_post_does_not_retry_a_malformed_body(monkeypatch):
    """A body that will not parse is deterministic. Retrying it four times only
    burns the budget the next real rate limit needs."""
    attempts, slept = _drive_post(monkeypatch, [b"this is not json"])
    assert attempts == 1 and slept == []


def test_post_retries_a_transient_stream_error(monkeypatch):
    """overloaded_error arrives as an SSE event inside a 200, so status matching
    alone cannot see it."""
    overloaded = 'data: {"type": "error", "error": {"type": "overloaded_error"}}\n\n'
    ok = (
        'data: {"type": "content_block_delta", "delta": '
        '{"type": "text_delta", "text": "{\\"findings\\": []}"}}\n\n'
    )
    slept = []
    monkeypatch.setattr(ar.time, "sleep", slept.append)
    monkeypatch.setattr(ar.random, "uniform", lambda a, b: 0.0)
    seen = _stub_urlopen(monkeypatch, [overloaded.encode(), ok.encode()])
    text, _ = ar._post(
        "https://example/v1", {}, {}, reader=ar.read_anthropic_stream
    )
    assert seen["n"] == 2 and text == '{"findings": []}'


def test_post_does_not_retry_a_permanent_stream_error(monkeypatch):
    body = 'data: {"type": "error", "error": {"type": "invalid_request_error"}}\n\n'
    slept = []
    monkeypatch.setattr(ar.time, "sleep", slept.append)
    seen = _stub_urlopen(monkeypatch, [body.encode()])
    with pytest.raises(RuntimeError):
        ar._post("https://example/v1", {}, {}, reader=ar.read_anthropic_stream)
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


def test_post_clamps_a_long_wait_to_the_remaining_budget(monkeypatch):
    """With room to wait but not the full window, wait what is left rather than
    a constant — and keep the margin that lets the job report."""
    attempts, slept = _drive_post(
        monkeypatch, [_http_429("300"), b'{"ok": true}'], deadline=100
    )
    assert attempts == 2
    assert slept == [pytest.approx(100 - ar.RETRY_BUDGET_MARGIN_S, abs=1)]


# ------------------------------------------------------------- request payloads


def _sent(seen, i=0):
    return json.loads(seen["requests"][i].data)


def test_call_model_openai_payload_shape(monkeypatch):
    body = json.dumps({"choices": [{"message": {"content": '{"findings": []}'}}]})
    seen = _stub_urlopen(monkeypatch, [body.encode()])
    out = ar.call_model("openai", "k", "gpt-4.1", "sys", "user text")
    assert out == '{"findings": []}'
    sent = _sent(seen)
    assert sent["model"] == "gpt-4.1"
    assert sent["response_format"] == {"type": "json_object"}
    assert sent["messages"] == [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "user text"},
    ]
    assert seen["requests"][0].headers["Authorization"] == "Bearer k"


@pytest.mark.parametrize(
    "body",
    [
        {"choices": [{"finish_reason": "length", "message": {"content": "{"}}]},
        {"choices": [{"message": {"content": None}}]},
        {"choices": []},
    ],
)
def test_call_model_openai_unusable_response_raises(monkeypatch, body):
    _stub_urlopen(monkeypatch, [json.dumps(body).encode()])
    with pytest.raises(RuntimeError):
        ar.call_model("openai", "k", "gpt-4.1", "sys", "user")


def test_call_model_anthropic_payload_shape(monkeypatch):
    """The Anthropic branch has never run against the real API, so this payload
    assertion is the only thing standing between a typo'd field name and a
    repo-wide red the day the key is added."""
    sse = (
        'data: {"type": "content_block_delta", "delta": '
        '{"type": "text_delta", "text": "{\\"findings\\": []}"}}\n\n'
        'data: {"type": "message_delta", "delta": {"stop_reason": "end_turn"}}\n\n'
    )
    seen = _stub_urlopen(monkeypatch, [sse.encode()])
    out = ar.call_model("anthropic", "sekret", "claude-opus-5", "sys", "user text")
    assert out == '{"findings": []}'

    req = seen["requests"][0]
    assert req.full_url == ar.ANTHROPIC_URL
    assert req.headers["X-api-key"] == "sekret"
    assert req.headers["Anthropic-version"] == "2023-06-01"
    assert req.headers["Anthropic-beta"] == ar.ANTHROPIC_BETAS

    sent = _sent(seen)
    assert sent["model"] == "claude-opus-5"
    assert sent["max_tokens"] == ar.ANTHROPIC_MAX_TOKENS
    assert ar.ANTHROPIC_MAX_TOKENS >= 32000  # thinking shares this budget
    assert sent["stream"] is True
    assert sent["thinking"] == {"type": "adaptive"}
    assert sent["fallbacks"] == "default"
    assert sent["system"] == "sys"
    assert sent["messages"] == [{"role": "user", "content": "user text"}]
    fmt = sent["output_config"]["format"]
    assert fmt["type"] == "json_schema"
    assert fmt["schema"] == ar.FINDINGS_SCHEMA
    assert sent["output_config"]["effort"] == ar.ANTHROPIC_EFFORT


@pytest.mark.parametrize("stop", ["max_tokens", "refusal"])
def test_call_model_anthropic_unusable_stop_reason_raises(monkeypatch, stop):
    sse = (
        'data: {"type": "content_block_delta", "delta": '
        '{"type": "text_delta", "text": "{\\"findings\\": []"}}\n\n'
        'data: {"type": "message_delta", "delta": {"stop_reason": "%s"}}\n\n' % stop
    )
    _stub_urlopen(monkeypatch, [sse.encode()])
    with pytest.raises(RuntimeError):
        ar.call_model("anthropic", "k", "claude-opus-5", "sys", "user")


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
    # A file that PREDATES the branch, so its diff hunk shows only a few lines
    # while the whole file holds much more. SENTINEL sits far from the edited
    # line, which makes it a witness for "the confirmation pass read the file,
    # not the chunk" — a diff can never contain it.
    lines = [f"line {i}\n" for i in range(1, 61)]
    lines[4] = "SENTINEL_ONLY_IN_THE_WHOLE_FILE\n"
    (tmp_path / "context.txt").write_text("".join(lines))
    git("add", "-A")
    git("commit", "-qm", "base")
    root = rev("HEAD")

    git("checkout", "-q", "-b", "feature")
    (tmp_path / "feature.txt").write_text("feature change\n")
    lines[54] = "line 55 edited on the feature branch\n"
    (tmp_path / "context.txt").write_text("".join(lines))
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
        def fake(provider, key, model, system, user, schema=None):
            value = reply(user) if callable(reply) else reply
            if isinstance(value, Exception):
                raise value
            return value

        monkeypatch.setattr(ar, "call_model", fake)

    return install


def _confirming(review_reply, verdict, reason="because"):
    """Reply router: `review_reply` for lens calls, `verdict` for confirmations.

    `verdict` is True/False for a clean verdict, an Exception to raise, or a
    raw string to return unparsed.
    """
    def reply(user):
        if ar.CONFIRM_MARKER not in user:
            return review_reply
        if isinstance(verdict, (Exception, str)):
            return verdict
        return json.dumps({"confirmed": verdict, "reason": reason})

    return reply


def _high(file="context.txt", severity="high", title="t"):
    return json.dumps(
        {
            "findings": [
                {
                    "severity": severity,
                    "file": file,
                    "line": "55",
                    "title": title,
                    "detail": "d",
                }
            ]
        }
    )


def test_clean_diff_passes(gate):
    gate('{"findings": []}')
    assert ar.main() == 0


def test_high_finding_blocks(gate):
    gate('{"findings": [{"severity": "high", "file": "a", "title": "t", "detail": "d"}]}')
    assert ar.main() == 1


def test_low_finding_passes(gate):
    gate('{"findings": [{"severity": "low", "file": "a", "title": "t", "detail": "d"}]}')
    assert ar.main() == 0


@pytest.mark.parametrize(
    "severity",
    ["critical", "blocker", "HIGH ", "major", "urgent", "very high", "P0",
     "severity: high"],
)
def test_blocking_severity_aliases_at_the_exit_code(gate, severity):
    """Every one of these exited 0 at some point in this PR's history while a
    finding was on the table. The exit code is the gate, so assert there."""
    gate(json.dumps({"findings": [{"severity": severity, "file": "a", "title": "t"}]}))
    assert ar.main() == 1, severity


@pytest.mark.parametrize("severity", ["spicy", "bug", "low (non-blocking)"])
def test_readable_but_non_blocking_severities_pass_at_the_exit_code(gate, severity):
    """The carve-out, asserted where it counts. A word we do not recognise is
    not a reason to block every merge in the repo — it is logged as a
    ::warning:: and the run stays green."""
    gate(json.dumps({"findings": [{"severity": severity, "file": "a", "title": "t"}]}))
    assert ar.main() == 0, severity


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


def test_error_path_does_not_claim_the_lenses_read_the_diff(gate, monkeypatch):
    """The comment said the diff was NOT fully reviewed and then, two lines
    later, that "every lens read 100% of that diff". A false forensic record on
    the one red an operator most needs to trust. Chunk coverage and review
    coverage are different claims."""
    posted = []
    monkeypatch.setattr(ar, "post_sticky_comment", posted.append)
    gate(RuntimeError("boom"))
    assert ar.main() == 1
    assert "every lens read 100%" not in posted[0]
    assert "0 chars dropped by chunking" in posted[0]


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


# ------------------------------------------------------- lens calibration
#
# The gate's first real block was mechanically correct and over-graded: a
# dev-server-only Vite `server.fs.allow` widening on a PUBLIC repo, called
# HIGH. Two causes, asserted here so neither can be quietly reverted — the
# security lens had no threat model, and "severity" was never defined.


def test_security_lens_carries_a_threat_model():
    """One sentence of "find injection, SSRF, missing authz" with no system
    description grades against a generic multi-tenant web service, because
    that is what those words describe. The lens has to know what ships."""
    lens = ar.LENSES["security"].lower()
    assert "public" in lens and "open source" in lens
    assert "tauri" in lens and "static" in lens
    assert "authorization" in lens  # no server-side authz layer to bypass
    assert "multi-tenant" in lens
    assert "never ship" in lens  # dev server / tests / CI
    assert "server.*" in ar.LENSES["security"]


def test_security_lens_is_not_shorter_than_the_correctness_calibration():
    """The asymmetry WAS the bug: three paragraphs of "do NOT report" guidance
    on correctness, one sentence on security."""
    assert len(ar.LENSES["security"]) > len(ar.LENSES["correctness"])


def test_severity_ladder_defines_every_level():
    ladder = ar.SEVERITY_LADDER
    for level in ("HIGH", "MEDIUM", "LOW"):
        assert f"* {level} —" in ladder, level


def test_severity_ladder_grades_impact_not_confidence():
    """The old guidance ("reserve it for real, confident defects") calibrated
    CONFIDENCE. A reviewer certain about a harmless fact reads that as licence
    to block — which is precisely what happened."""
    ladder = ar.SEVERITY_LADDER
    assert "IMPACT and REACHABILITY" in ladder
    assert "how confident you are" in ladder
    assert "confident defects" not in ar.SCHEMA_HINT


def test_severity_ladder_carries_both_worked_examples():
    """Same reachability, different grade — that contrast is the whole lesson,
    and an abstract definition does not teach it."""
    ladder = ar.SEVERITY_LADDER
    assert ".jks" in ladder and "KEYSTORE" in ladder  # the real TRUE high
    assert "server.fs.allow" in ladder  # the real over-grade, called LOW
    assert "TRUE HIGH" in ladder and "NOT HIGH" in ladder


def test_reviewers_are_told_high_needs_a_reachable_actor():
    ladder = ar.SEVERITY_LADDER.lower()
    assert "not the developer at their own machine" in ladder
    assert "name a specific actor and a specific consequence" in ladder


def test_the_ladder_reaches_every_lens(gate, monkeypatch):
    """A ladder only the security lens sees would leave correctness and
    pack-compat grading on the old confidence rule."""
    seen = []
    gate(lambda user: seen.append(user) or '{"findings": []}')
    assert ar.main() == 0
    lenses = {name for name in ar.LENSES}
    assert len(seen) >= len(lenses)
    assert all(ar.SEVERITY_LADDER in u for u in seen)


# ------------------------------------------------------------ model allow-list


def test_default_models_are_in_the_allow_list():
    for provider, default in ar.DEFAULT_MODEL.items():
        assert default in ar.ALLOWED_MODELS[provider], provider


def test_model_override_outside_the_allow_list_is_an_error(monkeypatch):
    """ADVERSARIAL_MODEL was a repo variable that could silently downgrade all
    three lenses forever, with no PR and no audit trail."""
    monkeypatch.setenv("ADVERSARIAL_MODEL", "gpt-3.5-turbo")
    with pytest.raises(ar.ReviewError):
        ar.resolve_model("openai")


def test_model_override_outside_the_allow_list_blocks_at_the_exit_code(
    gate, monkeypatch
):
    gate('{"findings": []}')
    monkeypatch.setenv("ADVERSARIAL_MODEL", "something-cheap")
    assert ar.main() == 1


def test_an_unrecognized_model_is_not_silently_replaced_by_the_default(monkeypatch):
    """Falling back to the default would make a downgraded ADVERSARIAL_MODEL
    indistinguishable from an unset one in the logs."""
    monkeypatch.setenv("ADVERSARIAL_MODEL", "claude-tiny")
    with pytest.raises(ar.ReviewError) as e:
        ar.resolve_model("anthropic")
    assert "allow-list" in str(e.value)


def test_allowed_override_is_used(monkeypatch):
    for provider, allowed in ar.ALLOWED_MODELS.items():
        for model in sorted(allowed):
            monkeypatch.setenv("ADVERSARIAL_MODEL", model)
            assert ar.resolve_model(provider) == model, (provider, model)


def test_the_allow_list_holds_only_ids_this_gate_has_run():
    """The allow-list's whole value is that a listed id is SAFE to select. An
    id nobody has run against this exact request shape is one repo-variable
    edit from a 400, which is a lens error, which is a repo-wide block — the
    outcome the list exists to prevent.

    ADVERSARIAL_MODEL has never been set, so the only id each provider has
    actually run is its default. Widening the set means running the candidate
    first and then changing this test on purpose."""
    for provider, allowed in ar.ALLOWED_MODELS.items():
        assert allowed == {ar.DEFAULT_MODEL[provider]}, provider


def test_unset_or_blank_override_uses_the_default(monkeypatch):
    monkeypatch.delenv("ADVERSARIAL_MODEL", raising=False)
    assert ar.resolve_model("anthropic") == ar.DEFAULT_MODEL["anthropic"]
    monkeypatch.setenv("ADVERSARIAL_MODEL", "   ")
    assert ar.resolve_model("anthropic") == ar.DEFAULT_MODEL["anthropic"]


# --------------------------------------------------------- confirmation pass


def test_parse_confirmation_reads_a_verdict():
    assert ar.parse_confirmation('{"confirmed": true, "reason": "r"}') == (True, "r")
    assert ar.parse_confirmation('{"confirmed": false, "reason": "r"}') == (False, "r")
    assert ar.parse_confirmation('prose {"confirmed": false, "reason": "r"} tail') == (
        False,
        "r",
    )


@pytest.mark.parametrize(
    "reply",
    [
        "",
        "   ",
        "I think it is fine.",
        '{"ok": true}',
        '{"confirmed": "false"}',  # string, not bool
        '{"confirmed": 0}',  # falsy int, not bool
        '{"confirmed": null}',
        '{"confirmed": fal',  # truncated
    ],
)
def test_unreadable_verdicts_are_none(reply):
    """None must never read as "cleared" — the caller turns it into a blocking
    confirmation error. A string "false" clearing a real HIGH is the exact
    fail-open this guards."""
    assert ar.parse_confirmation(reply) is None


def _count_confirmations(gate, review_reply, verdict):
    """Drive main() and return (exit_code, number of confirmation calls made).

    The call count is what keeps the fail-closed tests below honest: "blocked"
    is also what a gate with no confirmation pass at all returns, so asserting
    only the exit code would pass for the wrong reason.
    """
    inner = _confirming(review_reply, verdict)
    calls = {"n": 0}

    def reply(user):
        if ar.CONFIRM_MARKER in user:
            calls["n"] += 1
        return inner(user)

    gate(reply)
    return ar.main(), calls["n"]


def test_confirmed_high_blocks(gate):
    # ONE confirmation, not one per lens: all three report the same defect at
    # the same location, so it is one question and one whole-file call.
    code, confirmations = _count_confirmations(gate, _high(), True)
    assert (code, confirmations) == (1, 1)


def test_one_defect_costs_one_confirmation_and_the_verdict_fans_out(gate, monkeypatch):
    """dedupe() keys on the lens, so a defect all three lenses notice survives
    as three findings. Confirming each separately spent three whole-file calls
    — from a budget of 20 — asking one question three times."""
    posted = []
    monkeypatch.setattr(ar, "post_sticky_comment", posted.append)
    code, confirmations = _count_confirmations(gate, _high(title="one defect"), False)
    assert (code, confirmations) == (0, 1)
    # The single verdict reached every lens's copy of the finding.
    assert posted[0].count("one defect") == len(ar.LENSES)
    assert posted[0].count("cleared: because") == len(ar.LENSES)


def test_unconfirmed_high_does_not_block(gate):
    """The whole point: a HIGH the second pass rejects stops wedging the queue."""
    gate(_confirming(_high(), False))
    assert ar.main() == 0


def test_unconfirmed_high_is_still_reported(gate, monkeypatch):
    """Cleared is not deleted. If the second pass could make findings vanish
    silently, it would be a place for real defects to disappear."""
    posted = []
    monkeypatch.setattr(ar, "post_sticky_comment", posted.append)
    gate(_confirming(_high(title="dev server serves the keystore"), False, "dev only"))
    assert ar.main() == 0
    assert "dev server serves the keystore" in posted[0]
    assert "cleared" in posted[0].lower()
    assert "dev only" in posted[0]


def test_cleared_finding_is_logged_as_a_warning(gate, capsys):
    gate(_confirming(_high(), False))
    assert ar.main() == 0
    assert "cleared" in capsys.readouterr().out


def test_confirmation_error_blocks(gate):
    """FAIL CLOSED. If an API error could delete a blocking finding, a flaky
    provider becomes a way to merge anything. The call-count assertion proves
    the confirmation actually ran and errored, rather than never happening."""
    code, confirmations = _count_confirmations(gate, _high(), RuntimeError("HTTP 500"))
    assert (code, confirmations) == (1, 1)


def test_confirmation_unparseable_reply_blocks(gate):
    code, confirmations = _count_confirmations(gate, _high(), "looks fine to me")
    assert (code, confirmations) == (1, 1)


def test_confirmation_reads_the_whole_file_not_the_diff_chunk(gate):
    """The measured failure mode was ONE context-poor call. Confirming against
    the same chunk that produced the finding would be ceremonial."""
    prompts = []

    def reply(user):
        prompts.append(user)
        if ar.CONFIRM_MARKER not in user:
            return _high()
        return '{"confirmed": false, "reason": "r"}'

    gate(reply)
    assert ar.main() == 0
    confirms = [p for p in prompts if ar.CONFIRM_MARKER in p]
    assert len(confirms) == 1
    # Present in the file at head, and impossible for any diff hunk to contain.
    assert all("SENTINEL_ONLY_IN_THE_WHOLE_FILE" in p for p in confirms)
    reviews = [p for p in prompts if ar.CONFIRM_MARKER not in p]
    assert not any("SENTINEL_ONLY_IN_THE_WHOLE_FILE" in p for p in reviews)


def test_confirmation_also_carries_the_change_not_only_head_state(gate):
    """Head state alone cannot answer a finding about a REMOVAL: the removed
    line is not in the file, and the honest reading of its absence is "no such
    code, not a blocking problem" — a clearance, and a wrong one. The stub
    below stands in for that honest confirmer: it upholds the finding only if
    the prompt actually shows the deletion."""
    prompts = []

    def reply(user):
        prompts.append(user)
        if ar.CONFIRM_MARKER not in user:
            return _high(title="the change deleted `line 55`")
        removed = "\n-line 55\n" in user
        return json.dumps({"confirmed": removed, "reason": "read the diff"})

    gate(reply)
    assert ar.main() == 1  # the deletion was visible, so the HIGH stood
    confirm = next(p for p in prompts if ar.CONFIRM_MARKER in p)
    assert "```diff" in confirm
    assert "\n-line 55\n" in confirm  # what the branch removed
    assert "\n+line 55 edited on the feature branch\n" in confirm  # ...and added
    assert "SENTINEL_ONLY_IN_THE_WHOLE_FILE" in confirm  # ...plus the whole file


def test_a_high_on_a_file_outside_the_reviewed_diff_is_never_confirmed(gate):
    """`base.txt` predates the branch and the reviewed range does not touch it.
    Confirming a finding against it would put the second pass in unrelated,
    pre-existing code — where "no, not a blocking problem introduced here" is
    the correct answer and a clearance is the wrong outcome. A mis-attributed
    path is a routine model error, so the least reliable field in the finding
    must not be able to select what the only un-blocking mechanism reads."""
    prompts = []

    def reply(user):
        prompts.append(user)
        if ar.CONFIRM_MARKER not in user:
            return _high(file="base.txt")
        return '{"confirmed": false, "reason": "nothing wrong in this file"}'

    gate(reply)
    assert ar.main() == 1
    assert not any(ar.CONFIRM_MARKER in p for p in prompts)


@pytest.mark.parametrize("spelling", ["context.txt", "b/context.txt", "./context.txt"])
def test_a_prefixed_path_is_still_recognised_as_part_of_the_diff(gate, spelling):
    """The off-diff check must not turn every model spelling of a real path
    into a skip. `git diff --name-only` prints `context.txt`; the finding may
    say `b/context.txt` or `./context.txt`, and `git show` accepts both."""
    prompts = []

    def reply(user):
        prompts.append(user)
        if ar.CONFIRM_MARKER not in user:
            return _high(file=spelling)
        return '{"confirmed": false, "reason": "r"}'

    gate(reply)
    assert ar.main() == 0, spelling
    assert sum(ar.CONFIRM_MARKER in p for p in prompts) == 1, spelling


def test_an_off_diff_finding_says_why_it_was_not_re_checked(gate, monkeypatch):
    """"not re-checked" must not read as a provider outage."""
    posted = []
    monkeypatch.setattr(ar, "post_sticky_comment", posted.append)
    gate(_confirming(_high(file="base.txt"), False))
    assert ar.main() == 1
    assert "not in the reviewed diff" in posted[0]


def test_an_exhausted_budget_is_reported_as_such_not_as_an_api_failure(
    gate, monkeypatch
):
    """The lens pass spends from the same wall clock. When it has spent all of
    it, every remaining confirmation would fail one at a time and render as
    "confirmation call failed", which reads as the provider being down."""
    posted = []
    monkeypatch.setattr(ar, "post_sticky_comment", posted.append)
    monkeypatch.setattr(ar, "_time_left", lambda: 0.0)
    prompts = []

    def reply(user):
        prompts.append(user)
        return _high()

    gate(reply)
    assert ar.main() == 1
    assert not any(ar.CONFIRM_MARKER in p for p in prompts)
    assert "budget exhausted" in posted[0]


def test_a_high_on_an_unreadable_file_blocks_without_a_second_pass(gate):
    """No full-file context means no confirmation, and no confirmation means
    the finding stands."""
    prompts = []

    def reply(user):
        prompts.append(user)
        return _high(file="does/not/exist.ts")

    gate(reply)
    assert ar.main() == 1
    assert not any(ar.CONFIRM_MARKER in p for p in prompts)


def test_unreadable_severity_blocks_without_a_second_pass(gate):
    """An omitted severity is unreadable INPUT, not a graded judgment — there
    is nothing for the second pass to re-check, and it must not be a way in."""
    prompts = []

    def reply(user):
        prompts.append(user)
        if ar.CONFIRM_MARKER in user:
            return '{"confirmed": false, "reason": "r"}'
        return '{"findings": [{"file": "context.txt", "title": "t", "detail": "d"}]}'

    gate(reply)
    assert ar.main() == 1
    assert not any(ar.CONFIRM_MARKER in p for p in prompts)


@pytest.mark.parametrize("severity", ["medium", "low", "spicy"])
def test_non_blocking_findings_are_never_confirmed(gate, severity):
    """Cost guard: the second pass runs on HIGH only, so a clean or merely
    noisy diff pays nothing for it."""
    prompts = []

    def reply(user):
        prompts.append(user)
        return _high(severity=severity)

    gate(reply)
    assert ar.main() == 0
    assert not any(ar.CONFIRM_MARKER in p for p in prompts)


def test_clean_diff_makes_no_confirmation_calls(gate):
    prompts = []
    gate(lambda user: prompts.append(user) or '{"findings": []}')
    assert ar.main() == 0
    assert not any(ar.CONFIRM_MARKER in p for p in prompts)


def test_confirmation_prompt_carries_the_ladder_and_the_finding(gate):
    prompts = []

    def reply(user):
        prompts.append(user)
        if ar.CONFIRM_MARKER not in user:
            return _high(title="unique-title-here")
        return '{"confirmed": true, "reason": "r"}'

    gate(reply)
    assert ar.main() == 1
    confirm = next(p for p in prompts if ar.CONFIRM_MARKER in p)
    assert ar.SEVERITY_LADDER in confirm
    assert "unique-title-here" in confirm
    assert "context.txt:55" in confirm


def test_is_blocking_defaults_every_unknown_state_to_blocking():
    """Written as "not cleared" rather than "confirmed" on purpose: a
    confirmation state someone adds later must block, not slip through."""
    high = {"severity": "high"}
    assert ar.is_blocking(dict(high)) is True  # no confirmation recorded at all
    for state in (ar.CONFIRM_UPHELD, ar.CONFIRM_ERROR, ar.CONFIRM_SKIPPED, "novel"):
        assert ar.is_blocking({**high, "confirmation": state}) is True, state
    assert ar.is_blocking({**high, "confirmation": ar.CONFIRM_CLEARED}) is False
    assert ar.is_blocking({"severity": "low", "confirmation": ar.CONFIRM_UPHELD}) is False


def test_confirmation_is_bounded(gate):
    """A run cannot spend unbounded calls, and the overflow stays blocking."""
    many = json.dumps(
        {
            "findings": [
                {
                    "severity": "high",
                    "file": "context.txt",
                    "line": str(i),
                    "title": f"t{i}",
                    "detail": "d",
                }
                for i in range(ar.MAX_CONFIRMATIONS + 15)
            ]
        }
    )
    prompts = []

    def reply(user):
        prompts.append(user)
        if ar.CONFIRM_MARKER not in user:
            return many
        return '{"confirmed": false, "reason": "r"}'

    gate(reply)
    assert ar.main() == 1  # the overflow was never cleared
    assert sum(ar.CONFIRM_MARKER in p for p in prompts) == ar.MAX_CONFIRMATIONS


def test_file_at_resolves_a_diff_prefixed_path(repo):
    for spelling in ("context.txt", "b/context.txt", "./context.txt"):
        at_head = ar.file_at(repo["head"], spelling)
        assert "SENTINEL" in at_head.text, spelling
        # The path git ACCEPTED, not the one the model wrote — the caller tests
        # membership of the reviewed diff against this, and `b/context.txt` is
        # not a path git ever reports as changed.
        assert at_head.path == "context.txt", spelling


@pytest.mark.parametrize("path", ["", "   ", "?", "<unknown>", "no/such/file.ts", None])
def test_file_at_returns_none_rather_than_guessing(repo, path):
    assert ar.file_at(repo["head"], path) is None


def test_oversized_context_is_not_confirmed_against_a_truncated_view(gate, monkeypatch):
    """Truncation is what the first pass already suffered from. "Confirmed
    against half the context" is a worse answer than "not checked"."""
    monkeypatch.setattr(ar, "CONFIRM_MAX_CONTEXT_CHARS", 10)
    prompts = []

    def reply(user):
        prompts.append(user)
        if ar.CONFIRM_MARKER not in user:
            return _high()
        return '{"confirmed": false, "reason": "r"}'

    gate(reply)
    assert ar.main() == 1
    assert not any(ar.CONFIRM_MARKER in p for p in prompts)


# -------------------------------------------------------------- no waivers


def test_there_is_no_waiver_mechanism():
    """DELIBERATE, and asserted so nobody adds one later: agents author both
    the diff and the PR body here, so a waiver is the reviewed party silencing
    the reviewer."""
    src = Path(ar.__file__).read_text()
    assert "no waiver" in src.lower()  # the decision is recorded in the script
    for escape_hatch in (
        "PR_BODY",
        "pull_request.body",
        "skip-adversarial",
        "adversarial-skip",
        "ALLOW_HIGH",
        "OVERRIDE",
        "noqa: adversarial",
    ):
        assert escape_hatch not in src, escape_hatch
