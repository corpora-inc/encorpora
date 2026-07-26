#!/usr/bin/env python3
"""Adversarial PR review — the machine gatekeeper that replaces the human.

Runs three independent adversarial lenses (correctness, security, pack-compat)
over a PR diff, posts a single sticky findings comment, and exits non-zero iff
there is a blocking-severity finding OR the review could not be completed.

FAIL CLOSED is the contract. This script is the `adversarial-review` required
status check, so a green exit must mean "every lens actually read 100% of the
reviewed range and found nothing blocking". Anything else exits non-zero: a git
failure, a malformed SHA, an unresolvable merge base, a lens API error, a model
reply we cannot parse, a finding whose severity is missing or unreadable, or a
diff we could not fully cover.

SEVERITY is matched per TOKEN, at every position, blocking level first: "high",
"very high", "severity: high", "medium-high", "critical", "P0", "urgent" and a
missing / null / letterless severity all block. See BLOCKING_ALIASES for the
full surface and for what is deliberately left out.

The ONE deliberate carve-out: a finding whose severity is a readable string in
which NO token names a level ("spicy", "bug") warns instead of blocking — that
is an answer we merely do not recognise, and blocking on it would let a typo
wedge the queue. A missing, null, or letterless severity is unreadable input
and blocks, like every other unreadable reply.

GRADING is calibrated on IMPACT and REACHABILITY, not on confidence. The lenses
carry SEVERITY_LADDER (what HIGH/MEDIUM/LOW mean here, with worked examples from
this repository) and the security lens carries a THREAT MODEL for this system —
a public repo shipping a local Tauri app and a static site. The first blocking
finding this gate ever produced was mechanically correct and over-graded, and
the cause was an uncalibrated one-sentence security prompt next to three
paragraphs of correctness calibration.

CONFIRMATION. A finding that grades HIGH is re-asked once, alone, against the
WHOLE FILE at head instead of one diff chunk. Only a positive "not a blocking
problem" verdict clears it; a confirmed HIGH, an errored confirmation, an
unparseable verdict, and a HIGH we could not build full-file context for all
still block. Cleared HIGHs are NOT hidden — they are listed in the sticky
comment and logged, so an over-eager clear is visible. Confirmation costs one
call per HIGH finding and nothing at all on a clean diff.

MODELS are pinned to ALLOWED_MODELS. ADVERSARIAL_MODEL can only select from
that set, so weakening every lens at once takes a PR through this gate rather
than a silent repo-variable edit with no audit trail.

There is deliberately NO waiver, suppression, annotation, or PR-body override.
See the note above confirm_findings before adding one.

RANGE. The reviewed range is always `merge-base(base, head)..head`. The event's
base SHA is the base *branch tip*, not the merge base, so a two-dot
`base..head` on a branch cut from an older main reviews the wrong set of
changes while still reporting full coverage. In the merge queue the base SHA is
the previous entry's head — already an ancestor of head — so the merge base is
that SHA and the range is exactly that entry's own delta.

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
  ADVERSARIAL_MODEL   model id override; MUST be in ALLOWED_MODELS[provider]
  ADVERSARIAL_WORKERS concurrent model calls (default 3)
  GITHUB_TOKEN        for posting the sticky PR comment (optional in merge_group)
  GITHUB_REPOSITORY   owner/repo (set by Actions)
  PR_NUMBER           PR number (empty in merge_group → comment skipped)
  BASE_SHA, HEAD_SHA  diff range endpoints (a merge base is resolved from them)
  MAX_CHUNK_CHARS     per-chunk character budget (default 200000)
"""

import http.client
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

# The models this gate is allowed to review with. ADVERSARIAL_MODEL selects
# FROM this set and cannot introduce a new value.
#
# Why an allow-list and not a free-form repo variable: the model is the single
# input that silently sets the quality of all three lenses at once. As a bare
# repo variable it could be pointed at something cheap and weak forever, with
# no PR, no diff, and no audit trail — the whole gate quietly downgraded while
# every check stayed green. Widening this set is a code change that must itself
# pass this gate.
#
# Keep entries to models actually validated against these prompts. The OpenAI
# branch lists only the id this repo has ever run, deliberately: an id that
# does not exist is a 400, which is a lens error, which is a repo-wide block —
# so a guessed entry is worse than no entry.
ALLOWED_MODELS = {
    "anthropic": {"claude-opus-5", "claude-fable-5", "claude-opus-4-8"},
    "openai": {"gpt-4.1"},
}

# `max_tokens` on current Claude models caps thinking + visible response
# together, and thinking is ON BY DEFAULT on claude-opus-5. The old value of
# 2000 silently truncated the JSON mid-object, which parsed as "no findings"
# and passed the gate; 16000 was still thin once adaptive thinking spends from
# the same budget over a 50k-token chunk, and a `max_tokens` stop is a hard
# red here. There is no API-enforced non-streaming ceiling — the constraint is
# the HTTP request timeout, which is why this branch streams (see call_model).
ANTHROPIC_MAX_TOKENS = 32000
ANTHROPIC_EFFORT = "high"
# `fallbacks: "default"` needs this beta. Without it a safety-classifier
# decline on the security lens (whose prompt is exactly the shape that trips
# the cyber category) is an unrecoverable red on a required check.
ANTHROPIC_BETAS = "server-side-fallback-2026-07-01"

# Chunk budget in CHARACTERS. The old name (MAX_DIFF_BYTES) lied: it was
# compared against len() of a str, which counts characters, not bytes.
DEFAULT_CHUNK_CHARS = 200000
MIN_CHUNK_CHARS = 4000  # guards against a config that would never terminate

# Concurrency. Every worker holds a full chunk (~50k tokens) in flight, and it
# is that concurrent token volume — not the request count — that provokes a
# token-rate 429. Overridable from the workflow so an incident can be throttled
# without a code change (and therefore without a merge through the gate).
DEFAULT_WORKERS = 3

REQUEST_TIMEOUT_S = 120
REQUEST_ATTEMPTS = 4
# Token-rate limits reset over roughly a minute, so 2s/4s could never clear
# one: every attempt landed inside the same window and the 429 became a lens
# error, i.e. a repo-wide block. 8/16/32 (+jitter) spans a rate-limit window.
#
# This is a FLOOR, not a default. A server hint can only ever make the wait
# LONGER (see _post). Treating the hint as a replacement was a live wedge: the
# providers attach x-ratelimit-reset-* to essentially every response, healthy
# buckets read "0s", and `hint if hint is not None else floor` therefore
# collapsed the whole backoff to zero on any 5xx — four attempts in
# milliseconds, then a lens error, then a red required check on every PR.
RETRY_BACKOFF_S = 8
# Seconds of budget held back so the run can still report a legible error
# instead of being killed by the job's timeout-minutes.
RETRY_BUDGET_MARGIN_S = 5
# 529 is Anthropic's documented overloaded_error and is retryable; treating it
# as permanent would make provider overload an instant repo-wide block. 522/524
# are Cloudflare connection/origin timeouts and are equally transient.
RETRY_STATUS = {408, 409, 429, 500, 502, 503, 504, 522, 524, 529}

