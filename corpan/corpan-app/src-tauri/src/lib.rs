#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod content_packs;
mod db;
mod pack_db;
mod phrase_packs;

use rusqlite::{params_from_iter, Connection, ToSql};
use rusqlite::types::{Value as SqlValue, ValueRef};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::collections::HashSet;
use std::collections::HashMap;
use tauri::{command, AppHandle, Manager, State};
use tauri_plugin_opener;
use crate::content_packs::{
    download_and_install, get_manifest_url, list_installed, ContentPackInfo,
    ContentPackInstallResult,
};
use crate::pack_db::{open_pack_connection, resolve_pack_db_path, PackDbState};
use crate::phrase_packs::{
    collect_pack_counts, fetch_entry as fetch_phrase_pack_entry, pick_weighted_source,
    sample_random_id as sample_random_phrase_pack_id, FilterSig, PhrasePackEntry,
    PhrasePacksState, BASE_SOURCE_ID,
};

const PACK_DB_DEFAULT_MAX_ROWS: usize = 500;
const PACK_DB_HARD_MAX_ROWS: usize = 2000;

/// Return type for each translation
#[derive(Serialize)]
struct TranslationOut {
    language_code: String,
    text: String,
    romanization: String, // kept as String for the API; we coalesce NULL -> ""
}

/// Return type for an entry with all translations.
///
/// `source` identifies which corpus the entry came from: `"base"` for the
/// bundled corpus, or the phrase-pack id (e.g. `"phrase-botany-basics"`).
/// Callers that store entries for later lookup (history, resume) need to
/// remember (`source`, `entry_id`) because `entry_id` is only unique within
/// its source.
#[derive(Serialize)]
struct EntryOut {
    entry_id: i64,
    level: String,
    domains: Vec<String>,
    translations: Vec<TranslationOut>,
    source: String,
}

#[derive(Serialize)]
struct PackDbQueryResult {
    columns: Vec<String>,
    rows: Vec<HashMap<String, JsonValue>>,
}

fn escape_like(text: &str) -> String {
    text.replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

fn strip_leading_comments(mut input: &str) -> &str {
    loop {
        let trimmed = input.trim_start();
        if trimmed.starts_with("--") {
            if let Some(idx) = trimmed.find('\n') {
                input = &trimmed[idx + 1..];
                continue;
            }
            return "";
        }
        if trimmed.starts_with("/*") {
            if let Some(end) = trimmed.find("*/") {
                input = &trimmed[end + 2..];
                continue;
            }
            return "";
        }
        return trimmed;
    }
}

fn ensure_readonly_sql(sql: &str) -> Result<(), String> {
    let trimmed = strip_leading_comments(sql);
    if trimmed.is_empty() {
        return Err("SQL query is empty".to_string());
    }
    if trimmed.contains(';') {
        return Err("Only a single SQL statement is allowed".to_string());
    }
    let keyword = trimmed
        .split_whitespace()
        .next()
        .unwrap_or("")
        .to_ascii_uppercase();
    match keyword.as_str() {
        "SELECT" | "WITH" | "PRAGMA" | "EXPLAIN" => Ok(()),
        _ => Err("Only SELECT/WITH/PRAGMA/EXPLAIN statements are allowed".to_string()),
    }
}

fn json_to_sql_value(value: &JsonValue) -> SqlValue {
    match value {
        JsonValue::Null => SqlValue::Null,
        JsonValue::Bool(b) => SqlValue::Integer(if *b { 1 } else { 0 }),
        JsonValue::Number(num) => {
            if let Some(i) = num.as_i64() {
                SqlValue::Integer(i)
            } else if let Some(f) = num.as_f64() {
                SqlValue::Real(f)
            } else {
                SqlValue::Null
            }
        }
        JsonValue::String(s) => SqlValue::Text(s.clone()),
        JsonValue::Array(_) | JsonValue::Object(_) => SqlValue::Text(value.to_string()),
    }
}

fn blob_to_hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        use std::fmt::Write;
        let _ = write!(out, "{:02x}", b);
    }
    out
}

fn sql_value_ref_to_json(value: ValueRef<'_>) -> JsonValue {
    match value {
        ValueRef::Null => JsonValue::Null,
        ValueRef::Integer(i) => JsonValue::from(i),
        ValueRef::Real(f) => JsonValue::from(f),
        ValueRef::Text(bytes) => {
            JsonValue::from(String::from_utf8_lossy(bytes).to_string())
        }
        ValueRef::Blob(bytes) => JsonValue::from(format!("0x{}", blob_to_hex(bytes))),
    }
}

