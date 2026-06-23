#!/usr/bin/env python3
"""
Package + ship phrase packs directly to S3, no PR or app rebuild needed.

The phrase-pack catalog lives at
    s3://corpan-prod/artifacts/corpan/phrase-packs/catalog.json
served via CloudFront as
    https://d38iwc9748jekz.cloudfront.net/corpan/phrase-packs/catalog.json
with `Cache-Control: public, max-age=300, must-revalidate` so running apps
refresh within 5 minutes (or immediately with `--invalidate`).

OPERATIONS
----------

Local-only packaging (fast feedback while authoring):
    publish.py <build-dir>

Full publish (zip + catalog upsert; recommended for new packs):
    publish.py <build-dir> --upload --update-catalog \
        [--invalidate --distribution-id <DIST_ID>] \
        [--bucket corpan-prod] \
        [--prefix artifacts/corpan/phrase-packs] \
        [--profile corpora]

Curation-only update (no build needed — retunes starter set / groups):
    publish.py --update-curation <curation.json> \
        [--invalidate --distribution-id <DIST_ID>] \
        [--bucket corpan-prod --prefix ... --profile ...]

Yank a broken pack from the catalog (rollback; pack.zip stays on S3):
    publish.py --remove-from-catalog phrase-broken-pack-id \
        [--invalidate --distribution-id <DIST_ID>] \
        [--bucket corpan-prod --prefix ... --profile ...]

Just invalidate the catalog (rare; usually paired with one of the above):
    publish.py --invalidate-only --distribution-id <DIST_ID> \
        [--bucket corpan-prod --prefix ... --profile ...]

See corpan/docs/PHRASE_PACK_AUTHORING.md for the full publisher contract.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from zipfile import ZIP_DEFLATED, ZipFile

CATALOG_KEY_FILENAME = "catalog.json"
CDN_HOST = "d38iwc9748jekz.cloudfront.net"
CATALOG_CACHE_CONTROL = "public, max-age=300, must-revalidate"
CATALOG_FORMAT_VERSION = 1
DEFAULT_MIN_APP_VERSION = "0.15.0"
DEFAULT_CHANNEL = "stable"


# ---------------------------------------------------------------------------
# packaging
# ---------------------------------------------------------------------------

def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def package(build_dir: Path, out_dir: Path | None = None) -> tuple[Path, str, dict]:
    """Zip the build dir + return (zip_path, sha256, parsed_manifest).

    The manifest is returned so the catalog-upsert path doesn't have to
    re-parse it from inside the zip.
    """
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
    print(f"[publish] packaged {zip_path}  size={size:>9} bytes  sha256={sha}")
    return zip_path, sha, manifest


# ---------------------------------------------------------------------------
# S3 + CloudFront
# ---------------------------------------------------------------------------

def _require_boto3():
    try:
        import boto3  # type: ignore
        return boto3
    except ImportError:
        raise SystemExit(
            "this operation requires boto3 (pip install boto3 in your venv, "
            "or `pipx inject` into the venv that runs this script)"
        )


def _s3_client(profile: str | None):
    boto3 = _require_boto3()
    session = boto3.Session(profile_name=profile) if profile else boto3.Session()
    return session.client("s3")


def _cloudfront_client(profile: str | None):
    boto3 = _require_boto3()
    session = boto3.Session(profile_name=profile) if profile else boto3.Session()
    return session.client("cloudfront")


def upload_zip(
    zip_path: Path,
    sha: str,
    bucket: str,
    prefix: str,
    profile: str | None = None,
) -> str:
    """Push `<id>-<version>.zip` to S3. Returns the CloudFront URL."""
    s3 = _s3_client(profile)
    key = f"{prefix.rstrip('/')}/{zip_path.name}"
    print(f"[publish] uploading s3://{bucket}/{key}")
    s3.upload_file(
        str(zip_path),
        bucket,
        key,
        ExtraArgs={
            "ContentType": "application/zip",
            "Metadata": {"sha256": sha},
        },
    )
    return f"https://{CDN_HOST}/{key.removeprefix('artifacts/')}"


def _catalog_key(prefix: str) -> str:
    return f"{prefix.rstrip('/')}/{CATALOG_KEY_FILENAME}"


def fetch_catalog(bucket: str, prefix: str, profile: str | None) -> dict:
    """Read the live catalog.json from S3. Returns a fresh empty catalog
    on 404 (NoSuchKey), so the first-ever publish doesn't have to
    bootstrap by hand."""
    s3 = _s3_client(profile)
    key = _catalog_key(prefix)
    try:
        r = s3.get_object(Bucket=bucket, Key=key)
        data = json.loads(r["Body"].read())
    except s3.exceptions.NoSuchKey:
        print(f"[publish] no existing catalog at s3://{bucket}/{key} — starting fresh")
        return _empty_catalog()
    except Exception as e:
        # boto3 sometimes raises ClientError instead of NoSuchKey
        if "NoSuchKey" in str(type(e)) or "404" in str(e):
            print(f"[publish] no existing catalog at s3://{bucket}/{key} — starting fresh")
            return _empty_catalog()
        raise

    if not isinstance(data, dict) or data.get("version") != CATALOG_FORMAT_VERSION:
        raise SystemExit(
            f"existing s3://{bucket}/{key} has unexpected shape (version="
            f"{data.get('version') if isinstance(data, dict) else 'n/a'}); "
            f"refusing to overwrite. Investigate before retrying."
        )
    data.setdefault("packs", [])
    return data


def _empty_catalog() -> dict:
    return {
        "version": CATALOG_FORMAT_VERSION,
        "generatedAt": _utcnow_iso(),
        "packs": [],
    }


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def write_catalog(
    bucket: str,
    prefix: str,
    profile: str | None,
    catalog: dict,
) -> str:
    """Serialize + upload catalog.json. Returns the CloudFront URL."""
    s3 = _s3_client(profile)
    key = _catalog_key(prefix)
    catalog["generatedAt"] = _utcnow_iso()
    body = json.dumps(catalog, indent=2, ensure_ascii=False).encode("utf-8")
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=body,
        ContentType="application/json; charset=utf-8",
        CacheControl=CATALOG_CACHE_CONTROL,
    )
    url = f"https://{CDN_HOST}/{key.removeprefix('artifacts/')}"
    print(f"[publish] wrote catalog → {url}  ({len(catalog.get('packs', []))} packs)")
    return url


def invalidate_catalog(distribution_id: str, prefix: str, profile: str | None) -> None:
    """Force a fresh fetch of catalog.json for users whose 5-min TTL hasn't
    expired. Optional but recommended on launches and rollbacks."""
    cf = _cloudfront_client(profile)
    # CloudFront paths are absolute, no `artifacts/` prefix.
    path = "/" + _catalog_key(prefix).removeprefix("artifacts/")
    print(f"[publish] CloudFront invalidate {distribution_id} {path}")
    cf.create_invalidation(
        DistributionId=distribution_id,
        InvalidationBatch={
            "Paths": {"Quantity": 1, "Items": [path]},
            "CallerReference": f"phrase-pack-publish-{int(time.time())}",
        },
    )


# ---------------------------------------------------------------------------
# catalog mutations
# ---------------------------------------------------------------------------

# Fields we carry from the per-pack manifest into the catalog entry,
# verbatim, when present. Keep this list narrow — the catalog is the
# user-facing index and should not leak arbitrary build metadata.
_PASSTHROUGH_FIELDS = (
    "description", "topic", "category", "levelMin", "levelMax",
    "entryCount", "tags", "iconUrl", "accentColor", "purchase",
    "minAppVersion", "channel",
    # Localized metadata maps (Corpán-app 0.15.3+). Mirrored from
    # manifest into catalog entry verbatim; the app's resolver walks
    # the map with the user's UI language.
    "nameLocalized", "descriptionLocalized", "topicLocalized",
)


def derive_catalog_entry(
    manifest: dict,
    zip_url: str,
    sha: str,
    size_mb: float,
) -> dict:
    if "id" not in manifest or "name" not in manifest or "version" not in manifest:
        raise SystemExit("manifest is missing id/name/version")
    entry: dict[str, Any] = {
        "id": manifest["id"],
        "name": manifest["name"],
        "version": manifest["version"],
        "zipUrl": zip_url,
        "sha256": sha,
        "sizeMb": round(size_mb, 3),
        "languageCount": len(manifest.get("languageCodes") or []),
    }
    for key in _PASSTHROUGH_FIELDS:
        if key in manifest and manifest[key] is not None:
            entry[key] = manifest[key]
    entry.setdefault("purchase", {"type": "free"})
    entry.setdefault("minAppVersion", DEFAULT_MIN_APP_VERSION)
    entry.setdefault("channel", DEFAULT_CHANNEL)
    return entry


def upsert_pack(catalog: dict, entry: dict) -> None:
    """Replace any existing entry with the same id; append otherwise."""
    pack_id = entry["id"]
    catalog["packs"] = [
        p for p in catalog.get("packs", []) if p.get("id") != pack_id
    ]
    catalog["packs"].append(entry)


def remove_pack(catalog: dict, pack_id: str) -> bool:
    before = len(catalog.get("packs", []))
    catalog["packs"] = [
        p for p in catalog.get("packs", []) if p.get("id") != pack_id
    ]
    return len(catalog["packs"]) != before


_CURATION_GROUP_LOCALIZED = (
    # (snake_in_curation, camel_in_catalog)
    ("label_localized", "labelLocalized"),
    ("description_localized", "descriptionLocalized"),
)


def _normalize_curation_groups(groups: list) -> list:
    """Convert snake_case localized fields to camelCase for the catalog.
    Authors can write either form in curation.json; the catalog wire
    format is camelCase only."""
    out = []
    for g in groups or []:
        if not isinstance(g, dict):
            out.append(g); continue
        ng = dict(g)
        for snake, camel in _CURATION_GROUP_LOCALIZED:
            if snake in ng and camel not in ng:
                ng[camel] = ng.pop(snake)
            elif snake in ng and camel in ng:
                # both present → camel wins, snake dropped
                ng.pop(snake, None)
        out.append(ng)
    return out


def apply_curation(catalog: dict, curation: dict) -> None:
    """Merge top-level curation fields. Missing keys in `curation` leave
    the existing catalog values intact; explicit `null` clears them.

    `phrasePackGroups` entries may carry `label_localized` /
    `description_localized` (snake_case) — converted to camelCase for
    the catalog wire format."""
    if "onboardingStarterPackIds" in curation:
        v = curation["onboardingStarterPackIds"]
        if v is None: catalog.pop("onboardingStarterPackIds", None)
        else: catalog["onboardingStarterPackIds"] = v
    if "phrasePackGroups" in curation:
        v = curation["phrasePackGroups"]
        if v is None: catalog.pop("phrasePackGroups", None)
        else: catalog["phrasePackGroups"] = _normalize_curation_groups(v)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "build_dir",
        nargs="?",
        default=None,
        help="Directory with manifest.json + data.sqlite3 (required for package/upload).",
    )
    parser.add_argument("--out", help="Where to write the zip + sha256 (default: <build-dir>)")

    # Modes
    parser.add_argument("--upload", action="store_true", help="Upload the zip to S3 (requires build_dir).")
    parser.add_argument("--update-catalog", action="store_true",
                        help="Upsert this pack into catalog.json on S3 after upload.")
    parser.add_argument("--update-curation", metavar="FILE",
                        help="Path to a curation.json file (onboardingStarterPackIds + phrasePackGroups). "
                             "Merges into catalog.json without touching packs.")
    parser.add_argument("--remove-from-catalog", metavar="PACK_ID",
                        help="Yank a pack from the catalog (rollback). Pack zip stays on S3.")
    parser.add_argument("--invalidate", action="store_true",
                        help="CloudFront-invalidate catalog.json after the catalog change. "
                             "Requires --distribution-id.")
    parser.add_argument("--invalidate-only", action="store_true",
                        help="Just invalidate, don't touch S3. Useful after manual edits.")
    parser.add_argument("--distribution-id",
                        help="CloudFront distribution id, e.g. E1ABCD…  required for --invalidate.")

    # Common S3 args
    parser.add_argument("--bucket", default="corpan-prod", help="S3 bucket name (default corpan-prod)")
    parser.add_argument("--prefix", default="artifacts/corpan/phrase-packs",
                        help="Key prefix inside the bucket")
    parser.add_argument("--profile", help="AWS named profile to use")
    ns = parser.parse_args(argv)

    needs_build = ns.upload or (ns.update_catalog and not ns.update_curation and not ns.remove_from_catalog)
    is_curation_only = ns.update_curation is not None and ns.build_dir is None
    is_remove_only = ns.remove_from_catalog is not None and ns.build_dir is None
    is_invalidate_only = ns.invalidate_only and ns.build_dir is None

    if needs_build and ns.build_dir is None:
        parser.error("--upload / --update-catalog (with a pack) requires <build-dir>.")
    if ns.invalidate and not ns.distribution_id:
        parser.error("--invalidate requires --distribution-id")
    if ns.invalidate_only and not ns.distribution_id:
        parser.error("--invalidate-only requires --distribution-id")

    # Mode 1: build + (optional) upload + (optional) catalog upsert.
    if ns.build_dir is not None and not is_curation_only and not is_remove_only and not is_invalidate_only:
        build_dir = Path(ns.build_dir).resolve()
        out_dir = Path(ns.out).resolve() if ns.out else None
        zip_path, sha, manifest = package(build_dir, out_dir)
        zip_url: str | None = None
        size_bytes = zip_path.stat().st_size
        size_mb = size_bytes / (1024 * 1024)

        if ns.upload:
            zip_url = upload_zip(zip_path, sha, ns.bucket, ns.prefix, ns.profile)
            print(f"[publish] zip URL → {zip_url}")

        if ns.update_catalog:
            if not zip_url:
                # Allow `--update-catalog` without `--upload` to refresh
                # the catalog entry's metadata against an already-uploaded
                # zip. zipUrl is derived from the convention.
                zip_url = (
                    f"https://{CDN_HOST}/"
                    f"{ns.prefix.removeprefix('artifacts/').rstrip('/')}/"
                    f"{zip_path.name}"
                )
            catalog = fetch_catalog(ns.bucket, ns.prefix, ns.profile)
            entry = derive_catalog_entry(manifest, zip_url, sha, size_mb)
            upsert_pack(catalog, entry)
            write_catalog(ns.bucket, ns.prefix, ns.profile, catalog)
            if ns.invalidate:
                invalidate_catalog(ns.distribution_id, ns.prefix, ns.profile)
        return 0

    # Mode 2: curation-only update.
    if is_curation_only:
        curation_path = Path(ns.update_curation).resolve()
        if not curation_path.is_file():
            parser.error(f"curation file not found: {curation_path}")
        curation = json.loads(curation_path.read_text())
        catalog = fetch_catalog(ns.bucket, ns.prefix, ns.profile)
        apply_curation(catalog, curation)
        write_catalog(ns.bucket, ns.prefix, ns.profile, catalog)
        if ns.invalidate:
            invalidate_catalog(ns.distribution_id, ns.prefix, ns.profile)
        return 0

    # Mode 3: yank a pack.
    if is_remove_only:
        catalog = fetch_catalog(ns.bucket, ns.prefix, ns.profile)
        removed = remove_pack(catalog, ns.remove_from_catalog)
        if not removed:
            print(f"[publish] note: '{ns.remove_from_catalog}' not in catalog; nothing to remove")
        write_catalog(ns.bucket, ns.prefix, ns.profile, catalog)
        if ns.invalidate:
            invalidate_catalog(ns.distribution_id, ns.prefix, ns.profile)
        return 0

    # Mode 4: invalidate-only.
    if is_invalidate_only:
        invalidate_catalog(ns.distribution_id, ns.prefix, ns.profile)
        return 0

    # Fall-through: nothing requested. Still useful — local package only
    # already happened above.
    return 0


if __name__ == "__main__":
    sys.exit(main())
