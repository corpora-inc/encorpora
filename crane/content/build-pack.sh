#!/usr/bin/env bash
# Build the crane pack from this checkout, then read every table back through harvest-core
# (`harvest-bake showcheck`). CI runs it on every change to the pack's inputs (crane-pack job);
# the release workflow runs the same script and bundles its output in the app.
#
#   crane/content/build-pack.sh OUT_DIR
#
# Needs `harvest-bake` (harvest/pipeline) and the harvest-core CLI (HARVEST_BIN, default
# `harvest`). The eCFR sources are fetched at the dates pinned in corpus.sources.lock.json
# (cached under $HARVEST_HOME/raw); no model is called: enrichment comes from the committed cache.
#
# Environment:
#   HARVEST_SIGNING_KEY / HARVEST_SIGNING_KEY_FILE  the pack signing key. Without one an
#       ephemeral key is made for this run only: fine for a test, never for a release.
#   CRANE_PACK_REQUIRE_KEY=1  refuse to run without a signing key (release builds set it).
#   CRANE_PACK_EMBEDDER  hash (default; no model) or embeddinggemma-2 (release; needs the GGUF in
#       $HARVEST_HOME/models and llama-server, or HARVEST_EMBED_BASE_URL).
#   HARVEST_PACK_VERSION  the pack version (default: today-1).
#
# Output in OUT_DIR:
#   pack/                  <pack_id>-<version>.sqlite + manifest.json (the signed pack)
#   pack.pub               the public key that verifies it
#   crane-us.browser.json  everything the read API returned (harvest-show/1), for browser builds
#   showcheck.json         what was read, and any problems
set -euo pipefail

out="${1:?usage: build-pack.sh OUT_DIR}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bake="${HARVEST_BAKE:-harvest-bake}"
harvest="${HARVEST_BIN:-harvest}"
mkdir -p "$out"
out="$(cd "$out" && pwd)"

if [ -z "${HARVEST_SIGNING_KEY:-}" ] && [ -z "${HARVEST_SIGNING_KEY_FILE:-}" ]; then
  if [ "${CRANE_PACK_REQUIRE_KEY:-0}" = 1 ]; then
    echo "build-pack: CRANE_PACK_REQUIRE_KEY=1 and no signing key is set" >&2
    exit 1
  fi
  echo "build-pack: no signing key set; signing with an ephemeral test key (do not ship this pack)" >&2
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  "$bake" keygen "$tmp/test-key.pem" >/dev/null
  export HARVEST_SIGNING_KEY_FILE="$tmp/test-key.pem"
fi
"$bake" pubkey > "$out/pack.pub"

"$bake" build "$here/corpus.yaml" --embedder "${CRANE_PACK_EMBEDDER:-hash}" --out "$out/pack" > "$out/build.json"
"$bake" verify "$out/pack" --pubkey "$out/pack.pub"
"$harvest" verify "$out/pack" --pubkey "$out/pack.pub"
if ! "$bake" showcheck "$out/pack" --harvest "$harvest" --pubkey "$out/pack.pub" --app-data \
    --out "$out/crane-us.browser.json" > "$out/showcheck.json"; then
  cat "$out/showcheck.json" >&2
  exit 1
fi
cat "$out/showcheck.json"
