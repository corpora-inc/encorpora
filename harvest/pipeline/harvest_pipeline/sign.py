"""Manifest and ed25519 signature.

Canonical manifest bytes = UTF-8 of `json.dumps(manifest_without_signature, sort_keys=True,
separators=(",", ":"), ensure_ascii=False)`. `signature.sig` is the base64 ed25519 signature of
those bytes; `key_id` is the first 16 hex chars of SHA-256 over the raw 32-byte public key.

The private key comes from HARVEST_SIGNING_KEY (base64 of the 32-byte seed) or
HARVEST_SIGNING_KEY_FILE (a PEM PKCS#8 file, or a file holding the base64 seed). It is never
committed; tests generate a throwaway key.
"""

from __future__ import annotations

import base64
import json
import os
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

from .textutil import canonical_json, sha256_bytes


def canonical_bytes(manifest: dict) -> bytes:
    return canonical_json({k: v for k, v in manifest.items() if k != "signature"}).encode("utf-8")


def public_raw(pub: Ed25519PublicKey) -> bytes:
    return pub.public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)


def key_id(pub: Ed25519PublicKey) -> str:
    return sha256_bytes(public_raw(pub))[:16]


def load_private_key(env: dict | None = None) -> Ed25519PrivateKey | None:
    env = env if env is not None else os.environ
    if env.get("HARVEST_SIGNING_KEY"):
        return Ed25519PrivateKey.from_private_bytes(base64.b64decode(env["HARVEST_SIGNING_KEY"]))
    path = env.get("HARVEST_SIGNING_KEY_FILE")
    if path:
        data = Path(path).expanduser().read_bytes()
        if b"BEGIN" in data:
            key = serialization.load_pem_private_key(data, password=None)
            if not isinstance(key, Ed25519PrivateKey):
                raise SystemExit("HARVEST_SIGNING_KEY_FILE is not an ed25519 key")
            return key
        return Ed25519PrivateKey.from_private_bytes(base64.b64decode(data.strip()))
    return None


def sign_manifest(manifest: dict, key: Ed25519PrivateKey) -> dict:
    sig = key.sign(canonical_bytes(manifest))
    return {**{k: v for k, v in manifest.items() if k != "signature"},
            "signature": {"alg": "ed25519", "key_id": key_id(key.public_key()),
                          "sig": base64.b64encode(sig).decode()}}


def verify_manifest(manifest: dict, pub: Ed25519PublicKey) -> bool:
    sig = manifest.get("signature") or {}
    if sig.get("alg") != "ed25519":
        return False
    try:
        pub.verify(base64.b64decode(sig["sig"]), canonical_bytes(manifest))
        return True
    except Exception:
        return False


def verify_pack_dir(pack_dir: Path, pub: Ed25519PublicKey | None) -> list[str]:
    """Problems with a pack directory: signature (if a key is given) and every file hash."""
    problems = []
    m = json.loads((pack_dir / "manifest.json").read_text())
    if pub is not None and not verify_manifest(m, pub):
        problems.append("signature does not verify")
    for f in m.get("files", []):
        p = pack_dir / f["path"]
        if not p.exists():
            problems.append(f"missing {f['path']}")
            continue
        data = p.read_bytes()
        if sha256_bytes(data) != f["sha256"] or len(data) != f["bytes"]:
            problems.append(f"hash mismatch {f['path']}")
    return problems


def write_public_key(key: Ed25519PrivateKey, path: Path) -> None:
    path.write_text(base64.b64encode(public_raw(key.public_key())).decode() + "\n")