fn fetch_entry_with_translations(
    conn: &Connection,
    entry_id: i64,
    allowed_langs: Option<&HashSet<String>>,
) -> Result<EntryOut, String> {
    let mut stmt = conn
        .prepare_cached(
            "SELECT e.id, e.level, group_concat(DISTINCT d.code) AS domains
             FROM cor_entry e
             LEFT JOIN cor_entry_domains ced ON ced.entry_id = e.id
             LEFT JOIN cor_domain d ON d.id = ced.domain_id
             WHERE e.id = ?
             GROUP BY e.id",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt.query([entry_id]).map_err(|e| e.to_string())?;
    let row = rows
        .next()
        .map_err(|e| e.to_string())?
        .ok_or("Entry not found")?;

    let id: i64 = row.get(0).map_err(|e| e.to_string())?;
    let level: String = row.get(1).map_err(|e| e.to_string())?;
    let domain_str: Option<String> = row.get(2).ok();

    let domains_vec = domain_str
        .unwrap_or_default()
        .split(',')
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect::<Vec<_>>();

    let mut tstmt = conn
        .prepare_cached(
            "SELECT l.code, t.text, t.romanization
             FROM cor_translation t
             JOIN cor_language l ON l.id = t.language_id
             WHERE t.entry_id = ?",
        )
        .map_err(|e| e.to_string())?;

    let trows = tstmt
        .query_map([id], |row| {
            let lang_code: String = row.get(0)?;
            let text: String = row.get(1)?;
            let romanization: Option<String> = row.get(2)?;
            Ok((lang_code, text, romanization.unwrap_or_default()))
        })
        .map_err(|e| e.to_string())?;

    let mut translations = vec![];
    for res in trows {
        let (lang, text, romanization) = res.map_err(|e| e.to_string())?;
        if allowed_langs
            .map_or(true, |set| set.contains(&lang))
        {
            translations.push(TranslationOut {
                language_code: lang,
                text,
                romanization,
            });
        }
    }

    Ok(EntryOut {
        entry_id: id,
        level,
        domains: domains_vec,
        translations,
        source: BASE_SOURCE_ID.to_string(),
    })
}

/// Build the JOIN + WHERE fragments for a filtered query against `cor_entry`.
/// Returns (`join_clause`, `where_clauses`, `params`). The where clauses are
/// AND-joined by the caller. Shared by the count + random-pick helpers
/// below.
///
/// `exclude_ids` is the per-source anti-repetition list: entry ids the
/// caller would like to skip if there are alternatives. Empty slice for
/// no exclusion. The exclusion is a regular WHERE clause; the relaxation
/// ladder above is responsible for retrying without exclusion if needed.
fn build_base_filter(
    sig: &FilterSig,
    exclude_ids: &[i64],
) -> (&'static str, Vec<String>, Vec<Box<dyn ToSql>>) {
    let mut where_clauses: Vec<String> = vec![];
    let mut params: Vec<Box<dyn ToSql>> = vec![];

    if !sig.levels.is_empty() {
        let placeholders = vec!["?"; sig.levels.len()].join(",");
        where_clauses.push(format!("e.level IN ({placeholders})"));
        for lv in &sig.levels {
            params.push(Box::new(lv.clone()));
        }
    }

    let join: &'static str = if !sig.domains.is_empty() {
        let placeholders = vec!["?"; sig.domains.len()].join(",");
        where_clauses.push(format!("d.code IN ({placeholders})"));
        for dom in &sig.domains {
            params.push(Box::new(dom.clone()));
        }
        "INNER JOIN cor_entry_domains ced ON ced.entry_id = e.id \
         INNER JOIN cor_domain d ON d.id = ced.domain_id"
    } else {
        ""
    };

    if !exclude_ids.is_empty() {
        let placeholders = vec!["?"; exclude_ids.len()].join(",");
        where_clauses.push(format!("e.id NOT IN ({placeholders})"));
        for id in exclude_ids {
            params.push(Box::new(*id));
        }
    }

    (join, where_clauses, params)
}

fn base_where_clause(parts: &[String]) -> String {
    if parts.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", parts.join(" AND "))
    }
}

/// COUNT(DISTINCT entry) for the base corpus matching `sig`. Used by the
/// multi-source sampler to weight `"base"` against active phrase packs.
fn count_base_entries(
    conn: &Connection,
    sig: &FilterSig,
    exclude_ids: &[i64],
) -> Result<i64, String> {
    let (join, wheres, params) = build_base_filter(sig, exclude_ids);
    let where_str = base_where_clause(&wheres);
    let sql = format!(
        "SELECT COUNT(DISTINCT e.id) FROM cor_entry e {join} {where_str}"
    );
    let n: i64 = conn
        .query_row(
            &sql,
            params_from_iter(params.iter().map(|p| &**p)),
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(n)
}

/// Pick one random entry id from the base corpus matching `sig`.
fn sample_random_base_id(
    conn: &Connection,
    sig: &FilterSig,
    exclude_ids: &[i64],
) -> Result<i64, String> {
    let (join, wheres, params) = build_base_filter(sig, exclude_ids);
    let where_str = base_where_clause(&wheres);
    let sql = format!(
        "SELECT e.id FROM cor_entry e {join} {where_str} \
         GROUP BY e.id ORDER BY RANDOM() LIMIT 1"
    );
    let mut stmt = conn.prepare_cached(&sql).map_err(|e| e.to_string())?;
    let id: i64 = stmt
        .query_row(
            params_from_iter(params.iter().map(|p| &**p)),
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(id)
}

/// Pick N random entry ids from the base corpus matching `sig`.
fn sample_random_base_ids(
    conn: &Connection,
    sig: &FilterSig,
    exclude_ids: &[i64],
    n: i64,
) -> Result<Vec<i64>, String> {
    let (join, wheres, mut params) = build_base_filter(sig, exclude_ids);
    let where_str = base_where_clause(&wheres);
    let sql = format!(
        "SELECT e.id FROM cor_entry e {join} {where_str} \
         GROUP BY e.id ORDER BY RANDOM() LIMIT ?"
    );
    params.push(Box::new(n));
    let mut stmt = conn.prepare_cached(&sql).map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query(params_from_iter(params.iter().map(|p| &**p)))
        .map_err(|e| e.to_string())?;
    let mut out = Vec::with_capacity(n as usize);
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        out.push(row.get(0).map_err(|e| e.to_string())?);
    }
    Ok(out)
}

/// Convert a phrase-pack-shaped entry into the public `EntryOut`. Phrase
/// packs have no `domains` axis — they're categorised by pack `topic` and
/// `category` instead — so `domains` is empty.
fn phrase_pack_entry_to_out(entry: PhrasePackEntry, source: &str) -> EntryOut {
    EntryOut {
        entry_id: entry.entry_id,
        level: entry.level,
        domains: vec![],
        translations: entry
            .translations
            .into_iter()
            .map(|t| TranslationOut {
                language_code: t.language_code,
                text: t.text,
                romanization: t.romanization,
            })
            .collect(),
        source: source.to_string(),
    }
}

/// Build the filter-relaxation ladder. Each tier is tried in order until
/// the first one yields a non-empty source list. Silent fallback — the
/// returned `EntryOut` carries no signal about which tier hit, by design
/// (user prefers gaslighting over a "we relaxed your filter" banner).
///
///   1. Caller's exact filter (strict).
///   2. Drop CEFR `levels` — most common trap is "only A0" or "only C2"
///      against packs that don't cover those edges.
///   3. Drop everything but the active source set.
///   4. Drop everything AND force-include base. The bundled corpus is
///      the universal floor: if every selected pack is genuinely empty,
///      we still hand back a real entry rather than dying.
///
/// Duplicate tiers (e.g. caller passed no levels) collapse so we don't
/// run the same query twice.
fn relaxation_ladder(
    levels: &Option<Vec<String>>,
    domains: &Option<Vec<String>>,
) -> Vec<(FilterSig, bool)> {
    let strict = FilterSig::new(levels, domains);
    let no_levels = FilterSig::new(&None, domains);
    let nothing = FilterSig::new(&None, &None);
    let mut out: Vec<(FilterSig, bool)> = Vec::with_capacity(4);
    out.push((strict.clone(), false));
    if no_levels != strict {
        out.push((no_levels.clone(), false));
    }
    if nothing != no_levels && nothing != strict {
        out.push((nothing.clone(), false));
    }
    // Universal floor — always last, always force_base.
    out.push((nothing, true));
    out
}

/// Build the `(source_id, count)` list for a given filter + source set.
/// Returns an empty Vec when nothing matches; the caller decides whether
/// to relax filters and try again.
/// JS-supplied anti-repetition tuple. The sampler skips these entries
/// when possible, falling back through the relaxation ladder when the
/// resulting pool is empty. `camelCase` to match the JS callsite shape.
#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExcludeEntry {
    pub source: String,
    pub entry_id: i64,
}

