#!/usr/bin/env python3
"""
Surgical catalog-v2.json patcher — publishedAt + missing book rows.

`patch-catalog.py` REBUILDS the entire books array from its in-repo BOOK_META +
asset-urls.json, which clobbers cover art and descriptions that the backend
`ttsctl publish` has since written. To fix only the Browse → "Latest" sort we
do the minimal thing: fetch the live catalog, set publishedAt on the narrations
(and book rows), append any missing book rows (with full metadata + cover URL),
and put it back. Everything else is preserved byte-for-byte.

Why book-row injection lives here: `ttsctl publish` stamps publishedAt and
narration entries but does NOT create new `books[]` rows. Without a row, the
book's cover/title/description never shows up in Browse even though
narrations are live. This used to be `patch-catalog.py`'s job, which is now
dead. So this script picks it up — surgically.

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
#
# Dates are best-guess from git first-commit dates of each book directory,
# with same-day series staggered by 1 day each to give a sensible
# within-series read order. New books should be added here in publish order
# (ttsctl publish now also stamps publishedAt at publish time from each
# pack's manifest.json `metadata.publishedAt`, but we keep this script as
# the catch-up tool for backfills).
DATES = {
    # ── Spring 2026 backlog (best-guess from git first-commit) ──────────
    # Religion
    "bible_genesis": "2026-03-25",
    # History: fascinating curiosities + pirate biographies
    "book_monte_alban":            "2026-03-28",
    "book_mystery_of_the_olmec":   "2026-03-29",
    "book_zheng_yi_sao":           "2026-04-18",
    "book_hayreddin_barbarossa":   "2026-04-19",
    # Sports: U10 7v7 Soccer (4 books, in field-position order)
    "book_u10_goalie":             "2026-04-01",
    "book_u10_sweeper":            "2026-04-02",
    "book_u10_defender":           "2026-04-03",
    "book_u10_striker":            "2026-04-04",
    # Science: fascinating science
    "book_science_atom":           "2026-04-05",
    "book_science_volcanoes":      "2026-04-06",
    "book_science_cell":           "2026-04-18",
    "book_science_heart":          "2026-04-19",
    # Literature: Tolstoy short stories
    "book_tolstoy_three_questions":  "2026-04-27",
    "book_tolstoy_what_men_live_by": "2026-04-28",
    # Lifestyle: little escapes
    "book_sky_diving":             "2026-04-29",
    "book_gardening":              "2026-05-18",
    "book_sailing":                "2026-05-19",
    # Vehicles
    "book_motorcycles_history":    "2026-05-16",
    "book_train_history":          "2026-05-17",
    # Food: food-of-the-world
    "book_soul_food_southern_us":  "2026-05-08",
    "book_persian_food":           "2026-05-12",
    # Music: instruments-of-the-world
    "book_oud_history":            "2026-05-15",
    # Sports for Kids (3 books, in published order)
    "book_sports_for_kids_baseball":     "2026-05-21",
    "book_sports_for_kids_gymnastics":   "2026-05-22",
    "book_sports_for_kids_cheerleading": "2026-05-23",
    # ── AI This Week (weekly podcast, dated by episode) ────────────────
    "book_ai_this_week_2026_05_13": "2026-05-13",
    "book_ai_this_week_2026_05_20": "2026-05-20",
    "book_ai_this_week_2026_05_27": "2026-05-27",
    "book_ai_this_week_2026_06_03": "2026-06-03",
    "book_ai_this_week_2026_06_14": "2026-06-14",
    "book_ai_this_week_2026_06_21": "2026-06-21",
    "book_ai_this_week_2026_06_28": "2026-06-28",
    # ── Biomes of the World (new series, sequential daily) ─────────────
    "book_biomes_tropical_rainforest": "2026-06-14",
    "book_biomes_tropical_savanna":    "2026-06-15",
    "book_biomes_hot_desert":          "2026-06-16",
    "book_biomes_temperate_forest":    "2026-06-17",
    "book_biomes_temperate_grassland": "2026-06-18",
    "book_biomes_mediterranean":       "2026-06-19",
    "book_biomes_boreal_forest":       "2026-06-20",
    "book_biomes_tundra":              "2026-06-21",
}


# Full book-row metadata for any book that isn't yet in catalog.books[].
# Append-only — never edits an existing row. Keys match the live catalog
# schema (bookId/title/description/coverImageUrl/series/primaryLanguage/tags).
# publishedAt is filled from DATES at write time.
CDN_BASE = "https://d38iwc9748jekz.cloudfront.net"
BIOMES_TAGS = ["nature", "biomes", "science", "language-learning"]
BOOK_ROWS: dict[str, dict] = {
    "book_biomes_mediterranean": {
        "title": "The Mediterranean Biome",
        "description": (
            "A short, plain-spoken tour of the Mediterranean biome — hot "
            "dry summers and mild wet winters, the fragrant low shrublands "
            "and silver-leaved olive trees, and the people whose food and "
            "farming grew up with the long blue summer. Found in five small "
            "corners of the Earth. Book six of the Biomes of the World series."
        ),
        "coverImageUrl": f"{CDN_BASE}/books/book_biomes_mediterranean/cover.jpg",
        "series": "Biomes of the World",
        "primaryLanguage": "en",
        "tags": BIOMES_TAGS,
    },
    "book_biomes_boreal_forest": {
        "title": "The Boreal Forest",
        "description": (
            "A short, plain-spoken tour of the boreal forest — the great "
            "green belt of evergreen trees, lakes, and quiet snow that runs "
            "almost all the way around the top of the world. The taiga: "
            "long cold winters, brief bright summers, moose and brown bear "
            "and lynx, the Sami and Evenki and Dene who have lived among "
            "the trees for thousands of years. Book seven of the Biomes "
            "of the World series."
        ),
        "coverImageUrl": f"{CDN_BASE}/books/book_biomes_boreal_forest/cover.jpg",
        "series": "Biomes of the World",
        "primaryLanguage": "en",
        "tags": BIOMES_TAGS,
    },
    "book_biomes_tundra": {
        "title": "The Tundra",
        "description": (
            "A short, plain-spoken tour of the tundra — the cold, treeless "
            "land at the top of the world and high on the mountains. Frozen "
            "ground and a brief bright summer, low mosses and lichens and "
            "tiny flowers, caribou and musk ox and arctic fox and snowy owl, "
            "and the Inuit, Sami, Nenets and Chukchi who have lived here for "
            "thousands of years. Book eight of the Biomes of the World series."
        ),
        "coverImageUrl": f"{CDN_BASE}/books/book_biomes_tundra/cover.jpg",
        "series": "Biomes of the World",
        "primaryLanguage": "en",
        "tags": BIOMES_TAGS,
    },
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

    existing_ids = {b.get("bookId") for b in cat.get("books", [])}
    b_added = 0
    for bid, meta in BOOK_ROWS.items():
        if bid in existing_ids:
            continue
        row = {"bookId": bid, **meta}
        if bid in DATES:
            row["publishedAt"] = DATES[bid]
        cat.setdefault("books", []).append(row)
        b_added += 1
        print(f"  + added book row: {bid}")

    print(f"  narrations updated: {n_changed}")
    print(f"  books updated:      {b_changed}")
    print(f"  books added:        {b_added}")
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
