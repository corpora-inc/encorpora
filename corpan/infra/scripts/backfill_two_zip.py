#!/usr/bin/env python3
"""Backfill existing narrations to the Corpán Plus two-ZIP model.

For every narration in catalog-v2.json that does NOT yet have `preview`/`full`,
this:
  1. downloads the existing full ZIP (legacy public narrations/<id>-<ver>.zip),
  2. slices the first `free_segments` TTS segments into a preview ZIP and
     uploads it to narrations/preview/,
  3. copies the full ZIP to narrations/premium/ (CloudFront-signed, Plus-gated),
  4. patches the catalog entry with preview/full/totalSegments/freeSegments
     (additive — legacy downloadUrl/tier/purchase are left intact so old
     runtimes keep working; NO version bump).

It does NOT re-run TTS or touch pack source. Free cutoff = min(floor(total/3),
100) unless overridden per-entry.

SAFETY: dry-run by default. Review the planned actions, then re-run with
--apply. Versions are write-once; this never overwrites the legacy ZIP.

Usage:
  python backfill_two_zip.py                 # dry run, all entries
  python backfill_two_zip.py --only <id>     # dry run, one narration id
  python backfill_two_zip.py --apply         # actually upload + patch catalog
"""
from __future__ import annotations

import argparse
import io
import json
import zipfile
from pathlib import PurePosixPath

import boto3

BUCKET = "corpan-prod"
PROFILE = "corpan-publisher"
CDN = "d38iwc9748jekz.cloudfront.net"
CATALOG_KEY = "artifacts/catalog-v2.json"