# Wall-clock budget for the whole review. Kept under the job's timeout-minutes
# so an overloaded provider produces a legible "budget exhausted" error instead
# of the runner killing the job, and so retries can never outlive the job.
REVIEW_BUDGET_S = 20 * 60

# Severity tokens that block the merge, after normalization. "major" is a
# mainstream severity word — leaving it out was the last fail-open hole: a
# model reporting a real defect as `"severity": "major"` exited 0.
#
# The rest are the top-of-ladder vocabulary a model reaches for when it ignores
# the high|medium|low enum: incident grades (p0/p1/sev0/sev1/s0/s1), the
# Microsoft/Red Hat ladder (critical > important > moderate > low, so
# "important" outranks the already-medium "moderate"), the log-level ladder
# (error > warning, and "warning" is already medium here), and plain English
# maxima. Each one is a REPORTED defect the model graded at the top of whatever
# scale it used; letting it exit 0 is the same fail-open as "major" was.
#
# Deliberately NOT blocking: "bug", "defect", "issue", "regression" — those name
# a KIND of finding, not its grade, and a low-severity bug is still a bug. They
# fall through to "unknown" and warn.
BLOCKING_ALIASES = {
    "critical", "blocker", "block", "blocking", "major", "severe", "fatal",
    "urgent", "showstopper", "breaking", "serious", "important", "error",
    "mustfix", "p0", "p1", "sev0", "sev1", "s0", "s1",
}
MEDIUM_ALIASES = {"medium", "med", "moderate", "warning", "warn"}
LOW_ALIASES = {"low", "minor", "info", "informational", "nit", "nitpick", "trivial"}
# A blocking token immediately after one of these is negated, so "low
# (non-blocking)" stays low instead of wedging the queue on the word it used to
# say it is safe.
NEGATIONS = {"no", "not", "non", "never"}

# Sentinel for "the key was absent", which is different from "the value was a
# string we do not recognise". Absent is unreadable input → blocks.
MISSING = object()


def provider_and_key():
    """Pick the review provider. Anthropic if its key is set, else OpenAI."""
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "anthropic", os.environ["ANTHROPIC_API_KEY"]
    key = os.environ.get("OPENAI_KEY") or os.environ.get("OPENAI_API_KEY")
    if key:
        return "openai", key
    return None, None


