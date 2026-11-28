#!/usr/bin/env bash
# A development packs root for the maintenance app: the pump proof manual (variant 2, rules arm) and
# the ArduPilot pre-arm pack, built from this checkout with no model call, signed with a development
# key and installed with harvest-core, ready for `harvest serve`.
#
#   maint/content/dev-packs.sh [ROOT]        (default: ~/.cache/harvest/packs/maint-dev)
#
# Writes ROOT/dev-key.pem (development only; never ship), ROOT/pack.pub, ROOT/root/ (the installed
# packs: serve it with `harvest serve ROOT/root --pubkey ROOT/pack.pub --records ROOT/records.db`),
# and ROOT/build/<pack>/ (the built pack directories and their reports). Vectors: EmbeddingGemma 2
# (MAINT_DEV_EMBEDDER, default embeddinggemma-2: the GGUF in $HARVEST_HOME/models, served for the bake by a
# local llama-server started and stopped by harvest-bake; or HARVEST_EMBED_BASE_URL).
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dest="${1:-$HOME/.cache/harvest/packs/maint-dev}"
bake="${HARVEST_BAKE:-harvest-bake}"
harvest="${HARVEST_BIN:-harvest}"
# a rebuild replaces the installed packs (same version numbers): set the old root aside first
if [ -d "${dest}/root" ]; then
  (command -v trash >/dev/null && trash "${dest}/root") || mv "${dest}/root" "${dest}/root.old.$(date +%s)"
fi
mkdir -p "$dest/build" "$dest/root"
dest="$(cd "$dest" && pwd)"
[ -f "$dest/dev-key.pem" ] || "$bake" keygen "$dest/dev-key.pem" >/dev/null
export HARVEST_SIGNING_KEY_FILE="$dest/dev-key.pem"
"$bake" pubkey > "$dest/pack.pub"

"$bake" fetch "$here/proof/corpus-v2.yaml" >/dev/null
"$bake" maint build "$here/proof/corpus-v2.yaml" --arm rules --out "$dest/build/pump40v2-proof" \
  --harvest "$harvest" --pubkey "$dest/pack.pub" --embedder "${MAINT_DEV_EMBEDDER:-embeddinggemma-2}" \
  > "$dest/build/pump40v2-proof.build.json"
"$bake" fetch "$here/ardupilot/corpus.yaml" >/dev/null
"$bake" maint table-build "$here/ardupilot/corpus.yaml" --out "$dest/build/ardupilot-prearm" \
  --harvest "$harvest" --pubkey "$dest/pack.pub" --embedder "${MAINT_DEV_EMBEDDER:-embeddinggemma-2}" \
  > "$dest/build/ardupilot-prearm.build.json"

for p in pump40v2-proof ardupilot-prearm; do
  "$harvest" verify "$dest/build/$p" --pubkey "$dest/pack.pub"
  "$harvest" install "$dest/root" "$dest/build/$p" --pubkey "$dest/pack.pub"
done
# the fleet's asset registry with each unit's events (harvest-assets/1), for `asset.import`
cp "$dest/build/pump40v2-proof.registry.json" "$dest/fleet-registry.json"
echo "packs root: $dest/root   public key: $dest/pack.pub   fleet registry: $dest/fleet-registry.json"
echo "serve: $harvest serve $dest/root --pubkey $dest/pack.pub --records $dest/records.db"
