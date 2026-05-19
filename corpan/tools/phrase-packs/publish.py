#!/usr/bin/env python3
"""
Package a built phrase pack as a zip with a SHA-256 sidecar and (optionally)
upload to the Corpán CDN.

Reads the manifest produced by `build_phrase_pack.py`, packages
{manifest.json, data.sqlite3} into a single zip named
`<id>-<version>.zip`, computes its SHA-256, and writes both alongside.

CLI
---
    python publish.py <build-dir> [--out <dir>] [--upload] [--bucket NAME]
        [--prefix corpan/phrase-packs] [--profile aws-profile]

Without `--upload` this is a pure local packager — fast feedback for the
authoring loop. With `--upload`, requires `boto3` (a stdlib-only install
fails with a clear message). See PHRASE_PACK_AUTHORING.md for CDN paths
and the catalog-append step.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Iterable
from zipfile import ZIP_DEFLATED, ZipFile


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def package(build_dir: Path, out_dir: Path | None = None) -> tuple[Path, str]:
    manifest_path = build_dir / "manifest.json"
    db_path = build_dir / "data.sqlite3"
    if not manifest_path.is_file() or not db_path.is_file():
        raise SystemExit(
            f"build dir missing manifest.json or data.sqlite3: {build_dir}"
        )
    manifest = json.loads(manifest_path.read_text())
    pack_id = manifest["id"]
    version = manifest["version"]
    out_dir = (out_dir or build_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    zip_path = out_dir / f"{pack_id}-{version}.zip"
    sha_path = out_dir / f"{pack_id}-{version}.zip.sha256"

    with ZipFile(zip_path, "w", ZIP_DEFLATED) as z:
        z.write(manifest_path, arcname="manifest.json")
        z.write(db_path, arcname="data.sqlite3")
    sha = _sha256(zip_path)
    sha_path.write_text(f"{sha}  {zip_path.name}\n")

    size = zip_path.stat().st_size
    print(f"[publish] {zip_path}  size={size:>9} bytes  sha256={sha}")
    return zip_path, sha


def upload(
    zip_path: Path,
    sha: str,
    bucket: str,
    prefix: str,
    profile: str | None = None,
) -> str:
    try:
        import boto3  # type: ignore
    except ImportError:
        raise SystemExit(
            "--upload requires boto3 (pipx inject phrase-packs-tools boto3, "
            "or pip install boto3 in your venv)"
        )
    session = boto3.Session(profile_name=profile) if profile else boto3.Session()
    s3 = session.client("s3")
    key = f"{prefix.rstrip('/')}/{zip_path.name}"
    print(f"[publish] uploading s3://{bucket}/{key}")
    s3.upload_file(
        str(zip_path),
        bucket,
        key,
        ExtraArgs={"ContentType": "application/zip", "Metadata": {"sha256": sha}},
    )
    return f"https://d38iwc9748jekz.cloudfront.net/{key}"


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("build_dir", help="Directory containing manifest.json + data.sqlite3")
    parser.add_argument("--out", help="Where to write the zip + sha256 (default: <build-dir>)")
    parser.add_argument("--upload", action="store_true", help="Upload the zip to S3")
    parser.add_argument("--bucket", default="corpan-prod", help="S3 bucket name (default corpan-prod)")
    parser.add_argument("--prefix", default="artifacts/corpan/phrase-packs", help="Key prefix inside the bucket")
    parser.add_argument("--profile", help="AWS named profile to use")
    ns = parser.parse_args(argv)

    build_dir = Path(ns.build_dir).resolve()
    out_dir = Path(ns.out).resolve() if ns.out else None
    zip_path, sha = package(build_dir, out_dir)

    if ns.upload:
        cdn_url = upload(zip_path, sha, ns.bucket, ns.prefix, ns.profile)
        print(f"[publish] CDN URL: {cdn_url}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
