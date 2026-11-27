#!/usr/bin/env bash
# Stands in for `harvest` on the Mac: runs the aarch64 Linux build on the lab machine over ssh,
# mapping the local pack mirror path to the lab path. Host alias: $HARVEST_HOST (default spark-lan).
set -euo pipefail
LOCAL_PREFIX="${HARVEST_LOCAL_PACKS:?}"
REMOTE_PREFIX="${HARVEST_REMOTE_PACKS:?}"
REMOTE_BIN="${HARVEST_REMOTE_BIN:?}"
args=()
for a in "$@"; do
  if [[ $a == "$LOCAL_PREFIX"* ]]; then a="$REMOTE_PREFIX${a#"$LOCAL_PREFIX"}"; fi
  # "@lab/…" names a file on the lab machine (e.g. the embedder GGUF), so configs stay machine-neutral.
  if [[ $a == @lab/* ]]; then a="${HARVEST_REMOTE_LAB:?set HARVEST_REMOTE_LAB for @lab/ paths}/${a#@lab/}"; fi
  args+=("$a")
done
exec ssh -o ControlMaster=auto -o ControlPath="$HOME/.ssh/cm-crane-eval-%r@%h" -o ControlPersist=900 \
  "${HARVEST_HOST:-spark-lan}" "$(printf '%q ' "$REMOTE_BIN" "${args[@]}" --pubkey "${HARVEST_REMOTE_PUBKEY:?}")"
