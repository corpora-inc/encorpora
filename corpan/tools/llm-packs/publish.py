#!/usr/bin/env python3
"""
Package + ship LLM artifacts to S3 + CloudFront.

Three subcommands:

  base       — the shared model pack (e.g. `llm-base-qwen3-4b-v1`). Two-ZIP:
               preview (1 KB metadata) + full (2.5 GB GGUF). Goes into the
               catalog's `llmPacks[]` array.

  pack       — a regular content pack that consumes the LLM runtime
               (e.g. `tutomaton-v1`). Two-ZIP: preview + full. Goes into the
               catalog's `entries[]` array (same place as phrase packs).
               For Tutomaton, the shell ZIP *excludes* per-language modules
               under `languages/` — those ship separately via `language`.

  language   — a single Tutomaton language module (e.g. `es-0.1.0.zip`).
               Single ZIP (no preview shim; the pack manifest declares the
               module URL + sha256). Uploaded under a sibling prefix and
               referenced from the Tutomaton pack manifest's `languages[]`.

The catalog lives at:
    s3://corpan-prod/catalog-v2.json
served as:
    https://d38iwc9748jekz.cloudfront.net/catalog-v2.json
with Cache-Control: public, max-age=300, must-revalidate
(invalidate with --invalidate + --distribution-id E1RDNUCVE70SCI).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile

CDN_HOST = "d38iwc9748jekz.cloudfront.net"
CATALOG_KEY = "catalog-v2.json"
CATALOG_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300"
DEFAULT_BUCKET = "corpan-prod"
DEFAULT_PROFILE = "corpan-publisher"
LLM_PREFIX = "artifacts/corpan/llm-packs"
TUTOMATON_LANG_PREFIX = "artifacts/corpan/tutomaton-languages"
# CloudFront origin rewrites /corpan/* → s3://corpan-prod/artifacts/corpan/*
# so public URLs drop the "/artifacts/" segment.
LLM_CDN_PATH = "corpan/llm-packs"
TUTOMATON_LANG_CDN_PATH = "corpan/tutomaton-languages"
DEFAULT_MIN_APP_VERSION = "0.16.0"


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def size_mb(p: Path) -> int:
    return max(1, round(p.stat().st_size / (1024 * 1024)))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ---------------------------------------------------------------------------
# Base model packaging
# ---------------------------------------------------------------------------

def build_base_pack(gguf: Path, pack_id: str, version: str, model_arch: str,
                    context_size: int, quant: str, out_dir: Path) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    stage = out_dir / f"{pack_id}-{version}-stage"
    if stage.exists():
        shutil.rmtree(stage)
    (stage / "model").mkdir(parents=True)
    target_gguf = stage / "model" / "base.gguf"
    target_gguf.symlink_to(gguf.resolve())

    sha = sha256_file(gguf)
    size_bytes = gguf.stat().st_size

    manifest = {
        "id": pack_id,
        "packType": "llm-base",
        "version": version,
        "minAppVersion": DEFAULT_MIN_APP_VERSION,
        "runtime": {
            "target": "llama.cpp",
            "format": "gguf",
            "modelArch": model_arch,
            "contextSize": context_size,
            "recommendedGpuLayers": "auto",
        },
        "variants": [{
            "quant": quant,
            "path": "model/base.gguf",
            "sizeBytes": size_bytes,
            "sha256": sha,
            "recommended": True,
        }],
    }
    (stage / "manifest.json").write_text(json.dumps(manifest, indent=2))

    preview_zip = out_dir / f"{pack_id}-{version}-preview.zip"
    with ZipFile(preview_zip, "w", ZIP_DEFLATED) as z:
        z.writestr("manifest.json", json.dumps(manifest, indent=2))
        z.writestr("README.md", f"Preview shim for {pack_id} {version}. Model in the full pack.\n")
    preview_sha = sha256_file(preview_zip)
    preview_mb = size_mb(preview_zip)

    full_zip = out_dir / f"{pack_id}-{version}-full.zip"
    with ZipFile(full_zip, "w", ZIP_STORED, allowZip64=True) as z:
        z.write(stage / "manifest.json", arcname="manifest.json")
        z.write(target_gguf, arcname="model/base.gguf")
    full_sha = sha256_file(full_zip)
    full_mb = size_mb(full_zip)

    shutil.rmtree(stage)

    entry = {
        **manifest,
        "tier": "plus",
        "devOnly": True,
        "preview": {
            "url": f"https://{CDN_HOST}/{LLM_CDN_PATH}/{preview_zip.name}",
            "sha256": preview_sha,
            "sizeMb": preview_mb,
        },
        "full": {
            "url": f"https://{CDN_HOST}/{LLM_CDN_PATH}/{full_zip.name}",
            "sha256": full_sha,
            "sizeMb": full_mb,
            "requires": "plus",
        },
        "publishedAt": now_iso(),
    }
    print(f"[publish] base: {preview_zip.name} ({preview_mb} MB)")
    print(f"[publish] base: {full_zip.name} ({full_mb} MB)  sha={full_sha[:12]}…")
    return entry


# ---------------------------------------------------------------------------
# Pack (shell) packaging — e.g. Tutomaton
# ---------------------------------------------------------------------------

PACK_EXCLUDE_NAMES = {"__pycache__", ".DS_Store", ".gitignore", "node_modules", "tools"}


def _add_dir(z: ZipFile, src: Path, skip_subpaths: list[str] | None = None):
    skip_subpaths = skip_subpaths or []
    for p in sorted(src.rglob("*")):
        rel = p.relative_to(src)
        parts = rel.parts
        if any(part in PACK_EXCLUDE_NAMES for part in parts):
            continue
        if any(rel.as_posix() == sp or rel.as_posix().startswith(sp + "/") for sp in skip_subpaths):
            continue
        if p.is_file():
            z.write(p, arcname=rel.as_posix())


def build_shell_pack(pack_dir: Path, out_dir: Path) -> dict:
    """Build a content pack (shell only — no language modules)."""
    manifest_path = pack_dir / "manifest.json"
    if not manifest_path.is_file():
        raise SystemExit(f"missing manifest.json in {pack_dir}")
    manifest = json.loads(manifest_path.read_text())
    pack_id = manifest["id"]
    version = manifest["version"]

    out_dir.mkdir(parents=True, exist_ok=True)

    preview_zip = out_dir / f"{pack_id}-{version}-preview.zip"
    with ZipFile(preview_zip, "w", ZIP_DEFLATED) as z:
        z.writestr("manifest.json", json.dumps(manifest, indent=2))
        z.writestr("README.md", f"Preview shim for {pack_id} {version}. Full pack requires Corpán Plus.\n")
    preview_sha = sha256_file(preview_zip)
    preview_mb = size_mb(preview_zip)

    # Full ZIP — pack shell, but EXCLUDE per-language modules; they ship separately.
    full_zip = out_dir / f"{pack_id}-{version}-full.zip"
    with ZipFile(full_zip, "w", ZIP_DEFLATED, allowZip64=True) as z:
        _add_dir(z, pack_dir, skip_subpaths=["languages"])
    full_sha = sha256_file(full_zip)
    full_mb = size_mb(full_zip)

    entry = {
        **manifest,
        "preview": {
            "url": f"https://{CDN_HOST}/{LLM_CDN_PATH}/{preview_zip.name}",
            "sha256": preview_sha,
            "sizeMb": preview_mb,
        },
        "full": {
            "url": f"https://{CDN_HOST}/{LLM_CDN_PATH}/{full_zip.name}",
            "sha256": full_sha,
            "sizeMb": full_mb,
            "requires": "plus",
        },
        "publishedAt": now_iso(),
    }
    print(f"[publish] pack: {preview_zip.name} ({preview_mb} MB)")
    print(f"[publish] pack: {full_zip.name} ({full_mb} MB)")
    return entry


# ---------------------------------------------------------------------------
# Language module packaging
# ---------------------------------------------------------------------------

def build_language_module(pack_dir: Path, code: str, out_dir: Path) -> dict:
    """Build a single Tutomaton language module ZIP.

    Returns a dict ready to merge into the pack manifest's `languages[]` array
    (specifically: contentVersion, sha256, sizeMb, moduleUrl).
    """
    lang_dir = pack_dir / "languages" / code
    module_path = lang_dir / "module.json"
    if not module_path.is_file():
        raise SystemExit(f"missing {module_path}")
    module = json.loads(module_path.read_text())
    content_version = module["contentVersion"]

    out_dir.mkdir(parents=True, exist_ok=True)
    zip_path = out_dir / f"{code}-{content_version}.zip"

    with ZipFile(zip_path, "w", ZIP_DEFLATED, allowZip64=True) as z:
        for p in sorted(lang_dir.rglob("*")):
            if p.is_file() and not any(part in PACK_EXCLUDE_NAMES for part in p.relative_to(lang_dir).parts):
                z.write(p, arcname=p.relative_to(lang_dir).as_posix())

    sha = sha256_file(zip_path)
    mb = size_mb(zip_path)

    registry_entry = {
        "code": code,
        "displayName": module.get("displayName", {code: code}),
        "voiceLanguageCode": module["voiceLanguageCode"],
        "contentVersion": content_version,
        "sizeMb": mb,
        "moduleUrl": f"https://{CDN_HOST}/{TUTOMATON_LANG_CDN_PATH}/{zip_path.name}",
        "sha256": sha,
    }
    print(f"[publish] lang: {zip_path.name} ({mb} MB)  sha={sha[:12]}…")
    return registry_entry


def sync_language_into_pack_manifest(pack_dir: Path, registry_entry: dict):
    """Update pack-dir manifest.json's languages[] entry for the given code."""
    manifest_path = pack_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    languages = manifest.get("languages", [])
    code = registry_entry["code"]
    languages = [l for l in languages if l.get("code") != code] + [registry_entry]
    languages.sort(key=lambda l: l["code"])
    manifest["languages"] = languages
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"[publish] updated {manifest_path} with {code} {registry_entry['contentVersion']}")


