# Backend instructions: stamp `publishedAt` in the catalog at publish time

Audience: whoever maintains **`ttsctl`** (the publisher on the DGX Spark build
box). This is the permanent fix for a recurring bug — see
[`CATALOG_DATES_RUNBOOK.md`](./CATALOG_DATES_RUNBOOK.md) for the app-side context
and the manual stopgap we run today.

## The problem

`ttsctl publish` writes `s3://corpan-prod/artifacts/catalog-v2.json` but does
**not** set `publishedAt` on the entries. The app sorts **Browse → Latest** and
**within-series reading order** by `publishedAt`, so every newly published book
sorts to the bottom / out of order until someone hand-patches the catalog. Worse,
the next `ttsctl publish` overwrites the catalog and **wipes** any `publishedAt`
that was hand-added.

## What `ttsctl` must do

1. **Set `publishedAt` on every entry it writes** — on each **narration row**
   (the client reads it there) **and** each **book row**. Format: ISO date
   string `YYYY-MM-DD`.

2. **Use the book's intended release date, not `now()`.** Source it from the
   book's own metadata (a `published`/`release_date` field in the book's source
   config, or — for periodicals like *AI This Week* — the date encoded in the
   book id, e.g. `book_ai_this_week_2026_06_14` → `2026-06-14`). Re-publishing an
   existing book must reproduce the **same** date every time. Never stamp "today"
   at publish time, or re-publishing reorders the catalog.

3. **Be idempotent / preserve existing values.** When re-uploading the catalog,
   carry through any fields already present on entries (including a
   `publishedAt` that may have been set by an earlier run or a manual patch).
   Do not drop unrecognized fields.

4. **Make `publishedAt` required for new books.** A publish of a book with no
   resolvable date should fail (or warn loudly), not silently emit an undated
   entry.

## Where the date should live (recommended)

Add an explicit `published: "YYYY-MM-DD"` to each book's source manifest/config
that `ttsctl` reads, and have the publisher copy it onto the narration + book
rows. This keeps the date with the content, survives re-publishes, and is
reviewable in source control.

## Conventions currently in use

- **Biomes of the World** (books have `volume: null`, so they order *only* by
  date): sequential daily dates in series order — rainforest `2026-06-14`,
  savanna `06-15`, hot desert `06-16`, temperate forest `06-17`, temperate
  grassland `06-18`. New volumes continue the sequence.
- **AI This Week** (periodical): the episode date from the book id.

## Acceptance criteria

- After `ttsctl publish` of any book, `catalog-v2.json` has a correct
  `publishedAt` (ISO `YYYY-MM-DD`) on that book's narration rows and book row.
- Re-publishing the same book yields the identical `publishedAt` (no drift).
- Re-publishing book A does not remove `publishedAt` from books B, C, …
- Verify:
  ```bash
  curl -s "https://d38iwc9748jekz.cloudfront.net/catalog-v2.json?cb=$RANDOM" \
    | python3 -c "import json,sys;c=json.load(sys.stdin);print([(b['bookId'],b.get('publishedAt')) for b in c['books']])"
  ```
  Every book should show a date.

## Until this ships

The app-side team stamps dates manually after each backend publish via
`corpan/infra/patch-published-dates.py` (surgical — only touches `publishedAt`).
**Do not** point anyone at `corpan/infra/patch-catalog.py`; it rebuilds the
books array from stale in-repo data and wipes covers/descriptions. Once `ttsctl`
owns `publishedAt`, the manual step and both of those scripts can be retired.
