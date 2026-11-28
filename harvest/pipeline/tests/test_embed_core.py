"""The pack's vectors are ones harvest-core uses: a tiny pack baked through the llama-server embedder
protocol (a stand-in server here) must be searched densely by the core with the matching embedder.
Needs the core binary: HARVEST_BIN (the maint-pack CI job sets it); skipped without it."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import numpy as np
import pytest

HARVEST = os.environ.get("HARVEST_BIN")
pytestmark = pytest.mark.skipif(not HARVEST or not os.path.exists(HARVEST), reason="needs HARVEST_BIN")
DIM = 32
SHA = "ab" * 32


def _vec(text: str) -> list[float]:
    v = np.zeros(DIM, dtype=np.float32)
    for tok in re.findall(r"[a-z0-9]+", text.lower()):
        h = int.from_bytes(hashlib.sha256(tok.encode()).digest()[:8], "little")
        v[h % DIM] += 1.0
    n = float(np.linalg.norm(v)) or 1.0
    return (v / n).tolist()


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"{}")

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        inp = body["input"] if isinstance(body["input"], list) else [body["input"]]
        out = {"data": [{"index": i, "embedding": _vec(t)} for i, t in enumerate(inp)], "model": "test"}
        data = json.dumps(out).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def test_core_searches_the_baked_vectors_densely(tmp_path, monkeypatch):
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from harvest_pipeline.embed import LlamaServerEmbedder
    from harvest_pipeline.model import Node, ParsedDoc
    from harvest_pipeline.pack import write_pack
    from harvest_pipeline.sign import public_raw
    from harvest_pipeline.stage import Stage

    srv = HTTPServer(("127.0.0.1", 0), _Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{srv.server_address[1]}"
    key = Ed25519PrivateKey.generate()
    kf = tmp_path / "k.pem"
    kf.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                     serialization.NoEncryption()))
    monkeypatch.setenv("HARVEST_SIGNING_KEY_FILE", str(kf))
    monkeypatch.delenv("HARVEST_TEST_EMBEDDER", raising=False)
    pub = tmp_path / "k.pub"
    pub.write_text(base64.b64encode(public_raw(key.public_key())).decode())
    st = Stage(tmp_path / "s.sqlite")
    st.add_source({"source_id": "s", "title": "t", "publisher": "p", "url": "u", "edition": "e", "retrieved_at": "r",
                   "sha256": "0", "media_type": "text/plain", "license": "l"})
    root = Node("s:1", "section", "1", heading="Cooling", own_text="Clean the intake strainer when the pump runs hot.")
    root.add(Node("s:2", "paragraph", "1.1", own_text="Replace the starter relay when the engine will not crank."))
    st.add_doc(ParsedDoc("s", [root]))
    emb = LlamaServerEmbedder("/nonexistent.gguf", "test-embed", base_url=url, model_sha256=SHA)
    res = write_pack(st, tmp_path / "pack", "t", "1", "t", emb)
    meta = res["counts"]
    assert meta["chunk_vec"] == meta["chunk"] > 0
    out = subprocess.run([HARVEST, "search", str(tmp_path / "pack"), "pump running hot", "--embedder", url,
                          "--embedder-sha256", SHA, "--pubkey", str(pub), "--json"], capture_output=True, text=True)
    assert out.returncode == 0, out.stderr
    r = json.loads(out.stdout)
    assert r["dense"] == "used", r["dense"]           # not no_vectors, not mismatch
    srv.shutdown()
