#!/usr/bin/env python3
"""
Merge translated pack metadata into a pack's manifest.json.

Inputs:
  - Source `.en.json` describing which keys to extract (e.g. {"name": "...", "description": "..."}).
  - A directory of `<lang>.json` files (one per language) with the same keys.
  - A pack `manifest.json` to write into.

Output: rewrites manifest.json with `<key>Localized` maps for every key
present in the source file. Existing manifest fields are preserved.

Example:
  python merge_manifest_localized.py \\
    corpan/packs/hover-runner/src/i18n/metadata.en.json \\
    --translations-dir corpan/packs/hover-runner/src/i18n/metadata-out \\
    --manifest corpan/packs/hover-runner/manifest.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("source", help="Source .en.json describing keys to localize")
    p.add_argument("--translations-dir", required=True, help="Dir of <lang>.json files")
    p.add_argument("--manifest", required=True, help="manifest.json to update in place")
    ns = p.parse_args()

    source = json.loads(Path(ns.source).read_text())
    if not isinstance(source, dict):
        raise SystemExit("source must be a JSON object")
    keys = list(source.keys())

    trans_dir = Path(ns.translations_dir).resolve()
    if not trans_dir.is_dir():
        raise SystemExit(f"translations-dir not found: {trans_dir}")

    manifest_path = Path(ns.manifest).resolve()
    manifest = json.loads(manifest_path.read_text())

    # Aggregate per-key localized maps
    localized: dict[str, dict[str, str]] = {k: {} for k in keys}
    files = sorted(trans_dir.glob("*.json"))
    for path in files:
        lang = path.stem
        data = json.loads(path.read_text())
        if not isinstance(data, dict):
            print(f"[warn] {path.name}: not a JSON object, skipping", file=sys.stderr)
            continue
        for k in keys:
            if k in data and isinstance(data[k], str) and data[k].strip():
                localized[k][lang] = data[k]

    # Also include the English source values (under "en") for completeness
    for k in keys:
        localized[k]["en"] = source[k]

    # Write into manifest as `<key>Localized`
    for k in keys:
        field = f"{k}Localized"
        manifest[field] = {code: localized[k][code] for code in sorted(localized[k].keys())}

    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"[merge] {manifest_path.name}: updated " + ", ".join(f"{k}Localized" for k in keys))
    for k in keys:
        print(f"  {k}: {len(localized[k])} languages")
    return 0


if __name__ == "__main__":
    sys.exit(main())
