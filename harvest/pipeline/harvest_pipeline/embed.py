"""Pluggable embedders and int8 vector storage.

`chunk_vec.vec` holds int8 components and `chunk_vec.scale` one float per vector:
    float_vector[i] = int8_vector[i] * scale,  scale = max(|v|) / 127
Vectors are L2-normalized before quantization, so a reader scores with a dot product.

Embedders:
  hash          feature hashing, no model; deterministic (tests, and a lexical-only fallback)
  llama-server  any GGUF embedding model through llama.cpp's server (/v1/embeddings). The pack
                default: the same GGUF and runtime the device uses for the query side, so bake
                vectors and query vectors come from one model build.

The pack records `embedder_id`, `embed_dim`, and the query/document templates in pack_meta;
a reader must embed queries with the same model, dimension and query template.
"""

from __future__ import annotations

import hashlib
import http.client
import json
import os
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np

from .corpus import harvest_home


class Embedder:
    id: str = ""
    dim: int = 0
    query_template: str = "{query}"
    doc_template: str = "{text}"

    def embed(self, texts: list[str]) -> np.ndarray:  # pragma: no cover - interface
        raise NotImplementedError

    def embed_docs(self, docs: list[tuple[str | None, str]]) -> np.ndarray:
        texts = [self.doc_template.format(title=t or "none", text=x) for t, x in docs]
        return self.embed(texts)

    def close(self) -> None:
        pass

    def meta(self) -> dict:
        return {"embedder_id": self.id, "embed_dim": str(self.dim), "embed_query_template": self.query_template,
                "embed_doc_template": self.doc_template, "embed_quant": "int8-absmax-per-vector"}