# ---------------------------------------------------------------------------
# S3 / CloudFront
# ---------------------------------------------------------------------------

def _require_boto3():
    try:
        import boto3  # type: ignore
        return boto3
    except ImportError:
        raise SystemExit("requires boto3 (pip install boto3)")


def _s3_client(profile: str | None):
    boto3 = _require_boto3()
    sess = boto3.Session(profile_name=profile) if profile else boto3.Session()
    return sess.client("s3")


def upload_zip(zip_path: Path, bucket: str, key: str, profile: str | None):
    s3 = _s3_client(profile)
    print(f"[publish] uploading s3://{bucket}/{key} ({size_mb(zip_path)} MB)…")
    s3.upload_file(
        str(zip_path), bucket, key,
        ExtraArgs={
            "CacheControl": "public, max-age=31536000, immutable",
            "ContentType": "application/zip",
        },
    )


def download_catalog(bucket: str, profile: str | None) -> dict:
    """Fetch the live catalog VIA THE PUBLIC CDN (not S3 GetObject) — the
    Spark publisher IAM role has PutObject but not GetObject. Catalog is
    public anyway. We treat it as opaque — only the additive `llmPacks`
    field is read/written. All other fields (`narrations`, `books`,
    `gamePacks`, `characters`, `voiceProfiles`) pass through untouched."""
    import urllib.request
    # Cache-bust to avoid stale CDN response
    url = f"https://{CDN_HOST}/{CATALOG_KEY}?cb={int(datetime.now(timezone.utc).timestamp())}"
    with urllib.request.urlopen(url, timeout=30) as r:
        if r.status != 200:
            raise SystemExit(f"catalog fetch failed: HTTP {r.status}")
        return json.loads(r.read())


