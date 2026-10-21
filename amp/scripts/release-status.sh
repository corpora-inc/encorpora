#!/usr/bin/env bash
# What AMP runs, and what it would run next. Public API and health endpoints
# only: no cluster access, no secrets. Uses an authenticated `gh` when there is
# one (higher rate limit), otherwise anonymous GitHub API requests.
#
# Usage: amp/scripts/release-status.sh
#   Env: AMP_PROD_URL (default https://amp.corpora.inc),
#        AMP_STAGE_URL (default https://amp-stage.corpora.inc),
#        AMP_STATUS_SCAN (amp commits searched for the newest green; default
#        30 with gh, 12 anonymously)
#
# "Green" is the deploy rule (docs/deployment.md, Releases): some run of the CI
# workflow on that commit concluded `amp` and `ci-gate`
# SUCCESS at their latest attempt. Cancelled, superseded, skipped or missing
# runs are not green.
set -euo pipefail
repo=corpora-inc/encorpora
prod=${AMP_PROD_URL:-https://amp.corpora.inc}
stage=${AMP_STAGE_URL:-https://amp-stage.corpora.inc}
scan=${AMP_STATUS_SCAN:-}
required='["amp", "ci-gate"]'

# About two requests per commit searched: anonymous requests (60 an hour)
# search fewer.
if command -v gh > /dev/null && gh auth status > /dev/null 2>&1; then
  api() { gh api "$1"; }
  scan=${scan:-30}
else
  api() { curl --fail --silent --show-error --header "Accept: application/vnd.github+json" "https://api.github.com/$1"; }
  scan=${scan:-12}
fi

commits=$(api "repos/$repo/commits?sha=main&path=amp&per_page=100")
sha_at() { jq -r ".[$1].sha // empty" <<<"$commits"; }
subject() { jq -r --arg s "$1" '.[] | select(.sha == $s) | .commit.message | split("\n")[0] | if length > 60 then .[0:59] + "…" else . end' <<<"$commits"; }
index_of() { jq -r --arg s "$1" '[.[].sha] | index($s) // empty' <<<"$commits"; }

# verdict <sha>: "green", or "red: …", "pending: …", "not run: …".
verdict() {
  local runs suite results collected='[]'
  runs=$(api "repos/$repo/actions/runs?head_sha=$1&per_page=20" |
    jq -c '[.workflow_runs[] | select(.name == "CI") | {suite: .check_suite_id, status}]')
  [ "$(jq length <<<"$runs")" -gt 0 ] || { echo "not run: no CI run"; return; }
  for suite in $(jq -r '.[].suite' <<<"$runs"); do
    results=$(api "repos/$repo/check-suites/$suite/check-runs?filter=latest&per_page=100" |
      jq --argjson required "$required" '[.check_runs[] | select(.name as $n | $required | index($n))
        | {name, result: (.conclusion // .status)}]')
    if jq -e --argjson required "$required" \
      'map(select(.result == "success") | .name) | unique == ($required | sort)' <<<"$results" > /dev/null; then
      echo green; return
    fi
    collected=$(jq -c --argjson more "$results" '. + $more' <<<"$collected")
  done
  jq -r --argjson runs "$runs" '
    map(select(.result | IN("failure", "timed_out", "startup_failure", "action_required"))
      | "\(.name) \(.result | gsub("_"; " "))") | unique as $failed
    | if ($failed | length) > 0 then "red: \($failed | join(", "))"
      elif any($runs[]; .status != "completed") or any(.[]; .result | IN("queued", "in_progress", "pending", "waiting", "requested"))
        then "pending: CI running or queued"
      else "not run: cancelled, skipped or superseded" end' <<<"$collected"
}

# health <base url>: "<commit> <builtAt>", or "- -" when the release reports none.
health() {
  curl --fail --silent --max-time 15 "$1/api/v1/health" |
    jq -r '"\(.commit // "-") \(.builtAt // "-")"' 2> /dev/null || echo "? ?"
}

head_sha=$(sha_at 0)
head_verdict=$(verdict "$head_sha")
green_sha=""
if [ "$head_verdict" = green ]; then green_sha=$head_sha; else
  for ((i = 1; i < scan; i++)); do
    sha=$(sha_at "$i"); [ -n "$sha" ] || break
    if [ "$(verdict "$sha")" = green ]; then green_sha=$sha; break; fi
  done
fi

row() { printf '%-13s %-13s %s\n' "$1" "$2" "$3"; }
echo "AMP release status: $repo main, commits touching amp/"
echo
row "main head" "${head_sha:0:12}" "$head_verdict · $(subject "$head_sha")"
if [ -n "$green_sha" ]; then row "newest green" "${green_sha:0:12}" "$(subject "$green_sha")"
else row "newest green" "none" "in the newest $scan amp commits; production holds"; fi

behind() { # <env> <commit>
  local live=$2 i g
  i=$(index_of "$live")
  if [ -z "$i" ]; then
    echo "$1 runs a commit outside the newest 100 amp commits on main (or not on main)."
    return
  fi
  if [ -z "$green_sha" ]; then echo "$1 is $i amp commits behind main; no green commit to compare."; return; fi
  g=$(index_of "$green_sha")
  if [ "$i" -ge "$g" ]; then echo "$1 is $i amp commits behind main and $((i - g)) behind green."
  else echo "$1 is $i amp commits behind main and $((g - i)) ahead of green: it runs an unverified commit."; fi
}
summary=()
for env in prod stage; do
  if [ "$env" = prod ]; then url=$prod; else url=$stage; fi
  read -r commit built < <(health "$url")
  case "$commit" in
    "?") row "$env" "unreachable" "$url"; summary+=("$env is unreachable.") ;;
    "-") row "$env" "unknown" "$url reports no build commit (image predates commit stamping)" ;;
    *) row "$env" "${commit:0:12}" "built $built · $url"; summary+=("$(behind "$env" "$commit")") ;;
  esac
done
echo
[ "${#summary[@]}" -eq 0 ] || printf '%s\n' "${summary[@]}"
