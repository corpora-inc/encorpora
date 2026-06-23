#!/usr/bin/env python3
"""Adversarial PR review — the machine gatekeeper that replaces the human.

Runs three independent adversarial lenses (correctness, security, pack-compat)
over a PR diff using the Anthropic Messages API, posts a single sticky findings
comment, and exits non-zero iff there is an unresolved HIGH-severity finding.
That exit code becomes the `adversarial-review` required status check.

Self-contained: stdlib only (urllib), so the workflow needs no pip install.

Env:
  ANTHROPIC_API_KEY   required — the review model key
  ADVERSARIAL_MODEL   model id (default: claude-sonnet-4-6)
  GITHUB_TOKEN        for posting the sticky PR comment (optional in merge_group)
  GITHUB_REPOSITORY   owner/repo (set by Actions)
  PR_NUMBER           PR number (empty in merge_group → comment skipped)
  BASE_SHA, HEAD_SHA  diff range
  MAX_DIFF_BYTES      truncate the diff to control cost (default 200000)
"""

import json
import os
import re
import subprocess
import sys
import urllib.request
import urllib.error

API_URL = "https://api.anthropic.com/v1/messages"
MARKER = "<!-- adversarial-review -->"

LENSES = {
    "correctness": (
        "You are a correctness reviewer. Find logic bugs, broken edge cases, "
        "incorrect control flow, race conditions, off-by-one errors, and changes "
        "that break existing behavior. Ignore style."
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


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True).stdout


_SHA_RE = re.compile(r"^[0-9a-fA-F]{7,40}$")


def _safe_sha(value, fallback="HEAD"):
    # Only accept hex SHAs / HEAD so nothing like `--upload-pack=...` reaches git.
    value = (value or "").strip()
    if value == "HEAD" or _SHA_RE.match(value):
        return value
    return fallback


def get_diff():
    base = _safe_sha(os.environ.get("BASE_SHA"), fallback="")
    head = _safe_sha(os.environ.get("HEAD_SHA"), fallback="HEAD") or "HEAD"
    # Resolve a usable base.
    if not base or subprocess.call(
        ["git", "cat-file", "-e", f"{base}^{{commit}}"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    ) != 0:
        base = run(["git", "rev-parse", f"{head}^"]).strip()
    rng = f"{base}..{head}" if base else head
    diff = run(["git", "diff", "--unified=3", rng])
    max_bytes = int(os.environ.get("MAX_DIFF_BYTES", "200000"))
    if len(diff) > max_bytes:
        diff = diff[:max_bytes] + "\n\n[diff truncated for length]\n"
    return rng, diff


def call_anthropic(model, system, user):
    body = json.dumps({
        "model": model,
        "max_tokens": 2000,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }).encode()
    req = urllib.request.Request(
        API_URL, data=body, method="POST",
        headers={
            "x-api-key": os.environ["ANTHROPIC_API_KEY"],
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.loads(resp.read())
    parts = [b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"]
    return "".join(parts)


def parse_findings(text):
    # Scan for balanced {...} spans and return the first that parses and carries a
    # "findings" key — robust to prose or example braces around the JSON.
    starts = [i for i, c in enumerate(text) if c == "{"]
    for start in starts:
        depth = 0
        for j in range(start, len(text)):
            if text[j] == "{":
                depth += 1
            elif text[j] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        obj = json.loads(text[start:j + 1])
                    except json.JSONDecodeError:
                        break
                    if isinstance(obj, dict) and "findings" in obj:
                        return obj.get("findings", [])
                    break
    return []


def review_lens(model, name, instruction, diff):
    user = (
        f"{instruction}\n\nReview this unified diff. {SCHEMA_HINT}\n\n"
        f"```diff\n{diff}\n```"
    )
    try:
        raw = call_anthropic(model, "You are a rigorous, adversarial code reviewer.", user)
    except urllib.error.HTTPError as e:
        print(f"::warning::{name} lens API error {e.code}: {e.read()[:300]!r}")
        return []
    except Exception as e:  # noqa: BLE001
        print(f"::warning::{name} lens failed: {e}")
        return []
    out = []
    for f in parse_findings(raw):
        f["lens"] = name
        out.append(f)
    return out


def render_markdown(rng, all_findings):
    sev_order = {"high": 0, "medium": 1, "low": 2}
    all_findings.sort(key=lambda f: sev_order.get(str(f.get("severity")).lower(), 3))
    highs = [f for f in all_findings if str(f.get("severity")).lower() == "high"]
    lines = [MARKER, "## 🛡️ Adversarial review"]
    if not all_findings:
        lines.append("\n✅ No findings across correctness / security / pack-compat lenses.")
        return "\n".join(lines), highs
    verdict = "❌ **Blocked** — high-severity findings must be resolved." if highs \
        else "✅ **Pass** — only non-blocking findings."
    lines.append(f"\n{verdict}\n")
    lines.append(f"_Reviewed range `{rng}`._\n")
    icon = {"high": "🔴", "medium": "🟠", "low": "🟡"}
    for f in all_findings:
        sev = str(f.get("severity", "low")).lower()
        loc = f.get("file", "?")
        if f.get("line"):
            loc += f":{f['line']}"
        lines.append(
            f"- {icon.get(sev, '⚪')} **{sev.upper()}** [{f.get('lens')}] "
            f"`{loc}` — **{f.get('title', '').strip()}**  \n  {f.get('detail', '').strip()}"
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
            url, data=json.dumps(payload).encode() if payload else None,
            method=method, headers=hdr,
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
        print(f"::warning::could not post comment: {e}")


def main():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("::error::ANTHROPIC_API_KEY not set.")
        return 1
    model = os.environ.get("ADVERSARIAL_MODEL", "claude-sonnet-4-6")
    rng, diff = get_diff()
    if not diff.strip():
        print("Empty diff; nothing to review.")
        return 0
    findings = []
    for name, instruction in LENSES.items():
        findings += review_lens(model, name, instruction, diff)
    body, highs = render_markdown(rng, findings)
    post_sticky_comment(body)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as fh:
            fh.write(body + "\n")
    print(body)
    if highs:
        print(f"::error::{len(highs)} high-severity finding(s) block the merge.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