/// Group exclude entries by source for per-source SQL `NOT IN (...)`
/// application. Empty `exclude` input yields an empty map (zero
/// allocations downstream — `gather_sources`/`collect_pack_counts` use
/// `HashMap::get(...).unwrap_or(&empty)`).
fn partition_exclude(
    exclude: &[ExcludeEntry],
) -> HashMap<String, Vec<i64>> {
    let mut out: HashMap<String, Vec<i64>> = HashMap::new();
    for e in exclude {
        out.entry(e.source.clone()).or_default().push(e.entry_id);
    }
    out
}

fn gather_sources(
    app: &AppHandle,
    pp_state: &State<'_, PhrasePacksState>,
    base_conn: &Connection,
    sig: &FilterSig,
    pack_ids: &[String],
    base_on: bool,
    exclude_map: &HashMap<String, Vec<i64>>,
) -> Result<Vec<(String, i64)>, String> {
    let empty: Vec<i64> = Vec::new();
    let mut sources: Vec<(String, i64)> = vec![];
    if base_on {
        let base_exclude = exclude_map.get(BASE_SOURCE_ID).unwrap_or(&empty);
        let n = count_base_entries(base_conn, sig, base_exclude)?;
        if n > 0 {
            sources.push((BASE_SOURCE_ID.to_string(), n));
        }
    }
    let pack_counts = collect_pack_counts(app, pp_state, pack_ids, sig, exclude_map)?;
    for (id, n) in pack_counts {
        if n > 0 {
            sources.push((id, n));
        }
    }
    Ok(sources)
}

/// Try `get_random_entry_base_only` with the relaxation ladder. Used for
/// the fast path when no phrase packs are configured. Returns the first
/// non-empty result; surfaces non-empty errors (DB lock, SQL) immediately.
fn try_base_only_with_relaxation(
    state: &State<'_, db::DbState>,
    levels: Option<Vec<String>>,
    domains: Option<Vec<String>>,
    allowed_langs: Option<HashSet<String>>,
    exclude_ids: &[i64],
) -> Result<EntryOut, String> {
    // Try at each filter relaxation tier WITH exclude first; if every
    // tier comes up empty, retry the strict tier without exclude as a
    // final "anti-repetition is nice-to-have, never blocks an entry"
    // safety net. In practice the base corpus is large enough that
    // tier 1 with a 10-entry exclude window always succeeds.
    let no_exclude: &[i64] = &[];
    for ex in [exclude_ids, no_exclude] {
        let attempts: [(Option<Vec<String>>, Option<Vec<String>>); 3] = [
            (levels.clone(), domains.clone()),
            (None, domains.clone()),
            (None, None),
        ];
        for (lv, dm) in attempts {
            match get_random_entry_base_only(state, lv, dm, allowed_langs.clone(), ex) {
                Ok(entry) => return Ok(entry),
                Err(e) if e == "No entries found for these criteria" => continue,
                Err(e) => return Err(e),
            }
        }
    }
    Err("No entries in the bundled corpus".to_string())
}

