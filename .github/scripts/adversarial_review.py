#!/usr/bin/env python3
"""Adversarial PR review — the machine gatekeeper that replaces the human.

Runs three independent adversarial lenses (correctness, security, pack-compat)
over a PR diff, posts a single sticky findings comment, and exits non-zero iff
there is a blocking-severity finding OR the review could not be completed.

FAIL CLOSED is the contract. This script is the `adversarial-review` required
status check, so a green exit must mean "every lens actually read 100% of the
diff and found nothing blocking". Anything else exits non-zero: a git failure,
a malformed SHA, a lens API error, a model reply we cannot parse, or a diff we
could not fully cover.

Large diffs are CHUNKED, never truncated. The diff is split on `diff --git`
boundaries into budget-sized chunks, every lens runs over every chunk, and the
findings are unioned. Coverage is asserted programmatically — the concatenated
chunks must equal the diff exactly — before a single model call is made.

Provider-agnostic: prefers Anthropic if ANTHROPIC_API_KEY is set, otherwise uses
the repo's existing OPENAI_KEY (the same secret pr-agent already uses — no new
secret to add). Self-contained: stdlib only (urllib), so CI needs no pip install.

Env:
  ANTHROPIC_API_KEY   if set → review via Claude (preferred)
  OPENAI_KEY / OPENAI_API_KEY   fallback → review via OpenAI
  ADVERSARIAL_MODEL   model id override (default per provider)
  GITHUB_TOKEN        for posting the sticky PR comment (optional in merge_group)
  GITHUB_REPOSITORY   owner/repo (set by Actions)
  PR_NUMBER           PR number (empty in merge_group → comment skipped)
  BASE_SHA, HEAD_SHA  diff range
  MAX_CHUNK_CHARS     per-chunk character budget (default 200000)
  ADVERSARIAL_WORKERS concurrent model calls (default 4)
"""

import json
import os
import random
import re
import subprocess
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor
from typing import NamedTuple

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
OPENAI_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = {"anthropic": "claude-opus-5", "openai": "gpt-4.1"}
MARKER = "<!-- adversarial-review -->"

# `max_tokens` on current Claude models caps thinking + visible response
# together. The old value of 2000 silently truncated the JSON mid-object, which
# parsed as "no findings" and passed the gate. 16000 is the non-streaming
# ceiling (much above this the API wants a streaming request).
ANTHROPIC_MAX_TOKENS = 16000

# Chunk budget in CHARACTERS. The old name (MAX_DIFF_BYTES) lied: it was
# compared against len() of a str, which counts characters, not bytes.
DEFAULT_CHUNK_CHARS = 200000
MIN_CHUNK_CHARS = 4000  # guards against a config that would never terminate

REQUEST_TIMEOUT_S = 120
REQUEST_ATTEMPTS = 3
RETRY_BACKOFF_S = 2
RETRY_STATUS = {408, 409, 429, 500, 502, 503, 504}

# Severity strings that block the merge, after normalization.
BLOCKING_ALIASES = {"critical", "blocker", "block", "severe", "fatal"}
MEDIUM_ALIASES = {"medium", "med", "moderate", "warning", "warn"}
LOW_ALIASES = {"low", "minor", "info", "informational", "nit", "nitpick", "trivial"}


def provider_and_key():
    """Pick the review provider. Anthropic if its key is set, else OpenAI."""
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "anthropic", os.environ["ANTHROPIC_API_KEY"]
    key = os.environ.get("OPENAI_KEY") or os.environ.get("OPENAI_API_KEY")
    if key:
        return "openai", key
    return None, None


LENSES = {
    "correctness": (
        "You are a correctness reviewer. Find logic bugs, broken edge cases, "
        "incorrect control flow, off-by-one errors, and changes that break "
        "existing behavior. Ignore style. "
        "Browser/Node JavaScript and TypeScript run on a single-threaded event "
        "loop: synchronous code between two await/callback boundaries cannot be "
        "interrupted, so do NOT report data races, re-entrancy, or "
        "'two events on the same frame/tick' hazards for synchronous handlers — "
        "those are not possible without real concurrency (Workers/threads/shared "
        "memory). Only flag a true async-interleaving bug if there is an actual "
        "await/Promise/timer boundary in the middle of the operation. If the diff "
        "already adds a guard that makes the alleged bug impossible (e.g. an "
        "early-return flag cleared synchronously at entry, or a clamp), treat the "
        "concern as resolved and do NOT re-raise it."
    ),
    "security": (
        "You are a security reviewer. Find injection, secret/credential exposure, "
        "unsafe deserialization, path traversal, SSRF, missing authz, and unsafe "
        "handling of untrusted input introduced by this diff."
    ),
    "pack-compat": (
        "You are a content-pack back-compat reviewer for the Corpán app. Find "
        "changes that could break already-installed app versions (currently "
        "0.19.2): catalog entries that drop or raise version/platform floors "
        "without a compat route, changed published voiceIds, manifest schema "
        "breaks, or removed pack URLs. Reuse of minAppVersion/maxAppVersion/"
        "platforms routing is expected; flag only real regressions."
    ),
}

