"""Anthropic Messages API through the official SDK (optional dependency `anthropic`).

Used when ANTHROPIC_API_KEY (or another SDK credential) is available. Structured output via
`output_config.format = {type: json_schema, schema}`.
"""

from __future__ import annotations

import json

from .base import Backend, BackendError, Request, Response

# USD per million tokens (input, output) for cost accounting; unknown models count 0.
PRICES = {"claude-opus-5-5": (4.0, 20.0), "claude-sonnet-5-5": (2.0, 10.0), "claude-haiku-5-5": (0.10, 0.50)}


class AnthropicBackend(Backend):
    name = "anthropic"

    def __init__(self, model: str = "claude-sonnet-5-5", effort: str | None = None, client=None, **options):
        super().__init__(model, **options)
        self.effort = effort
        self._client = client

    def client(self):
        if self._client is None:
            try:
                import anthropic
            except ImportError:
                raise BackendError("pip install 'harvest-pipeline[anthropic]' for the anthropic backend",
                                   retryable=False)
            self._client = anthropic.Anthropic()
        return self._client

    supports_images = True

    @staticmethod
    def content(req: Request):
        if not req.images:
            return req.prompt
        import base64
        return [{"type": "image", "source": {"type": "base64", "media_type": mt, "data": base64.b64encode(b).decode()}}
                for mt, b in req.images] + [{"type": "text", "text": req.prompt}]

    def complete(self, req: Request) -> Response:
        output_config = {"format": {"type": "json_schema", "schema": req.schema}}
        if self.effort:
            output_config["effort"] = self.effort
        try:
            msg = self.client().messages.create(
                model=self.model, max_tokens=req.max_tokens, system=req.system,
                messages=[{"role": "user", "content": self.content(req)}], output_config=output_config,
            )
        except BackendError:
            raise
        except Exception as e:  # SDK errors: rate limits and 5xx are worth retrying
            status = getattr(e, "status_code", None)
            raise BackendError(f"anthropic: {e}", retryable=status is None or status == 429 or status >= 500)
        if getattr(msg, "stop_reason", None) == "refusal":
            raise BackendError("anthropic: refusal", retryable=False)
        text = next((b.text for b in msg.content if getattr(b, "type", "") == "text"), None)
        if text is None:
            raise BackendError("anthropic: no text block")
        try:
            out = json.loads(text)
        except json.JSONDecodeError as e:
            raise BackendError(f"anthropic: invalid JSON: {e}")
        u = msg.usage
        it, ot = int(getattr(u, "input_tokens", 0) or 0), int(getattr(u, "output_tokens", 0) or 0)
        pin, pout = PRICES.get(msg.model, (0.0, 0.0))
        return Response(output=out, model_id=msg.model,
                        usage={"input_tokens": it, "output_tokens": ot, "cost_usd": (it * pin + ot * pout) / 1e6})
