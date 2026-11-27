"""Codex CLI: `codex exec --output-schema <file> -o <file>`, read-only sandbox, ephemeral session.

For a handful of calls only; bulk runs need the founder's go and a token ceiling.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

from .base import Backend, BackendError, Request, Response


class CodexBackend(Backend):
    name = "codex"

    def __init__(self, model: str = "default", binary: str = "codex", timeout: int = 900,
                 workdir: str = "/tmp/harvest-empty", **options):
        super().__init__(model, **options)
        self.binary = binary
        self.timeout = timeout
        self.workdir = Path(workdir)

    def complete(self, req: Request) -> Response:
        self.workdir.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="harvest-codex-") as td:
            schema_f, out_f = Path(td) / "schema.json", Path(td) / "out.json"
            schema_f.write_text(json.dumps(req.schema))
            cmd = [self.binary, "exec", "--skip-git-repo-check", "--ephemeral", "--sandbox", "read-only",
                   "--output-schema", str(schema_f), "-o", str(out_f), "-C", str(self.workdir)]
            if self.model != "default":
                cmd += ["-m", self.model]
            cmd.append("-")
            prompt = f"{req.system}\n\n{req.prompt}\n\nReply only with the JSON object the schema describes."
            try:
                proc = subprocess.run(cmd, input=prompt, capture_output=True, text=True, timeout=self.timeout)
            except subprocess.TimeoutExpired:
                raise BackendError(f"codex timed out after {self.timeout}s")
            except FileNotFoundError:
                raise BackendError(f"{self.binary} not found", retryable=False)
            if not out_f.exists():
                raise BackendError(f"codex exit {proc.returncode}: {proc.stderr.strip()[-400:]}")
            text = out_f.read_text()
        try:
            out = json.loads(text)
        except json.JSONDecodeError as e:
            raise BackendError(f"codex: invalid JSON: {e}")
        return Response(output=out, model_id=f"codex:{self.model}", usage={})