def l2norm(m: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(m, axis=1, keepdims=True)
    n[n == 0] = 1.0
    return m / n


def quantize(v: np.ndarray) -> tuple[bytes, float]:
    v = np.asarray(v, dtype=np.float32)
    amax = float(np.max(np.abs(v))) if v.size else 0.0
    scale = amax / 127.0 if amax > 0 else 1.0
    q = np.clip(np.rint(v / scale), -127, 127).astype(np.int8)
    return q.tobytes(), scale


def dequantize(blob: bytes, scale: float) -> np.ndarray:
    return np.frombuffer(blob, dtype=np.int8).astype(np.float32) * scale


class HashEmbedder(Embedder):
    def __init__(self, dim: int = 256):
        self.dim = dim
        self.id = f"hash-v1-{dim}"

    def embed(self, texts):
        out = np.zeros((len(texts), self.dim), dtype=np.float32)
        for i, t in enumerate(texts):
            toks = re.findall(r"[a-z0-9]+", t.lower())
            for tok in toks + [a + " " + b for a, b in zip(toks, toks[1:])]:
                h = int.from_bytes(hashlib.blake2b(tok.encode(), digest_size=8).digest(), "little")
                out[i, h % self.dim] += 1.0 if (h >> 63) & 1 else -1.0
        return l2norm(out)


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class LlamaServerEmbedder(Embedder):
    """Starts `llama-server --embedding` on a local port for the duration of the build, then stops it.

    model_path: a local GGUF. id: recorded verbatim in the pack (name, quant and file hash).
    """

    def __init__(self, model_path: str, model_name: str, dim: int | None = None, binary: str = "llama-server",
                 query_template: str = "{query}", doc_template: str = "{text}", batch: int = 32,
                 base_url: str | None = None, ctx: int = 8192, threads: int | None = None,
                 model_sha256: str | None = None):
        self.model_path = Path(os.path.expanduser(model_path))
        self.binary = binary
        self.batch = batch
        self.query_template = query_template
        self.doc_template = doc_template
        self._proc = None
        self._log = None
        self._logfh = None
        self._base = base_url
        self.ctx = ctx
        self.threads = threads
        self.truncate = dim
        if not base_url and not self.model_path.exists():
            raise SystemExit(f"embedding model not found: {self.model_path} (see README: embedder setup)")
        # The id must name the exact weights: the device compares it with pack_meta.embedder_id before
        # it uses any vector. A remote server's file is not readable here, so its SHA-256 is declared
        # (and must be checked on that machine); "remote" marks a pack whose vectors no device can match.
        if self.model_path.exists():
            sha = _file_sha256(self.model_path)[:16]
        elif model_sha256:
            sha = model_sha256[:16]
        else:
            raise SystemExit("remote embedder needs the served GGUF's SHA-256 (HARVEST_EMBED_MODEL_SHA256 or "
                             "model_sha256): without it no device can match the pack's vectors")
        self.id = f"{model_name}@{sha}" + (f"/mrl{dim}" if dim else "")
        self.dim = dim or 0

    def _start(self):
        if self._base:
            return
        port = _free_port()
        cmd = ["nice", "-n", "20", self.binary, "-m", str(self.model_path), "--embedding", "--port", str(port),
               "--host", "127.0.0.1", "-c", str(self.ctx), "-b", str(self.ctx), "-ub", str(self.ctx), "-np", "1"]
        if self.threads:
            cmd += ["-t", str(self.threads)]
        # server logs go to a file: an unread pipe fills up and stalls the server
        log_dir = harvest_home() / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        self._log = log_dir / f"embed-server-{port}.log"
        self._logfh = self._log.open("wb")
        self._proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=self._logfh)
        self._base = f"http://127.0.0.1:{port}"
        for _ in range(240):
            if self._proc.poll() is not None:
                raise SystemExit(f"llama-server exited: {self._log.read_text(errors='replace')[-800:]}")
            try:
                with urllib.request.urlopen(f"{self._base}/health", timeout=2) as r:
                    if r.status == 200:
                        return
            except Exception:
                time.sleep(0.5)
        raise SystemExit("llama-server did not become healthy")

    def embed(self, texts):
        self._start()
        rows = []
        for i in range(0, len(texts), self.batch):
            body = json.dumps({"input": texts[i:i + self.batch], "model": "embed"}).encode()
            req = urllib.request.Request(f"{self._base}/v1/embeddings", data=body,
                                         headers={"Content-Type": "application/json"})
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(req, timeout=600) as r:
                        data = json.loads(r.read())
                    break
                except urllib.error.HTTPError:
                    raise  # the server answered: retrying the same request gets the same answer
                except (TimeoutError, ConnectionResetError, http.client.RemoteDisconnected,
                        urllib.error.URLError) as e:
                    transient = not isinstance(e, urllib.error.URLError) or isinstance(
                        e.reason, (TimeoutError, ConnectionResetError))
                    if not transient or attempt == 2:
                        raise  # e.g. connection refused: the server or tunnel is gone
                    time.sleep(2 * (attempt + 1))
            if len(texts) > 500 and (i // self.batch) % 25 == 0:
                print(f"[embed] {i}/{len(texts)}", file=sys.stderr, flush=True)
            for d in sorted(data["data"], key=lambda d: d["index"]):
                rows.append(d["embedding"])
        m = np.asarray(rows, dtype=np.float32)
        if self.truncate:
            m = m[:, : self.truncate]
        self.dim = m.shape[1] if m.size else self.dim
        return l2norm(m)

    def close(self):
        if self._proc and self._proc.poll() is None:
            self._proc.terminate()
            try:
                self._proc.wait(timeout=20)
            except subprocess.TimeoutExpired:
                self._proc.kill()
        if self._logfh:
            self._logfh.close()
            self._logfh = None
        self._proc = None


def _file_sha256(p: Path) -> str:
    cache = p.with_suffix(p.suffix + ".sha256")
    if cache.exists() and cache.stat().st_mtime >= p.stat().st_mtime:
        return cache.read_text().strip()
    h = hashlib.sha256()
    with p.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    try:
        cache.write_text(h.hexdigest())
    except OSError:
        pass
    return h.hexdigest()


# EmbeddingGemma 2 prompt conventions (model card): asymmetric retrieval.
EMBEDDINGGEMMA2 = {
    "model_name": "ggml-org/embeddinggemma-2-GGUF:embeddinggemma-2-Q8_0.gguf",
    "file": "embeddinggemma-2-Q8_0.gguf",
    "url": "https://huggingface.co/ggml-org/embeddinggemma-2-GGUF/resolve/main/embeddinggemma-2-Q8_0.gguf",
    "sha256": "2188ac1deca4b77dffefd603c2776a9d76d9d74ec01841392982ebb840b09135",
    "query_template": "task: search result | query: {query}",
    "doc_template": "title: {title} | text: {text}",
}


def make_embedder(cfg: dict | None) -> Embedder:
    """HARVEST_EMBED_BASE_URL points a llama-server embedder at an already running server
    (e.g. the lab machine through an SSH tunnel) instead of starting one locally.
    HARVEST_EMBED_MODEL_SHA256 declares the SHA-256 of the GGUF that server loaded when the file is
    not on this machine; embeddinggemma-2 defaults to the pinned release file's hash."""
    cfg = dict(cfg or {"kind": "hash"})
    if os.environ.get("HARVEST_EMBED_BASE_URL") and cfg.get("kind") != "hash":
        cfg.setdefault("base_url", os.environ["HARVEST_EMBED_BASE_URL"])
    if os.environ.get("HARVEST_EMBED_MODEL_SHA256") and cfg.get("kind") != "hash":
        cfg.setdefault("model_sha256", os.environ["HARVEST_EMBED_MODEL_SHA256"])
    kind = cfg.pop("kind", "hash")
    if kind == "hash":
        return HashEmbedder(int(cfg.get("dim", 256)))
    if kind == "embeddinggemma-2":
        path = cfg.get("model_path") or str(harvest_home() / "models" / EMBEDDINGGEMMA2["file"])
        return LlamaServerEmbedder(path, EMBEDDINGGEMMA2["model_name"], dim=cfg.get("dim"),
                                   query_template=EMBEDDINGGEMMA2["query_template"],
                                   doc_template=EMBEDDINGGEMMA2["doc_template"], base_url=cfg.get("base_url"),
                                   model_sha256=cfg.get("model_sha256") or EMBEDDINGGEMMA2["sha256"])
    if kind == "llama-server":
        return LlamaServerEmbedder(cfg["model_path"], cfg["model_name"], dim=cfg.get("dim"),
                                   query_template=cfg.get("query_template", "{query}"),
                                   doc_template=cfg.get("doc_template", "{text}"), base_url=cfg.get("base_url"),
                                   model_sha256=cfg.get("model_sha256"))
    raise SystemExit(f"unknown embedder kind {kind!r} (hash | embeddinggemma-2 | llama-server)")
