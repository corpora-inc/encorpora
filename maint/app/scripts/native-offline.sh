#!/usr/bin/env bash
# The offline claim for the native engine path, twice:
#   1. the tests in src-tauri/tests/offline.rs (no internet socket at any moment
#      without hub or helper; only loopback to the helper with one);
#   2. the no-hub, no-helper test again under macOS sandbox-exec with every
#      network operation denied: any attempt fails the run.
set -euo pipefail
cd "$(dirname "$0")/../src-tauri"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$HOME/.cache/harvest/target-maint-tauri}"
nice -n 20 cargo test --test offline -- --test-threads=1
BIN="$(nice -n 20 cargo test --test offline --no-run --message-format=json 2>/dev/null | python3 -c 'import json,sys
for l in sys.stdin:
    m=json.loads(l)
    if m.get("executable") and "offline" in m.get("target",{}).get("name",""): print(m["executable"])' | tail -1)"
sandbox-exec -p '(version 1)(allow default)(deny network*)' "$BIN" no_socket_at_all_without_hub_or_helper --exact --test-threads=1
echo "offline: passed under a sandbox that denies all networking"