def resolve_model(provider):
    """Pick the review model, refusing any id outside ALLOWED_MODELS.

    An unrecognised override is an ERROR, not a fallback to the default. A
    silent fallback would make a typo'd or downgraded ADVERSARIAL_MODEL
    indistinguishable from an unset one in the logs, which is the audit-trail
    hole this allow-list exists to close.
    """
    allowed = ALLOWED_MODELS[provider]
    override = (os.environ.get("ADVERSARIAL_MODEL") or "").strip()
    if not override:
        return DEFAULT_MODEL[provider]
    if override not in allowed:
        raise ReviewError(
            f"ADVERSARIAL_MODEL={override!r} is not in the {provider} allow-list "
            f"({', '.join(sorted(allowed))}). The review model sets the quality "
            "of every lens, so changing it is a code change that must pass this "
            "gate — not a repo-variable edit."
        )
    return override


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
    # This lens used to be exactly one sentence — the first four lines below —
    # while the correctness lens above carried three paragraphs of hard-won
    # calibration. That asymmetry is what produced this gate's first false
    # block: a mechanically correct finding, graded HIGH, against a
    # dev-server-only config change on a public repo. A reviewer told to find
    # injection/SSRF/authz with no description of the system it is reviewing
    # will grade against a generic multi-tenant web service, because that is
    # what those words describe. So describe the system.
    "security": (
        "You are a security reviewer. Find injection, secret/credential exposure, "
        "unsafe deserialization, path traversal, SSRF, missing authz, and unsafe "
        "handling of untrusted input introduced by this diff.\n\n"
        "THREAT MODEL — grade against THIS system, not a generic web service:\n"
        "* This repository is PUBLIC and open source. Source disclosure is not "
        "itself an exposure: reading the code, an endpoint URL, the pack "
        "catalog, or these security checks themselves gains an attacker nothing "
        "they could not get by cloning the repo. What matters is real SECRET "
        "material — keystores, .jks/.p8/.pem/.keystore files, service-account "
        "JSON, API tokens, signing keys — anything that would still be a leak "
        "after the source is already published.\n"
        "* The products are a LOCAL Tauri desktop/mobile app and a STATIC site "
        "on GitHub Pages. There is no server-side authorization layer, no "
        "session or tenant boundary, and no multi-tenant data. 'Missing authz', "
        "'IDOR', and 'privilege escalation' presuppose a server enforcing "
        "authorization on behalf of many users; if this diff does not add one, "
        "those findings do not apply. Data the app holds is the user's own data "
        "on the user's own device — reading it locally is not exfiltration.\n"
        "* Dev-only surfaces NEVER SHIP and are not in any built artifact: "
        "`server.*` dev-server config, tests, benches, fixtures, QA harnesses, "
        "CI workflows and scripts, and local tooling. A weakness that exists "
        "only while a developer runs a dev server on their own machine is "
        "bounded by who can reach that machine.\n"
        "* Untrusted input that genuinely DOES matter here: downloaded content "
        "packs and the code inside them, catalog/manifest JSON fetched over the "
        "network, model output, remote narration/book assets, and anything else "
        "a remote host serves to an installed app.\n"
        "Grade on IMPACT and REACHABILITY, per the severity ladder below."
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

# What the levels MEAN. The old guidance was one clause — "reserve it for real,
# confident defects" — which grades CONFIDENCE, and HIGH vs MEDIUM was never
# defined anywhere. A reviewer that is certain about a harmless fact reads that
# as licence to block, which is exactly what happened. Severity is a claim about
# impact and reachability; confidence is a separate axis, handled by the
# confirmation pass, not by the ladder.
#
# The two worked examples are real events in this repository and are chosen to
# share a reachability class and differ only in impact — that is the distinction
# a reviewer has to be able to make, and abstract definitions do not teach it.
SEVERITY_LADDER = (
    "SEVERITY LADDER — only HIGH blocks the merge. Grade on IMPACT and "
    "REACHABILITY: what an attacker gains, and how they reach it. Do NOT grade "
    "on how confident you are that you have read the code correctly — a "
    "certain observation about a harmless fact is still LOW.\n"
    "* HIGH — someone who is NOT the developer at their own machine gains "
    "something real: leaked signing material or a live credential, code "
    "execution or arbitrary file write on a user's device from content the app "
    "fetches, silent data loss on a user's device, or a shipped artifact that "
    "is broken for every user. A HIGH must be able to name WHO reaches it and "
    "WHAT they get.\n"
    "* MEDIUM — a real defect whose reach or impact is bounded: it needs an "
    "unlikely precondition, it affects only the developer's own machine, it "
    "weakens a defense in depth without breaking it, or it degrades one "
    "feature rather than the shipped artifact.\n"
    "* LOW — hardening, hygiene, and defense in depth with no concrete path to "
    "harm; anything confined to tests, benches, fixtures, CI, or dev tooling "
    "that never ships; and source disclosure in a repository that is already "
    "public.\n"
    "Two worked examples from THIS repository. They have the SAME reachability "
    "— a dev server on a developer's machine — and different grades, because "
    "the difference is impact, not confidence:\n"
    "* TRUE HIGH: the Vite dev server served the production Android upload "
    "KEYSTORE, because Vite's default deny list does not cover `.jks`. Any peer "
    "on the developer's network could fetch the signing key for the shipped "
    "app. Real secret, reachable by a non-developer, unfixable by rotation "
    "alone — that is what HIGH is for.\n"
    "* NOT HIGH: widening `server.fs.allow` in that same dev-server config so "
    "Vite may read more of the repository. Dev-server only, never shipped, and "
    "what it exposes is source code in a public open-source repository — no "
    "secret, no gain. That is LOW.\n"
    "If you cannot name a specific actor and a specific consequence, it is not "
    "HIGH."
)

SCHEMA_HINT = (
    'Respond with ONLY a JSON object, no prose, of the form:\n'
    '{"findings": [{"severity": "high|medium|low", "file": "path", '
    '"line": "n or range or null", "title": "short", '
    '"detail": "why it is a problem and how to fix"}]}\n'
    "Return an empty findings array if you find nothing. Be precise; do not "
    "invent issues. Grade every finding against the severity ladder above, and "
    "for a HIGH say in `detail` who reaches it and what they gain. Every "
    "finding MUST carry a severity — a finding with a missing or empty "
    "severity is treated as blocking."
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
    "or renames them. A chunk can also begin or end mid-line when a single "
    "source line exceeded the chunk budget, so do NOT report truncated, "
    "unterminated, or syntactically incomplete text as a defect."
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

# The confirmation pass asks one question about one finding, so it gets its own
# schema. Both fields are required: a verdict with no reason is not reviewable
# by the human reading the sticky comment.
CONFIRM_SCHEMA = {
    "type": "object",
    "properties": {
        "confirmed": {"type": "boolean"},
        "reason": {"type": "string"},
    },
    "required": ["confirmed", "reason"],
    "additionalProperties": False,
}

# Marker string so the second pass is identifiable in a log or a test stub.
CONFIRM_MARKER = "SECOND-PASS CONFIRMATION"

CONFIRM_HINT = (
    CONFIRM_MARKER + ". A first-pass reviewer saw ONE CHUNK of a unified diff "
    "and graded the finding below at blocking severity. You are now looking at "
    "the COMPLETE file as it stands at the head of this branch — the full "
    "context that pass did not have.\n\n"
    "Decide one thing: is this a real, blocking-severity problem?\n"
    "Answer false when the full file shows the concern is already handled, "
    "when it rested on context the chunk was missing, when the code is not "
    "what the first pass took it for, or when it is a real defect that the "
    "severity ladder does not put at HIGH.\n"
    "Answer true when you can name a specific actor who reaches it and a "
    "specific thing they gain, per that ladder.\n\n"
    "This is a precision check on ONE finding, not a re-review: do not look "
    "for new problems, and do not confirm this finding because you noticed a "
    "different one. If the file does not let you decide, answer true — an "
    "undecidable blocking finding stays blocking.\n\n"
    'Respond with ONLY a JSON object, no prose: {"confirmed": true|false, '
    '"reason": "one sentence"}'
)

CONFIRM_SYSTEM = (
    "You are a rigorous code reviewer performing a second-pass precision check "
    "on a single finding. You are as adversarial about false alarms as about "
    "real defects: a wrong block and a missed defect are both failures."
)

# Confirmation reads whole files, so it needs its own ceiling. A file over this
# budget is not confirmed at all rather than confirmed against a truncated
# view — truncation is what the first pass already suffered from, and
# "confirmed against half a file" is a worse answer than "not checked".
CONFIRM_MAX_FILE_CHARS = 400000

# Upper bound on confirmation calls per run. Past this the PR is thoroughly
# blocked anyway, and the remaining HIGHs stay blocking unchecked — the
# fail-closed direction.
MAX_CONFIRMATIONS = 20


class ReviewError(Exception):
    """Anything that makes a green verdict unsafe. Always exits non-zero."""


class TransientError(RuntimeError):
    """A provider-side failure worth retrying that arrives inside a 200 body.

    A streamed response can report `overloaded_error` as an SSE event rather
    than an HTTP status, so status-code matching alone would treat provider
    overload as permanent.
    """


# Retried in _post. Deliberately narrow: urllib.error.URLError, socket timeouts
# and connection resets are all OSError; RemoteDisconnected/IncompleteRead are
# http.client.HTTPException. A JSONDecodeError (ValueError) from the reader is
# NOT here — a malformed body is deterministic, and retrying it four times only
# burns budget the next rate limit will need.
RETRYABLE_ERRORS = (OSError, http.client.HTTPException, TransientError)

# Anthropic stream `error` event types that are worth another attempt. Anything
# else (invalid_request_error, authentication_error, …) is permanent.
TRANSIENT_STREAM_ERRORS = {
    "overloaded_error",
    "api_error",
    "rate_limit_error",
    "timeout_error",
}


# ------------------------------------------------------------------- deadline

_DEADLINE = None


def _time_left():
    """Seconds remaining in the review budget (inf when no deadline is set)."""
    if _DEADLINE is None:
        return float("inf")
    return _DEADLINE - time.monotonic()


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


class DiffRange(NamedTuple):
    """The range actually reviewed, plus what the event asked for."""

    base: str  # merge base — the commit the diff is taken FROM
    head: str
    requested_base: str  # the event's base SHA, before merge-base resolution

    @property
    def spec(self):
        return f"{self.base}..{self.head}"

    def describe(self):
        short = self.requested_base[:12]
        if self.base == self.requested_base:
            return f"merge base == requested base `{short}`"
        return f"merge base of requested base `{short}` and head"


def _merge_base(base, head):
    """Resolve the merge base, failing closed if git cannot.

    Two-dot `base..head` diffs the base branch's CURRENT tree against head, so
    every commit that landed on main after the branch was cut shows up inverted
    in the diff — and, worse, changes the branch made on top of those commits
    can vanish from it. The reviewed range must be the branch's own change.
    """
    rc, out, err = run(["git", "merge-base", base, head])
    if rc != 0 or not out.strip():
        raise ReviewError(
            f"could not resolve the merge base of {base}..{head} "
            f"(exit {rc}): {err.strip() or 'no common ancestor'}. "
            "Refusing to review a range that is not this branch's change."
        )
    return out.strip()


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
        requested = _check_sha("BASE_SHA", base_raw)
    else:
        # workflow_dispatch and other no-base events: review the head commit.
        rc, out, err = run(["git", "rev-parse", f"{head}^"])
        if rc != 0 or not out.strip():
            raise ReviewError(
                f"BASE_SHA unset and could not resolve {head}^: "
                f"{err.strip() or 'no parent commit'}"
            )
        requested = out.strip()

    return DiffRange(_merge_base(requested, head), head, requested)


def get_diff(spec):
    """Return the full diff for `spec`. Never truncates; raises on git failure."""
    rc, diff, err = run(["git", "diff", "--unified=3", spec])
    if rc != 0:
        raise ReviewError(f"git diff {spec} failed (exit {rc}): {err.strip()}")

    if not diff.strip():
        # An empty diff is only a pass if the range is GENUINELY empty. Assert
        # that with an independent query rather than trusting one empty stdout.
        rc2, names, err2 = run(["git", "diff", "--name-only", spec])
        if rc2 != 0:
            raise ReviewError(
                f"git diff --name-only {spec} failed (exit {rc2}): {err2.strip()}"
            )
        if names.strip():
            raise ReviewError(
                f"git reported changed files for {spec} but produced an empty diff; "
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
    """Partition text into <=budget pieces, breaking at newline boundaries.

    Splits on "\\n" only. str.splitlines() also breaks on U+2028, U+2029,
    U+0085, \\x0b and \\x0c — all legal inside JS/TS source — which silently
    handed a lens a chunk starting mid-line while the audit line claimed no
    lens sees a partial line.

    Returns (pieces, hard_split). `hard_split` is True when a single line was
    longer than the budget and had to be cut mid-line: there is no smaller
    boundary to use, so the audit reports it rather than claiming otherwise.

    Guarantee: "".join(pieces) == text.
    """
    pieces, current, hard_split = [], "", False
    parts = text.split("\n")
    last = len(parts) - 1
    for i, part in enumerate(parts):
        line = part if i == last else part + "\n"
        if not line:
            continue
        if len(line) > budget:
            hard_split = True
            if current:
                pieces.append(current)
                current = ""
            for j in range(0, len(line), budget):
                pieces.append(line[j : j + budget])
            continue
        if current and len(current) + len(line) > budget:
            pieces.append(current)
            current = ""
        current += line
    if current:
        pieces.append(current)
    return pieces, hard_split


def _split_file_segment(segment, budget):
    """Split one oversized file diff at hunk boundaries, then line boundaries.

    Returns (pieces, hard_split).

    Guarantee: "".join(pieces) == segment.
    """
    starts = [m.start() for m in _HUNK_RE.finditer(segment)]
    if starts:
        blocks = [segment[: starts[0]]] if starts[0] > 0 else []
        for i, start in enumerate(starts):
            end = starts[i + 1] if i + 1 < len(starts) else len(segment)
            blocks.append(segment[start:end])
    else:
        blocks = [segment]

    atoms, hard_split = [], False
    for block in blocks:
        if len(block) <= budget:
            atoms.append(block)
            continue
        split, block_hard = _split_on_lines(block, budget)
        atoms.extend(split)
        hard_split = hard_split or block_hard

    pieces, current = [], ""
    for atom in atoms:
        if current and len(current) + len(atom) > budget:
            pieces.append(current)
            current = ""
        current += atom
    if current:
        pieces.append(current)
    return pieces, hard_split


def chunk_diff(diff, budget):
    """Pack per-file segments into chunks of at most `budget` characters.

    Returns (chunks, oversized_files, hard_split_files).

    A single file larger than the budget is SPLIT rather than truncated or
    rejected. Truncating would silently drop review coverage (the exact bug this
    change exists to fix), and rejecting would block legitimate large-file PRs —
    generated files, lockfiles, vendored sources — on day one.

    Splits land on hunk boundaries where possible and line boundaries otherwise,
    and every continuation piece carries a synthetic `context` naming the file
    it belongs to. Those two properties keep a split file reviewable: without
    them the model cannot attribute hunks to a path and invents findings from
    the missing context. A file with a single line longer than the whole budget
    (a minified bundle) is cut mid-line and reported in `hard_split_files`.

    Guarantee: "".join(c.text for c in chunks) == diff, for budget >= MIN_CHUNK_CHARS.
    """
    if budget < MIN_CHUNK_CHARS:
        raise ReviewError(
            f"chunk budget {budget} is below the minimum {MIN_CHUNK_CHARS}."
        )

    chunks, oversized, hard_split, current = [], [], [], ""
    for segment in split_into_files(diff):
        if len(segment) > budget:
            if current:
                chunks.append(Chunk(current))
                current = ""
            path = _segment_path(segment)
            oversized.append(path)
            pieces, was_hard = _split_file_segment(segment, budget)
            if was_hard:
                hard_split.append(path)
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
    return chunks, oversized, hard_split


# ------------------------------------------------------------------ model I/O

_DURATION_UNITS = {"ms": 0.001, "s": 1.0, "m": 60.0, "h": 3600.0}
_DURATION_PART_RE = re.compile(r"(\d+(?:\.\d+)?)(ms|s|m|h)")


def parse_duration(value):
    """Parse '30', '6s', '1.5s', '6m0s' into seconds. None if unparseable."""
    text = (value or "").strip().lower()
    if not text:
        return None
    try:
        return float(text)  # bare seconds, e.g. retry-after: 30
    except ValueError:
        pass
    parts = _DURATION_PART_RE.findall(text)
    if not parts:
        return None
    return sum(float(n) * _DURATION_UNITS[u] for n, u in parts)


def parse_millis(value):
    """Parse retry-after-ms ('1500' → 1.5s). None if unparseable."""
    text = (value or "").strip()
    if not text:
        return None
    try:
        return float(text) / 1000.0
    except ValueError:
        return None


def retry_delay_from(headers):
    """Longest server-directed retry delay in seconds, or None.

    A token-rate 429 is answered by the provider with the time until the window
    resets. Ignoring it and guessing a backoff is how a transient rate limit
    became a repo-wide block.

    Takes the MAX of every parseable hint, not the first. The classic RPM-429
    carries `{reset-tokens: "0s", reset-requests: "45s"}` — the token bucket is
    fine, the request bucket is what is throttling us — and first-wins returned
    0.0 and threw away the only number that mattered.

    The value is a hint about the earliest useful retry, never a licence to
    wait less than the exponential floor; _post takes the max of the two.
    """
    if not headers:
        return None

    def get(name):
        try:
            return headers.get(name)
        except AttributeError:
            return None

    delays = [parse_millis(get("retry-after-ms"))]  # OpenAI's ms spelling
    for name in ("retry-after", "x-ratelimit-reset-tokens", "x-ratelimit-reset-requests"):
        delays.append(parse_duration(get(name)))
    known = [max(0.0, d) for d in delays if d is not None]
    return max(known) if known else None


def _json_reader(resp):
    return json.loads(resp.read())


def _post(url, headers, payload, reader=_json_reader):
    """POST JSON with bounded retries on transient failures.

    Retries matter for fail-closed correctness: a lens error now blocks the
    merge, so a 429 that is not survived is a repo-wide outage.

    The wait is `max(server hint, exponential floor)`, bounded only by what is
    left of the review budget:

      * MAX, not "hint wins" — the hint is 0s whenever the bucket is healthy,
        which is most of the time, and letting it win collapsed the backoff to
        nothing on any transient 5xx.
      * MAX, not "floor wins" — a real `retry-after: 300` is the provider
        telling us the window is five minutes; retrying sooner is a guaranteed
        second failure.
      * bounded by the BUDGET, not by a 60s constant — clamping a 6-minute
        window down to 60s spent three attempts inside the same window and
        gave up with most of the budget unused.

    Only transient transport failures are retried. A malformed body
    (JSONDecodeError from the reader) is deterministic: retrying it four times
    just burns the budget that a genuine rate limit needs.
    """
    body = json.dumps(payload).encode()
    last = None
    for attempt in range(REQUEST_ATTEMPTS):
        budget = _time_left()
        if budget <= 0:
            raise last or RuntimeError("review time budget exhausted before request")
        try:
            req = urllib.request.Request(url, data=body, method="POST", headers=headers)
            with urllib.request.urlopen(
                req, timeout=min(REQUEST_TIMEOUT_S, budget)
            ) as resp:
                return reader(resp)
        except urllib.error.HTTPError as e:
            try:
                detail = e.read()[:300]
            except Exception:  # noqa: BLE001
                detail = b""
            last = RuntimeError(f"HTTP {e.code}: {detail!r}")
            if e.code not in RETRY_STATUS:
                raise last from e
            server_delay = retry_delay_from(getattr(e, "headers", None))
        except RETRYABLE_ERRORS as e:
            # Connection reset, DNS, read timeout, half-closed socket, and the
            # provider-side stream error events classified as transient.
            last = e
            server_delay = None
        if attempt + 1 >= REQUEST_ATTEMPTS:
            break
        delay = max(server_delay or 0.0, RETRY_BACKOFF_S * (2**attempt))
        delay += random.uniform(0, 1)
        room = _time_left() - RETRY_BUDGET_MARGIN_S
        if room <= 0:
            break  # no room to wait AND still report; fail legibly instead
        time.sleep(min(delay, room))
    raise last


def read_anthropic_stream(resp):
    """Accumulate a streamed Anthropic response into (text, stop_reason).

    Streaming is not optional at this max_tokens: a non-streaming request that
    thinks and then writes tens of thousands of tokens holds one socket open
    for minutes and trips REQUEST_TIMEOUT_S. Concatenating every text delta is
    also the correct reconstruction under `fallbacks`, because a fallback model
    continues the partial text rather than restarting it.
    """
    text, stop = [], None
    for raw in resp:
        line = raw.decode("utf-8", "replace").strip()
        if not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if not payload:
            continue
        try:
            event = json.loads(payload)
        except json.JSONDecodeError:
            continue
        etype = event.get("type")
        if etype == "content_block_delta":
            delta = event.get("delta") or {}
            if delta.get("type") == "text_delta":
                text.append(delta.get("text", ""))
        elif etype == "message_delta":
            stop = (event.get("delta") or {}).get("stop_reason") or stop
        elif etype == "error":
            err = event.get("error") or {}
            kind = str(err.get("type") or "") if isinstance(err, dict) else ""
            exc = TransientError if kind in TRANSIENT_STREAM_ERRORS else RuntimeError
            raise exc(f"anthropic stream error: {err}")
    return "".join(text), stop


def call_model(provider, key, model, system, user, schema=FINDINGS_SCHEMA):
    if provider == "anthropic":
        text, stop = _post(
            ANTHROPIC_URL,
            {
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "anthropic-beta": ANTHROPIC_BETAS,
                "content-type": "application/json",
            },
            {
                "model": model,
                "max_tokens": ANTHROPIC_MAX_TOKENS,
                # See read_anthropic_stream: streaming is what keeps a large
                # max_tokens inside the request timeout.
                "stream": True,
                # Adaptive thinking is the current on-mode; a fixed thinking
                # budget (budget_tokens) is rejected by current models.
                "thinking": {"type": "adaptive"},
                # `format` gives the same guaranteed-JSON contract the OpenAI
                # branch gets from response_format, but schema-checked.
                "output_config": {
                    "effort": ANTHROPIC_EFFORT,
                    "format": {"type": "json_schema", "schema": schema},
                },
                # A safety classifier declining one chunk would otherwise be an
                # unrecoverable red on a required check. "default" re-runs the
                # declined request on the recommended fallback model,
                # server-side, inside the same call.
                "fallbacks": "default",
                "system": system,
                "messages": [{"role": "user", "content": user}],
            },
            reader=read_anthropic_stream,
        )
        if stop in ("max_tokens", "refusal"):
            # Either one means the JSON is absent or incomplete. Raising makes
            # it a lens error rather than a silent "no findings". A refusal here
            # means the fallback chain also declined.
            raise RuntimeError(f"anthropic response unusable (stop_reason={stop})")
        return text

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


# Bound on how many `{` positions the brace walk will try. The walk is O(n) per
# candidate, so unbalanced output was O(n^2) — 20k stray braces burned 4.4s per
# lens/chunk against the job budget. A well-formed object starts at the first
# or second brace; 200 is far past any real reply and keeps the worst case
# comfortably sub-second.
MAX_JSON_SCAN_STARTS = 200


def _extract_json_object(text, key):
    """First well-formed JSON object in `text` carrying `key`, else None.

    Shared by both reply parsers so the bounded brace walk — and therefore the
    MAX_JSON_SCAN_STARTS protection against O(n^2) on degenerate output — is
    written once and cannot drift between them.
    """
    if not text or not text.strip():
        return None

    # The overwhelmingly common case: the whole reply is the object. Trying it
    # first avoids the brace walk entirely.
    try:
        whole = json.loads(text.strip())
    except json.JSONDecodeError:
        whole = None
    if isinstance(whole, dict) and key in whole:
        return whole

    scanned = 0
    for start, char in enumerate(text):
        if char != "{":
            continue
        scanned += 1
        if scanned > MAX_JSON_SCAN_STARTS:
            break
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
                    if isinstance(obj, dict) and key in obj:
                        return obj
                    break
    return None


def parse_findings(text):
    """Return a list of finding dicts, or None if there is no well-formed
    findings object.

    None is the important half: "the model produced nothing we can read" used to
    be indistinguishable from "the model found nothing" (both returned []), so
    an empty reply, prose, a JSON object without a findings key, and JSON cut
    off mid-object all passed the gate. None is now counted as a lens error.
    """
    obj = _extract_json_object(text, "findings")
    if obj is None:
        return None
    return _coerce_findings(obj["findings"])


def parse_confirmation(text):
    """Return (confirmed: bool, reason: str) from a verdict reply, else None.

    None means "unreadable", and an unreadable verdict must never read as
    "cleared" — the caller turns it into a blocking confirmation error. The
    `confirmed` value must be a real bool: a string "false" or a 0 is not an
    answer we are willing to clear a blocking finding on.
    """
    obj = _extract_json_object(text, "confirmed")
    if obj is None:
        return None
    verdict = obj["confirmed"]
    if not isinstance(verdict, bool):
        return None
    reason = obj.get("reason")
    return verdict, str(reason).strip() if reason else ""


def _coerce_findings(raw):
    """Validate the `findings` value. None means "unreadable" → fail closed."""
    # `{"findings": null}` used to crash on iteration. Treat an explicit null as
    # "nothing found": the key is present and says so, and failing closed here
    # would block every clean PR from a model that spells [] as null. This is a
    # DELIBERATE asymmetry with the missing-severity rule below — null here is
    # an answer, a missing severity on a reported finding is not.
    if raw is None:
        return []
    if not isinstance(raw, list):
        return None
    if not all(isinstance(f, dict) for f in raw):
        return None  # a finding we cannot read may be a HIGH
    return raw


def review_chunk(provider, key, model, name, instruction, chunk, index, total):
    """Run one lens over one chunk. Returns a list of findings, or None on error."""
    label = f"{name} lens, chunk {index}/{total}"
    user = (
        f"{instruction}\n\n{CHUNK_HINT.format(i=index, n=total)}\n\n"
        f"{SEVERITY_LADDER}\n\n"
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


def _severity_tokens(value):
    """Lowercase alphanumeric tokens of a severity value.

    Digits are KEPT so incident grades survive tokenizing: stripping them
    turned "p0" into "p" and "sev1" into "sev", which matched nothing.
    """
    return re.sub(r"[^a-z0-9]+", " ", str(value).lower()).split()


def _is_readable_severity(value):
    """A severity we can even attempt to read: present, and has letters in it.

    "", "   ", "!!!" and "123" carry no level at all — that is unreadable
    input, which fails closed, not an unrecognized word, which warns.
    """
    if value is MISSING or value is None:
        return False
    return bool(re.search(r"[a-z]", str(value).lower()))


def normalize_severity(value):
    """Map a severity to high / medium / low / unknown.

    The old code compared the raw string to "high" exactly, so "critical",
    "blocker", "High severity" and "HIGH " all sailed through the gate. The
    first fix only looked at the FIRST token, which still let a reported
    finding graded "very high", "severity: high" or "P0" exit 0.

    EVERY token is scanned now, blocking level first, so any position of a
    top-of-ladder word blocks: "very high", "medium-high" and "high, but easy
    to fix" all resolve to high. When a value carries two levels the higher one
    wins — the fail-closed direction. The one exception is negation: a blocking
    token directly after "no"/"not"/"non"/"never" is not a grade, so
    "low (non-blocking)" stays low.

    Unreadable input — the key absent (MISSING), null, or a string with no
    letters in it — normalizes to "high" and BLOCKS. A model that reports a
    defect without a severity we can read has not told us the finding is safe
    to merge, and the whole contract of this script is that unreadable means
    blocked. Only a non-empty, readable string in which NO token names a level
    falls through to "unknown", which warns instead of blocking, so that one
    unrecognized word cannot wedge every merge in the repo.
    """
    if not _is_readable_severity(value):
        return "high"
    tokens = _severity_tokens(value)
    for i, token in enumerate(tokens):
        if i and tokens[i - 1] in NEGATIONS:
            continue
        if token.startswith("high") or token in BLOCKING_ALIASES:
            return "high"
    # Hyphenated/spaced spellings of a single alias ("must-fix", "show stopper")
    # tokenize into halves that match nothing on their own.
    if "".join(tokens) in BLOCKING_ALIASES:
        return "high"
    if any(t in MEDIUM_ALIASES for t in tokens):
        return "medium"
    if any(t in LOW_ALIASES for t in tokens):
        return "low"
    return "unknown"


def finding_severity(finding):
    return normalize_severity(finding.get("severity", MISSING))


def has_unreadable_severity(finding):
    """True when the finding blocked because we could not read its severity."""
    return not _is_readable_severity(finding.get("severity", MISSING))


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


# --------------------------------------------------------------- confirmation

# CONFIRMATION STATES. Exactly one of these clears a blocking finding.
CONFIRM_CLEARED = "unconfirmed"  # the ONLY non-blocking outcome
CONFIRM_UPHELD = "confirmed"
CONFIRM_ERROR = "error"  # call failed or verdict unreadable → blocks
CONFIRM_SKIPPED = "unchecked"  # no second pass was possible → blocks


def is_blocking(finding):
    """True unless the confirmation pass positively cleared this finding.

    Written as "not cleared" rather than "confirmed" on purpose: every new
    confirmation state that anyone adds later defaults to BLOCKING, which is
    the direction this gate must fail in. An error, a skip, an unreadable
    verdict, and a state nobody has invented yet all block; only an explicit
    CONFIRM_CLEARED lets a blocking-severity finding through.
    """
    if finding_severity(finding) != "high":
        return False
    return finding.get("confirmation") != CONFIRM_CLEARED


def file_at(head, path):
    """Full text of `path` at `head`, or None when it cannot be read.

    None is a legitimate answer — a deleted file, a path the model invented,
    or a binary blob — and the caller treats it as "cannot confirm", which
    blocks. This never falls back to the diff chunk: confirming against the
    same partial view that produced the finding would make the second pass
    ceremonial.
    """
    path = (path or "").strip()
    if not path or "\n" in path or len(path) > 400 or path in ("?", "<unknown>"):
        return None
    candidates = [path]
    # Diff headers are `a/<path>` / `b/<path>` and models sometimes copy the
    # prefix into the finding. Try the literal path FIRST so a real top-level
    # `a/` directory is never shadowed by the stripped form.
    if path.startswith(("a/", "b/")):
        candidates.append(path[2:])
    if path.startswith("./"):
        candidates.append(path[2:])
    for candidate in candidates:
        rc, out, _ = run(["git", "show", f"{head}:{candidate}"])
        if rc == 0:
            return out
    return None


def build_confirm_prompt(finding, source):
    """The single-finding, whole-file question put to the second pass."""
    lens = str(finding.get("lens") or "")
    location = str(finding.get("file", "?"))
    if finding.get("line"):
        location += f":{finding['line']}"
    return (
        f"{LENSES.get(lens, '')}\n\n{SEVERITY_LADDER}\n\n{CONFIRM_HINT}\n\n"
        f"FINDING (reported by the {lens} lens at blocking severity)\n"
        f"location: {location}\n"
        f"title: {str(finding.get('title', '')).strip()}\n"
        f"detail: {str(finding.get('detail', '')).strip()}\n\n"
        f"COMPLETE CURRENT CONTENTS OF `{finding.get('file', '?')}`:\n"
        f"```\n{source}\n```"
    )


def _confirm_one(provider, key, model, finding, source):
    """Second-pass verdict on one finding. Returns (state, reason)."""
    label = f"confirmation of {finding.get('lens')} finding in {finding.get('file')}"
    try:
        raw = call_model(
            provider,
            key,
            model,
            CONFIRM_SYSTEM,
            build_confirm_prompt(finding, source),
            schema=CONFIRM_SCHEMA,
        )
    except Exception as e:  # noqa: BLE001
        # Fail CLOSED. A confirmation we could not run is not a clearance:
        # letting an API error delete a blocking finding would turn a flaky
        # provider into a way to merge anything.
        print(f"::warning::{label} failed: {e}")
        return CONFIRM_ERROR, f"confirmation call failed: {e}"
    verdict = parse_confirmation(raw)
    if verdict is None:
        print(f"::warning::{label} returned no parseable verdict: {(raw or '')[:200]!r}")
        return CONFIRM_ERROR, "confirmation reply could not be parsed"
    confirmed, reason = verdict
    return (CONFIRM_UPHELD if confirmed else CONFIRM_CLEARED), reason


def confirm_findings(provider, key, model, findings, head, workers):
    """Re-check every blocking-severity finding against its whole file.

    This targets the gate's measured failure mode: ONE low-precision call that
    saw a diff chunk and nothing else. It runs only on HIGH findings, so a
    clean diff costs nothing and a normal diff costs at most a handful of
    calls.

    DELIBERATE: this is the ONLY mechanism that can stop a HIGH from blocking,
    and it is the model re-reading the file. There is NO waiver, no suppression
    comment, no annotation, and no PR-body override — and none may be added.
    In this repository agents author both the diff and the PR body, so any such
    mechanism would be a waiver the reviewed party grants itself, which is not
    a gate at all. If that feels inconvenient, the fix is a better finding or a
    better prompt, not an escape hatch.
    """
    pending = []
    for f in findings:
        if finding_severity(f) != "high":
            continue
        if has_unreadable_severity(f):
            # There is no graded judgment here to re-check — the severity was
            # unreadable input, which fails closed on its own terms.
            f["confirmation"] = CONFIRM_SKIPPED
            f["confirmation_reason"] = "no readable severity — nothing to re-check"
            continue
        pending.append(f)

    for f in pending[MAX_CONFIRMATIONS:]:
        f["confirmation"] = CONFIRM_SKIPPED
        f["confirmation_reason"] = (
            f"more than {MAX_CONFIRMATIONS} blocking findings — not re-checked"
        )

    jobs = []
    for f in pending[:MAX_CONFIRMATIONS]:
        source = file_at(head, str(f.get("file") or ""))
        if source is None:
            f["confirmation"] = CONFIRM_SKIPPED
            f["confirmation_reason"] = "could not read the full file at head"
        elif len(source) > CONFIRM_MAX_FILE_CHARS:
            f["confirmation"] = CONFIRM_SKIPPED
            f["confirmation_reason"] = (
                f"file exceeds the {CONFIRM_MAX_FILE_CHARS}-char confirmation budget"
            )
        else:
            jobs.append((f, source))

    if jobs:
        with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
            results = list(
                pool.map(
                    lambda job: _confirm_one(provider, key, model, job[0], job[1]),
                    jobs,
                )
            )
        for (f, _), (state, reason) in zip(jobs, results):
            f["confirmation"] = state
            f["confirmation_reason"] = reason
    return findings


# --------------------------------------------------------------------- output


def render_markdown(audit, all_findings):
    """Build the sticky comment body. Returns (body, blocking_findings).

    The audit line is emitted UNCONDITIONALLY, including on clean runs — a green
    run used to record nothing at all about what had actually been reviewed.

    Findings the confirmation pass CLEARED are rendered too, in their own
    section. Silently dropping them would make the second pass a place where
    real defects could disappear with no trace; listing them means an
    over-eager clear is reviewable by whoever reads the comment.
    """
    for f in all_findings:
        f["severity_norm"] = finding_severity(f)
    all_findings.sort(key=lambda f: SEV_ORDER.get(f["severity_norm"], 3))
    blocking = [f for f in all_findings if is_blocking(f)]
    cleared = [
        f
        for f in all_findings
        if f["severity_norm"] == "high" and not is_blocking(f)
    ]
    # Partition by IDENTITY, not equality: `f not in cleared` compares dicts by
    # value, so two findings that happen to render identically would both
    # vanish from the main list.
    cleared_ids = {id(f) for f in cleared}
    listed = [f for f in all_findings if id(f) not in cleared_ids]

    lines = [MARKER, "## 🛡️ Adversarial review"]
    if not all_findings:
        lines.append(
            "\n✅ No findings across correctness / security / pack-compat lenses."
        )
    elif blocking:
        lines.append("\n❌ **Blocked** — blocking-severity findings must be resolved.")
    else:
        lines.append("\n✅ **Pass** — only non-blocking findings.")
    lines.append(f"\n{audit}\n")

    icon = {"high": "🔴", "medium": "🟠", "low": "🟡", "unknown": "⚪"}

    def render(f, note):
        sev = f["severity_norm"]
        loc = str(f.get("file", "?"))
        if f.get("line"):
            loc += f":{f['line']}"
        return (
            f"- {icon.get(sev, '⚪')} **{sev.upper()}** [{f.get('lens')}] "
            f"`{loc}` — **{str(f.get('title', '')).strip()}**{note}  \n  "
            f"{str(f.get('detail', '')).strip()}"
        )

    for f in listed:
        note = ""
        if has_unreadable_severity(f):
            note = " _(no readable severity — treated as blocking)_"
        elif f.get("confirmation") in (CONFIRM_ERROR, CONFIRM_SKIPPED):
            note = (
                f" _(not re-checked: {f.get('confirmation_reason', '')} — "
                "still blocking)_"
            )
        lines.append(render(f, note))

    if cleared:
        lines.append(
            "\n<details><summary>🔎 "
            f"{len(cleared)} blocking-severity finding(s) cleared by the "
            "second pass — reported, not blocking</summary>\n\n"
            "Each was re-read against the whole file rather than one diff "
            "chunk and judged not to be a blocking problem. They are listed "
            "so the clearance is reviewable; nothing here was hidden.\n"
        )
        for f in cleared:
            lines.append(
                render(f, f" _(cleared: {f.get('confirmation_reason', '')})_")
            )
        lines.append("\n</details>")
    return "\n".join(lines), blocking


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


def publish(body):
    """Every terminal path records the same body in both places.

    The error path used to emit_summary() only, so the most confusing red the
    gate can produce (nothing wrong with the diff — the reviewer could not run)
    left no comment at all, while a stale green "✅ No findings" comment stayed
    visible contradicting the red check.
    """
    post_sticky_comment(body)
    emit_summary(body)
    print(body)


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


def build_audit(
    rng, diff, chunks, budget, oversized, hard_split, provider, model, reviewed=True
):
    """Render the forensic line.

    `reviewed=False` is the lens-failure path. The coverage clause used to be
    unconditional, so the most confusing red the gate produces said "the diff
    was not fully reviewed" and then, two lines later, "every lens read 100% of
    that diff" — a false record on exactly the run an operator has to trust.
    Chunk coverage and review coverage are different claims; only the first one
    holds when a lens fails.
    """
    files = len(_FILE_START_RE.findall(diff))
    coverage = (
        "every lens read 100% of that diff, 0 chars dropped"
        if reviewed
        else "0 chars dropped by chunking, but the lens reviews above did not complete"
    )
    audit = (
        f"_Reviewed `{rng.spec}` ({rng.describe()}) — {files} file(s), "
        f"{len(diff)} chars, {len(chunks)} chunk(s) of <= {budget}; {coverage}"
        f" · {provider} ({model}) · {len(LENSES)} lenses._"
    )
    if oversized:
        audit += (
            f"\n\n> ⚠️ Larger than the {budget}-char chunk budget, so split "
            f"across chunks with the file re-identified on each continuation: "
            f"`{'`, `'.join(sorted(set(oversized)))}`. Fully reviewed."
        )
        if hard_split:
            audit += (
                f" Splits land on hunk/line boundaries EXCEPT in "
                f"`{'`, `'.join(sorted(set(hard_split)))}`, where a single line "
                "exceeded the budget and was cut mid-line — those lenses saw a "
                "partial line."
            )
        else:
            audit += " Splits land on hunk/line boundaries; no lens saw a partial line."
    return audit


def main():
    global _DEADLINE
    _DEADLINE = time.monotonic() + REVIEW_BUDGET_S

    provider, key = provider_and_key()
    if not provider:
        print("::error::no review key set (need ANTHROPIC_API_KEY or OPENAI_KEY).")
        return 1

    try:
        model = resolve_model(provider)
        budget = int(os.environ.get("MAX_CHUNK_CHARS") or DEFAULT_CHUNK_CHARS)
        workers = int(os.environ.get("ADVERSARIAL_WORKERS") or DEFAULT_WORKERS)
        rng = resolve_range()
        diff = get_diff(rng.spec)
        chunks, oversized, hard_split = chunk_diff(diff, budget)
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

    def audit_for(reviewed=True):
        return build_audit(
            rng, diff, chunks, budget, oversized, hard_split, provider, model, reviewed
        )

    audit = audit_for()
    print(audit)

    if not diff.strip():
        # get_diff already asserted the range is genuinely empty.
        publish(
            "\n".join(
                [
                    MARKER,
                    "## 🛡️ Adversarial review",
                    "",
                    "✅ Empty diff — nothing to review.",
                    "",
                    audit,
                ]
            )
        )
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
        publish(
            "\n".join(
                [
                    MARKER,
                    "## 🛡️ Adversarial review",
                    "",
                    f"❌ **Blocked** — {errors} of {calls} lens/chunk reviews failed "
                    "to produce a readable result, so the diff was not fully "
                    "reviewed. Nothing here says the diff is wrong; the reviewer "
                    "could not run. See the job log for the per-lens "
                    "`::warning::` lines.",
                    "",
                    audit_for(reviewed=False),
                ]
            )
        )
        return 1

    findings = dedupe(findings)
    # Precision pass on blocking findings only: re-read each against its whole
    # file. Only an explicit clearance stops one blocking; every other outcome,
    # including an API error, leaves it blocking.
    findings = confirm_findings(provider, key, model, findings, rng.head, workers)
    body, blocking = render_markdown(audit, findings)
    publish(body)

    unknown = [f for f in findings if f["severity_norm"] == "unknown"]
    if unknown:
        print(
            f"::warning::{len(unknown)} finding(s) had an unrecognized severity "
            f"and did not block: {sorted({str(f.get('severity')) for f in unknown})}"
        )
    cleared = [
        f for f in findings if f["severity_norm"] == "high" and not is_blocking(f)
    ]
    if cleared:
        # Logged as well as rendered: a clearance is the one place this gate
        # gets quieter, so it leaves a trace in the job log too.
        print(
            f"::warning::{len(cleared)} blocking-severity finding(s) were cleared "
            "by the whole-file confirmation pass and did not block; they are "
            "listed in the review comment."
        )
    unreadable = [f for f in blocking if has_unreadable_severity(f)]
    if unreadable:
        print(
            f"::error::{len(unreadable)} finding(s) had no readable severity and "
            "were treated as blocking."
        )
    if blocking:
        print(f"::error::{len(blocking)} blocking-severity finding(s) block the merge.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
