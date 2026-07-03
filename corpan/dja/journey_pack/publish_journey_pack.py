#!/usr/bin/env python3
"""Publish a Journey course pack to S3/CloudFront (IN-REPO publisher).

Spec: corpan/docs/journey/specs/course-pack.md §4.3. Clone of the wordpan
publisher mechanics, relocated in-repo (the out-of-repo wordpan publisher is a
documented mistake) and hardened: validation-gated, immutable zips,
accumulate-merge index.

usage: python3 publish_journey_pack.py <target> [--dry-run] [--channel preview]
e.g.:  python3 publish_journey_pack.py en

Steps (idempotent):
  1. build or verify dist/journey_<target>-<ver>.zip (fresh-rebuild sha check
     unless --allow-stale)
  2. run the validator — publish is gated on ALL gates passing;
     --dry-run stops here and prints the would-be index entry
  3. immutability check: HEAD the S3 key; different sha256 → hard abort
  4. upload zip, Cache-Control: public,max-age=31536000,immutable
  5. accumulate-merge index.json (replace-or-append keyed by id, sorted,
     max-age=300)
  6. print the CDN URL + entry for the changelog

AWS credentials: ~/.env (AWS_ACCESS_KEY / AWS_SECRET_ACCESS_KEY), region us-east-2.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from journey_common import (
    CORPAN_DIR,
    DJA_DIR,
    HERE,
    JOURNEY_SCHEMA_VERSION,
    sha256_file,
    underscore_lang,
)

BUCKET = "corpan-prod"
REGION = "us-east-2"
S3_PREFIX = "artifacts/corpan/journey-packs"
CDN_BASE = "https://d38iwc9748jekz.cloudfront.net/corpan/journey-packs"
ZIP_CACHE = "public,max-age=31536000,immutable"
INDEX_CACHE = "public,max-age=300"
DEFAULT_MIN_APP_VERSION = "0.9.0"


class PublishError(Exception):
    pass


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


def s3_client():
    try:
        import boto3
    except ImportError as e:  # pragma: no cover
        raise PublishError("boto3 is required to publish (pip install boto3)") from e
    creds = load_aws_env()
    key = creds.get("AWS_ACCESS_KEY") or creds.get("AWS_ACCESS_KEY_ID")
    secret = creds.get("AWS_SECRET_ACCESS_KEY")
    if not key or not secret:
        raise PublishError("AWS_ACCESS_KEY / AWS_SECRET_ACCESS_KEY not found in ~/.env")
    return boto3.client(
        "s3", region_name=REGION,
        aws_access_key_id=key, aws_secret_access_key=secret,
    )


# ---------------------------------------------------------------------------
# Steps (each a function; the script is idempotent)
# ---------------------------------------------------------------------------


def step_build_or_verify(
    target: str, course_dir: Path, out_dir: Path, allow_stale: bool,
) -> Dict[str, Any]:
    """Step 1: ensure the zip exists and matches a fresh rebuild."""
    import build_journey_pack as b

    course = b.load_course_tree(target, course_dir, HERE / "recipes.yaml")
    course_id = course.course_id
    version = course.course.version
    zip_path = out_dir / f"{course_id}-{version}.zip"

    if not zip_path.exists():
        print(f"zip absent — building {zip_path.name}")
        b.build(target, course_dir, DJA_DIR / "release.sqlite3",
                CORPAN_DIR / "tools" / "phrase-packs", HERE / "recipes.yaml",
                out_dir, skip_validate=True)
    elif not allow_stale:
        existing_sha = sha256_file(zip_path)
        import shutil
        import tempfile

        with tempfile.TemporaryDirectory() as td:
            fresh = b.build(target, course_dir, DJA_DIR / "release.sqlite3",
                            CORPAN_DIR / "tools" / "phrase-packs",
                            HERE / "recipes.yaml", Path(td), skip_validate=True)
            fresh_db = Path(td) / course_id / "data" / "course.sqlite3"
            cur_db = out_dir / course_id / "data" / "course.sqlite3"
            # generated_at makes zip shas differ run-to-run; compare item ids
            # + counts instead of raw bytes when timestamps are the only delta.
            if not _same_content(fresh_db, cur_db):
                raise PublishError(
                    f"dist zip {zip_path.name} differs from a fresh rebuild "
                    f"(sha {existing_sha[:12]}…) — rebuild or pass --allow-stale"
                )
            del fresh
            shutil.rmtree(td, ignore_errors=True)

    stage = out_dir / course_id
    manifest = json.loads((stage / "manifest.json").read_text(encoding="utf-8"))
    return {
        "course_id": course_id, "version": version, "zip_path": zip_path,
        "manifest": manifest, "course": course,
    }


def _same_content(db_a: Path, db_b: Path) -> bool:
    """Byte-reproducible modulo generated_at (§5): dump both DBs minus that row."""
    import sqlite3

    def dump(p: Path) -> str:
        db = sqlite3.connect(f"file:{p}?mode=ro", uri=True)
        lines = [
            l for l in db.iterdump()
            if "generated_at" not in l and "corpus_base_sha" not in l
        ]
        db.close()
        return "\n".join(lines)

    return dump(db_a) == dump(db_b)


def step_validate(target: str, course_dir: Path, out_dir: Path) -> None:
    """Step 2: publish is gated on ALL validation gates passing."""
    import validate_journey_pack as v

    report = v.validate(target=target, course_dir=course_dir, dist_dir=out_dir)
    v.print_report(report)
    if v.has_errors(report):
        raise PublishError("validation gates failed — publish blocked")


def build_index_entry(
    info: Dict[str, Any], channel: str, min_app_version: str,
) -> Dict[str, Any]:
    manifest = info["manifest"]
    zip_path: Path = info["zip_path"]
    course = info["course"]
    import sqlite3

    db = sqlite3.connect(
        f"file:{info['zip_path'].parent / info['course_id'] / 'data' / 'course.sqlite3'}?mode=ro",
        uri=True,
    )
    meta = {k: v for k, v in db.execute("SELECT key, value FROM pack_meta")}
    arc_max = db.execute(
        "SELECT cefr FROM arcs ORDER BY arc_index DESC LIMIT 1"
    ).fetchone()
    db.close()

    entry: Dict[str, Any] = {
        "id": info["course_id"],
        "kind": "journey-course",
        "targetLang": course.target,
        "name": manifest["name"],
        "version": info["version"],
        "schemaVersion": JOURNEY_SCHEMA_VERSION,
        "zipUrl": f"{CDN_BASE}/{zip_path.name}",
        "sha256": sha256_file(zip_path),
        "sizeMb": round(zip_path.stat().st_size / 1e6, 2),
        "unitCount": int(meta["unit_count"]),
        "itemCount": int(meta["item_count"]),
        "arcMax": arc_max[0] if arc_max else None,
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


def step_immutability_check(s3, zip_path: Path) -> Optional[str]:
    """Step 3: existing key with a different sha256 → hard abort.

    Returns "skip" when the identical zip is already up.
    """
    key = f"{S3_PREFIX}/{zip_path.name}"
    try:
        head = s3.head_object(Bucket=BUCKET, Key=key)
    except Exception:
        return None  # not present — fresh upload
    remote_sha = (head.get("Metadata") or {}).get("sha256")
    local_sha = sha256_file(zip_path)
    if remote_sha and remote_sha == local_sha:
        return "skip"
    raise PublishError(
        f"s3://{BUCKET}/{key} already exists with different content — "
        "zips are immutable; bump the version (§8)"
    )


def step_upload_zip(s3, zip_path: Path) -> None:
    key = f"{S3_PREFIX}/{zip_path.name}"
    s3.upload_file(
        str(zip_path), BUCKET, key,
        ExtraArgs={
            "CacheControl": ZIP_CACHE,
            "ContentType": "application/zip",
            "Metadata": {"sha256": sha256_file(zip_path)},
        },
    )
    print(f"uploaded s3://{BUCKET}/{key}")


def step_merge_index(s3, entry: Dict[str, Any]) -> Dict[str, Any]:
    """Step 5: accumulate-merge — never touch other entries."""
    key = f"{S3_PREFIX}/index.json"
    try:
        obj = s3.get_object(Bucket=BUCKET, Key=key)
        index = json.loads(obj["Body"].read().decode("utf-8"))
    except Exception:
        index = {"version": 1, "packs": []}
    packs = [p for p in index.get("packs", []) if p.get("id") != entry["id"]]
    packs.append(entry)
    packs.sort(key=lambda p: p.get("id", ""))
    index = {
        "version": 1,
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
    ap.add_argument("target")
    ap.add_argument("--course-dir", type=Path, default=None)
    ap.add_argument("--out", type=Path, default=HERE / "dist")
    ap.add_argument("--channel", default="preview", choices=["preview", "stable"])
    ap.add_argument("--min-app-version", default=DEFAULT_MIN_APP_VERSION)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--allow-stale", action="store_true")
    args = ap.parse_args()

    course_dir = args.course_dir or (HERE / "courses" / args.target)
    try:
        info = step_build_or_verify(args.target, course_dir, args.out,
                                    args.allow_stale)
        step_validate(args.target, course_dir, args.out)
        entry = build_index_entry(info, args.channel, args.min_app_version)
        if args.dry_run:
            print("\n--dry-run: would publish the following index entry:")
            print(json.dumps(entry, ensure_ascii=False, indent=2))
            return
        s3 = s3_client()
        if step_immutability_check(s3, info["zip_path"]) == "skip":
            print("zip already published with identical content — skipping upload")
        else:
            step_upload_zip(s3, info["zip_path"])
        step_merge_index(s3, entry)
        print(f"\nCDN: {entry['zipUrl']}")
        print("index:", f"{CDN_BASE}/index.json")
        print("\nChangelog entry (dja/journey_pack/courses/"
              f"{args.target}/CHANGELOG.md):")
        print(f"- Published {entry['id']} {entry['version']} "
              f"({entry['channel']}, {entry['sizeMb']} MB, "
              f"{entry['unitCount']} units, {entry['itemCount']} items).")
    except PublishError as e:
        print(f"PUBLISH ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