LOCAL_PATCHED_CATALOG = Path("/tmp/catalog-v2.patched.json")


def upload_catalog(catalog: dict, bucket: str, profile: str | None):
    """Write the catalog back. Stamps `generatedAt` (matching the project's
    existing pattern in `infra/patch-catalog.py`); uses `ensure_ascii=False`
    so CJK / accented characters stay UTF-8.

    The Spark IAM user (`corpan-publisher`) can PutObject under the artifacts
    prefix but NOT at `catalog-v2.json` at the bucket root. When that's the
    case, we save the patched catalog locally + print the upload command for
    a machine with broader perms. The artifact ZIPs are already published —
    only the catalog promotion is deferred."""
    import time
    catalog["generatedAt"] = time.strftime(
        "%Y-%m-%dT%H:%M:%S.000+00:00", time.gmtime()
    )
    body = json.dumps(catalog, indent=2, ensure_ascii=False).encode("utf-8")
    # Safety: before upload, sanity-check we haven't dropped any major fields.
    must_have = {"version", "narrations", "books"}
    missing = [k for k in must_have if k not in catalog]
    if missing:
        raise SystemExit(f"REFUSING TO UPLOAD: catalog missing {missing} — read failed?")

    # Always write a local copy first (cheap, reversible, helpful for debugging)
    LOCAL_PATCHED_CATALOG.write_bytes(body)
    print(f"[publish] wrote local copy → {LOCAL_PATCHED_CATALOG} ({len(body):,} bytes)")

    s3 = _s3_client(profile)
    try:
        print(f"[publish] uploading s3://{bucket}/{CATALOG_KEY} …")
        s3.put_object(
            Bucket=bucket, Key=CATALOG_KEY, Body=body,
            CacheControl=CATALOG_CACHE_CONTROL, ContentType="application/json",
        )
        print(f"[publish]   ✓ uploaded")
    except Exception as e:
        if "AccessDenied" in str(e):
            print(f"[publish]   ✗ AccessDenied on catalog put — this IAM user can't write the root catalog.")
            print(f"[publish]   The artifact ZIPs are already up. Upload the patched catalog from a machine with full perms:")
            print(f"")
            print(f"     aws --profile <full-perms> s3 cp {LOCAL_PATCHED_CATALOG} s3://{bucket}/{CATALOG_KEY} \\")
            print(f"       --cache-control '{CATALOG_CACHE_CONTROL}' \\")
            print(f"       --content-type application/json")
            print(f"")
            print(f"     aws --profile <full-perms> cloudfront create-invalidation \\")
            print(f"       --distribution-id E1RDNUCVE70SCI --paths /{CATALOG_KEY}")
            return
        raise


