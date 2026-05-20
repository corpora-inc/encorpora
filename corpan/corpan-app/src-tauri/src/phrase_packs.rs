//! Phrase-pack sampler.
//!
//! Modular text-only corpora downloaded into `app_data_dir/corpan-packs/<id>/`
//! and queried alongside the bundled base corpus (`cor_entry` /
//! `cor_translation`). Each phrase pack is a self-contained SQLite file with
//! the schema documented in `corpan/docs/PHRASE_PACK_AUTHORING.md`:
//!
//!   - `pack_meta`     one row of authored metadata
//!   - `entries`       (id, english, level)
//!   - `translations`  (entry_id, language_code, text, romanization)
//!
//! Design (decided in `now-let-s-thing-about-mighty-sifakis.md`):
//!   - One independent read-only `Connection` per active pack, capped LRU at
//!     `MAX_OPEN_CONNECTIONS`. No ATTACH (would cap at 125 and burn iOS fds +
//!     ~2 MiB page cache per attachment).
//!   - Sampling is two-phase: per-source `COUNT(*) WHERE filter` is cached
//!     per `(pack_id, filter_signature)`; weighted-pick a source in Rust,
//!     then one indexed query against that source. O(1) per tap after warm-up
//!     regardless of how many packs are active.
//!   - Weighting is uniform-per-entry — larger sources contribute more.
//!
//! The bundled base corpus is treated as just another source named `"base"`
//! but lives behind its own dedicated connection (`db::DbState`) and uses
//! its existing schema (`cor_entry` / `cor_translation` / `cor_domain`).

use std::collections::HashMap;
use std::sync::Mutex;

use rusqlite::{params_from_iter, Connection};
use tauri::{AppHandle, Runtime};

use crate::pack_db::{open_pack_connection, resolve_pack_db_path};

/// Conventional source-id used by callers for the bundled corpus.
pub const BASE_SOURCE_ID: &str = "base";

/// LRU cap on simultaneously open phrase-pack connections. Each connection
/// holds ~2 MiB of page cache + a handful of file descriptors. iOS soft fd
/// limit per process is 256; 25 is a comfortable budget that lets a power
/// user keep many packs *active* (we re-open lazily) without paying the RAM
/// or fd cost for all of them at once.
const MAX_OPEN_CONNECTIONS: usize = 25;

/// Conventional database key inside a phrase pack's `manifest.databases` map.
/// The build script (`tools/phrase-packs/build_phrase_pack.py`) emits exactly
/// this key.
const PHRASE_PACK_DB_KEY: &str = "main";

/// Hashable filter set used as the key for the per-pack COUNT cache.
/// Domains are intentionally part of the signature even though phrase packs
/// don't currently use a domain column — the base corpus does, and the cache
/// is keyed on the full filter so different settings on different stacks
/// don't share cached counts incorrectly.
#[derive(Clone, Eq, PartialEq, Hash, Debug)]
pub struct FilterSig {
    pub levels: Vec<String>,
    pub domains: Vec<String>,
}

impl FilterSig {
    pub fn new(levels: &Option<Vec<String>>, domains: &Option<Vec<String>>) -> Self {
        fn norm(v: &Option<Vec<String>>) -> Vec<String> {
            let mut v = v.clone().unwrap_or_default();
            v.sort();
            v.dedup();
            v
        }
        Self {
            levels: norm(levels),
            domains: norm(domains),
        }
    }
}

pub struct PhrasePacksState {
    inner: Mutex<Inner>,
}

#[derive(Default)]
struct Inner {
    /// Open connections keyed by pack id.
    connections: HashMap<String, Connection>,
    /// LRU order: front = most recently used.
    lru: Vec<String>,
    /// Cached COUNT per (pack_id, filter_sig). Invalidated on pack
    /// install/uninstall/update (see [`PhrasePacksState::invalidate`]).
    count_cache: HashMap<(String, FilterSig), i64>,
}

