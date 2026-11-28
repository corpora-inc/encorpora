"""OpenAI-compatible chat completions (llama-server, vLLM, any local server): the open-weight path.

Two structured-output modes:
  mode: json_schema  -> response_format {type: json_schema, json_schema: {name, schema, strict}}
  mode: tools        -> one function tool whose parameters are the schema, tool_choice forced
No data leaves the host the URL names.
"""

from __future__ import annotations

import base64
import json
import os
import urllib.error
import urllib.request

from .base import Backend, BackendError, Request, Response


class OpenAICompatBackend(Backend):
    name = "openai-compatible"

    def __init__(self, model: str = "gpt-oss-120b", base_url: str = "http://127.0.0.1:8080/v1",
                 mode: str = "json_schema", api_key_env: str | None = None, timeout: int = 1800,
                 temperature: float | None = None, reasoning_effort: str | None = None, extra: dict | None = None,
                 max_tokens: int | None = None, vision: bool = False, **options):
        super().__init__(model, **options)
        self.supports_images = vision
        self.base_url = base_url.rstrip("/")
        self.mode = mode
        self.api_key = os.environ.get(api_key_env) if api_key_env else None
        self.timeout = timeout
        self.temperature = temperature
        self.reasoning_effort = reasoning_effort
        self.extra = extra or {}
        self.max_tokens = max_tokens

    def body(self, req: Request) -> dict:
        user = req.prompt
        if req.images:   # llama-server with a vision projector, vLLM, any OpenAI-style vision server
            user = [{"type": "image_url", "image_url": {"url": f"data:{mt};base64,{base64.b64encode(b).decode()}"}}
                    for mt, b in req.images] + [{"type": "text", "text": req.prompt}]
        body = {
            "model": self.model,
            "messages": [{"role": "system", "content": req.system}, {"role": "user", "content": user}],
            "max_tokens": self.max_tokens or req.max_tokens,
        }
        if self.temperature is not None:
            body["temperature"] = self.temperature
        if self.reasoning_effort:
            body["reasoning_effort"] = self.reasoning_effort
        if self.mode == "tools":
            body["tools"] = [{"type": "function", "function": {
                "name": req.name, "description": "Return the result.", "parameters": req.schema}}]
            body["tool_choice"] = {"type": "function", "function": {"name": req.name}}
        else:
            body["response_format"] = {"type": "json_schema",
                                       "json_schema": {"name": req.name, "schema": req.schema, "strict": True}}
        body.update(self.extra)
        return body

    def post(self, body: dict) -> dict:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        r = urllib.request.Request(f"{self.base_url}/chat/completions", data=json.dumps(body).encode(),
                                   headers=headers, method="POST")
        try:
            with urllib.request.urlopen(r, timeout=self.timeout) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:400]
            raise BackendError(f"HTTP {e.code}: {detail}", retryable=e.code == 429 or e.code >= 500)
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            raise BackendError(f"connection: {e}")

    def complete(self, req: Request) -> Response:
        data = self.post(self.body(req))
        try:
            choice = data["choices"][0]
            msg = choice["message"]
        except (KeyError, IndexError):
            raise BackendError(f"malformed response: {str(data)[:300]}")
        if choice.get("finish_reason") == "length":
            raise BackendError("output truncated at max_tokens")
        if self.mode == "tools" and msg.get("tool_calls"):
            text = msg["tool_calls"][0]["function"]["arguments"]
        else:
            text = msg.get("content") or ""
        try:
            out = json.loads(text) if isinstance(text, str) else text
        except json.JSONDecodeError as e:
            raise BackendError(f"invalid JSON: {e}: {text[:200]}")
        if not isinstance(out, dict):
            raise BackendError("output is not a JSON object")
        u = data.get("usage") or {}
        return Response(output=out, model_id=data.get("model") or self.model,
                        usage={"input_tokens": u.get("prompt_tokens", 0), "output_tokens": u.get("completion_tokens", 0),
                               "cost_usd": 0.0})
