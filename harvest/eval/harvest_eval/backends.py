"""Systems under test. Each returns one normalized response per question.

* ``harvest`` -- the core CLI, ``harvest ask <pack> "<q>" --json`` (CONTRACT).
* ``openai``  -- any OpenAI-compatible chat endpoint, no retrieval (baseline).
* ``claude``  -- headless Claude CLI, no retrieval, no tools (frontier baseline).
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any

from .corpus import Corpus
from .sections import Normalizer, cites_in_text

DEFAULT_BASELINE_PROMPT = (
    "You answer questions using the regulations named by the evaluator. Answer concisely and "
    "exactly, with the numbers and conditions that apply. Cite each rule you rely on by its "
    "section and paragraph. If the question cannot be answered from those regulations, or needs "
    "information you do not have, say that you cannot answer it instead of guessing.")

CLAUDE_FLAGS = ["--setting-sources", "", "--strict-mcp-config", "--disable-slash-commands",
                "--tools", "", "--no-session-persistence"]
EMPTY_DIR = os.environ.get("HARVEST_EVAL_EMPTY_DIR", "/tmp/harvest-empty")


@dataclass
class Response:
    ok: bool
    error: str | None = None
    mode: str | None = None              # baked | composed | declined | text
    text: str = ""                       # plain answer text (all segments joined)
    claims: list[str] = field(default_factory=list)
    citations: list[str] = field(default_factory=list)
    quotes: list[dict] = field(default_factory=list)   # [{section_id, text}]
    retrieved: list[str] = field(default_factory=list)  # ranked distinct section ids
    elapsed_ms: float | None = None      # reported by the system
    wall_ms: float | None = None         # measured by the harness
    model: str | None = None
    pack_version: str | None = None
    check: dict | None = None
    raw: Any = None

    def to_json(self) -> dict:
        return dict(self.__dict__)

    @classmethod
    def from_json(cls, d: dict) -> "Response":
        return cls(**d)


SENT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9(\"'“])")
# A composed answer labels each quoted section with a text segment such as
# "§1926.1437(m)(1) Load charts": a heading, not a claim to check.
HEADING_RE = re.compile(r"^§\s?[\w.\-]+(?:\([^()\s]+\))*(?:\s+(?!.*\b(?:must|shall|may|is|are|required)\b)[^0-9.!?;:\n]{0,80})?$",
                        re.IGNORECASE)
TABLE_LABEL_RE = re.compile(r"^Table [\w.\-]+ to §\s?[\w.\-]+(?:\s+Table [\w.\-]+)?$")


def split_claims(text: str) -> list[str]:
    out = []
    for para in re.split(r"\n\s*\n|\n[-*•]\s+|\n\d+\.\s+", text or ""):
        for s in SENT_RE.split(para.strip()):
            s = s.strip(" -*•\n")
            if len(s) >= 12:
                out.append(s)
    return out


class HarvestBackend:
    kind = "harvest"

    def __init__(self, cfg: dict, corpus: Corpus | None, normalize: Normalizer):
        self.name = cfg["name"]
        self.binary = cfg.get("binary", "harvest")
        self.pack = cfg["pack"]
        self.llm = cfg.get("llm")
        self.role = cfg.get("role")
        self.pass_equip = cfg.get("pass_equip", False)
        self.equip_map = cfg.get("equip_map", {})
        self.timeout = cfg.get("timeout_s", 300)
        self.extra = cfg.get("extra_args", [])
        self.corpus = corpus
        self.normalize = normalize

    def ask(self, item: dict) -> Response:
        cmd = [self.binary, "ask", str(self.pack), item["question"], "--json"]
        if self.llm:
            cmd += ["--llm", str(self.llm)]
        if self.role:
            cmd += ["--role", self.role]
        eq = item.get("equipment")
        if self.pass_equip and eq:
            cmd += ["--equip", self.equip_map.get(eq, eq)]
        cmd += self.extra
        t0 = time.perf_counter()
        try:
            p = subprocess.run(cmd, capture_output=True, text=True, timeout=self.timeout)
        except (subprocess.TimeoutExpired, FileNotFoundError, PermissionError) as e:
            return Response(ok=False, error=f"{type(e).__name__}: {e}")
        wall = (time.perf_counter() - t0) * 1000
        if p.returncode != 0:
            return Response(ok=False, error=f"exit {p.returncode}: {p.stderr.strip()[-500:]}", wall_ms=wall)
        try:
            out = json.loads(p.stdout)
        except json.JSONDecodeError as e:
            return Response(ok=False, error=f"bad json: {e}: {p.stdout[:300]}", wall_ms=wall)
        return self.parse(out, wall)

    def parse(self, out: dict, wall: float | None) -> Response:
        n = self.normalize
        body = out.get("body") or []
        texts, quotes, cites = [], [], []
        claims: list[str] = []
        for seg in body:
            t = seg.get("t")
            if t == "text":
                texts.append(seg.get("text", ""))
                label = seg.get("text", "").strip()
                if not (HEADING_RE.match(label) or TABLE_LABEL_RE.match(label)):
                    claims.extend(split_claims(seg.get("text", "")))
            elif t == "quote":
                quotes.append({"section_id": n(seg.get("section_id", "")), "text": seg.get("text", "")})
                texts.append(f"“{seg.get('text', '')}”")
                cites.append(n(seg.get("section_id", "")))
            elif t == "cite":
                cites.append(n(seg.get("section_id", "")))
        cites = list(dict.fromkeys([n(c) for c in out.get("citations") or []] + cites))
        retrieved: list[str] = []
        for r in out.get("retrieved") or []:
            ref = r.get("ref_id") or r.get("chunk_id") or ""
            kind = r.get("ref_kind") or (self.corpus.chunk_kind(r.get("chunk_id", "")) if self.corpus else None)
            secs = self.corpus.sections_for_ref(kind, ref) if self.corpus else [ref]
            for s in secs:
                s = n(s)
                if s and s not in retrieved:
                    retrieved.append(s)
        return Response(ok=True, mode=out.get("mode"), text=" ".join(texts).strip(), claims=claims,
                        citations=cites, quotes=quotes, retrieved=retrieved,
                        elapsed_ms=out.get("elapsed_ms"), wall_ms=wall, model=out.get("model"),
                        pack_version=out.get("pack_version"), check=out.get("check"), raw=out)


class _TextBaseline:
    def __init__(self, cfg: dict, normalize: Normalizer):
        self.name = cfg["name"]
        self.system = cfg.get("system_prompt", DEFAULT_BASELINE_PROMPT)
        self.timeout = cfg.get("timeout_s", 300)
        self.normalize = normalize
        self.cite_prefix = cfg.get("cite_prefix", "29cfr")

    def finish(self, text: str, wall: float, model: str | None, raw: Any) -> Response:
        cites = [self.normalize(c) for c in cites_in_text(text, self.cite_prefix)]
        return Response(ok=True, mode="text", text=text.strip(), claims=split_claims(text), citations=cites,
                        wall_ms=wall, elapsed_ms=wall, model=model, raw=raw)


class OpenAIBackend(_TextBaseline):
    kind = "openai"

    def __init__(self, cfg: dict, normalize: Normalizer):
        super().__init__(cfg, normalize)
        self.endpoint = cfg["endpoint"].rstrip("/")
        self.model = cfg["model"]
        self.max_tokens = cfg.get("max_tokens", 800)
        # Send a key only when the config names its variable: never leak a default key to a lab endpoint.
        self.api_key = os.environ.get(cfg["api_key_env"]) if cfg.get("api_key_env") else None
        self.extra_body = cfg.get("extra_body", {})

    def ask(self, item: dict) -> Response:
        body = {"model": self.model, "temperature": 0, "max_tokens": self.max_tokens,
                "messages": [{"role": "system", "content": self.system},
                             {"role": "user", "content": item["question"]}], **self.extra_body}
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        req = urllib.request.Request(f"{self.endpoint}/chat/completions", data=json.dumps(body).encode(),
                                     headers=headers)
        t0 = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                out = json.loads(r.read())
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError, ValueError) as e:
            return Response(ok=False, error=f"{type(e).__name__}: {e}")
        wall = (time.perf_counter() - t0) * 1000
        try:
            choice = out["choices"][0]
            msg = choice["message"]
            text = msg.get("content") or ""
        except (KeyError, IndexError, TypeError):
            return Response(ok=False, error=f"bad response: {str(out)[:300]}", wall_ms=wall)
        if not text.strip():
            # A reasoning model that spends the whole budget thinking returns no answer. That is a
            # failed call (fix the budget or turn thinking off), never an answer to grade.
            reasoning = msg.get("reasoning_content") or ""
            return Response(ok=False, wall_ms=wall,
                            error=f"empty answer (finish_reason={choice.get('finish_reason')}, "
                                  f"{len(reasoning)} chars of reasoning_content)")
        return self.finish(text, wall, out.get("model", self.model),
                           {"usage": out.get("usage"), "finish_reason": choice.get("finish_reason")})


class ClaudeBackend(_TextBaseline):
    kind = "claude"

    def __init__(self, cfg: dict, normalize: Normalizer):
        super().__init__(cfg, normalize)
        self.model = cfg.get("model", "sonnet")
        self.binary = cfg.get("binary", "claude")

    def ask(self, item: dict) -> Response:
        cmd = [self.binary, "-p", *CLAUDE_FLAGS, "--model", self.model, "--system-prompt", self.system,
               "--output-format", "json"]
        os.makedirs(EMPTY_DIR, exist_ok=True)
        t0 = time.perf_counter()
        try:
            p = subprocess.run(cmd, input=item["question"], capture_output=True, text=True,
                               timeout=self.timeout, cwd=EMPTY_DIR)
        except (subprocess.TimeoutExpired, FileNotFoundError) as e:
            return Response(ok=False, error=f"{type(e).__name__}: {e}")
        wall = (time.perf_counter() - t0) * 1000
        try:
            out = json.loads(p.stdout)
        except json.JSONDecodeError:
            return Response(ok=False, error=f"exit {p.returncode}: {p.stderr[-300:]} {p.stdout[-300:]}", wall_ms=wall)
        if out.get("is_error"):
            return Response(ok=False, error=str(out.get("result"))[:300], wall_ms=wall)
        models = list((out.get("modelUsage") or {}).keys())
        return self.finish(out.get("result", ""), wall, models[0] if models else self.model,
                           {"cost_usd": out.get("total_cost_usd")})


def make_backend(cfg: dict, corpus: Corpus | None, normalize: Normalizer):
    kind = cfg["kind"]
    if kind == "harvest":
        return HarvestBackend(cfg, corpus, normalize)
    if kind == "openai":
        return OpenAIBackend(cfg, normalize)
    if kind == "claude":
        return ClaudeBackend(cfg, normalize)
    raise ValueError(f"unknown backend kind {kind!r}")
