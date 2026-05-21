# `user_data.db` — per-user history + analytics store

> **Status:** Plan / sketch only. Target: corpan-app 0.16+. Seeded in
> 0.15.1 (anti-repetition release) because that's when the limits of the
> current localStorage-only approach started becoming visible.

## Why

The 0.15.1 anti-repetition fix passes the **last 10 `(source, entry_id)`
tuples** from `useHistoryStore` to the Rust sampler so it can skip them
when sampling fresh entries. That works because we only need a tiny
sliding window — last 10 fits in a few hundred bytes and the
already-persisted Zustand history store has the data.

The features we *want next* — none of which ship in 0.15.1 — all need
something the last-10 trick can't give:

- **Spaced repetition.** Weighted-random sampling by recency × score
  (Leitner / SM-2 inspired). Needs `last_seen_at` + `seen_count` per
  entry, indexed for fast lookup.
- **Archive / dismiss.** "I know this one; never show it again." Needs
  a per-entry `archived` flag that survives across stacks.
- **Streaks + word-count histograms.** "You've seen 12,847 unique
  phrases in Italian; current streak: 14 days." Needs aggregations
  across the user's lifetime of activity.
- **Cross-pack analytics.** "Across Botany and Cooking, you've seen
  every A2 entry at least twice." Needs `seen_count` per
  `(source, entry_id)`.

LocalStorage is the wrong shape for any of these:

- WKWebView's per-origin quota is ~5 MB on iOS. We share that origin
  across the host app *and* every pack (memory: `corpan-pack-storage.md`).
- A user at 50k seen entries × ~60 B of metadata = 3 MB. We'd crowd
  out packs.
- Every read deserializes the *entire* JSON blob. Reasonable at 50 KB;
  awful at 3 MB.
- No indexes, no joins. Anti-repetition over the last 1,000 entries
  would mean a linear JS scan on every sample call.

The Tauri app already runs SQLite for the bundled corpus and each phrase
pack via the `rusqlite` + LRU-pooled connections in
`corpan-app/src-tauri/src/phrase_packs.rs`. Adding one more SQLite file
for user data is an additive change in the same architectural mold.

## Schema (draft)

```sql
CREATE TABLE seen_entries (
    source        TEXT    NOT NULL,         -- "base" or phrase-pack id
    entry_id      INTEGER NOT NULL,
    first_seen_at INTEGER NOT NULL,         -- unix ms
    last_seen_at  INTEGER NOT NULL,         -- unix ms
    seen_count    INTEGER NOT NULL DEFAULT 1,
    archived      INTEGER NOT NULL DEFAULT 0,  -- 0/1 boolean
    last_score    REAL,                     -- nullable; Parlometron fills it
    PRIMARY KEY (source, entry_id)
) WITHOUT ROWID;

CREATE INDEX idx_seen_last_seen   ON seen_entries(last_seen_at);
CREATE INDEX idx_seen_archived    ON seen_entries(archived);
CREATE INDEX idx_seen_source      ON seen_entries(source);
```

- `WITHOUT ROWID` because we always lookup by the composite PK and we want
  the row to be the index entry. Same pattern as the phrase-pack `entries`
  table.
- `archived` as `INTEGER 0/1` rather than `BOOLEAN` because SQLite is
  loose about boolean types and `INTEGER` is honest.
- `last_score REAL` is nullable so non-Parlometron exposures don't have
  to invent a score.

## File location

- iOS: `<app-data>/user_data.db` (same dir as installed packs).
- Android: `<app-data>/user_data.db`.
- Migrate via the same `rusqlite::OpenFlags::SQLITE_OPEN_CREATE` pattern
  used in `pack_db::open_pack_connection`.

A new `UserDataState` (parallel to `PhrasePacksState`) manages the single
connection. It's not LRU'd — there's only one user-data DB and we always
want it warm.

## Migration from localStorage

One-time on app boot, gated by a tiny `corpan-user-data-migrated`
localStorage flag:

```ts
if (!localStorage.getItem("corpan-user-data-migrated")) {
    const legacyHistory = JSON.parse(
        localStorage.getItem("corpan-history-v2") ?? "{}",
    );
    // For each stack: walk (ids, sources) arrays, batch-INSERT into
    // user_data.db with synthesized first_seen_at=last_seen_at=now-i*60s
    // (linear timestamps going backwards, finest resolution we have).
    invoke("user_data_import_legacy_history", legacyHistory);
    localStorage.setItem("corpan-user-data-migrated", "1");
    localStorage.removeItem("corpan-history-v2");
}
```

The migration is one-shot and idempotent (re-running just no-ops on the
flag check). If a user installs fresh on 0.16+, the flag never has to
be checked at all because there's no legacy data.

## What this unlocks

| Feature | SQL sketch |
| --- | --- |
| Spaced repetition (recency-weighted sampler) | `SELECT entry_id FROM seen_entries WHERE source = ? ORDER BY (strftime('%s','now')*1000 - last_seen_at) DESC, RANDOM() LIMIT 1` |
| Archive | sampler `WHERE archived = 0` |
| Lifetime unique-phrase count | `SELECT COUNT(*) FROM seen_entries` |
| Current daily streak | `SELECT MAX(date(last_seen_at/1000, 'unixepoch')) ...` (day-wise GROUP BY + window) |
| Recently-seen exclude (replaces 0.15.1's JS-passed list) | `WHERE last_seen_at < (strftime('%s','now')*1000 - 60000)` — anything seen in the last minute |
| Word histograms across languages | aggregation via JOIN with bundled corpus / phrase-pack `entries.level` |

## Performance

- 100k rows × ~60 B = ~6 MB on disk. Index + page overhead: 1.5×.
  Still trivial.
- Indexed lookups are sub-millisecond. Even the lifetime-count aggregation
  is a few ms on the cold cache.
- Anti-repetition over the last N becomes a JOIN against `seen_entries`,
  cleaner than the JS-passed exclude list.

## Wire-up surface (back-of-envelope)

New Tauri commands:
- `user_data_record_seen(source, entry_id, score?)` — UPSERT.
- `user_data_archive(source, entry_id, archived: bool)`.
- `user_data_stats(source_filter?: string)` → totals + streak + last-7d.
- `user_data_import_legacy_history(payload)` — one-shot migration.

New JS surface:
- A thin `useUserDataStore` that mirrors the most-frequently-queried
  aggregates (lifetime count, current streak) and refreshes on
  visibility-change so it doesn't hold a long-running DB query open.

## Not in scope yet

- **Sync across devices.** User data stays on-device until we have a
  story for accounts. (When we do: SQLite is friendly to one-blob
  export/import.)
- **Export / backup.** Easy to add later: `cp user_data.db backup.db`
  in Rust + a "Share" button.
- **Privacy controls / data deletion.** Settings → "Reset learning
  history" should `DELETE FROM seen_entries`; trivial.

## Why not just bound the localStorage history?

A cap (e.g. last 2000 entries per stack) is the right *interim*
mitigation if we want to defer this further — it bounds the storage
growth without changing the storage substrate. But every "next feature"
list above needs the *unbounded* history, just stored efficiently.
Doing the SQLite shift once unlocks them all.

## Why not IndexedDB?

We already have rusqlite in-process. IndexedDB would mean re-implementing
the lookup pattern, dealing with async DB opens, and a second persistence
layer. SQLite via Rust is the consistent answer.
