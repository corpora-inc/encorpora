"""Precompute the Instructor's tree turns for the browser build.

    python3 -I instructor-turns.py HARVEST_BIN PACK_DIR PUBKEY OUT_JSON

A browser cannot run harvest-core, and the Instructor answers every tapped
tree move (`open`, `rules`) from the course tree with no model and no learner
state. So the real engine answers them all here, once: starting from the
welcome turn, every `open` and `rules` follow-up is asked and the follow-ups
of each answer are followed in turn, until no new move is left. The output
(`crane-instructor/1`) holds the welcome, every such turn keyed by its input,
and the tree nodes the app searches for free text. `practice` and `focus`
depend on the learner and are answered in the app.
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path


def key(inp: dict) -> str | None:
    kind = inp.get("kind")
    if kind == "rules":
        return f"rules:{inp['node_id']}"
    if kind == "open":
        fields = ",".join(inp.get("fields") or [])
        return f"open:{inp['node_id']}" + (f":{fields}" if fields else "")
    return None


def run(harvest: str, pack: str, pubkey: str, scripts: list[dict]) -> list[dict]:
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(scripts, f)
        path = f.name
    try:
        r = subprocess.run([harvest, "converse", pack, path, "--pubkey", pubkey, "--json"],
                           capture_output=True, text=True, check=True)
    finally:
        Path(path).unlink()
    return [json.loads(line) for line in r.stdout.splitlines() if line.strip()]


def main() -> int:
    harvest, pack, pubkey, out = sys.argv[1:5]
    tree = json.loads(subprocess.run([harvest, "show", pack, "tree", "--pubkey", pubkey],
                                     capture_output=True, text=True, check=True).stdout)
    welcome = run(harvest, pack, pubkey, [{"id": "welcome", "welcome": True, "turns": []}])[0]["turns"][0]["turn"]
    turns: dict[str, dict] = {}
    todo = {k: f["input"] for f in welcome["follow_ups"] if f.get("input") and (k := key(f["input"]))}
    # Every node opens and shows its rules, whether or not a follow-up reaches it (free text lands anywhere).
    for n in tree["nodes"]:
        todo.setdefault(f"open:{n['node_id']}", {"kind": "open", "node_id": n["node_id"]})
        todo.setdefault(f"rules:{n['node_id']}", {"kind": "rules", "node_id": n["node_id"]})
    while todo:
        batch = list(todo.items())
        todo = {}
        results = run(harvest, pack, pubkey, [{"id": k, "welcome": False, "turns": [{"input": i}]} for k, i in batch])
        for (k, _), res in zip(batch, results):
            turn = res["turns"][0].get("turn")
            if turn is None:
                print(f"instructor-turns: {k}: {res['turns'][0]}", file=sys.stderr)
                return 1
            turn.pop("trace", None)
            turns[k] = turn
            for f in turn["follow_ups"]:
                if f.get("input") and (nk := key(f["input"])) and nk not in turns and nk not in todo:
                    todo[nk] = f["input"]
    welcome.pop("trace", None)
    doc = {"format": "crane-instructor/1", "welcome": welcome, "turns": turns, "nodes": tree["nodes"]}
    Path(out).write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")))
    print(f"instructor-turns: welcome + {len(turns)} turns, {len(tree['nodes'])} nodes -> {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