/// Get one random entry matching given filters, with all translations.
///
/// Resilient by design: if the caller's strict filter yields zero
/// entries across the active source set, the sampler walks the
/// `relaxation_ladder` (drop levels → drop everything → fall back to
/// base) and returns the first non-empty result. Only when even the
/// bundled corpus is dry does this command error.
#[command]
fn get_random_entry_with_translations(
    app: AppHandle,
    state: State<'_, db::DbState>,
    pp_state: State<'_, PhrasePacksState>,
    levels: Option<Vec<String>>,
    domains: Option<Vec<String>>,
    language_codes: Option<Vec<String>>,
    phrase_pack_ids: Option<Vec<String>>,
    base_corpus_enabled: Option<bool>,
    exclude: Option<Vec<ExcludeEntry>>,
) -> Result<EntryOut, String> {
    let pack_ids = phrase_pack_ids.unwrap_or_default();
    let base_on = base_corpus_enabled.unwrap_or(true);
    let allowed_langs: Option<HashSet<String>> =
        language_codes.as_ref().map(|v| v.iter().cloned().collect());
    let exclude_vec = exclude.unwrap_or_default();
    let exclude_map = partition_exclude(&exclude_vec);
    let empty: Vec<i64> = Vec::new();

    // Fast path — pre-phrase-packs behaviour, single-query plan, with a
    // tiny relaxation ladder around it so a user with restrictive
    // levels (e.g. only C2) still gets an entry.
    if pack_ids.is_empty() && base_on {
        let base_exclude = exclude_map.get(BASE_SOURCE_ID).unwrap_or(&empty);
        return try_base_only_with_relaxation(
            &state,
            levels,
            domains,
            allowed_langs,
            base_exclude,
        );
    }

    if !base_on && pack_ids.is_empty() {
        return Err("No active sources".to_string());
    }

    // Multi-source path with filter-relaxation ladder. Anti-repetition
    // exclude is applied at every tier; if every tier comes back empty
    // with exclude, we retry the ladder once more with exclude=[] so
    // anti-repetition can never wedge the loop.
    let empty_map: HashMap<String, Vec<i64>> = HashMap::new();
    for excl_map in [&exclude_map, &empty_map] {
        for (sig, force_base) in relaxation_ladder(&levels, &domains) {
            let effective_base_on = base_on || force_base;
            let base_conn = state
                .conn
                .lock()
                .map_err(|_| "DB lock poisoned".to_string())?;
            let sources = gather_sources(
                &app,
                &pp_state,
                &base_conn,
                &sig,
                &pack_ids,
                effective_base_on,
                excl_map,
            )?;
            if sources.is_empty() {
                drop(base_conn);
                continue;
            }

            let total: i64 = sources.iter().map(|(_, c)| c).sum();
            let chosen = pick_weighted_source(&base_conn, &sources, total)?;

            if chosen == BASE_SOURCE_ID {
                let base_exclude = excl_map.get(BASE_SOURCE_ID).unwrap_or(&empty);
                let entry_id = sample_random_base_id(&base_conn, &sig, base_exclude)?;
                return fetch_entry_with_translations(
                    &base_conn,
                    entry_id,
                    allowed_langs.as_ref(),
                );
            }
            // Release the base lock before doing any phrase-pack work.
            drop(base_conn);
            let pack_exclude = excl_map.get(&chosen).unwrap_or(&empty);
            let id = sample_random_phrase_pack_id(
                &app,
                &pp_state,
                &chosen,
                &sig,
                pack_exclude,
            )?;
            let entry =
                fetch_phrase_pack_entry(&app, &pp_state, &chosen, id, allowed_langs.as_ref())?;
            return Ok(phrase_pack_entry_to_out(entry, &chosen));
        }
    }

    Err("No entries in the bundled corpus".to_string())
}