impl PhrasePacksState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(Inner::default()),
        }
    }

    /// Drop every cached connection and count for the given pack id.
    /// Call this on install (in case a previous version is cached) and on
    /// uninstall — wired through the `phrase_packs_invalidate_cache` Tauri
    /// command, which JS calls from `phrasePackRegister.ts`.
    pub fn invalidate(&self, pack_id: &str) {
        let mut inner = self.lock();
        inner.connections.remove(pack_id);
        inner.lru.retain(|p| p != pack_id);
        inner.count_cache.retain(|(pid, _), _| pid != pack_id);
    }

    /// Drop every cached connection and count, full reset. Useful after a
    /// bulk uninstall or migration. Not currently wired but cheap to have.
    #[allow(dead_code)]
    pub fn invalidate_all(&self) {
        let mut inner = self.lock();
        inner.connections.clear();
        inner.lru.clear();
        inner.count_cache.clear();
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Inner> {
        // Mutex poisoning here would mean a prior caller panicked under the
        // lock. Recover the inner state rather than crashing the whole app.
        self.inner.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

/// Sum of matching entry counts across a list of phrase packs for a given
/// filter signature. Opens connections as needed (LRU-managed), populates
/// the cache. Packs with zero matches stay in the returned vec so callers
/// can include them in weighting if desired — but callers typically filter
/// them out before sampling.
///
/// Resilient to partial install state: when a pack id is listed in user
/// settings but its SQLite/manifest isn't on disk yet (race during
/// onboarding, manual settings drift, or a stale id), the per-pack count
/// is logged and treated as zero rather than failing the whole call. This
/// keeps the multi-source sampler honest about the *available* sources
/// while never silently demoting the user back to base-only.
pub fn collect_pack_counts<R: Runtime>(
    app: &AppHandle<R>,
    state: &PhrasePacksState,
    pack_ids: &[String],
    sig: &FilterSig,
    exclude_map: &std::collections::HashMap<String, Vec<i64>>,
) -> Result<Vec<(String, i64)>, String> {
    let empty: Vec<i64> = Vec::new();
    let mut out = Vec::with_capacity(pack_ids.len());
    for pid in pack_ids {
        let per_pack_exclude = exclude_map.get(pid).unwrap_or(&empty);
        match count_phrase_pack(app, state, pid, sig, per_pack_exclude) {
            Ok(n) => out.push((pid.clone(), n)),
            Err(e) => {
                eprintln!(
                    "[phrase_packs] count skipped for {pid}: {e}; treating as 0"
                );
                out.push((pid.clone(), 0));
            }
        }
    }
    Ok(out)
}

/// One indexed query against a single phrase pack, returning the chosen
/// entry id. Uses `ORDER BY RANDOM() LIMIT 1` against `entries` — at our
/// per-pack scale (50–2500 entries) this is fast (sub-millisecond) and we
/// don't need the rowid-offset trick.
pub fn sample_random_id<R: Runtime>(
    app: &AppHandle<R>,
    state: &PhrasePacksState,
    pack_id: &str,
    sig: &FilterSig,
    exclude_ids: &[i64],
) -> Result<i64, String> {
    let (sql, params) = build_pack_id_sample_sql(sig, exclude_ids);
    with_pack_conn(app, state, pack_id, |conn| {
        let mut stmt = conn.prepare_cached(&sql).map_err(|e| e.to_string())?;
        let id: i64 = stmt
            .query_row(
                params_from_iter(params.iter().map(|p| &**p)),
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        Ok(id)
    })
}

/// Resolve a single entry's full details (entry row + every translation,
/// optionally filtered by language) from a phrase pack.
pub fn fetch_entry<R: Runtime>(
    app: &AppHandle<R>,
    state: &PhrasePacksState,
    pack_id: &str,
    entry_id: i64,
    allowed_langs: Option<&std::collections::HashSet<String>>,
) -> Result<PhrasePackEntry, String> {
    with_pack_conn(app, state, pack_id, |conn| {
        let level: Option<String> = conn
            .query_row(
                "SELECT level FROM entries WHERE id = ?",
                [entry_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("entry {entry_id} not found: {e}"))?;

        let mut stmt = conn
            .prepare_cached(
                "SELECT language_code, text, romanization
                 FROM translations
                 WHERE entry_id = ?",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([entry_id], |row| {
                let lang: String = row.get(0)?;
                let text: String = row.get(1)?;
                let rom: Option<String> = row.get(2)?;
                Ok((lang, text, rom.unwrap_or_default()))
            })
            .map_err(|e| e.to_string())?;

        let mut translations = Vec::new();
        for r in rows {
            let (lang, text, rom) = r.map_err(|e| e.to_string())?;
            if allowed_langs.map_or(true, |set| set.contains(&lang)) {
                translations.push(PhrasePackTranslation {
                    language_code: lang,
                    text,
                    romanization: rom,
                });
            }
        }

        Ok(PhrasePackEntry {
            entry_id,
            level: level.unwrap_or_default(),
            translations,
        })
    })
}

pub struct PhrasePackEntry {
    pub entry_id: i64,
    pub level: String,
    pub translations: Vec<PhrasePackTranslation>,
}

pub struct PhrasePackTranslation {
    pub language_code: String,
    pub text: String,
    pub romanization: String,
}

/* -------------------------------------------------------------------------- */
/*  internals                                                                 */
/* -------------------------------------------------------------------------- */

fn count_phrase_pack<R: Runtime>(
    app: &AppHandle<R>,
    state: &PhrasePacksState,
    pack_id: &str,
    sig: &FilterSig,
    exclude_ids: &[i64],
) -> Result<i64, String> {
    // Only filter-only counts hit the cache. The exclude window slides
    // with every entry the user sees, so an exclude-aware count is a
    // moving target and not worth caching — go straight to SQL.
    let cache_key = if exclude_ids.is_empty() {
        Some((pack_id.to_string(), sig.clone()))
    } else {
        None
    };
    if let Some(ref k) = cache_key {
        let inner = state.lock();
        if let Some(&n) = inner.count_cache.get(k) {
            return Ok(n);
        }
    }
    let (sql, params) = build_pack_count_sql(sig, exclude_ids);
    let count = with_pack_conn(app, state, pack_id, |conn| {
        let n: i64 = conn
            .query_row(
                &sql,
                params_from_iter(params.iter().map(|p| &**p)),
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        Ok(n)
    })?;
    if let Some(k) = cache_key {
        state.lock().count_cache.insert(k, count);
    }
    Ok(count)
}

/// Run a closure with a borrowed connection to the requested pack. Opens the
/// connection on miss, evicts the LRU tail when over the cap. The state
/// mutex is held for the full duration — phrase-pack queries are
/// sub-millisecond at our scale, so this is fine for Phase A; if a future
/// hot path needs parallelism we can move to per-pack `Mutex<Connection>`
/// slots.
fn with_pack_conn<R, F, T>(
    app: &AppHandle<R>,
    state: &PhrasePacksState,
    pack_id: &str,
    f: F,
) -> Result<T, String>
where
    R: Runtime,
    F: FnOnce(&Connection) -> Result<T, String>,
{
    let mut inner = state.lock();

    if !inner.connections.contains_key(pack_id) {
        // Release the lock while doing FS + open work, then reacquire to
        // insert. Two concurrent callers may race-open the same pack; the
        // last writer wins and the loser's connection is dropped on insert.
        drop(inner);
        let db_path = resolve_pack_db_path(app, pack_id, Some(PHRASE_PACK_DB_KEY))?;
        let conn = open_pack_connection(&db_path)?;
        inner = state.lock();
        inner.connections.insert(pack_id.to_string(), conn);
    }

    // Bump LRU.
    inner.lru.retain(|p| p != pack_id);
    inner.lru.insert(0, pack_id.to_string());

    // Evict tail.
    while inner.lru.len() > MAX_OPEN_CONNECTIONS {
        if let Some(victim) = inner.lru.pop() {
            if victim != pack_id {
                inner.connections.remove(&victim);
            } else {
                // We just promoted this; put it back at the front and bail.
                inner.lru.insert(0, victim);
                break;
            }
        } else {
            break;
        }
    }

    let conn = inner
        .connections
        .get(pack_id)
        .ok_or_else(|| "phrase pack connection vanished".to_string())?;
    f(conn)
}

fn build_pack_count_sql(
    sig: &FilterSig,
    exclude_ids: &[i64],
) -> (String, Vec<Box<dyn rusqlite::ToSql>>) {
    let mut where_clauses: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if !sig.levels.is_empty() {
        let placeholders = vec!["?"; sig.levels.len()].join(",");
        where_clauses.push(format!("level IN ({placeholders})"));
        for lv in &sig.levels {
            params.push(Box::new(lv.clone()));
        }
    }
    if !exclude_ids.is_empty() {
        let placeholders = vec!["?"; exclude_ids.len()].join(",");
        where_clauses.push(format!("id NOT IN ({placeholders})"));
        for id in exclude_ids {
            params.push(Box::new(*id));
        }
    }

    let mut sql = "SELECT COUNT(*) FROM entries".to_string();
    if !where_clauses.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&where_clauses.join(" AND "));
    }
    (sql, params)
}

fn build_pack_id_sample_sql(
    sig: &FilterSig,
    exclude_ids: &[i64],
) -> (String, Vec<Box<dyn rusqlite::ToSql>>) {
    let mut where_clauses: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if !sig.levels.is_empty() {
        let placeholders = vec!["?"; sig.levels.len()].join(",");
        where_clauses.push(format!("level IN ({placeholders})"));
        for lv in &sig.levels {
            params.push(Box::new(lv.clone()));
        }
    }
    if !exclude_ids.is_empty() {
        let placeholders = vec!["?"; exclude_ids.len()].join(",");
        where_clauses.push(format!("id NOT IN ({placeholders})"));
        for id in exclude_ids {
            params.push(Box::new(*id));
        }
    }

    let mut sql = "SELECT id FROM entries".to_string();
    if !where_clauses.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&where_clauses.join(" AND "));
    }
    sql.push_str(" ORDER BY RANDOM() LIMIT 1");
    (sql, params)
}

/* -------------------------------------------------------------------------- */
/*  weighted sampling helper (used by lib.rs)                                 */
/* -------------------------------------------------------------------------- */

/// Pick one source from a list of `(source_id, count)` pairs, weighted by
/// count. `total` must equal the sum of the counts and be > 0. Uses SQLite's
/// `RANDOM()` via the supplied connection so we don't pull in a new PRNG
/// crate just for this.
pub fn pick_weighted_source(
    base_conn: &Connection,
    sources: &[(String, i64)],
    total: i64,
) -> Result<String, String> {
    debug_assert!(total > 0);
    let r: i64 = base_conn
        .query_row(
            "SELECT ABS(RANDOM()) % ?",
            [total],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    let mut cum = 0i64;
    for (id, c) in sources {
        cum += *c;
        if r < cum {
            return Ok(id.clone());
        }
    }
    // Floating-point can't happen with integer counts; defensive fallback.
    Ok(sources
        .last()
        .map(|(id, _)| id.clone())
        .unwrap_or_default())
}
