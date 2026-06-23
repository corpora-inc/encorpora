# Catalog `publishedAt` — runbook for the next publisher

Last updated: 2026-06-19 (ttsctl now writes publishedAt at publish time)

## TL;DR

Every narration book needs a **`publishedAt`** date in the catalog, or
it sorts wrong in the app's **Browse → Latest** tab and breaks
**within-series reading order**.

- ✅ **For new packs**: set `metadata.publishedAt` in the pack's `manifest.json` (ISO `YYYY-MM-DD`). `ttsctl publish` (as of 2026-06-19) reads it and stamps it on both the narration row and the matching `books[]` row, preserving any existing value.
- ✅ **For backfills / hand-corrections**: `corpan/infra/patch-published-dates.py` — surgical, only touches `publishedAt`, preserves everything else.
- ⛔ **NEVER run `corpan/infra/patch-catalog.py`** — it rebuilds the whole books array from stale in-repo data and **wipes cover art + descriptions** for any book it doesn't know about (verified: it would drop 23 of 36 covers). It is dead bootstrap code.

## Why `publishedAt` matters

The app's catalog browser (`@shared/catalog`) sorts by `publishedAt`:

- **Latest tab** = all books, `publishedAt` descending. No date → sinks to the bottom.
- **Within a series**, books are ordered by `volume`, then `publishedAt` front-to-back. **All current Biomes/AITW books have `volume: null`, so they order *entirely* by `publishedAt`.** A missing/wrong date means the series reads out of order.

The date is read at the **narration row** level (the client groups narrations into a book and takes the row's `publishedAt`). The tool sets it on both the narration rows and the book rows for safety.

## The canonical catalog

- **`catalog-v2.json`** — what current readers fetch (primary). **This is the one to patch.**
  `s3://corpan-prod/artifacts/catalog-v2.json` → `https://d38iwc9748jekz.cloudfront.net/catalog-v2.json`
- `catalog.json` — legacy fallback for old clients (predates Latest sort). Not patched here; low priority.

## Publish-time stamping (the default path going forward)

`ttsctl publish` (since 2026-06-19) reads `metadata.publishedAt` from
the pack's `manifest.json` and stamps it on both the narration row and
the matching `books[]` row in `catalog.json` and `catalog-v2.json`.

Precedence (what wins when there's a value on both sides):

1. **Existing narration `publishedAt`** in the live catalog (re-publish
   of an old narration never re-dates it).
2. **Existing `books[]` `publishedAt`** in the live catalog (re-publish
   of a new lang for an existing book inherits the book's date).
3. **Manifest value** (`metadata.publishedAt` in the pack manifest) —
   only used when nothing is on file yet.

The book row only ever gets a `publishedAt` added if it currently has
none; existing dates are never overwritten. ttsctl does NOT create new
`books[]` rows — book metadata (cover, description, series) is owned by
other tooling.

To enable this on a new pack, add to `manifest.json`:

```json
{
  "id": "book_<id>",
  "name": "...",
  "version": "0.1.0",
  "metadata": { "publishedAt": "YYYY-MM-DD", ... }
}
```

## Backfill procedure (for books with no date yet)

1. Edit the `DATES` map in `corpan/infra/patch-published-dates.py` — add an entry
   for each new book: `"book_<id>": "YYYY-MM-DD"`.
2. Dry-run and read the summary (it prints how many narration/book rows change and writes a local copy to `/tmp/catalog-v2-dates.json`):
   ```bash
   python3 corpan/infra/patch-published-dates.py
   ```
3. Apply to prod (uploads to S3 + invalidates CloudFront):
   ```bash
   python3 corpan/infra/patch-published-dates.py --apply
   ```
   Needs AWS creds in the repo-root `.env` (`AWS_ACCESS_KEY`/`AWS_SECRET_ACCESS_KEY`, region `us-east-2`). `boto3` required (`pip install boto3`).
4. Verify (allow ~30–60s for the invalidation):
   ```bash
   curl -s "https://d38iwc9748jekz.cloudfront.net/catalog-v2.json?cb=$RANDOM" \
     | python3 -c "import json,sys; c=json.load(sys.stdin); \
     print({b['bookId']:b.get('publishedAt') for b in c['books'] if 'biome' in b['bookId']}); \
     print('covers:', sum(1 for b in c['books'] if b.get('coverImageUrl')), '/', len(c['books']))"
   ```
   Confirm the new dates are present **and** the cover count is unchanged (currently 36/36).

## Dating conventions (current catalog)

- **Biomes of the World** (all `volume: null`): sequential daily dates in series order — rainforest `2026-06-14`, savanna `06-15`, hot desert `06-16`, temperate forest `06-17`, temperate grassland `06-18`. Continue the sequence for new volumes.
- **AI This Week** (periodical): `publishedAt` = the episode date encoded in the book id (`book_ai_this_week_2026_06_14` → `2026-06-14`).

## What happened on 2026-06-19 (context)

The new Biomes vols 2–5 and AITW ep-005 had no `publishedAt`, so Latest sort was
wrong. `patch-catalog.py` was the old hand-bootstrap, but it now **regresses**
the catalog (rebuilds books from stale `BOOK_META`/`asset-urls.json`, wiping
covers/descriptions written by `ttsctl`). We added `patch-published-dates.py`
(surgical: only touches `publishedAt`), verified zero collateral diffs (36/36
covers preserved), and applied it. The permanent fix is moving date-stamping
into `ttsctl`.
