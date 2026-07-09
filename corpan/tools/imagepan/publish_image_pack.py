#!/usr/bin/env python3
"""Publish the ``imagepan`` concept-picture pack to S3/CloudFront.

In-repo publisher, modeled on ``corpan/dja/journey_pack/publish_journey_pack.py``
(same bucket/region/credentials + immutable-zip discipline + accumulate-merge
index), trimmed to what a single language-neutral data pack needs.

The app installs imagepan from a dedicated CloudFront index — NOT the main
``catalog-v3.json`` — and auto-installs it the first time a Journey session
opens (see ``corpan-app/src/util/imagePack.ts`` +
``corpan-app/src/contentPacks/imagePackCatalog.ts``). This script produces both
sides of that contract:

    <CDN_BASE>/imagepan-<version>.zip     (immutable, the pack payload)
    <CDN_BASE>/index.json                 (short-TTL, what the app polls)

usage:
    python3 publish_image_pack.py [--dry-run] [--channel stable] \
        [--min-app-version 0.20.2] [--profile <aws-profile>]

Steps (idempotent):
  1. verify the built pack at dist/imagepan/ (manifest + data/index.sqlite3 +
     every concept's WebP present); build the zip fresh from it.
  2. --dry-run stops here and prints the would-be index entry.
  3. immutability check: HEAD the S3 key; a different sha256 → hard abort
     (bump manifest.json version instead).
  4. upload the zip (Cache-Control: public,max-age=31536000,immutable).
  5. accumulate-merge index.json (replace-or-append keyed by id, short TTL).
  6. print the CDN URL + entry for the changelog.

AWS credentials: a named --profile / $AWS_PROFILE, else ~/.env
(AWS_ACCESS_KEY / AWS_SECRET_ACCESS_KEY), region us-east-2.

Nothing here PUBLISHES on its own — run it explicitly. This module is
import-safe (main() only runs under __main__).
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import sqlite3
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

HERE = Path(__file__).resolve().parent            # corpan/tools/imagepan
DIST = HERE / "dist" / "imagepan"                 # the built pack

BUCKET = "corpan-prod"
REGION = "us-east-2"
S3_PREFIX = "artifacts/corpan/imagepan"
CDN_BASE = "https://d38iwc9748jekz.cloudfront.net/corpan/imagepan"
ZIP_CACHE = "public,max-age=31536000,immutable"
INDEX_CACHE = "public,max-age=300"
CATALOG_FORMAT_VERSION = 1  # == IMAGE_PACK_CATALOG_FORMAT_VERSION (TS side)
DEFAULT_MIN_APP_VERSION = "0.20.2"


class PublishError(Exception):
    pass


# ---------------------------------------------------------------------------
# credentials / client (verbatim shape from publish_journey_pack.py)
# ---------------------------------------------------------------------------


def load_aws_env() -> Dict[str, str]:
    env_path = Path.home() / ".env"
    creds: Dict[str, str] = {}
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            creds[k.strip()] = v.strip()
    return creds


def s3_client(profile: str | None = None):
    try:
        import boto3
    except ImportError as e:  # pragma: no cover
        raise PublishError("boto3 is required to publish (pip install boto3)") from e
    profile = profile or os.environ.get("AWS_PROFILE")
    if profile:
        session = boto3.Session(profile_name=profile)
        return session.client("s3", region_name=REGION)
    creds = load_aws_env()
    key = creds.get("AWS_ACCESS_KEY") or creds.get("AWS_ACCESS_KEY_ID")
    secret = creds.get("AWS_SECRET_ACCESS_KEY")
    if not key or not secret:
        raise PublishError(
            "No AWS credentials: pass --profile, set AWS_PROFILE, or add "
            "AWS_ACCESS_KEY / AWS_SECRET_ACCESS_KEY to ~/.env"
        )
    return boto3.client(
        "s3", region_name=REGION,
        aws_access_key_id=key, aws_secret_access_key=secret,
    )


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# ---------------------------------------------------------------------------
# steps
# ---------------------------------------------------------------------------


def verify_pack(dist: Path) -> Dict[str, Any]:
    """Verify the built pack and return {manifest, concept_count}. Every concept
    row's WebP (and each distractor's) must exist — the same gate the app relies
    on at resolve time (a missing file would degrade a card silently)."""
    if not dist.is_dir():
        raise PublishError(
            f"built pack missing at {dist} — run build_image_pack.py first"
        )
    manifest_path = dist / "manifest.json"
    db_path = dist / "data" / "index.sqlite3"
    if not manifest_path.is_file():
        raise PublishError(f"manifest.json missing at {manifest_path}")
    if not db_path.is_file():
        raise PublishError(f"data/index.sqlite3 missing at {db_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("id") != "imagepan":
        raise PublishError(f"manifest.id != 'imagepan' ({manifest.get('id')!r})")
    if not manifest.get("version"):
        raise PublishError("manifest.version missing")

    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT key, file, distractors_json FROM concept"
    ).fetchall()
    conn.close()
    if not rows:
        raise PublishError("concept table is empty")
    for r in rows:
        if not (dist / r["file"]).is_file():
            raise PublishError(f"concept '{r['key']}' file missing: {r['file']}")
        for d in json.loads(r["distractors_json"]):
            if not (dist / d["file"]).is_file():
                raise PublishError(
                    f"distractor file missing for '{r['key']}': {d['file']}"
                )
    return {"manifest": manifest, "concept_count": len(rows)}


def build_zip(dist: Path) -> bytes:
    """Zip every file under dist/ into a deterministic in-memory archive.

    Entry names are pack-relative (``manifest.json``, ``data/index.sqlite3``,
    ``images/<key>.webp``) — the exact layout ``content_packs_install_from_url``
    unpacks into ``corpan-packs/imagepan/``.
    """
    files = sorted(p for p in dist.rglob("*") if p.is_file())
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in files:
            arcname = p.relative_to(dist).as_posix()
            # Fixed timestamp → byte-reproducible archives across runs.
            info = zipfile.ZipInfo(arcname, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            zf.writestr(info, p.read_bytes())
    return buf.getvalue()


def build_index_entry(
    manifest: Dict[str, Any],
    concept_count: int,
    zip_name: str,
    zip_bytes: bytes,
    channel: str,
    min_app_version: str,
) -> Dict[str, Any]:
    entry: Dict[str, Any] = {
        "id": manifest["id"],
        "kind": "image-pack",
        "name": manifest.get("name", manifest["id"]),
        "version": manifest["version"],
        "zipUrl": f"{CDN_BASE}/{zip_name}",
        "sha256": sha256_bytes(zip_bytes),
        "sizeMb": round(len(zip_bytes) / 1e6, 2),
        "conceptCount": concept_count,
        "minAppVersion": min_app_version,
        "channel": channel,
    }
    if manifest.get("nameLocalized"):
        entry["nameLocalized"] = manifest["nameLocalized"]
    if manifest.get("description"):
        entry["description"] = manifest["description"]
    if manifest.get("descriptionLocalized"):
        entry["descriptionLocalized"] = manifest["descriptionLocalized"]
    return entry


def step_immutability_check(s3, zip_name: str, zip_bytes: bytes) -> Optional[str]:
    """Existing key with a different sha256 → hard abort. 'skip' if identical."""
    key = f"{S3_PREFIX}/{zip_name}"
    try:
        head = s3.head_object(Bucket=BUCKET, Key=key)
    except Exception:
        return None  # not present — fresh upload
    remote_sha = (head.get("Metadata") or {}).get("sha256")
    local_sha = sha256_bytes(zip_bytes)
    if remote_sha and remote_sha == local_sha:
        return "skip"
    raise PublishError(
        f"s3://{BUCKET}/{key} already exists with different content — "
        "zips are immutable; bump manifest.json version"
    )


def step_upload_zip(s3, zip_name: str, zip_bytes: bytes) -> None:
    key = f"{S3_PREFIX}/{zip_name}"
    s3.put_object(
        Bucket=BUCKET, Key=key, Body=zip_bytes,
        CacheControl=ZIP_CACHE, ContentType="application/zip",
        Metadata={"sha256": sha256_bytes(zip_bytes)},
    )
    print(f"uploaded s3://{BUCKET}/{key}")


def step_merge_index(s3, entry: Dict[str, Any]) -> Dict[str, Any]:
    """Accumulate-merge — never touch other entries."""
    key = f"{S3_PREFIX}/index.json"
    try:
        obj = s3.get_object(Bucket=BUCKET, Key=key)
        index = json.loads(obj["Body"].read().decode("utf-8"))
    except Exception:
        index = {"version": CATALOG_FORMAT_VERSION, "packs": []}
    packs = [p for p in index.get("packs", []) if p.get("id") != entry["id"]]
    packs.append(entry)
    packs.sort(key=lambda p: p.get("id", ""))
    index = {
        "version": CATALOG_FORMAT_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "packs": packs,
    }
    body = json.dumps(index, ensure_ascii=False, indent=2).encode("utf-8")
    s3.put_object(
        Bucket=BUCKET, Key=key, Body=body,
        CacheControl=INDEX_CACHE, ContentType="application/json",
    )
    print(f"updated s3://{BUCKET}/{key} ({len(packs)} packs)")
    return index


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dist", type=Path, default=DIST)
    ap.add_argument("--channel", default="preview", choices=["preview", "stable"])
    ap.add_argument("--min-app-version", default=DEFAULT_MIN_APP_VERSION)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--profile", default=None,
                    help="AWS named profile (else AWS_PROFILE, else ~/.env keys).")
    args = ap.parse_args()

    try:
        info = verify_pack(args.dist.resolve())
        manifest = info["manifest"]
        version = manifest["version"]
        zip_name = f"imagepan-{version}.zip"
        zip_bytes = build_zip(args.dist.resolve())
        entry = build_index_entry(
            manifest, info["concept_count"], zip_name, zip_bytes,
            args.channel, args.min_app_version,
        )
        if args.dry_run:
            print("\n--dry-run: would publish the following index entry:")
            print(json.dumps(entry, ensure_ascii=False, indent=2))
            print(f"\n(zip: {zip_name}, {entry['sizeMb']} MB, "
                  f"{entry['conceptCount']} concepts)")
            return
        s3 = s3_client(args.profile)
        if step_immutability_check(s3, zip_name, zip_bytes) == "skip":
            print("zip already published with identical content — skipping upload")
        else:
            step_upload_zip(s3, zip_name, zip_bytes)
        step_merge_index(s3, entry)
        print(f"\nCDN: {entry['zipUrl']}")
        print("index:", f"{CDN_BASE}/index.json")
        print("\nChangelog entry (corpan/tools/imagepan/CHANGELOG.md):")
        print(f"- Published imagepan {version} ({args.channel}, "
              f"{entry['sizeMb']} MB, {entry['conceptCount']} concepts).")
    except PublishError as e:
        print(f"PUBLISH ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
