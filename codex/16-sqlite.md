# 16. SQLite

## What it is

SQLite is an embedded relational database. There is no server, no
process to start, no network port to manage; SQLite is a C library
the application links against, and the database is a single file on
disk. The library handles parsing SQL, planning queries, doing
transactions, and writing pages to the file. The application
opens the file, asks questions, and gets answers, all in-process
and in-memory.

In this repo SQLite plays three distinct roles:

- The **content database** for the Corpán app: 80 MB or so of
  authored phrase corpus, embedded in the Tauri binary at
  compile time. The largest single artifact in the codebase, and
  the reason `*.sqlite3` is in Git LFS (section 03).
- The **per-pack databases** for packs that want one: Hanzipan
  ships its own SQLite of character data. The host serves these
  through `queryPackDb` on the HostApi (section 12) with a
  read-only SQL gate.
- The **Django CMS database** at `corpan/dja/db.sqlite3`: the
  development database for authoring. The Django ORM (section 19)
  reads and writes this; `make_release_sqlite.py` produces the
  read-only `release.sqlite3` that the app embeds.

The same engine in three roles, with three different access
patterns. This section covers what they have in common and what
they do not.

## How it fits

SQLite is the inner data layer. Above it, the React tree reads
through the Tauri IPC commands (sections 04, 06). Below it,
nothing; the storage stops here. The app does not talk to a
remote database; the marketing site does not talk to a database
at all. The user's device runs SQLite locally, against a file
that shipped with the app, and adds rows to it (history,
settings, etc.) through Zustand-store persistence layers that are
independent of the corpus DB.

The Corpán corpus is **read-only at runtime**. The Tauri host
opens the embedded database with `SQLITE_OPEN_READ_ONLY` and
`PRAGMA query_only=ON`; nothing the user does writes back to it.
User-mutable state (history, preferences, installed packs) lives
in separate Zustand stores serialized to JSON, not in the corpus
DB. This separation is what lets the app ship a new corpus DB on
every release without losing user state.

## Files and entry points

### The app's content database

- `corpan/corpan-app/src-tauri/src/db.rs`: 57 lines. Holds the
  embedded-DB constant, writes it to the app data directory on
  first launch or after an app update, opens a read-only
  connection with `mmap`, and sets the PRAGMAs.
- `corpan/dja/release.sqlite3`: the bundled artifact. Embedded
  into the binary via `include_bytes!("../../../dja/release.sqlite3")`
  in `db.rs`. Tracked in Git LFS.
- `corpan/corpan-app/src-tauri/src/lib.rs`: every `#[command]`
  that queries the corpus opens the lock on `DbState`, runs a
  prepared statement, and returns. Section 04 walks the IPC seam.

### The Django CMS

- `corpan/dja/cor/models.py`: 161 lines. The seven Django models
  that define the corpus schema (`Language`, `Domain`, `Entry`,
  `Translation`, `Narrator`, `Pack`, `PackEntry`). Section 19
  covers Django itself.
- `corpan/dja/db.sqlite3`: the development database. Tracked in
  Git LFS. Editing it via Django admin is how new entries enter
  the system.
- `corpan/dja/make_release_sqlite.py`: the script that exports
  `db.sqlite3` to a leaner `release.sqlite3` for the app to
  embed.

### Per-pack databases

- `corpan/packs/hanzipan/data/`: the directory inside the
  Hanzipan pack zip that contains its SQLite (and the
  hanziwriter character JSON). The pack's `manifest.json`
  declares its databases under the `databases` map (section 10).
- `corpan/corpan-app/src-tauri/src/pack_db.rs`: 84 lines. Opens
  per-pack SQLite databases on demand and caches the connection
  in `PackDbState`.
- `corpan/corpan-app/src-tauri/src/lib.rs:90`
  (`ensure_readonly_sql`): the four-statement allowlist that
  rejects anything other than `SELECT`, `WITH`, `PRAGMA`, or
  `EXPLAIN` before the SQL ever reaches SQLite. Section 12 calls
  out this gate.

## How it works

### The data model

SQLite is a relational database, which means data lives in tables,
each table is a set of rows, each row is a tuple of typed columns,
and queries are written in SQL. Three concepts to hold:

