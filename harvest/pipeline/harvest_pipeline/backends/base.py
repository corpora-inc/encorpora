"""One interface for every model backend.

A backend takes a Request (system prompt, user prompt, JSON schema) and returns a Response whose
`output` is a JSON object valid against the schema. The Runner around it adds retries with
backoff, a concurrency cap, a minimum interval between calls, an optional usage guard, and
per-run accounting of calls, tokens and cost.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field

import jsonschema


class BackendError(RuntimeError):
    """A call failed. `retryable` says whether trying again can help."""

    def __init__(self, msg: str, retryable: bool = True):
        super().__init__(msg)
        self.retryable = retryable


class UsageLimitReached(RuntimeError):
    """The usage guard says stop: no further calls this run."""


@dataclass
class Request:
    system: str
    prompt: str
    schema: dict
    name: str = "output"          # schema name for APIs that want one
    max_tokens: int = 16000
    images: list = field(default_factory=list)   # [(media_type, bytes)], shown before the prompt


@dataclass
class Response:
    output: dict
    model_id: str                 # exact model id the backend reports
    usage: dict = field(default_factory=dict)   # input_tokens, output_tokens, cost_usd, ...
    raw: dict | None = None


class Backend:
    """Subclasses set `name` and implement `complete`."""

    name = "base"

    def __init__(self, model: str, **options):
        self.model = model
        self.options = options

    @property
    def spec(self) -> str:
        """Cache identity of this backend+model (requested, not resolved)."""
        return f"{self.name}:{self.model}"

    def complete(self, req: Request) -> Response:  # pragma: no cover - interface
        raise NotImplementedError

    supports_images = False

    def check_guard(self) -> None:
        """Raise UsageLimitReached when the backend's own quota guard trips. Default: never."""


@dataclass
class Usage:
    calls: int = 0
    failures: int = 0
    retries: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    seconds: float = 0.0
    models: dict = field(default_factory=dict)

    def add(self, resp: Response, seconds: float) -> None:
        self.calls += 1
        self.seconds += seconds
        u = resp.usage or {}
        self.input_tokens += int(u.get("input_tokens", 0) or 0)
        self.output_tokens += int(u.get("output_tokens", 0) or 0)
        self.cost_usd += float(u.get("cost_usd", 0.0) or 0.0)
        self.models[resp.model_id] = self.models.get(resp.model_id, 0) + 1

    def as_dict(self) -> dict:
        return {**self.__dict__, "cost_usd": round(self.cost_usd, 6), "seconds": round(self.seconds, 2)}


class Runner:
    def __init__(self, backend: Backend, concurrency: int = 4, retries: int = 3, min_interval: float = 0.0,
                 backoff: float = 2.0, sleep=time.sleep):
        self.backend = backend
        self.concurrency = max(1, concurrency)
        self.retries = retries
        self.min_interval = min_interval
        self.backoff = backoff
        self.usage = Usage()
        self._lock = threading.Lock()
        self._last = 0.0
        self._sleep = sleep
        self.stopped: str | None = None

    def _pace(self) -> None:
        if self.min_interval <= 0:
            return
        with self._lock:
            wait = self._last + self.min_interval - time.monotonic()
            if wait > 0:
                self._sleep(wait)
            self._last = time.monotonic()

    def call(self, req: Request) -> Response:
        if self.stopped:
            raise UsageLimitReached(self.stopped)
        attempt = 0
        while True:
            try:
                self.backend.check_guard()
            except UsageLimitReached as e:
                self.stopped = str(e)
                raise
            self._pace()
            t0 = time.monotonic()
            try:
                resp = self.backend.complete(req)
                jsonschema.validate(resp.output, req.schema)
                with self._lock:
                    self.usage.add(resp, time.monotonic() - t0)
                return resp
            except jsonschema.ValidationError as e:
                err = BackendError(f"output does not match schema: {e.message}", retryable=True)
            except BackendError as e:
                err = e
            with self._lock:
                self.usage.failures += 1
            attempt += 1
            if not err.retryable or attempt > self.retries:
                raise err
            with self._lock:
                self.usage.retries += 1
            self._sleep(self.backoff ** attempt)
