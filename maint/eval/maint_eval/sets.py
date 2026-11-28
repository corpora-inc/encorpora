"""Item files: held-out sets live outside the repository; the repository records only their hash and counts."""
from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path

from .paths import HELDOUT

SPLIT_SEED = 20261128


def path(task: str, part: str, version: str = "v1") -> Path:
    """part: raw | dev | heldout | review."""
    return HELDOUT / f"{task}-{part}-{version}.jsonl"


def load(p: Path) -> list[dict]:
    return [json.loads(x) for x in p.read_text().splitlines() if x.strip()] if p.exists() else []


def save(p: Path, items: list[dict]) -> None:
    p.write_text("".join(json.dumps(i, ensure_ascii=False, sort_keys=True) + "\n" for i in items))


def sha256(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def manifest(p: Path) -> dict:
    items = load(p)
    return {"file": p.name, "sha256": sha256(p), "n": len(items),
            "by_kind": dict(Counter(i.get("kind") for i in items)),
            "by_pack": dict(Counter(i.get("pack_id") for i in items)),
            "by_register": dict(Counter(i.get("register") for i in items))}
