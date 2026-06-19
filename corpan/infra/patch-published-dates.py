#!/usr/bin/env python3
"""
Surgical publishedAt backfill for catalog-v2.json.

`patch-catalog.py` REBUILDS the entire books array from its in-repo BOOK_META +
asset-urls.json, which clobbers cover art and descriptions that the backend
`ttsctl publish` has since written. To fix only the Browse → "Latest" sort we
do the minimal thing: fetch the live catalog, set publishedAt on the narrations
(and book rows) for a small set of books, and put it back. Everything else is
preserved byte-for-byte.

Dry-run by default; pass --apply to upload + invalidate CloudFront.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import sys
import time
from pathlib import Path

import boto3

REPO_ROOT = Path(__file__).resolve().parents[2]
DOTENV = REPO_ROOT / ".env"
S3_BUCKET = "corpan-prod"
S3_KEY = "artifacts/catalog-v2.json"
AWS_REGION = "us-east-2"
CLOUDFRONT_DISTRIBUTION_ID = "E1RDNUCVE70SCI"

# bookId -> publishedAt (the only change we make)
DATES = {
    "book_biomes_tropical_rainforest": "2026-06-14",
    "book_biomes_tropical_savanna": "2026-06-15",
    "book_biomes_hot_desert": "2026-06-16",
    "book_biomes_temperate_forest": "2026-06-17",
    "book_biomes_temperate_grassland": "2026-06-18",
    "book_ai_this_week_2026_06_14": "2026-06-14",
}


def load_dotenv(path: Path) -> None:
    if not path.exists():
        sys.exit(f"missing {path}")
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    if "AWS_ACCESS_KEY" in os.environ and "AWS_ACCESS_KEY_ID" not in os.environ:
        os.environ["AWS_ACCESS_KEY_ID"] = os.environ["AWS_ACCESS_KEY"]


def s3_client():
    return boto3.client(
        "s3", region_name=AWS_REGION,
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


def cf_client():
    return boto3.client(
        "cloudfront",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="upload + invalidate (default: dry-run)")
    ap.add_argument("--out", type=Path, default=Path("/tmp/catalog-v2-dates.json"))
    args = ap.parse_args()

    load_dotenv(DOTENV)
    s3 = s3_client()
    print(f"Fetching s3://{S3_BUCKET}/{S3_KEY}…")
    cat = json.load(s3.get_object(Bucket=S3_BUCKET, Key=S3_KEY)["Body"])

    n_changed = 0
    for n in cat.get("narrations", []):
        d = DATES.get(n.get("bookId"))
        if d and n.get("publishedAt") != d:
            n["publishedAt"] = d
            n_changed += 1
    b_changed = 0
    for b in cat.get("books", []):
        d = DATES.get(b.get("bookId"))
        if d and b.get("publishedAt") != d:
            b["publishedAt"] = d
            b_changed += 1

    print(f"  narrations updated: {n_changed}")
    print(f"  books updated:      {b_changed}")
    cat["generatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    body = json.dumps(cat, ensure_ascii=False, indent=2).encode("utf-8")
    args.out.write_bytes(body)
    print(f"Wrote local copy to {args.out}")

    if not args.apply:
        print("[dry-run] skipping S3 upload + CloudFront invalidation (pass --apply)")
        return

    s3.put_object(
        Bucket=S3_BUCKET, Key=S3_KEY, Body=body,
        ContentType="application/json", CacheControl="public, max-age=300",
    )
    print(f"  ✓ uploaded s3://{S3_BUCKET}/{S3_KEY}")
    print("Issuing CloudFront invalidation for /catalog-v2.json…")
    resp = cf_client().create_invalidation(
        DistributionId=CLOUDFRONT_DISTRIBUTION_ID,
        InvalidationBatch={
            "Paths": {"Quantity": 1, "Items": ["/catalog-v2.json"]},
            "CallerReference": f"dates-{int(time.time())}",
        },
    )
    print(f"  ✓ created invalidation {resp['Invalidation']['Id']}")


if __name__ == "__main__":
    main()