SCHEMA_HINT = (
    'Respond with ONLY a JSON object, no prose, of the form:\n'
    '{"findings": [{"severity": "high|medium|low", "file": "path", '
    '"line": "n or range or null", "title": "short", '
    '"detail": "why it is a problem and how to fix"}]}\n'
    "Return an empty findings array if you find nothing. Be precise; do not "
    "invent issues. Only HIGH severity blocks the merge, so reserve it for real, "
    "confident defects."
)

# Chunked reviews see one slice of the diff at a time. Without this, a lens
# reports "this helper is never defined" for a definition that lives in another
# chunk — a false HIGH that would wedge the merge queue.
CHUNK_HINT = (
    "This is chunk {i} of {n} from a larger diff; the other chunks contain "
    "different files and hunks and are reviewed separately. Judge only what is "
    "visible here. Do NOT report a finding merely because a definition, caller, "
    "import, test, or migration appears to be missing — it is very likely in "
    "another chunk. Report unresolved symbols only if the diff itself deletes "
    "or renames them."
)

# Mirrors SCHEMA_HINT. Anthropic structured outputs require additionalProperties
# false on every object and every property listed in `required`.
FINDINGS_SCHEMA = {
    "type": "object",
    "properties": {
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "severity": {"type": "string", "enum": ["high", "medium", "low"]},
                    "file": {"type": "string"},
                    "line": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                    "title": {"type": "string"},
                    "detail": {"type": "string"},
                },
                "required": ["severity", "file", "line", "title", "detail"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["findings"],
    "additionalProperties": False,
}


class ReviewError(Exception):
    """Anything that makes a green verdict unsafe. Always exits non-zero."""


# ---------------------------------------------------------------- git plumbing


def run(cmd):
    """Run a command, returning (returncode, stdout, stderr).

    The old helper returned stdout only and discarded the return code, so a
    failed `git diff` produced an empty string that the caller read as
    "empty diff; nothing to review" and passed the gate.
    """
    # errors="replace": a stray non-UTF-8 byte in a diff must not crash the gate.
    p = subprocess.run(cmd, capture_output=True, text=True, errors="replace")
    return p.returncode, p.stdout, p.stderr


_SHA_RE = re.compile(r"^[0-9a-fA-F]{7,40}$")


def _commit_exists(rev):
    rc, _, _ = run(["git", "cat-file", "-e", f"{rev}^{{commit}}"])
    return rc == 0


def _check_sha(name, value):
    """Validate a caller-supplied SHA.

    Malformed input is an error, never a silent substitution — substituting
    HEAD reviewed the wrong range and still reported success.
    """
    if not _SHA_RE.match(value):
        raise ReviewError(
            f"{name} is not a valid commit SHA: {value!r}. Refusing to guess a range."
        )
    if not _commit_exists(value):
        raise ReviewError(
            f"{name}={value} is not present in this checkout "
            "(is fetch-depth: 0 set on actions/checkout?)."
        )
    return value


def resolve_range():
    """Resolve the diff range, failing loudly rather than reviewing the wrong one."""
    base_raw = (os.environ.get("BASE_SHA") or "").strip()
    head_raw = (os.environ.get("HEAD_SHA") or "").strip()

    if head_raw:
        head = _check_sha("HEAD_SHA", head_raw)
    else:
        if not _commit_exists("HEAD"):
            raise ReviewError("no HEAD_SHA given and HEAD does not resolve to a commit.")
        head = "HEAD"

    if base_raw:
        base = _check_sha("BASE_SHA", base_raw)
    else:
        # workflow_dispatch and other no-base events: review the head commit.
        rc, out, err = run(["git", "rev-parse", f"{head}^"])
        if rc != 0 or not out.strip():
            raise ReviewError(
                f"BASE_SHA unset and could not resolve {head}^: "
                f"{err.strip() or 'no parent commit'}"
            )
        base = out.strip()
    return f"{base}..{head}"


def get_diff(rng):
    """Return the full diff for `rng`. Never truncates; raises on git failure."""
    rc, diff, err = run(["git", "diff", "--unified=3", rng])
    if rc != 0:
        raise ReviewError(f"git diff {rng} failed (exit {rc}): {err.strip()}")

    if not diff.strip():
        # An empty diff is only a pass if the range is GENUINELY empty. Assert
        # that with an independent query rather than trusting one empty stdout.
        rc2, names, err2 = run(["git", "diff", "--name-only", rng])
        if rc2 != 0:
            raise ReviewError(
                f"git diff --name-only {rng} failed (exit {rc2}): {err2.strip()}"
            )
        if names.strip():
            raise ReviewError(
                f"git reported changed files for {rng} but produced an empty diff; "
                "refusing to pass a review that read nothing."
            )
    return diff


# ------------------------------------------------------------------- chunking

_FILE_START_RE = re.compile(r"^diff --git ", re.M)


def split_into_files(diff):
    """Split a unified diff into per-file segments.

    Guarantee: "".join(split_into_files(d)) == d.
    """
    if not diff:
        return []
    starts = [m.start() for m in _FILE_START_RE.finditer(diff)]
    if not starts:
        return [diff]
    segments = []
    if starts[0] > 0:
        segments.append(diff[: starts[0]])
    for i, start in enumerate(starts):
        end = starts[i + 1] if i + 1 < len(starts) else len(diff)
        segments.append(diff[start:end])
    return segments


def _segment_path(segment):
    m = re.match(r"diff --git a/(\S+)", segment)
    return m.group(1) if m else "<unknown>"


class Chunk(NamedTuple):
    """One unit of review.

    `text` is raw diff content and is what the coverage assertion sums over.
    `context` is a synthetic prefix shown to the model only — it re-establishes
    the file a continuation piece belongs to and is deliberately NOT part of the
    coverage arithmetic.
    """

    text: str
    context: str = ""

    def prompt(self):
        return self.context + self.text


_HUNK_RE = re.compile(r"^@@ ", re.M)


def _split_on_lines(text, budget):
    """Partition text into <=budget pieces, breaking at line boundaries.

    A single line longer than the budget (a minified bundle, say) is still hard
    split — there is no smaller boundary to use.

    Guarantee: "".join(result) == text.
    """
    pieces, current = [], ""
    for line in text.splitlines(keepends=True):
        if len(line) > budget:
            if current:
                pieces.append(current)
                current = ""
            for i in range(0, len(line), budget):
                pieces.append(line[i : i + budget])
            continue
        if current and len(current) + len(line) > budget:
            pieces.append(current)
            current = ""
        current += line
    if current:
        pieces.append(current)
    return pieces


def _split_file_segment(segment, budget):
    """Split one oversized file diff at hunk boundaries, then line boundaries.

    Guarantee: "".join(result) == segment.
    """
    starts = [m.start() for m in _HUNK_RE.finditer(segment)]
    if starts:
        blocks = [segment[: starts[0]]] if starts[0] > 0 else []
        for i, start in enumerate(starts):
            end = starts[i + 1] if i + 1 < len(starts) else len(segment)
            blocks.append(segment[start:end])
    else:
        blocks = [segment]

    atoms = []
    for block in blocks:
        atoms.extend([block] if len(block) <= budget else _split_on_lines(block, budget))

    pieces, current = [], ""
    for atom in atoms:
        if current and len(current) + len(atom) > budget:
            pieces.append(current)
            current = ""
        current += atom
    if current:
        pieces.append(current)
    return pieces


def chunk_diff(diff, budget):
    """Pack per-file segments into chunks of at most `budget` characters.

    Returns (chunks, oversized_files).

    A single file larger than the budget is SPLIT rather than truncated or
    rejected. Truncating would silently drop review coverage (the exact bug this
    change exists to fix), and rejecting would block legitimate large-file PRs —
    generated files, lockfiles, vendored sources — on day one.

    Splits land on hunk boundaries where possible and line boundaries otherwise,
    so a chunk never starts mid-line, and every continuation piece carries a
    synthetic `context` naming the file it belongs to. Those two properties keep
    a split file reviewable: without them the model cannot attribute hunks to a
    path and invents findings from the missing context.

    Guarantee: "".join(c.text for c in chunks) == diff, for budget >= MIN_CHUNK_CHARS.
    """
    if budget < MIN_CHUNK_CHARS:
        raise ReviewError(
            f"chunk budget {budget} is below the minimum {MIN_CHUNK_CHARS}."
        )

    chunks, oversized, current = [], [], ""
    for segment in split_into_files(diff):
        if len(segment) > budget:
            if current:
                chunks.append(Chunk(current))
                current = ""
            path = _segment_path(segment)
            oversized.append(path)
            pieces = _split_file_segment(segment, budget)
            for n, piece in enumerate(pieces, start=1):
                context = (
                    ""
                    if n == 1
                    else (
                        f"# Continuation of the unified diff for `{path}` "
                        f"(part {n} of {len(pieces)}). The `diff --git` header and "
                        f"earlier hunks for this file are in previous chunks; every "
                        f"line below belongs to this file.\n"
                    )
                )
                chunks.append(Chunk(piece, context))
            continue
        if current and len(current) + len(segment) > budget:
            chunks.append(Chunk(current))
            current = ""
        current += segment
    if current:
        chunks.append(Chunk(current))
    return chunks, oversized


# ------------------------------------------------------------------ model I/O


def _post(url, headers, payload):
    """POST JSON with bounded retries on transient failures.

    Retries matter for fail-closed correctness: without them a single 429 from a
    concurrent burst becomes a lens error, and a lens error now blocks the merge.
    """
    body = json.dumps(payload).encode()
    last = None
    for attempt in range(REQUEST_ATTEMPTS):
        try:
            req = urllib.request.Request(url, data=body, method="POST", headers=headers)
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_S) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            try:
                detail = e.read()[:300]
            except Exception:  # noqa: BLE001
                detail = b""
            last = RuntimeError(f"HTTP {e.code}: {detail!r}")
            if e.code not in RETRY_STATUS:
                raise last from e
        except Exception as e:  # noqa: BLE001
            last = e
        if attempt + 1 < REQUEST_ATTEMPTS:
            time.sleep(RETRY_BACKOFF_S * (2**attempt) + random.uniform(0, 1))
    raise last