- **Tables and columns**. The `Entry` table holds the English
  phrases of the corpus, one row per phrase. Each row has an
  `id` (the primary key, an integer SQLite generates), an
  `en_text` (the English text), a `level` (the CEFR rating).
- **Foreign keys and joins**. The `Translation` table has a
  `entry_id` column pointing at a row in `Entry`. To fetch all
  translations of a given entry, you `JOIN translation ON
  translation.entry_id = entry.id`. The Django ORM hides this
  syntax; the Rust side writes it directly.
- **Indexes**. An index is a separate structure that lets SQLite
  find rows by a column value without scanning the whole table.
  The corpus DB has indexes on the columns the queries hit:
  `entry.level`, `translation.entry_id`, `translation.language_id`.
  Without indexes, a corpus query that should take a millisecond
  would take a second.

The schema is in `corpan/dja/cor/models.py`. Each Django model
class becomes a SQLite table; each field becomes a column. The
relationships (ForeignKey, ManyToManyField) become foreign-key
constraints and join tables.

### The schema, briefly

Seven tables for the phrase corpus:

```
Language(id, code, name)
    code is "es", "ko", "ko-polite", etc.

Domain(id, code, name, description)
    code is "travel", "business", etc.

Entry(id, en_text, level)
    level is "A0".."C2" CEFR; en_text is unique.

Entry_domains(entry_id, domain_id)
    Django's auto-generated M2M join table.

Translation(id, entry_id, language_id, text, romanization)
    Unique on (entry_id, language_id).
    romanization defaults to "".

Narrator(id UUID, name, language_id, description_pack_id)
Pack(id UUID, title, narrator_id, description_pack_id self-ref)
PackEntry(id UUID, pack_id, entry_id, order)
    Unique on (pack_id, order).
```

The `Entry` is the unit of corpus content. The `Translation`
table holds one row per (entry, language) pair. The `Pack` table
groups entries into ordered sequences (used both for narration
packs and for phrase packs). The `PackEntry` table is the
explicit join with ordering, because Django M2M tables do not
support ordering.

Sample row layouts:

```
Entry:        (42,  "I would like a cup of coffee.",  "A1")
Translation:  (193, 42, 7 [es], "Quisiera una taza de café.", "")
Translation:  (194, 42, 11 [ko], "커피 한 잔 주세요.", "keopi han jan juseyo")
```

The corpus has tens of thousands of entries, dozens of
languages, and hundreds of thousands of translations. The
release `*.sqlite3` is around 80 MB. With LFS the cost of
shipping it is one line in `.gitattributes` (section 03).

### The embed-write-mmap pattern

`db.rs` is the most production-incident-driven 57 lines after the
Android exit code (section 04). Read top to bottom:

```rust
const EMBEDDED_DB: &[u8] = include_bytes!("../../../dja/release.sqlite3");

pub struct DbState {
    pub conn: Mutex<Connection>,
}

impl DbState {
    pub fn new(data_dir: PathBuf) -> Result<Self, String> {
        let db_path = data_dir.join("release.sqlite3");

        let needs_write = match std::fs::metadata(&db_path) {
            Ok(meta) => meta.len() != EMBEDDED_DB.len() as u64,
            Err(_) => true,
        };

        if needs_write {
            std::fs::create_dir_all(&data_dir)?;
            std::fs::write(&db_path, EMBEDDED_DB)?;
        }

        Ok(Self { conn: Mutex::new(open_connection(&db_path)?) })
    }
}
```

Four phases:

1. **Embed**. `include_bytes!` is a Rust macro that reads the
   file at compile time and substitutes its bytes as a `&[u8]`
   constant. The 80 MB release database is baked into the binary
   as data. There is no separate file the app needs to ship next
   to the binary; the binary **is** the database.
2. **Write or skip**. On launch, the app checks whether
   `release.sqlite3` already exists in the app data directory
   with the right size. If it does, skip; if it does not (first
   launch, or app update with a new DB), write the bytes out.
