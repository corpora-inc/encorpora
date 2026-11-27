"""Model backends. `make_backend({"backend": "claude-cli", "model": "sonnet", ...})`."""

from __future__ import annotations

from .base import Backend, BackendError, Request, Response, Runner, Usage, UsageLimitReached

__all__ = ["Backend", "BackendError", "Request", "Response", "Runner", "Usage", "UsageLimitReached",
           "make_backend", "BACKENDS"]

BACKENDS = ("claude-cli", "anthropic", "openai-compatible", "codex", "deterministic", "scripted")


def make_backend(cfg: dict) -> Backend:
    cfg = dict(cfg)
    kind = cfg.pop("backend")
    model = cfg.pop("model", None)
    for k in ("concurrency", "min_interval", "retries"):
        cfg.pop(k, None)
    if kind == "claude-cli":
        from .claude_cli import ClaudeCliBackend
        return ClaudeCliBackend(model or "sonnet", **cfg)
    if kind == "anthropic":
        from .anthropic_api import AnthropicBackend
        return AnthropicBackend(model or "claude-sonnet-5-5", **cfg)
    if kind == "openai-compatible":
        from .openai_compat import OpenAICompatBackend
        return OpenAICompatBackend(model or "gpt-oss-120b", **cfg)
    if kind == "codex":
        from .codex import CodexBackend
        return CodexBackend(model or "default", **cfg)
    if kind == "deterministic":
        from .deterministic import DeterministicBackend
        return DeterministicBackend(model or "rules", **cfg)
    if kind == "scripted":
        from .deterministic import ScriptedBackend
        return ScriptedBackend(model or "script", **cfg)
    raise SystemExit(f"unknown backend {kind!r}; known: {', '.join(BACKENDS)}")