def call_model(provider, key, model, system, user):
    if provider == "anthropic":
        data = _post(
            ANTHROPIC_URL,
            {
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            {
                "model": model,
                "max_tokens": ANTHROPIC_MAX_TOKENS,
                # Adaptive thinking is the current on-mode; a fixed thinking
                # budget (budget_tokens) is rejected by current models.
                "thinking": {"type": "adaptive"},
                # `format` gives the same guaranteed-JSON contract the OpenAI
                # branch gets from response_format, but schema-checked.
                "output_config": {
                    "effort": "high",
                    "format": {"type": "json_schema", "schema": FINDINGS_SCHEMA},
                },
                "system": system,
                "messages": [{"role": "user", "content": user}],
            },
        )
        stop = data.get("stop_reason")
        if stop in ("max_tokens", "refusal"):
            # Either one means the JSON is absent or incomplete. Raising makes
            # it a lens error rather than a silent "no findings".
            raise RuntimeError(f"anthropic response unusable (stop_reason={stop})")
        return "".join(
            b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"
        )

    # openai
    data = _post(
        OPENAI_URL,
        {"authorization": f"Bearer {key}", "content-type": "application/json"},
        {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "response_format": {"type": "json_object"},
        },
    )
    choice = (data.get("choices") or [{}])[0]
    if choice.get("finish_reason") == "length":
        raise RuntimeError("openai response truncated (finish_reason=length)")
    content = (choice.get("message") or {}).get("content")
    if content is None:
        raise RuntimeError("openai response contained no message content")
    return content


def parse_findings(text):
    """Return a list of finding dicts, or None if there is no well-formed
    findings object.

    None is the important half: "the model produced nothing we can read" used to
    be indistinguishable from "the model found nothing" (both returned []), so
    an empty reply, prose, a JSON object without a findings key, and JSON cut
    off mid-object all passed the gate. None is now counted as a lens error.
    """
    if not text or not text.strip():
        return None
    for start in (i for i, c in enumerate(text) if c == "{"):
        depth = 0
        for j in range(start, len(text)):
            if text[j] == "{":
                depth += 1
            elif text[j] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        obj = json.loads(text[start : j + 1])
                    except json.JSONDecodeError:
                        break
                    if isinstance(obj, dict) and "findings" in obj:
                        raw = obj["findings"]
                        # `{"findings": null}` used to crash on iteration. Treat
                        # an explicit null as "nothing found": the key is present
                        # and says so, and failing closed here would block every
                        # clean PR from a model that spells [] as null.
                        if raw is None:
                            return []
                        if not isinstance(raw, list):
                            return None
                        if not all(isinstance(f, dict) for f in raw):
                            return None  # a finding we cannot read may be a HIGH
                        return raw
                    break
    return None


def review_chunk(provider, key, model, name, instruction, chunk, index, total):
    """Run one lens over one chunk. Returns a list of findings, or None on error."""
    label = f"{name} lens, chunk {index}/{total}"
    user = (
        f"{instruction}\n\n{CHUNK_HINT.format(i=index, n=total)}\n\n"
        f"Review this unified diff. {SCHEMA_HINT}\n\n"
        f"```diff\n{chunk.prompt()}\n```"
    )
    try:
        raw = call_model(
            provider, key, model, "You are a rigorous, adversarial code reviewer.", user
        )
    except Exception as e:  # noqa: BLE001
        print(f"::warning::{label} failed: {e}")
        return None
    findings = parse_findings(raw)
    if findings is None:
        preview = (raw or "")[:200]
        print(f"::warning::{label} returned no parseable findings object: {preview!r}")
        return None
    for f in findings:
        f["lens"] = name
        f["chunk"] = index
    return findings


# ------------------------------------------------------------------- severity


def normalize_severity(value):
    """Map a free-form severity string to high / medium / low / unknown.

    The old code compared the raw string to "high" exactly, so "critical",
    "blocker", "High severity" and "HIGH " all sailed through the gate.
    """
    cleaned = re.sub(r"[^a-z]+", " ", str(value or "").lower()).strip()
    first = cleaned.split(" ")[0] if cleaned else ""
    if first.startswith("high") or first in BLOCKING_ALIASES:
        return "high"
    if first in MEDIUM_ALIASES:
        return "medium"
    if first in LOW_ALIASES:
        return "low"
    return "unknown"


SEV_ORDER = {"high": 0, "medium": 1, "low": 2, "unknown": 3}


def dedupe(findings):
    """Collapse identical findings reported for the same location."""
    seen, out = set(), []
    for f in findings:
        key = (f.get("lens"), f.get("file"), str(f.get("line")), f.get("title"))
        if key in seen:
            continue
        seen.add(key)
        out.append(f)
    return out


# --------------------------------------------------------------------- output


def render_markdown(audit, all_findings):
    """Build the sticky comment body.

    The audit line is emitted UNCONDITIONALLY, including on clean runs — a green
    run used to record nothing at all about what had actually been reviewed.
    """
    for f in all_findings:
        f["severity_norm"] = normalize_severity(f.get("severity"))
    all_findings.sort(key=lambda f: SEV_ORDER.get(f["severity_norm"], 3))
    highs = [f for f in all_findings if f["severity_norm"] == "high"]

    lines = [MARKER, "## 🛡️ Adversarial review"]
    if not all_findings:
        lines.append(
            "\n✅ No findings across correctness / security / pack-compat lenses."
        )
    elif highs:
        lines.append("\n❌ **Blocked** — blocking-severity findings must be resolved.")
    else:
        lines.append("\n✅ **Pass** — only non-blocking findings.")
    lines.append(f"\n{audit}\n")

    icon = {"high": "🔴", "medium": "🟠", "low": "🟡", "unknown": "⚪"}
    for f in all_findings:
        sev = f["severity_norm"]
        loc = str(f.get("file", "?"))
        if f.get("line"):
            loc += f":{f['line']}"
        lines.append(
            f"- {icon.get(sev, '⚪')} **{sev.upper()}** [{f.get('lens')}] "
            f"`{loc}` — **{str(f.get('title', '')).strip()}**  \n  "
            f"{str(f.get('detail', '')).strip()}"
        )
    return "\n".join(lines), highs


def post_sticky_comment(body):
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    pr = os.environ.get("PR_NUMBER", "").strip()
    token = os.environ.get("GITHUB_TOKEN", "")
    if not (repo and pr and token):
        print("No PR context/token; skipping comment.")
        return
    base = f"https://api.github.com/repos/{repo}"
    hdr = {
        "authorization": f"Bearer {token}",
        "accept": "application/vnd.github+json",
        "content-type": "application/json",
    }

    def api(method, url, payload=None):
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode() if payload else None,
            method=method,
            headers=hdr,
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read() or "[]")

    try:
        existing = api("GET", f"{base}/issues/{pr}/comments?per_page=100")
        cid = next((c["id"] for c in existing if MARKER in (c.get("body") or "")), None)
        if cid:
            api("PATCH", f"{base}/issues/comments/{cid}", {"body": body})
        else:
            api("POST", f"{base}/issues/{pr}/comments", {"body": body})
        print("Posted sticky review comment.")
    except Exception as e:  # noqa: BLE001
        # Comment posting is cosmetic; the exit code is the gate.
        print(f"::warning::could not post comment: {e}")


