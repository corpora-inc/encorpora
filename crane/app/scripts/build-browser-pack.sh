#!/usr/bin/env bash
# Build the crane pack from this checkout and put its browser copy, and the Instructor's
# precomputed tree turns, where the app reads them:
#
#   crane/app/scripts/build-browser-pack.sh            # -> crane/app/public/pack/crane-us.browser.json
#
# Runs on a Mac (native arm64 Rust) or Linux. It builds the harvest-core CLI, installs
# harvest-pipeline into a virtualenv, then runs crane/content/build-pack.sh, which builds the
# pack, verifies its signature and reads every table back through harvest-core (`showcheck`).
# Without HARVEST_SIGNING_KEY(_FILE) the pack is signed with an ephemeral test key: fine for a
# preview, never for a release (release-crane.yml signs with the production key).
#
# Environment: HARVEST_HOME (default ~/.cache/harvest: the eCFR cache), HARVEST_VENV (default
# $HARVEST_HOME/venv-browser-pack),
# PACK_OUT (default a fresh temp dir; keeps the signed pack for inspection).
set -euo pipefail

app="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo="$(cd "$app/../.." && pwd)"
export HARVEST_HOME="${HARVEST_HOME:-$HOME/.cache/harvest}"
venv="${HARVEST_VENV:-$HARVEST_HOME/venv-browser-pack}"
out="${PACK_OUT:-$(mktemp -d)}"

if [ "$(uname -s)" = Darwin ]; then
  # Native arm64 build on macOS: bundled SQLite, the macOS SDK and clang's runtime library.
  export CMAKE_DISABLE_FIND_PACKAGE_OpenSSL=ON
  SDKROOT="$(xcrun --sdk macosx --show-sdk-path)"
  export SDKROOT
  clang_lib="$(dirname "$(xcrun --find clang)")/../lib/clang"
  clang_rt="$(ls -d "$clang_lib"/*/lib/darwin 2>/dev/null | sort -V | tail -1 || true)"
  case "$clang_rt" in
    *" "*) echo "build-browser-pack: Xcode path has a space ($clang_rt); set RUSTFLAGS yourself" >&2; exit 1 ;;
  esac
  if [ -n "$clang_rt" ]; then export RUSTFLAGS="${RUSTFLAGS:-} -C link-arg=-L$clang_rt"; fi
fi

echo "build-browser-pack: harvest-core CLI" >&2
nice -n 20 cargo build --locked --release --bin harvest --manifest-path "$repo/harvest/core/Cargo.toml" >&2
export HARVEST_BIN="$repo/harvest/core/target/release/harvest"

echo "build-browser-pack: harvest-pipeline in $venv" >&2
py="$(command -v python3.12 || command -v python3.13 || command -v python3 || true)"
: "${py:?build-browser-pack: no python3 found (3.12 or newer)}"
[ -x "$venv/bin/python" ] || "$py" -m venv "$venv"
"$venv/bin/pip" install --quiet --upgrade "$repo/harvest/pipeline" >&2
export PATH="$venv/bin:$PATH"

echo "build-browser-pack: pack -> $out" >&2
nice -n 20 "$repo/crane/content/build-pack.sh" "$out" >&2

mkdir -p "$app/public/pack"
cp "$out/crane-us.browser.json" "$app/public/pack/crane-us.browser.json"
# The Instructor's tree turns, answered by the real engine (scripts/instructor-turns.py).
"$venv/bin/python" -I "$app/scripts/instructor-turns.py" "$HARVEST_BIN" "$out/pack" "$out/pack.pub" \
  "$app/public/pack/crane-us.instructor.json" >&2
echo "$app/public/pack/crane-us.browser.json"