/// Pre-phrase-packs single-source implementation, preserved verbatim so the
/// fast path keeps its known-good query plan.
fn get_random_entry_base_only(
    state: &State<'_, db::DbState>,
    levels: Option<Vec<String>>,
    domains: Option<Vec<String>>,
    allowed_langs: Option<HashSet<String>>,
    exclude_ids: &[i64],
) -> Result<EntryOut, String> {
    let conn = state.conn.lock().map_err(|_| "DB lock poisoned".to_string())?;

    let mut where_clauses = vec![];
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    // Levels filter
    if let Some(ref lv_vec) = levels {
        if !lv_vec.is_empty() {
            let q = format!("e.level IN ({})", vec!["?"; lv_vec.len()].join(","));
            where_clauses.push(q);
            for lv in lv_vec {
                params.push(Box::new(lv.clone()));
            }
        }
    }

    // Domain filter (join only if domains specified)
    let (domain_join, domain_where) = if let Some(ref dom_vec) = domains {
        if !dom_vec.is_empty() {
            let q = format!("d.code IN ({})", vec!["?"; dom_vec.len()].join(","));
            (
                "INNER JOIN cor_entry_domains ced ON ced.entry_id = e.id
                 INNER JOIN cor_domain d ON d.id = ced.domain_id",
                Some(q),
            )
        } else {
            ("", None)
        }
    } else {
        ("", None)
    };

    if let Some(q) = domain_where {
        where_clauses.push(q);
        if let Some(dom_vec) = &domains {
            for dom in dom_vec {
                params.push(Box::new(dom.clone()));
            }
        }
    }

    // Anti-repetition exclude.
    if !exclude_ids.is_empty() {
        let q = format!("e.id NOT IN ({})", vec!["?"; exclude_ids.len()].join(","));
        where_clauses.push(q);
        for id in exclude_ids {
            params.push(Box::new(*id));
        }
    }

    let where_str = if where_clauses.is_empty() {
        "".to_string()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    // Use SQLite's RANDOM() — properly seeded PRNG, uniform across the
    // *current* row set (so post-prune deletions are naturally invisible
    // and we never offset into a stale 27k count). The previous
    // implementation used `subsec_nanos() % total` which is clock-derived,
    // not random: rapid taps cluster within the same nanosecond range and
    // collide on identical offsets, producing the same handful of phrases
    // over and over.
    let sql = format!(
        "SELECT e.id
         FROM cor_entry e
         {domain_join}
         {where}
         GROUP BY e.id
         ORDER BY RANDOM()
         LIMIT 1",
        domain_join = domain_join,
        where = where_str
    );

    let mut stmt = conn.prepare_cached(&sql).map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query(params_from_iter(params.iter().map(|p| &**p)))
        .map_err(|e| e.to_string())?;

    let row = rows
        .next()
        .map_err(|e| e.to_string())?
        .ok_or("No entries found for these criteria")?;

    let entry_id: i64 = row.get(0).map_err(|e| e.to_string())?;
    fetch_entry_with_translations(&conn, entry_id, allowed_langs.as_ref())
}

/// Get multiple random entries matching given filters, with all translations
#[command]
fn get_random_entries_with_translations(
    app: AppHandle,
    state: State<'_, db::DbState>,
    pp_state: State<'_, PhrasePacksState>,
    count: i64,
    levels: Option<Vec<String>>,
    domains: Option<Vec<String>>,
    language_codes: Option<Vec<String>>,
    phrase_pack_ids: Option<Vec<String>>,
    base_corpus_enabled: Option<bool>,
    exclude: Option<Vec<ExcludeEntry>>,
) -> Result<Vec<EntryOut>, String> {
    if count <= 0 {
        return Ok(vec![]);
    }

    let pack_ids = phrase_pack_ids.unwrap_or_default();
    let base_on = base_corpus_enabled.unwrap_or(true);
    let allowed_langs: Option<HashSet<String>> =
        language_codes.as_ref().map(|v| v.iter().cloned().collect());
    let exclude_vec = exclude.unwrap_or_default();
    let exclude_map = partition_exclude(&exclude_vec);
    let empty: Vec<i64> = Vec::new();

    // Fast path — pre-phrase-packs behaviour, identical query plan.
    // Wrapped in the same 3-tier relaxation as the single-entry fast
    // path so a strict-filter user still gets a batch back.
    if pack_ids.is_empty() && base_on {
        let base_exclude = exclude_map.get(BASE_SOURCE_ID).unwrap_or(&empty);
        let no_exclude: &[i64] = &[];
        for ex in [base_exclude.as_slice(), no_exclude] {
            let attempts: [(Option<Vec<String>>, Option<Vec<String>>); 3] = [
                (levels.clone(), domains.clone()),
                (None, domains.clone()),
                (None, None),
            ];
            for (lv, dm) in attempts {
                match try_batch_base_only(
                    &state,
                    count,
                    lv,
                    dm,
                    allowed_langs.clone(),
                    ex,
                ) {
                    Ok(entries) if !entries.is_empty() => return Ok(entries),
                    Ok(_) => continue,
                    Err(e) if e == "No entries found for these criteria" => continue,
                    Err(e) => return Err(e),
                }
            }
        }
        return Err("No entries in the bundled corpus".to_string());
    }

    if !base_on && pack_ids.is_empty() {
        return Err("No active sources".to_string());
    }

    // Multi-source path with filter-relaxation ladder. For each requested
    // result we weighted-pick a source and then sample 1 entry from that
    // source — within a single tier the sampling is N round-trips, each
    // ~1ms. Outer loop tries up to 4 tiers × {with, without} exclude.
    let count_usize = count as usize;
    let empty_map: HashMap<String, Vec<i64>> = HashMap::new();
    for excl_map in [&exclude_map, &empty_map] {
        for (sig, force_base) in relaxation_ladder(&levels, &domains) {
            let effective_base_on = base_on || force_base;
            let base_conn = state
                .conn
                .lock()
                .map_err(|_| "DB lock poisoned".to_string())?;
            let sources = gather_sources(
                &app,
                &pp_state,
                &base_conn,
                &sig,
                &pack_ids,
                effective_base_on,
                excl_map,
            )?;
            if sources.is_empty() {
                drop(base_conn);
                continue;
            }

            let total: i64 = sources.iter().map(|(_, c)| c).sum();
            let mut picks: HashMap<String, i64> = HashMap::new();
            for _ in 0..count_usize {
                let chosen = pick_weighted_source(&base_conn, &sources, total)?;
                *picks.entry(chosen).or_insert(0) += 1;
            }

            let mut entries: Vec<EntryOut> = Vec::with_capacity(count_usize);
            if let Some(&base_n) = picks.get(BASE_SOURCE_ID) {
                let base_exclude =
                    excl_map.get(BASE_SOURCE_ID).unwrap_or(&empty);
                let ids = sample_random_base_ids(&base_conn, &sig, base_exclude, base_n)?;
                for entry_id in ids {
                    entries.push(fetch_entry_with_translations(
                        &base_conn,
                        entry_id,
                        allowed_langs.as_ref(),
                    )?);
                }
            }
            drop(base_conn);

            for (source_id, n) in picks.iter().filter(|(id, _)| id.as_str() != BASE_SOURCE_ID) {
                let pack_exclude = excl_map.get(source_id).unwrap_or(&empty);
                for _ in 0..*n {
                    let id = sample_random_phrase_pack_id(
                        &app,
                        &pp_state,
                        source_id,
                        &sig,
                        pack_exclude,
                    )?;
                    let entry = fetch_phrase_pack_entry(
                        &app,
                        &pp_state,
                        source_id,
                        id,
                        allowed_langs.as_ref(),
                    )?;
                    entries.push(phrase_pack_entry_to_out(entry, source_id));
                }
            }

            if !entries.is_empty() {
                return Ok(entries);
            }
            // Sources were non-empty but the per-source sampling came back
            // empty — extremely unlikely but means this tier is dry; keep
            // going down the ladder.
        }
    }

    Err("No entries in the bundled corpus".to_string())
}

/// Inline batch-only base query, kept so the fast path stays a single
/// SQL round-trip. Returns `Err("No entries found for these criteria")`
/// on empty result so the relaxation wrapper can detect-and-retry.
fn try_batch_base_only(
    state: &State<'_, db::DbState>,
    count: i64,
    levels: Option<Vec<String>>,
    domains: Option<Vec<String>>,
    allowed_langs: Option<HashSet<String>>,
    exclude_ids: &[i64],
) -> Result<Vec<EntryOut>, String> {
    let conn = state.conn.lock().map_err(|_| "DB lock poisoned".to_string())?;

    let mut where_clauses = vec![];
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    if let Some(ref lv_vec) = levels {
        if !lv_vec.is_empty() {
            let q = format!("e.level IN ({})", vec!["?"; lv_vec.len()].join(","));
            where_clauses.push(q);
            for lv in lv_vec {
                params.push(Box::new(lv.clone()));
            }
        }
    }

    let (domain_join, domain_where) = if let Some(ref dom_vec) = domains {
        if !dom_vec.is_empty() {
            let q = format!("d.code IN ({})", vec!["?"; dom_vec.len()].join(","));
            (
                "INNER JOIN cor_entry_domains ced ON ced.entry_id = e.id
                 INNER JOIN cor_domain d ON d.id = ced.domain_id",
                Some(q),
            )
        } else {
            ("", None)
        }
    } else {
        ("", None)
    };

    if let Some(q) = domain_where {
        where_clauses.push(q);
        if let Some(dom_vec) = &domains {
            for dom in dom_vec {
                params.push(Box::new(dom.clone()));
            }
        }
    }

    if !exclude_ids.is_empty() {
        let q = format!("e.id NOT IN ({})", vec!["?"; exclude_ids.len()].join(","));
        where_clauses.push(q);
        for id in exclude_ids {
            params.push(Box::new(*id));
        }
    }

    let where_str = if where_clauses.is_empty() {
        "".to_string()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let sql = format!(
        "SELECT e.id
         FROM cor_entry e
         {domain_join}
         {where}
         GROUP BY e.id
         ORDER BY RANDOM()
         LIMIT ?",
        domain_join = domain_join,
        where = where_str
    );

    let mut params_with_limit = params;
    params_with_limit.push(Box::new(count));

    let mut stmt = conn.prepare_cached(&sql).map_err(|e| e.to_string())?;
    let mut id_rows = stmt
        .query(params_from_iter(params_with_limit.iter().map(|p| &**p)))
        .map_err(|e| e.to_string())?;

    let mut ids: Vec<i64> = Vec::new();
    while let Some(row) = id_rows.next().map_err(|e| e.to_string())? {
        ids.push(row.get(0).map_err(|e| e.to_string())?);
    }

    if ids.is_empty() {
        return Err("No entries found for these criteria".to_string());
    }

    let mut entries = Vec::with_capacity(ids.len());
    for entry_id in ids {
        let entry = fetch_entry_with_translations(&conn, entry_id, allowed_langs.as_ref())?;
        entries.push(entry);
    }
    Ok(entries)
}

/// Sum of entries matching `(levels, base_corpus_enabled, phrase_pack_ids)`
/// across every active source. Used by the Stacks tab to show a "~N
/// phrases match this stack" chip so users understand their filter
/// scope before tight-filter repetition surprises them.
///
/// Reuses the `count_base_entries` + `collect_pack_counts` helpers and
/// their FilterSig-keyed cache, so consecutive calls with the same
/// filter are sub-millisecond. Anti-repetition exclude is intentionally
/// NOT applied here — the chip reports the gross pool size, not the
/// post-exclude one.
#[command]
fn count_entries_for_filter(
    app: AppHandle,
    state: State<'_, db::DbState>,
    pp_state: State<'_, PhrasePacksState>,
    levels: Option<Vec<String>>,
    phrase_pack_ids: Option<Vec<String>>,
    base_corpus_enabled: Option<bool>,
) -> Result<i64, String> {
    let pack_ids = phrase_pack_ids.unwrap_or_default();
    let base_on = base_corpus_enabled.unwrap_or(true);
    let sig = FilterSig::new(&levels, &None);
    let empty_map: HashMap<String, Vec<i64>> = HashMap::new();
    let empty: Vec<i64> = Vec::new();

    let mut total: i64 = 0;
    if base_on {
        let base_conn = state
            .conn
            .lock()
            .map_err(|_| "DB lock poisoned".to_string())?;
        total = total.saturating_add(count_base_entries(&base_conn, &sig, &empty)?);
    }
    let pack_counts = collect_pack_counts(&app, &pp_state, &pack_ids, &sig, &empty_map)?;
    for (_, n) in pack_counts {
        total = total.saturating_add(n);
    }
    Ok(total)
}

/// Fetch a specific entry by ID with all translations (optionally filtered
/// by language codes). `source` defaults to `"base"` (bundled corpus) when
/// omitted, so existing callers keep working. Phrase-pack entries are
/// scoped by `source` because `entry_id` is only unique within a source.
#[command]
fn get_entry_by_id_with_translations(
    app: AppHandle,
    state: State<'_, db::DbState>,
    pp_state: State<'_, PhrasePacksState>,
    entry_id: i64,
    language_codes: Option<Vec<String>>,
    source: Option<String>,
) -> Result<EntryOut, String> {
    let allowed_langs: Option<HashSet<String>> =
        language_codes.map(|v| v.into_iter().collect());
    let source_id = source.unwrap_or_else(|| BASE_SOURCE_ID.to_string());
    if source_id == BASE_SOURCE_ID {
        let conn = state.conn.lock().map_err(|_| "DB lock poisoned".to_string())?;
        return fetch_entry_with_translations(&conn, entry_id, allowed_langs.as_ref());
    }
    let entry =
        fetch_phrase_pack_entry(&app, &pp_state, &source_id, entry_id, allowed_langs.as_ref())?;
    Ok(phrase_pack_entry_to_out(entry, &source_id))
}

/// Search for entries whose translation text contains the requested substring.
#[command]
fn search_entries_by_translation_text(
    state: State<'_, db::DbState>,
    text: String,
    language_codes: Option<Vec<String>>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<EntryOut>, String> {
    let needle = text.trim();
    if needle.is_empty() {
        return Ok(vec![]);
    }
    let limit = limit.unwrap_or(50).max(1).min(200);
    let offset = offset.unwrap_or(0).max(0);
    let search_langs = match &language_codes {
        Some(codes) if !codes.is_empty() => codes.clone(),
        _ => vec!["zh-Hans".to_string(), "zh-Hant".to_string()],
    };

    let conn = state.conn.lock().map_err(|_| "DB lock poisoned".to_string())?;

    let lang_placeholders = vec!["?"; search_langs.len()].join(",");
    let sql = format!(
        r#"SELECT DISTINCT t.entry_id
         FROM cor_translation t
         JOIN cor_language l ON l.id = t.language_id
         WHERE l.code IN ({lang_placeholders})
           AND t.text LIKE ? ESCAPE '\'
         ORDER BY t.entry_id
         LIMIT ? OFFSET ?"#
    );

    let mut params: Vec<Box<dyn ToSql>> = vec![];
    for lang in &search_langs {
        params.push(Box::new(lang.clone()));
    }
    let pattern = format!("%{}%", escape_like(needle));
    params.push(Box::new(pattern));
    params.push(Box::new(limit));
    params.push(Box::new(offset));

    let mut stmt = conn.prepare_cached(&sql).map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query(params_from_iter(params.iter().map(|p| &**p)))
        .map_err(|e| e.to_string())?;

    let allowed_langs: Option<HashSet<String>> =
        language_codes.map(|v| v.into_iter().collect());
    let mut results = vec![];
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let entry_id: i64 = row.get(0).map_err(|e| e.to_string())?;
        let entry = fetch_entry_with_translations(&conn, entry_id, allowed_langs.as_ref())?;
        results.push(entry);
    }
    Ok(results)
}

/// Count entries whose translation text contains the requested substring.
#[command]
fn search_entries_by_translation_text_count(
    state: State<'_, db::DbState>,
    text: String,
    language_codes: Option<Vec<String>>,
) -> Result<i64, String> {
    let needle = text.trim();
    if needle.is_empty() {
        return Ok(0);
    }
    let search_langs = match &language_codes {
        Some(codes) if !codes.is_empty() => codes.clone(),
        _ => vec!["zh-Hans".to_string(), "zh-Hant".to_string()],
    };

    let conn = state.conn.lock().map_err(|_| "DB lock poisoned".to_string())?;

    let lang_placeholders = vec!["?"; search_langs.len()].join(",");
    let sql = format!(
        r#"SELECT COUNT(DISTINCT t.entry_id)
         FROM cor_translation t
         JOIN cor_language l ON l.id = t.language_id
         WHERE l.code IN ({lang_placeholders})
           AND t.text LIKE ? ESCAPE '\'"#
    );

    let mut params: Vec<Box<dyn ToSql>> = vec![];
    for lang in &search_langs {
        params.push(Box::new(lang.clone()));
    }
    let pattern = format!("%{}%", escape_like(needle));
    params.push(Box::new(pattern));

    let total: i64 = conn
        .query_row(
            &sql,
            params_from_iter(params.iter().map(|p| &**p)),
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(total)
}

#[command]
fn content_packs_query_db(
    app: AppHandle,
    state: State<'_, PackDbState>,
    pack_id: String,
    db_name: Option<String>,
    sql: String,
    params: Option<Vec<JsonValue>>,
    max_rows: Option<usize>,
) -> Result<PackDbQueryResult, String> {
    ensure_readonly_sql(&sql)?;

    let db_path = resolve_pack_db_path(&app, &pack_id, db_name.as_deref())?;
    let key = format!("{}::{}", pack_id, db_name.unwrap_or_else(|| "main".to_string()));
    let mut connections = state
        .connections
        .lock()
        .map_err(|_| "Pack DB lock poisoned".to_string())?;

    if !connections.contains_key(&key) {
        let conn = open_pack_connection(&db_path)?;
        connections.insert(key.clone(), conn);
    }
    let conn = connections
        .get_mut(&key)
        .ok_or_else(|| "Failed to open pack DB".to_string())?;

    let mut stmt = conn.prepare_cached(&sql).map_err(|e| e.to_string())?;
    let columns = stmt
        .column_names()
        .iter()
        .map(|c| c.to_string())
        .collect::<Vec<_>>();

    let mut sql_params: Vec<SqlValue> = vec![];
    if let Some(values) = params {
        for value in values {
            sql_params.push(json_to_sql_value(&value));
        }
    }

    let mut rows = stmt
        .query(params_from_iter(sql_params.iter()))
        .map_err(|e| e.to_string())?;
    let mut out_rows: Vec<HashMap<String, JsonValue>> = vec![];
    let cap = max_rows
        .unwrap_or(PACK_DB_DEFAULT_MAX_ROWS)
        .min(PACK_DB_HARD_MAX_ROWS);
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let mut map = HashMap::new();
        for (idx, col) in columns.iter().enumerate() {
            let value = row.get_ref(idx).map_err(|e| e.to_string())?;
            map.insert(col.clone(), sql_value_ref_to_json(value));
        }
        out_rows.push(map);
        if out_rows.len() >= cap {
            break;
        }
    }

    Ok(PackDbQueryResult {
        columns,
        rows: out_rows,
    })
}

#[command]
async fn content_packs_install_from_url(
    app: AppHandle,
    pack_id: String,
    download_url: String,
    expected_sha256: Option<String>,
) -> Result<ContentPackInstallResult, String> {
    download_and_install(&app, pack_id, download_url, expected_sha256).await
}

#[command]
async fn content_packs_install_module(
    app: AppHandle,
    pack_id: String,
    sub_path: String,
    download_url: String,
    expected_sha256: Option<String>,
    pack_manifest: Option<String>,
) -> Result<(), String> {
    content_packs::install_module(
        &app,
        pack_id,
        sub_path,
        download_url,
        expected_sha256,
        pack_manifest,
    )
    .await
}

#[command]
fn content_packs_module_file_exists(
    app: AppHandle,
    pack_id: String,
    rel_path: String,
) -> Result<bool, String> {
    content_packs::module_file_exists(&app, pack_id, rel_path)
}

#[command]
async fn content_packs_fetch_text(app: AppHandle, url: String) -> Result<String, String> {
    content_packs::fetch_text(&app, url).await
}

#[command]
async fn content_packs_fetch_bytes(app: AppHandle, url: String) -> Result<tauri::ipc::Response, String> {
    content_packs::fetch_bytes(&app, url).await.map(tauri::ipc::Response::new)
}

#[command]
fn content_packs_list_installed(app: AppHandle) -> Result<Vec<ContentPackInfo>, String> {
    list_installed(&app)
}

#[command]
fn content_packs_get_manifest_url(app: AppHandle, pack_id: String) -> Result<String, String> {
    get_manifest_url(&app, pack_id)
}

/// Invalidate the cached COUNT(*) results and any open connection for the
/// given phrase pack. Called from JS after an install/uninstall/upgrade so
/// the sampler doesn't keep stale data around.
#[command]
fn phrase_packs_invalidate_cache(
    pp_state: State<'_, PhrasePacksState>,
    pack_id: String,
) -> Result<(), String> {
    pp_state.invalidate(&pack_id);
    Ok(())
}

/// Open Apple's Feedback Assistant app using the 'open' command (macOS/iOS)
#[command]
fn open_apple_feedback(#[allow(unused_variables)] app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        // Try URL scheme first
        let result = Command::new("open")
            .arg("applefeedback://")
            .output();

        match result {
            Ok(output) if output.status.success() => return Ok(()),
            _ => {
                // Fallback to direct app path
                let app_result = Command::new("open")
                    .arg("/System/Library/CoreServices/Applications/Feedback Assistant.app")
                    .output();

                match app_result {
                    Ok(output) if output.status.success() => return Ok(()),
                    Ok(output) => return Err(format!("Failed to open Feedback Assistant: {}",
                        String::from_utf8_lossy(&output.stderr))),
                    Err(e) => return Err(format!("Failed to execute open command: {}", e)),
                }
            }
        }
    }

    #[cfg(target_os = "ios")]
    {
        use tauri_plugin_opener::OpenerExt;

        // On iOS, try multiple options in order of preference:
        // 1. Feedback app (if installed via TestFlight/Beta program)
        // 2. Apple Support app (most users have this)
        // 3. Web feedback form as fallback
        let urls = vec![
            "applefeedback://new",           // Feedback app (Beta users)
            "applefeedback://",              // Feedback app (alternative)
            "applesupport://",               // Apple Support app
            "https://www.apple.com/feedback/", // Web fallback
        ];

        for url in urls {
            if let Ok(_) = app.opener().open_url(url, None::<&str>) {
                return Ok(());
            }
        }

        Err("Could not open Apple Feedback. Please install the Apple Support app from the App Store.".to_string())
    }

    #[cfg(not(any(target_os = "macos", target_os = "ios")))]
    {
        Err("Feedback Assistant is only available on Apple platforms".to_string())
    }
}

/// Quote `s` as a JSON string literal. Used by the panic hook to build a
/// valid-JSON breadcrumb from free-text fields. Never panics:
/// `serde_json::to_string` on a `&str` does not fail, and the fallback keeps
/// the hook infallible regardless.
fn json_quote(s: &str) -> String {
    serde_json::to_string(s).unwrap_or_else(|_| "\"\"".to_string())
}

/// Crash observability for the `panic = "abort"` Android build.
///
/// Any Rust panic — an `unwrap`/`expect`/index-out-of-bounds anywhere in the
/// app OR a statically-linked plugin (corpan-llm, stt, …) — aborts the process
/// immediately with no Java frame: exactly the unsymbolicated, all-native
/// tombstone we otherwise cannot diagnose from the Play Console. Install a hook
/// that records the panic's location + message + thread to a breadcrumb file
/// BEFORE the abort runs, then chains to the previous (default) hook so the
/// usual stderr print + abort still happen. `take_last_crash_report` hands the
/// breadcrumb to on-device analytics on the next launch (mirrors the STT
/// plugin's init breadcrumb). Best-effort throughout; the hook never panics.
fn install_panic_breadcrumb(data_dir: &std::path::Path) {
    let path = data_dir.join("panic-last.json");
    let prev = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let loc = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "<unknown>".to_string());
        let msg = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "<non-string panic payload>".to_string());
        let thread = std::thread::current()
            .name()
            .unwrap_or("<unnamed>")
            .to_string();
        let payload = format!(
            "{{\"location\":{},\"message\":{},\"thread\":{}}}",
            json_quote(&loc),
            json_quote(&msg),
            json_quote(&thread),
        );
        let _ = std::fs::write(&path, payload);
        prev(info);
    }));
}