def emit_summary(body):
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as fh:
            fh.write(body + "\n")


# ------------------------------------------------------------------------ main


def review(provider, key, model, chunks, workers):
    """Run every lens over every chunk. Returns (findings, errors, calls)."""
    jobs = [
        (name, instruction, chunk, i + 1, len(chunks))
        for name, instruction in LENSES.items()
        for i, chunk in enumerate(chunks)
    ]
    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        results = list(
            pool.map(
                lambda j: review_chunk(
                    provider, key, model, j[0], j[1], j[2], j[3], j[4]
                ),
                jobs,
            )
        )
    findings, errors = [], 0
    for result in results:
        if result is None:
            errors += 1
        else:
            findings += result
    return findings, errors, len(jobs)


def main():
    provider, key = provider_and_key()
    if not provider:
        print("::error::no review key set (need ANTHROPIC_API_KEY or OPENAI_KEY).")
        return 1
    model = os.environ.get("ADVERSARIAL_MODEL") or DEFAULT_MODEL[provider]

    try:
        budget = int(os.environ.get("MAX_CHUNK_CHARS") or DEFAULT_CHUNK_CHARS)
        workers = int(os.environ.get("ADVERSARIAL_WORKERS") or 4)
        rng = resolve_range()
        diff = get_diff(rng)
        chunks, oversized = chunk_diff(diff, budget)
        # Coverage is the whole point of chunking. Assert it before spending a
        # single API call, and fail closed if the split ever loses a character.
        # Note this sums .text only: synthetic continuation context is shown to
        # the model but must never count toward coverage.
        if "".join(c.text for c in chunks) != diff:
            raise ReviewError(
                "internal error: chunking did not cover the diff exactly "
                f"({sum(len(c.text) for c in chunks)} of {len(diff)} chars); "
                "failing closed."
            )
    except ReviewError as e:
        print(f"::error::{e}")
        return 1
    except ValueError as e:
        print(f"::error::invalid numeric configuration: {e}")
        return 1

    files = diff.count("diff --git ")
    audit = (
        f"_Reviewed `{rng}` — {files} file(s), {len(diff)} chars, "
        f"{len(chunks)} chunk(s) of <= {budget}, 100% covered, "
        f"0 dropped · {provider} ({model}) · {len(LENSES)} lenses._"
    )
    if oversized:
        audit += (
            f"\n\n> ⚠️ Larger than the {budget}-char chunk budget, so split "
            f"across chunks at hunk/line boundaries with the file re-identified "
            f"on each continuation: `{'`, `'.join(sorted(set(oversized)))}`. "
            "Fully reviewed; no lens sees a partial line."
        )
    print(audit)

    if not diff.strip():
        # get_diff already asserted the range is genuinely empty.
        body = "\n".join(
            [
                MARKER,
                "## 🛡️ Adversarial review",
                "",
                "✅ Empty diff — nothing to review.",
                "",
                audit,
            ]
        )
        post_sticky_comment(body)
        emit_summary(body)
        print(body)
        return 0

    findings, errors, calls = review(provider, key, model, chunks, workers)

    # A gate that could not run must NOT green-light the merge. ANY lens error
    # fails closed — the old code only failed when every single lens errored, so
    # two of three timing out still reported a pass.
    if errors:
        print(
            f"::error::{errors} of {calls} lens/chunk reviews failed to produce a "
            "readable result; failing closed."
        )
        emit_summary(
            f"{MARKER}\n## 🛡️ Adversarial review\n\n"
            f"❌ **Blocked** — {errors} of {calls} lens/chunk reviews failed.\n\n"
            f"{audit}\n"
        )
        return 1

    findings = dedupe(findings)
    body, highs = render_markdown(audit, findings)
    post_sticky_comment(body)
    emit_summary(body)
    print(body)

    unknown = [f for f in findings if f["severity_norm"] == "unknown"]
    if unknown:
        print(
            f"::warning::{len(unknown)} finding(s) had an unrecognized severity "
            f"and did not block: {sorted({str(f.get('severity')) for f in unknown})}"
        )
    if highs:
        print(f"::error::{len(highs)} blocking-severity finding(s) block the merge.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