def compute_free_segments(total: int, override: int | None) -> int:
    if override is not None:
        return max(0, min(int(override), total))
    return min(total // 3, 100)


def ordered_tts_ids(seg_doc: dict | list) -> list[str]:
    segs = seg_doc["segments"] if isinstance(seg_doc, dict) and "segments" in seg_doc else seg_doc
    return [s["id"] for s in segs if s.get("tts")]


def truncate_doc(raw: dict | list, included: set[str]):
    is_wrapped = isinstance(raw, dict) and "segments" in raw
    segs = raw["segments"] if is_wrapped else raw
    last = max((i for i, s in enumerate(segs) if s.get("id") in included), default=-1)
    kept = segs[: last + 1]
    if is_wrapped:
        new = dict(raw)
        new["segments"] = kept
        new["is_preview"] = True
        return new
    return kept


def slice_preview_zip(full_bytes: bytes, free_segments: int) -> tuple[bytes, int]:
    """Return (preview_zip_bytes, total_tts). Slices the full pack ZIP in
    memory to the first `free_segments` TTS segments (audio + manifests +
    truncated segments docs), preserving everything else (dist/, provenance)."""
    zin = zipfile.ZipFile(io.BytesIO(full_bytes))
    names = zin.namelist()
    root = names[0].split("/")[0]  # pack id dir

    # Find the segments doc to compute ordering.
    seg_name = f"{root}/segments.json"
    seg_doc = json.loads(zin.read(seg_name))
    ordered = ordered_tts_ids(seg_doc)
    total = len(ordered)
    n = min(free_segments, total)
    included = set(ordered[:n])

    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zout:
        for name in names:
            arc = PurePosixPath(name)
            base = arc.name
            # Audio: keep only included segment m4as.
            if "/audio/" in name and name.endswith(".m4a"):
                if PurePosixPath(base).stem in included:
                    zout.writestr(name, zin.read(name))
                continue
            # Segments docs: truncate.
            if base == "segments.json" or (base.startswith("segments_") and base.endswith(".json")):
                doc = json.loads(zin.read(name))
                zout.writestr(name, json.dumps(truncate_doc(doc, included)))
                continue
            # Audio manifest: filter to included.
            if base.startswith("audio_manifest_") and base.endswith(".json"):
                man = json.loads(zin.read(name))
                man["segments"] = {k: v for k, v in man.get("segments", {}).items() if k in included}
                zout.writestr(name, json.dumps(man))
                continue
            # Narration manifest: stamp isPreview.
            if base == "manifest.json":
                man = json.loads(zin.read(name))
                man["isPreview"] = True
                man["previewOfTotal"] = total
                if isinstance(man.get("metadata"), dict):
                    man["metadata"]["segmentCount"] = n
                zout.writestr(name, json.dumps(man, indent=2) + "\n")
                continue
            # Everything else (dist/, _provenance.json): copy verbatim.
            zout.writestr(name, zin.read(name))
    return out.getvalue(), total


def cdn_url(key: str) -> str:
    return f"https://{CDN}/{key.removeprefix('artifacts/')}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Actually upload + patch catalog")
    ap.add_argument("--only", default=None, help="Backfill a single narration id")
    ap.add_argument("--free-segments", type=int, default=None, help="Override cutoff for all")
    args = ap.parse_args()

    s3 = boto3.Session(profile_name=PROFILE).client("s3")
    catalog = json.loads(s3.get_object(Bucket=BUCKET, Key=CATALOG_KEY)["Body"].read())
    narrations = catalog.get("narrations", [])

    planned = 0
    for entry in narrations:
        nid = entry.get("id")
        if args.only and nid != args.only:
            continue
        if entry.get("preview") and entry.get("full"):
            continue  # already migrated
        dl = entry.get("downloadUrl")
        if not dl:
            print(f"SKIP {nid}: no downloadUrl")
            continue

        # Resolve the legacy full zip S3 key from its URL.
        path = PurePosixPath(dl.split(CDN + "/")[-1])
        full_key = f"artifacts/{path}"
        ver = entry.get("version")
        zip_name = full_key.split("/")[-1]
        preview_key = f"artifacts/narrations/preview/{zip_name.replace('.zip', '-preview.zip')}"
        premium_key = f"artifacts/narrations/premium/{zip_name}"

        print(f"\n[{nid}] v{ver}")
        print(f"  full(legacy): {full_key}")
        print(f"  → preview:    {preview_key}")
        print(f"  → premium:    {premium_key}")

        if not args.apply:
            planned += 1
            continue

        full_bytes = s3.get_object(Bucket=BUCKET, Key=full_key)["Body"].read()
        total = len(ordered_tts_ids(json.loads(
            zipfile.ZipFile(io.BytesIO(full_bytes)).read(
                f"{zipfile.ZipFile(io.BytesIO(full_bytes)).namelist()[0].split('/')[0]}/segments.json"
            )
        )))
        free_n = compute_free_segments(total, args.free_segments)
        preview_bytes, _ = slice_preview_zip(full_bytes, free_n)

        s3.put_object(Bucket=BUCKET, Key=preview_key, Body=preview_bytes, ContentType="application/zip")
        # Premium copy of the full zip (no re-encode; same bytes).
        s3.copy_object(Bucket=BUCKET, Key=premium_key,
                       CopySource={"Bucket": BUCKET, "Key": full_key})

        import hashlib
        entry["totalSegments"] = total
        entry["freeSegments"] = free_n
        entry["preview"] = {
            "url": cdn_url(preview_key),
            "sha256": hashlib.sha256(preview_bytes).hexdigest(),
            "sizeMb": round(len(preview_bytes) / (1024 * 1024), 1),
        }
        entry["full"] = {
            "url": cdn_url(premium_key),
            "sha256": entry.get("sha256", ""),
            "sizeMb": entry.get("sizeMb", 0),
            "requires": "corpan.plus",
        }
        print(f"  ✓ total={total} free={free_n} preview={entry['preview']['sizeMb']}MB")
        planned += 1

    if args.apply:
        s3.put_object(Bucket=BUCKET, Key=CATALOG_KEY,
                      Body=json.dumps(catalog, indent=2) + "\n",
                      ContentType="application/json",
                      CacheControl="public, max-age=60, stale-while-revalidate=300")
        print(f"\nPatched catalog ({planned} entries). Invalidate /catalog-v2.json on CloudFront next.")
    else:
        print(f"\nDRY RUN — {planned} entries would be backfilled. Re-run with --apply.")


if __name__ == "__main__":
    main()
