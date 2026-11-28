#!/usr/bin/env bash
# Build a maintenance pack from this checkout with no model call (the committed response cache),
# validate its fault trees with the core, read it back through `harvest serve`'s engine, and
# report coverage (and, for the proof corpus, precision and recall against its answer key).
#
#   maint/content/build-pack.sh OUT_DIR [CORPUS.yaml]      (default: maint/content/proof/corpus.yaml)
#
# Needs `harvest-bake` (harvest/pipeline) and the harvest-core CLI (HARVEST_BIN, default `harvest`).
# Environment:
#   HARVEST_SIGNING_KEY / HARVEST_SIGNING_KEY_FILE  the signing key; without one an ephemeral test
#       key signs this run only (never ship that pack). MAINT_PACK_REQUIRE_KEY=1 refuses to run without.
#   MAINT_PACK_ARM   the arm whose cached extraction builds the pack (default: the corpus's release_arm)
#   MAINT_PACK_EMBEDDER  hash (default) or embeddinggemma-2
#   MAINT_MIN_COVERAGE   fail below this share of warnings and cautions attached (default 0.98)
#
# Output in OUT_DIR: pack/ (signed), pack.pub, build.json, coverage.json, score.json (proof only).
set -euo pipefail

out="${1:?usage: build-pack.sh OUT_DIR [CORPUS.yaml]}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
corpus="${2:-$here/proof/corpus.yaml}"
bake="${HARVEST_BAKE:-harvest-bake}"
harvest="${HARVEST_BIN:-harvest}"
arm=(); [ -n "${MAINT_PACK_ARM:-}" ] && arm=(--arm "$MAINT_PACK_ARM")
mkdir -p "$out"
out="$(cd "$out" && pwd)"

if [ -z "${HARVEST_SIGNING_KEY:-}" ] && [ -z "${HARVEST_SIGNING_KEY_FILE:-}" ]; then
  if [ "${MAINT_PACK_REQUIRE_KEY:-0}" = 1 ]; then
    echo "build-pack: MAINT_PACK_REQUIRE_KEY=1 and no signing key is set" >&2
    exit 1
  fi
  echo "build-pack: no signing key set; signing with an ephemeral test key (do not ship this pack)" >&2
  tmp="$(mktemp -d)"
  trap '(command -v trash >/dev/null && trash "$tmp") 2>/dev/null || true' EXIT   # a temp dir; CI discards it anyway
  "$bake" keygen "$tmp/test-key.pem" >/dev/null
  export HARVEST_SIGNING_KEY_FILE="$tmp/test-key.pem"
fi
"$bake" pubkey > "$out/pack.pub"

"$bake" fetch "$corpus" >/dev/null
"$bake" maint build "$corpus" "${arm[@]}" --out "$out/pack" --harvest "$harvest" --pubkey "$out/pack.pub" \
  --embedder "${MAINT_PACK_EMBEDDER:-hash}" > "$out/build.json"
"$bake" verify "$out/pack" --pubkey "$out/pack.pub"
"$harvest" verify "$out/pack" --pubkey "$out/pack.pub"
python3 - "$out/build.json" <<'PY'
import json, sys
b = json.load(open(sys.argv[1]))
if b["cache_misses"]:
    sys.exit(f"build-pack: units with no cached extraction (not in the pack): {b['cache_misses']}")
print(f"build-pack: verdicts {b['verdicts']}, graph {b['graph']}, rounds {len(b['rounds'])}")
PY
"$bake" maint coverage "$corpus" "${arm[@]}" --pack "$out/pack" --json > "$out/coverage.json"
python3 - "$out/coverage.json" "${MAINT_MIN_COVERAGE:-0.98}" <<'PY'
import json, sys
c = json.load(open(sys.argv[1])); need = float(sys.argv[2])
wc = c["warnings_cautions"]
print(f"build-pack: warnings+cautions attached {wc['attached']}/{wc['present']}, "
      f"question boxes {c['questions']['attached']}/{c['questions']['present']}")
if wc["rate"] < need:
    sys.exit(f"build-pack: coverage {wc['rate']:.1%} is below {need:.0%}")
PY
expected="$(dirname "$corpus")/pump40-expected.json"
if [ -f "$expected" ]; then
  "$bake" maint score "$corpus" "${arm[@]}" --pack "$out/pack" --expected "$expected" --json > "$out/score.json"
  "$bake" maint score "$corpus" "${arm[@]}" --pack "$out/pack" --expected "$expected"
fi
