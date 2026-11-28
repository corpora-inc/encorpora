//! Reference tables (CONTRACT "Reference tables"): specification values,
//! indicator and blink-code patterns, on-screen messages with causes and
//! resolutions, maintenance schedules, command and parameter references,
//! abbreviations. Generic: a table names its columns and their roles; a row
//! holds verbatim cells (a string, a list of strings, or a printed value
//! with its unit and bounds) and its own citation. The engine looks rows up
//! exactly; it does not interpret values.

use super::applic::{Applicability, AttrValues};
use super::view::{Citation, citation};
use crate::error::{Error, Result};
use crate::pack::Pack;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Column roles (an open set: these are the ones the engine knows).
pub const COLUMN_ROLES: &[&str] = &[
    "key",
    "code",
    "pattern",
    "meaning",
    "cause",
    "check",
    "remedy",
    "value",
    "unit",
    "limit",
    "interval",
    "item",
    "applicability",
    "reference",
    "text",
];

/// Roles a row is looked up by.
const KEY_ROLES: &[&str] = &["key", "code", "pattern", "item"];

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Column {
    pub id: String,
    /// As printed in the header.
    pub label: String,
    pub role: String,
}

/// A printed value: `text` is what the manual prints (shown as is); the
/// numbers serve exact lookup only.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ValueCell {
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_inclusive: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_inclusive: Option<bool>,
}

/// A cell: verbatim text, an ordered list of verbatim items, or a printed
/// value.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(untagged)]
pub enum Cell {
    Text(String),
    List(Vec<String>),
    Value(ValueCell),
}

impl Cell {
    /// The verbatim strings of the cell.
    pub fn texts(&self) -> Vec<&str> {
        match self {
            Cell::Text(t) => vec![t.as_str()],
            Cell::List(l) => l.iter().map(String::as_str).collect(),
            Cell::Value(v) => vec![v.text.as_str()],
        }
    }
}

#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct RefTable {
    pub table_id: String,
    pub title: String,
    /// `spec` | `indicator` | `message` | `schedule` | `command` |
    /// `parameter` | `abbreviation` | … (open).
    pub kind: String,
    pub section_id: String,
    pub columns: Vec<Column>,
    pub lang: String,
}

#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct RefRow {
    pub table_id: String,
    pub ord: i64,
    /// `<table_id>#<ord>`.
    pub row_id: String,
    /// Column id → cell, in no particular order (the table's `columns`
    /// give the printed order).
    pub cells: BTreeMap<String, Cell>,
    pub section_id: String,
}

/// A row as a screen shows it: cells that do not apply are left out,
/// cells whose applicability is not determined are flagged.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct RowView {
    pub row_id: String,
    pub table_id: String,
    pub ord: i64,
    pub cells: BTreeMap<String, Cell>,
    pub citation: Citation,
    pub applicability: Option<Applicability>,
    /// Per cell (column id), when it has statements of its own.
    pub cell_applicability: BTreeMap<String, Applicability>,
}

#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct TableView {
    #[serde(flatten)]
    pub table: RefTable,
    pub citation: Citation,
    pub rows: Vec<RowView>,
}

/// A table in a listing.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct TableSummary {
    #[serde(flatten)]
    pub table: RefTable,
    pub rows: usize,
}

/// A row found by `table.lookup`.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct RowHit {
    pub table_id: String,
    pub title: String,
    pub kind: String,
    /// `exact` (a key, code or pattern cell equals the key, case and
    /// spacing folded) or `words` (the query's words found in the row).
    pub matched: String,
    pub score: f64,
    pub row: RowView,
}

