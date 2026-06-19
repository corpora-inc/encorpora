# Catalog `publishedAt` — runbook for the next publisher

Last updated: 2026-06-19

## TL;DR

Every narration book needs a **`publishedAt`** date in the catalog, or it
sorts wrong in the app's **Browse → Latest** tab and breaks **within-series
reading order**. The backend publisher (`ttsctl`) does **not** currently set
this, so until it does, **you must stamp the date yourself after every
publish** using the safe surgical tool below.

- ✅ **Use `corpan/infra/patch-published-dates.py`** — adds *only* `publishedAt`, preserves everything else.
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

## The real fix (do this when you can): make `ttsctl` set the date

`ttsctl publish` (on the DGX Spark build box, not in this repo) writes
`catalog-v2.json`. It should, at publish time:

1. Set `publishedAt` on every narration row **and** book row it writes (ISO `YYYY-MM-DD`). Use the book's intended release date (see conventions below), not "now" — re-publishing an old book must not re-date it.
2. **Preserve** any existing `publishedAt` already in the catalog when it re-uploads (don't drop fields it doesn't recognize).

Until `ttsctl` does this, every `ttsctl publish` may **wipe** the dates this
runbook sets — so re-run the interim step (below) after each publish, and treat
"books are dated" as part of the publish checklist.

## Interim procedure (after every publish)

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
