"""Backends with no model.

`deterministic` asks the task itself for its output (`Task.deterministic(input)`): rule-based
tasks, and tests. `scripted` replays canned outputs keyed by prompt substring, for tests.
"""

from __future__ import annotations

from typing import Callable

from .base import Backend, BackendError, Request, Response


class DeterministicBackend(Backend):
    name = "deterministic"

    def __init__(self, model: str = "rules", fn: Callable[[Request], dict] | None = None, **options):
        super().__init__(model, **options)
        self.fn = fn

    def complete(self, req: Request) -> Response:
        if self.fn is None:
            raise BackendError("deterministic backend has no function for this task", retryable=False)
        out = self.fn(req)
        if out is None:
            raise BackendError("task has no deterministic output for this input", retryable=False)
        return Response(output=out, model_id=f"deterministic:{self.model}", usage={})


class ScriptedBackend(Backend):
    """Test double: `responses` maps a substring of the prompt to an output (or a callable)."""

    name = "scripted"

    def __init__(self, model: str = "script", responses: dict | Callable | None = None, model_id: str | None = None,
                 **options):
        super().__init__(model, **options)
        self.responses = responses or {}
        self.model_id = model_id or f"scripted-{model}"
        self.calls: list[Request] = []

    def complete(self, req: Request) -> Response:
        self.calls.append(req)
        if callable(self.responses):
            out = self.responses(req)
        else:
            out = next((v for k, v in self.responses.items() if k in req.prompt), None)
            out = out(req) if callable(out) else out
        if out is None:
            raise BackendError("no scripted response", retryable=False)
        return Response(output=out, model_id=self.model_id, usage={"input_tokens": len(req.prompt) // 4,
                                                                  "output_tokens": 10, "cost_usd": 0.001})