3. **Open**. `open_connection` opens the on-disk file with
   `SQLITE_OPEN_READ_ONLY` and `SQLITE_OPEN_NO_MUTEX`; the
   in-process `Mutex<Connection>` provides the synchronization
   the no-mutex flag opts out of.
4. **PRAGMA setup**:
   - `PRAGMA query_only=ON` enforces read-only at the SQL level
     (belt and suspenders with the open flag).
   - `PRAGMA temp_store=MEMORY` keeps temporary tables in RAM
     instead of on disk.
   - `PRAGMA cache_size=-4096` (negative means kilobytes; this
     is a 4 MB page cache).
   - `PRAGMA case_sensitive_like=ON` makes `LIKE` actually
     case-sensitive (the SQLite default is case-folded, which
     would silently miscount.
   - `PRAGMA mmap_size=67108864` uses 64 MB of memory-mapped
     I/O. SQLite reads pages out of the OS page cache instead of
     copying them into private buffers; the OS handles eviction
     under memory pressure.

The comment in `db.rs` documents the rationale for writing the
DB to disk instead of feeding it to `sqlite3_deserialize`: the
deserialize path required SQLite to allocate one 80 MB
contiguous buffer at startup, which on lower-end Android devices
caused ANRs and SIGABRT crashes before the app's first frame.
Writing the bytes to disk and using `mmap` for reads is the path
that ships today.

### The connection lifecycle

`DbState` holds the connection in a `Mutex<Connection>` because
`rusqlite::Connection` is not `Sync`. Every `#[command]` that
touches the corpus locks the mutex, runs its query, and drops the
lock when the function returns. SQLite is fast enough that the
critical section is microseconds; the mutex contention is
invisible in practice.

The connection is opened **once** for the lifetime of the app and
parked in Tauri's managed state (section 04). There is no
per-call open; there is no connection pool. One connection,
behind one mutex, on a read-only file. This is exactly the shape
SQLite is happiest in.

### The query path

A worked example. The React side calls
`getRandomEntry`, which lands at
`get_random_entry_with_translations` in `lib.rs:497` (section 04
walks the signature). The function locks `DbState.conn`, runs a
prepared statement against the corpus, and returns. Roughly:

```rust
let mut stmt = conn.prepare(
    "SELECT id, en_text, level FROM entry
     WHERE level IN (?, ?, ?)
     ORDER BY random() LIMIT 1"
)?;
let entry = stmt.query_row(params!["A1", "A2", "B1"], |row| {
    Ok(Entry { id: row.get(0)?, en_text: row.get(1)?, level: row.get(2)? })
})?;
```

`prepare` parses and plans the SQL once. `query_row` runs the
plan and returns one row. The closure maps the SQLite columns
into a Rust struct. Errors anywhere become `Err(...)`; the
`#[command]` returns the error to JavaScript as a rejected
promise.

The translation half of the same call uses a second prepared
statement against the `translation` table joined to `language`,
with the entry id from the first query.

### The per-pack DB story

Packs that ship their own SQLite database (Hanzipan today; future
packs as needed) declare it in `manifest.json`:

```jsonc
{
  "databases": {
    "main": "data/pack.sqlite3"
  }
}
```

The host (`pack_db.rs`) opens the file on first use of
`queryPackDb`, caches the connection in `PackDbState`, and routes
subsequent queries to it. The SQL gate at `lib.rs:90`
(`ensure_readonly_sql`) is the safety net: only one statement at
a time, only `SELECT`/`WITH`/`PRAGMA`/`EXPLAIN`. The default row
cap is 500; the hard cap is 2,000. The pack's manifest does not
get to override this; the host enforces it.

The motivation is straightforward. A pack's bundled data is the
pack's own; the pack is the one that should know what to ask for.
Forcing the pack to round-trip every query through a Django HTTP
backend at runtime would defeat both the offline story and the
performance story. Letting the pack hit raw SQLite, but only for
reads, with a hard row cap, is the smallest gate that delivers
the use cases without exposing the corpus to runtime write
mistakes.

### The Django side

`corpan/dja/cor/models.py` is the authoring side of the same
schema. Django builds the same tables (via its migrations) and
provides a web admin (`/admin`) where humans create entries,
translations, narrators, and packs. `make_release_sqlite.py`
exports the development DB to a release file by stripping the
Django-internal tables, vacuuming, and writing the result
to `release.sqlite3` for the app to embed.

The split is the textbook editorial pattern: a heavyweight write
side (Django admin, Python, migrations, validation) and a
lightweight read side (the embedded SQLite in the app, hit
through Rust). Section 19 covers the Django half.

## Common operations

1. **Read the schema.** `sqlite3 corpan/dja/release.sqlite3 ".schema"`
   (after `git lfs pull`) lists every table and index. Compare
   against `corpan/dja/cor/models.py` to see how Django's models
   become SQL.
2. **Run a query against the bundled DB locally.**
   `sqlite3 corpan/dja/release.sqlite3
   "SELECT count(*) FROM entry"`.
   Same engine, same data; offline.
3. **Add a new column.** Edit `corpan/dja/cor/models.py`, run
   `python manage.py makemigrations`, then
   `python manage.py migrate`. Re-run `make_release_sqlite.py`
   to regenerate `release.sqlite3` for the app.
4. **Add a Rust query.** Use `conn.prepare(SQL)?.query_row(...)`
   or `query_map(...)`. Keep the SQL static and the parameters
   bound; never string-format SQL with user input.
5. **Inspect what a query plans.** Open the DB in `sqlite3` and
   prepend `EXPLAIN QUERY PLAN` to the query. SQLite tells you
   exactly which index it used (or did not use).
6. **Add a new pack DB.** Ship the SQLite as `data/pack.sqlite3`
   inside the pack zip. Declare it in `manifest.json`'s
   `databases` map. Use the pack-side `queryPackDb({ sql,
   params, dbName: "main" })`.

## Why we built it this way

SQLite embedded in the binary is the choice that makes the app
work on a plane. There is no server to be unavailable; there is
no API to time out; the app has the entire phrase corpus locally
from the moment the user installs it. The trade is binary size
(an extra 80 MB) and update cadence (a new corpus requires an
app update). For Corpán's user, the trade favors offline.

The read-only opening with explicit PRAGMAs is the small piece of
discipline that makes the embedded DB safe. `query_only=ON`
prevents accidental writes from a misplaced SQL statement; the
`mmap_size` and `cache_size` PRAGMAs are tuned to the device's
typical memory footprint. The `case_sensitive_like` setting is a
correctness fix for the search path (sections 04 and 12 mention
`search_entries_by_translation_text`).

The "write to disk and mmap" path instead of `sqlite3_deserialize`
is the lesson stamped into `db.rs` from a real shipped incident.
SQLite supports loading a database from in-memory bytes, which
would have been the obvious choice given the `include_bytes!`
embed; it was not the choice we shipped because the contiguous
allocation killed devices the app was supposed to run on. The
path that ships is documented; the path that does not ship is
documented in the same file as a warning.

Per-pack SQLite with a read-only SQL gate is the smallest design
that gives packs their own structured data without giving them
arbitrary write access to the user's device. The four-statement
allowlist is short enough to audit; the row cap is small enough
to bound the IPC payload. Hanzipan exists because of this seam;
future packs will too.

The Django authoring side is the choice that lets a small team
edit the corpus through a familiar web admin without rolling a
custom editor. Django and SQLite have shipped together for
twenty years; the boring tooling is the right tooling.

## To go deeper

- The SQLite documentation at `sqlite.org/docs.html`. The pages
  on the query planner, on `PRAGMA`, on `mmap` mode, and on
  `EXPLAIN QUERY PLAN` are concentrated and worth reading.
- *Use The Index, Luke* at `use-the-index-luke.com` for the
  general case of how indexes work. SQLite's query planner is
  not unique; the same intuitions apply elsewhere.
- `corpan/corpan-app/src-tauri/src/db.rs` end to end. Five
  minutes; the file rewards the second reading.
- `corpan/corpan-app/src-tauri/src/lib.rs` from `lib.rs:90`
  (`ensure_readonly_sql`) downward for the SQL gate, and from
  `lib.rs:496` for the `#[command]` query implementations.
- Section 19 (Python in the stack) for the Django side that
  authors the same schema.