def upsert_llm_entry(catalog: dict, entry: dict) -> dict:
    """Add or replace an entry in the additive `llmPacks[]` array.
    Touches ONLY `llmPacks` — no other catalog field is modified."""
    catalog.setdefault("llmPacks", [])
    catalog["llmPacks"] = [p for p in catalog["llmPacks"] if p.get("id") != entry["id"]]
    catalog["llmPacks"].append(entry)
    catalog["llmPacks"].sort(key=lambda p: (p.get("packType", ""), p.get("id", "")))
    return catalog


def invalidate_catalog(distribution_id: str, profile: str | None):
    boto3 = _require_boto3()
    sess = boto3.Session(profile_name=profile) if profile else boto3.Session()
    cf = sess.client("cloudfront")
    cf.create_invalidation(
        DistributionId=distribution_id,
        InvalidationBatch={
            "Paths": {"Quantity": 1, "Items": [f"/{CATALOG_KEY}"]},
            "CallerReference": f"llm-publish-{now_iso()}",
        },
    )
    print(f"[publish] cloudfront: invalidation queued for /{CATALOG_KEY}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def cmd_base(args):
    gguf = Path(args.gguf).resolve()
    if not gguf.is_file():
        raise SystemExit(f"GGUF not found: {gguf}")
    out_dir = Path(args.out or "/tmp/llm-base-dist").resolve()
    entry = build_base_pack(
        gguf=gguf, pack_id=args.pack_id, version=args.version,
        model_arch=args.model_arch, context_size=args.context_size,
        quant=args.quant, out_dir=out_dir,
    )
    if args.upload:
        for name in [f"{entry['id']}-{entry['version']}-preview.zip",
                     f"{entry['id']}-{entry['version']}-full.zip"]:
            upload_zip(out_dir / name, args.bucket, f"{LLM_PREFIX}/{name}", args.profile)
    if args.update_catalog:
        cat = download_catalog(args.bucket, args.profile)
        upsert_llm_entry(cat, entry)
        upload_catalog(cat, args.bucket, args.profile)
        if args.invalidate and args.distribution_id:
            invalidate_catalog(args.distribution_id, args.profile)
    print(json.dumps(entry, indent=2))


def cmd_pack(args):
    pack_dir = Path(args.pack_dir).resolve()
    out_dir = Path(args.out or pack_dir / "_dist").resolve()
    entry = build_shell_pack(pack_dir, out_dir)
    if args.upload:
        for name in [f"{entry['id']}-{entry['version']}-preview.zip",
                     f"{entry['id']}-{entry['version']}-full.zip"]:
            upload_zip(out_dir / name, args.bucket, f"{LLM_PREFIX}/{name}", args.profile)
    if args.update_catalog:
        cat = download_catalog(args.bucket, args.profile)
        upsert_llm_entry(cat, entry)
        upload_catalog(cat, args.bucket, args.profile)
        if args.invalidate and args.distribution_id:
            invalidate_catalog(args.distribution_id, args.profile)
    print(json.dumps(entry, indent=2))


def cmd_language(args):
    pack_dir = Path(args.pack_dir).resolve()
    out_dir = Path(args.out or pack_dir / "_dist/languages").resolve()
    registry_entry = build_language_module(pack_dir, args.code, out_dir)
    zip_name = f"{registry_entry['code']}-{registry_entry['contentVersion']}.zip"
    if args.upload:
        upload_zip(out_dir / zip_name, args.bucket, f"{TUTOMATON_LANG_PREFIX}/{zip_name}", args.profile)
    if args.sync_manifest:
        sync_language_into_pack_manifest(pack_dir, registry_entry)
    print(json.dumps(registry_entry, indent=2))


def cmd_remove(args):
    cat = download_catalog(args.bucket, args.profile)
    before = len(cat.get("llmPacks", []))
    cat["llmPacks"] = [p for p in cat.get("llmPacks", []) if p.get("id") != args.pack_id]
    after = len(cat["llmPacks"])
    print(f"[publish] removed {args.pack_id}: llmPacks {before}→{after}")
    upload_catalog(cat, args.bucket, args.profile)
    if args.invalidate and args.distribution_id:
        invalidate_catalog(args.distribution_id, args.profile)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    def _add_s3(sp):
        sp.add_argument("--upload", action="store_true")
        sp.add_argument("--update-catalog", action="store_true")
        sp.add_argument("--bucket", default=DEFAULT_BUCKET)
        sp.add_argument("--profile", default=DEFAULT_PROFILE)
        sp.add_argument("--invalidate", action="store_true")
        sp.add_argument("--distribution-id", default=None)
        sp.add_argument("--out", default=None)

    p_base = sub.add_parser("base", help="Ship the base GGUF pack")
    p_base.add_argument("--gguf", required=True)
    p_base.add_argument("--pack-id", required=True)
    p_base.add_argument("--version", required=True)
    p_base.add_argument("--model-arch", default="qwen3")
    p_base.add_argument("--context-size", type=int, default=4096)
    p_base.add_argument("--quant", default="Q4_K_M")
    _add_s3(p_base)
    p_base.set_defaults(func=cmd_base)

    p_pack = sub.add_parser("pack", help="Ship a content pack shell (e.g. Tutomaton)")
    p_pack.add_argument("pack_dir")
    _add_s3(p_pack)
    p_pack.set_defaults(func=cmd_pack)

    p_lang = sub.add_parser("language", help="Ship a single Tutomaton language module")
    p_lang.add_argument("pack_dir")
    p_lang.add_argument("code")
    p_lang.add_argument("--sync-manifest", action="store_true",
                        help="Update pack-dir manifest.json's languages[] with this entry")
    p_lang.add_argument("--upload", action="store_true")
    p_lang.add_argument("--bucket", default=DEFAULT_BUCKET)
    p_lang.add_argument("--profile", default=DEFAULT_PROFILE)
    p_lang.add_argument("--out", default=None)
    p_lang.set_defaults(func=cmd_language)

    p_rm = sub.add_parser("remove-from-catalog")
    p_rm.add_argument("pack_id")
    p_rm.add_argument("--bucket", default=DEFAULT_BUCKET)
    p_rm.add_argument("--profile", default=DEFAULT_PROFILE)
    p_rm.add_argument("--invalidate", action="store_true")
    p_rm.add_argument("--distribution-id", default=None)
    p_rm.set_defaults(func=cmd_remove)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