fn fold(s: &str) -> String {
    s.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

impl Pack {
    /// Every reference table, in id order.
    pub fn ref_tables(&self) -> Result<Vec<RefTable>> {
        if !self.has_table("ref_table")? {
            return Ok(Vec::new());
        }
        let rows: Vec<(String, String, String, String, String, String)> = {
            let conn = self.conn();
            let mut stmt = conn.prepare_cached(&format!(
                "SELECT table_id, title, kind, section_id, columns, lang FROM ref_table
                 WHERE {} ORDER BY table_id",
                super::PASSED
            ))?;
            stmt.query_map([], |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                ))
            })?
            .collect::<rusqlite::Result<_>>()?
        };
        rows.into_iter()
            .map(|(table_id, title, kind, section_id, columns, lang)| {
                Ok(RefTable {
                    columns: serde_json::from_str(&columns)
                        .map_err(|e| Error::Pack(format!("ref_table {table_id} columns: {e}")))?,
                    table_id,
                    title,
                    kind,
                    section_id,
                    lang,
                })
            })
            .collect()
    }

    pub fn ref_table(&self, table_id: &str) -> Result<Option<RefTable>> {
        Ok(self
            .ref_tables()?
            .into_iter()
            .find(|t| t.table_id == table_id))
    }

    /// A table's rows, in order.
    pub fn ref_rows(&self, table_id: &str) -> Result<Vec<RefRow>> {
        if !self.has_table("ref_row")? {
            return Ok(Vec::new());
        }
        let rows: Vec<(i64, String, String)> = {
            let conn = self.conn();
            let mut stmt = conn.prepare_cached(&format!(
                "SELECT ord, cells, section_id FROM ref_row WHERE table_id = ?1 AND {} ORDER BY ord",
                super::PASSED
            ))?;
            stmt.query_map([table_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
                .collect::<rusqlite::Result<_>>()?
        };
        rows.into_iter()
            .map(|(ord, cells, section_id)| {
                Ok(RefRow {
                    cells: serde_json::from_str(&cells)
                        .map_err(|e| Error::Pack(format!("ref_row {table_id}#{ord} cells: {e}")))?,
                    row_id: format!("{table_id}#{ord}"),
                    table_id: table_id.to_string(),
                    ord,
                    section_id,
                })
            })
            .collect()
    }

    /// One row by `<table_id>#<ord>`.
    pub fn ref_row(&self, row_id: &str) -> Result<Option<RefRow>> {
        let Some((t, _)) = row_id.rsplit_once('#') else {
            return Ok(None);
        };
        Ok(self.ref_rows(t)?.into_iter().find(|r| r.row_id == row_id))
    }
}

/// A row for `equip` and `values`: `None` when it does not apply (to the
/// variant, or by its statements).
pub fn row_view(
    pack: &Pack,
    row: &RefRow,
    equip: Option<&str>,
    values: &AttrValues,
) -> Result<Option<RowView>> {
    if !pack.applies(&pack.applies_to("ref_row", &row.row_id)?, equip)
        || !pack.applies(&pack.section_applies_to(&row.section_id)?, equip)
    {
        return Ok(None);
    }
    let applicability =
        pack.applicability_with_section("ref_row", &row.row_id, Some(&row.section_id), values)?;
    if !Applicability::shown(&applicability) {
        return Ok(None);
    }
    let mut cells = BTreeMap::new();
    let mut cell_applicability = BTreeMap::new();
    for (col, cell) in &row.cells {
        let a = pack.applicability("ref_cell", &format!("{}/{col}", row.row_id), values)?;
        if !Applicability::shown(&a) {
            continue;
        }
        if let Some(a) = a {
            cell_applicability.insert(col.clone(), a);
        }
        cells.insert(col.clone(), cell.clone());
    }
    Ok(Some(RowView {
        row_id: row.row_id.clone(),
        table_id: row.table_id.clone(),
        ord: row.ord,
        cells,
        citation: citation(pack, &row.section_id)?,
        applicability,
        cell_applicability,
    }))
}

/// A table with the rows that apply.
pub fn table_view(
    pack: &Pack,
    table_id: &str,
    equip: Option<&str>,
    values: &AttrValues,
) -> Result<Option<TableView>> {
    let Some(table) = pack.ref_table(table_id)? else {
        return Ok(None);
    };
    let mut rows = Vec::new();
    for r in pack.ref_rows(table_id)? {
        if let Some(v) = row_view(pack, &r, equip, values)? {
            rows.push(v);
        }
    }
    Ok(Some(TableView {
        citation: citation(pack, &table.section_id)?,
        table,
        rows,
    }))
}

/// Look rows up: by `key` exactly (a key, code, pattern or item cell equal
/// to it, folded), or by `query` words (every meaningful word found in the
/// row). `table_id` narrows to one table.
pub fn lookup(
    pack: &Pack,
    table_id: Option<&str>,
    key: Option<&str>,
    query: Option<&str>,
    equip: Option<&str>,
    values: &AttrValues,
    k: usize,
) -> Result<Vec<RowHit>> {
    let key = key.map(fold).filter(|k| !k.is_empty());
    let q: Vec<String> = query
        .map(|q| {
            let mut v = crate::normalize::content_stems(q);
            v.sort();
            v.dedup();
            v
        })
        .unwrap_or_default();
    if key.is_none() && q.is_empty() {
        return Err(Error::Invalid("table.lookup needs a key or a query".into()));
    }
    let mut hits = Vec::new();
    for t in pack.ref_tables()? {
        if table_id.is_some_and(|id| id != t.table_id) {
            continue;
        }
        let key_cols: Vec<&str> = t
            .columns
            .iter()
            .filter(|c| KEY_ROLES.contains(&c.role.as_str()))
            .map(|c| c.id.as_str())
            .collect();
        for r in pack.ref_rows(&t.table_id)? {
            // Only what applies to the asset can match.
            let Some(row) = row_view(pack, &r, equip, values)? else {
                continue;
            };
            let (matched, score) = if let Some(k) = &key {
                let exact = key_cols.iter().any(|c| {
                    row.cells
                        .get(*c)
                        .is_some_and(|cell| cell.texts().iter().any(|t| fold(t) == *k))
                });
                if !exact {
                    continue;
                }
                ("exact", 1.0)
            } else {
                let words: std::collections::BTreeSet<String> = row
                    .cells
                    .values()
                    .flat_map(|c| {
                        c.texts()
                            .into_iter()
                            .flat_map(crate::normalize::content_stems)
                            .collect::<Vec<_>>()
                    })
                    .collect();
                let found = q.iter().filter(|w| words.contains(*w)).count();
                if found == 0 {
                    continue;
                }
                ("words", found as f64 / q.len() as f64)
            };
            hits.push(RowHit {
                table_id: t.table_id.clone(),
                title: t.title.clone(),
                kind: t.kind.clone(),
                matched: matched.into(),
                score: (score * 1000.0_f64).round() / 1000.0,
                row,
            });
        }
    }
    hits.sort_by(|a, b| {
        b.score
            .total_cmp(&a.score)
            .then_with(|| a.row.row_id.cmp(&b.row.row_id))
    });
    hits.truncate(k.max(1));
    Ok(hits)
}

/// Problems with the pack's tables (for validation).
pub fn problems(pack: &Pack) -> Result<Vec<(String, String)>> {
    let mut out = Vec::new();
    let tables = match pack.ref_tables() {
        Ok(t) => t,
        Err(e) => return Ok(vec![("table.columns".into(), e.to_string())]),
    };
    for t in &tables {
        if !pack.section_exists(&t.section_id)? {
            out.push((
                "table.section".into(),
                format!("table {}: no section {}", t.table_id, t.section_id),
            ));
        }
        for (i, c) in t.columns.iter().enumerate() {
            if !COLUMN_ROLES.contains(&c.role.as_str()) {
                out.push((
                    "table.columns".into(),
                    format!(
                        "table {}: column {} has role {:?}",
                        t.table_id, c.id, c.role
                    ),
                ));
            }
            if t.columns[..i].iter().any(|o| o.id == c.id) || c.id.trim().is_empty() {
                out.push((
                    "table.columns".into(),
                    format!("table {}: empty or repeated column {:?}", t.table_id, c.id),
                ));
            }
        }
        let rows = match pack.ref_rows(&t.table_id) {
            Ok(r) => r,
            Err(e) => {
                out.push(("table.cells".into(), e.to_string()));
                continue;
            }
        };
        for r in rows {
            let Some(sec) = pack.section(&r.section_id)? else {
                out.push((
                    "table.section".into(),
                    format!("row {}: no section {}", r.row_id, r.section_id),
                ));
                continue;
            };
            for (col, cell) in &r.cells {
                if !t.columns.iter().any(|c| &c.id == col) {
                    out.push((
                        "table.cells".into(),
                        format!("row {}: cell {col:?} names no column", r.row_id),
                    ));
                }
                for text in cell.texts() {
                    if !crate::check::quote_in(text, &sec.text) {
                        out.push((
                            "table.verbatim".into(),
                            format!(
                                "row {} cell {col}: {text:?} is not in {}",
                                r.row_id, r.section_id
                            ),
                        ));
                    }
                }
                if let Cell::Value(v) = cell
                    && let (Some(lo), Some(hi)) = (v.min, v.max)
                    && lo > hi
                {
                    out.push((
                        "table.cells".into(),
                        format!("row {} cell {col}: min above max", r.row_id),
                    ));
                }
            }
        }
    }
    Ok(out)
}
