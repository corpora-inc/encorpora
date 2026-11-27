"""Response cache: committed JSONL, one file per task, keyed by (task, prompt_version, input_sha256, model).

`model` is the requested model spec ("claude-cli:sonnet"), so a lookup needs no call; the exact
model id the backend reported is stored in the entry for provenance. Entries are appended as they
arrive (a crash loses nothing) and the file is rewritten sorted and de-duplicated on close, so
diffs between bakes are readable and a re-bake only calls models for changed inputs.
"""

from __future__ import annotations

import json
import sys
import threading
from pathlib import Path


def cache_key(task: str, prompt_version: str, input_sha256: str, model: str) -> tuple[str, str, str, str]:
    return (task, str(prompt_version), input_sha256, model)


class ResponseCache:
    def __init__(self, directory: str | Path):
        self.dir = Path(directory)
        self._entries: dict[str, dict[tuple, dict]] = {}
        self._used: dict[str, set[tuple]] = {}
        self._lock = threading.Lock()

    def _file(self, task: str) -> Path:
        return self.dir / f"{task}.jsonl"

    def _load(self, task: str) -> dict[tuple, dict]:
        if task not in self._entries:
            entries: dict[tuple, dict] = {}
            f = self._file(task)
            if f.exists():
                lines = f.read_text().splitlines()
                for n, line in enumerate(lines, 1):
                    if not line.strip():
                        continue
                    try:
                        e = json.loads(line)
                    except json.JSONDecodeError as exc:
                        if n == len(lines):
                            # an append cut short (crash, full disk): drop it; the call is redone
                            print(f"warning: {f}:{n}: dropping truncated last cache line", file=sys.stderr)
                            continue
                        raise SystemExit(f"{f}:{n}: corrupt cache line: {exc}")
                    entries[cache_key(e["task"], e["prompt_version"], e["input_sha256"], e["model"])] = e
            self._entries[task] = entries
            self._used[task] = set()
        return self._entries[task]

    def get(self, task: str, prompt_version: str, input_sha256: str, model: str) -> dict | None:
        with self._lock:
            k = cache_key(task, prompt_version, input_sha256, model)
            e = self._load(task).get(k)
            if e is not None:
                self._used[task].add(k)
            return e

    def put(self, entry: dict) -> None:
        for field in ("task", "prompt_version", "input_sha256", "model", "output"):
            if field not in entry:
                raise ValueError(f"cache entry missing {field}")
        with self._lock:
            k = cache_key(entry["task"], entry["prompt_version"], entry["input_sha256"], entry["model"])
            self._load(entry["task"])[k] = entry
            self._used[entry["task"]].add(k)
            self.dir.mkdir(parents=True, exist_ok=True)
            with self._file(entry["task"]).open("a") as fh:
                fh.write(json.dumps(entry, sort_keys=True, ensure_ascii=False) + "\n")

    def entries(self, task: str) -> list[dict]:
        with self._lock:
            return list(self._load(task).values())

    def tasks_on_disk(self) -> list[str]:
        return sorted(p.stem for p in self.dir.glob("*.jsonl")) if self.dir.exists() else []

    def close(self, prune: bool = False) -> None:
        """Rewrite each touched file sorted by key. With prune, drop entries this run never used."""
        with self._lock:
            for task, entries in self._entries.items():
                keep = {k: v for k, v in entries.items() if not prune or k in self._used.get(task, set())}
                if not keep and not self._file(task).exists():
                    continue
                lines = [json.dumps(keep[k], sort_keys=True, ensure_ascii=False)
                         for k in sorted(keep, key=lambda k: (keep[k].get("key", ""), k))]
                self.dir.mkdir(parents=True, exist_ok=True)
                tmp = self._file(task).with_suffix(".jsonl.tmp")
                tmp.write_text("\n".join(lines) + ("\n" if lines else ""))
                tmp.replace(self._file(task))
