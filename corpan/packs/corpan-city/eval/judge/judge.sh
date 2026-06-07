#!/usr/bin/env bash
# Reusable LLM judge via Codex CLI (GPT-5.x) — NOT programmatic metrics.
# Usage: eval/judge/judge.sh <prompt-file> [out-file] [schema-file]
# The prompt file should contain the rubric + the transcript(s) to judge.
set -euo pipefail
PROMPT="${1:?prompt file required}"
OUT="${2:-/tmp/codex-verdict.md}"
SCHEMA="${3:-}"
ARGS=(--dangerously-bypass-approvals-and-sandbox --skip-git-repo-check -c mcp_servers='{}' -o "$OUT")
[ -n "$SCHEMA" ] && ARGS+=(--output-schema "$SCHEMA")
codex exec "${ARGS[@]}" - < "$PROMPT" >/dev/null 2>&1 || true
cat "$OUT"
