"""The real engine over HTTP (`harvest serve`), so the harness measures what the app runs."""
from __future__ import annotations

import json
import os
import urllib.request

DEFAULT_URL = os.environ.get("MAINT_EVAL_ENGINE", "http://127.0.0.1:4391")


class EngineError(RuntimeError):
    def __init__(self, method: str, error: dict):
        super().__init__(f"{method}: {error.get('code')}: {error.get('message')}")
        self.code = error.get("code")


class Engine:
    def __init__(self, url: str = DEFAULT_URL, timeout: float = 60):
        self.url = url.rstrip("/")
        self.timeout = timeout

    def call(self, method: str, params: dict | None = None):
        body = json.dumps({k: v for k, v in (params or {}).items() if v is not None}).encode()
        req = urllib.request.Request(f"{self.url}/api/{method}", data=body,
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=self.timeout) as r:
            env = json.loads(r.read())
        if not env.get("ok"):
            raise EngineError(method, env.get("error") or {})
        return env["result"]

    # -- conveniences ------------------------------------------------------
    def pack_info(self, pack_id: str) -> dict:
        return self.call("pack.info", {"pack_id": pack_id})

    def symptom_search(self, pack_id: str, text: str, k: int = 10, ranking: dict | None = None) -> dict:
        return self.call("symptom.search", {"pack_id": pack_id, "text": text, "k": k, "ranking": ranking})

    def trees(self, pack_id: str) -> list[dict]:
        return self.call("tree.list", {"pack_id": pack_id})

    def tree(self, pack_id: str, tree_id: str) -> dict:
        return self.call("tree.get", {"pack_id": pack_id, "tree_id": tree_id})

    def section(self, pack_id: str, section_id: str) -> dict:
        return self.call("manual.section", {"pack_id": pack_id, "section_id": section_id})

    def section_text(self, pack_id: str, section_id: str, depth: int = 3, limit: int = 6000) -> str:
        """The section's verbatim text with its descendants', in manual order, up to `limit` characters."""
        out: list[str] = []

        def walk(sid: str, d: int) -> None:
            if sum(len(x) for x in out) > limit:
                return
            v = self.section(pack_id, sid)
            sec = v["section"]
            head = sec.get("heading")
            txt = (sec.get("text") or "").strip()
            seen = " ".join(" ".join(out).split())
            if txt and " ".join(txt.split()) not in seen:  # a parent often already holds its children's text
                out.append(f"{head}: {txt}" if head and not txt.startswith(head) else txt)
            if d > 0:
                for c in v.get("children") or []:
                    walk(c["section_id"], d - 1)

        walk(section_id, depth)
        s = "\n".join(x for x in out if x.strip())
        return s[:limit]