/// Read and clear the last Rust-panic breadcrumb, if any. Called once at JS
/// boot; the returned JSON string is recorded into on-device analytics. Returns
/// `None` when no breadcrumb exists (the common, healthy case).
#[command]
fn take_last_crash_report(app: AppHandle) -> Option<String> {
    let dir = app.path().app_data_dir().ok()?;
    let path = dir.join("panic-last.json");
    let content = std::fs::read_to_string(&path).ok()?;
    let _ = std::fs::remove_file(&path);
    let trimmed = content.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pack_db_state = PackDbState::new();
    let phrase_packs_state = PhrasePacksState::new();
    tauri::Builder::default()
        .manage(pack_db_state)
        .manage(phrase_packs_state)
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_game_packs::init())
        .invoke_handler(tauri::generate_handler![
            get_random_entry_with_translations,
            get_random_entries_with_translations,
            count_entries_for_filter,
            get_entry_by_id_with_translations,
            search_entries_by_translation_text,
            search_entries_by_translation_text_count,
            content_packs_query_db,
            content_packs_install_from_url,
            content_packs_install_module,
            content_packs_module_file_exists,
            content_packs_fetch_text,
            content_packs_fetch_bytes,
            content_packs_list_installed,
            content_packs_get_manifest_url,
            phrase_packs_invalidate_cache,
            open_apple_feedback,
            take_last_crash_report
        ])
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_safe_area_insets_css::init())
        .plugin(tauri_plugin_tts::init())
        .plugin(tauri_plugin_audio_keepalive::init())
        .plugin(tauri_plugin_radio_stream::init())
        .plugin(tauri_plugin_iap::init())
        .plugin(tauri_plugin_subscriptions::init())
        .plugin(tauri_plugin_stt::init())
        .plugin(tauri_plugin_corpan_llm::init())
        .plugin(tauri_plugin_asr_native::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("failed to resolve app data dir: {}", e))?;
            // Install the panic breadcrumb hook before anything else can crash.
            // Borrow data_dir here; it is moved into DbState::new below.
            install_panic_breadcrumb(&data_dir);
            let db_state = db::DbState::new(data_dir)
                .map_err(|e| format!("failed to initialize database: {}", e))?;
            app.manage(db_state);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            // Android: never perform a graceful process exit.
            //
            // tao terminates the event loop with std::process::exit()
            // (tao android mod.rs:104), which runs __cxa_finalize — every
            // C++ static destructor across libhwui / libgui / vendor libs —
            // on the loop thread while the RenderThread, Mali GPU workers,
            // and OEM singletons are still live. Those teardowns abort the
            // process with "pthread_mutex_lock called on a destroyed mutex"
            // (HardwareBitmapUploader, hwui CommonPool), segfault in
            // Surface::connect on a dead BufferQueue, or crash inside a
            // vendor dtor (e.g. Vivo camera singleton). tauri-runtime-wry
            // raises RunEvent::ExitRequested before that exit (on any
            // Activity onDestroy: back, swipe-from-recents, OOM kill,
            // config recreate), so prevent_exit() keeps control_flow from
            // ever reaching ControlFlow::Exit — process::exit stays
            // unreachable. The process simply stays resident until Android
            // reclaims it via SIGKILL, which runs no destructors and is
            // race-free. Desktop is intentionally left to exit normally.
            if let tauri::RunEvent::ExitRequested { api: _api, .. } = event {
                #[cfg(target_os = "android")]
                _api.prevent_exit();
            }
        });
}
