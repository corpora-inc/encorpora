//! A verified pack, open read-only, and typed access to its rows.

use crate::error::{Error, Result};
use crate::packs::{self, Manifest, TrustedKey};
use crate::segments::Segment;
use rusqlite::{Connection, OpenFlags, OptionalExtension, params};
use serde::Serialize;
use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, OnceLock};

/// The schema-v1 DDL, verbatim from `harvest/CONTRACT.md`.
pub const SCHEMA_V1: &str = include_str!("schema_v1.sql");

/// Tables a v1 pack must have.
const REQUIRED_TABLES: &[&str] = &[
    "pack_meta",
    "source",
    "section",
    "fact",
    "answer",
    "answer_alias",
    "chunk",
    "chunk_fts",
    "alias_fts",
    "chunk_vec",
    "applies_to",
    "equipment",
    "explanation",
    "provenance",
];

/// How much to re-check on open.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Verify {
    /// Signature and the SHA-256 of every file (the default).
    #[default]
    Full,
    /// Signature always; skip re-hashing files whose size and modification
    /// time still match the stamp [`packs`] wrote after the install verified
    /// them. Falls back to `Full` when there is no matching stamp.
    InstallStamp,
}

/// One section of the corpus.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Section {
    pub section_id: String,
    pub source_id: String,
    pub parent_id: Option<String>,
    pub ord: i64,
    pub depth: i64,
    pub kind: String,
    pub citation: String,
    pub heading: Option<String>,
    pub text: String,
    pub lang: String,
}

/// A fact: a limit, clearance, interval, capacity, duty.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Fact {
    pub fact_id: String,
    pub section_id: String,
    pub kind: String,
    pub statement: String,
    pub quote: String,
    pub value: Option<String>,
    pub unit: Option<String>,
}

impl Fact {
    /// Kinds that are always quoted verbatim, never paraphrased.
    pub const VERBATIM_KINDS: &'static [&'static str] =
        &["limit", "clearance", "capacity", "interval"];

    pub fn is_verbatim(&self) -> bool {
        Self::VERBATIM_KINDS.contains(&self.kind.as_str())
    }
}

/// A row of the answer cache.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct CachedAnswer {
    pub answer_id: String,
    pub question: String,
    pub body: Vec<Segment>,
    pub section_ids: Vec<String>,
    pub level: Option<String>,
}

/// An equipment variant.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Equipment {
    pub equip_id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub aliases: Vec<String>,
}

/// A guided procedure (inspection, assembly, lift plan).
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Procedure {
    pub proc_id: String,
    pub title: String,
    pub kind: String,
    pub summary: String,
    pub roles: Vec<String>,
}

/// What to do when a step fails, with the rule behind it.
#[derive(Debug, Clone, Serialize, serde::Deserialize, PartialEq)]
pub struct Deficiency {
    pub guidance: String,
    #[serde(default)]
    pub action: Option<String>,
    pub section_id: String,
    #[serde(default)]
    pub quote: Option<String>,
}

/// One step of a procedure.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct ProcStep {
    pub proc_id: String,
    pub ord: i64,
    pub text: String,
    /// Step detail per role: `{trainee, operator, inspector}`.
    pub detail: BTreeMap<String, String>,
    /// `pass_fail` | `value` | `note` | `photo`.
    pub check_kind: String,
    pub section_ids: Vec<String>,
    pub deficiency: Option<Deficiency>,
}

/// A retrieval unit.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Chunk {
    pub chunk_id: String,
    pub ref_kind: String,
    pub ref_id: String,
    pub text: String,
}

/// Dense vectors, loaded on first use.
pub(crate) struct VecIndex {
    pub dim: usize,
    pub ids: Vec<String>,
    pub data: Vec<i8>,
    /// `scale / |dequantized vector|`, so cosine = dot(q_unit, i8) * factor.
    pub factor: Vec<f32>,
}

/// A verified pack, open read-only. `Send + Sync`; queries serialize on one
/// connection, which SQLite needs anyway for a single file.
pub struct Pack {
    dir: PathBuf,
    manifest: Manifest,
    conn: Mutex<Connection>,
    meta: BTreeMap<String, String>,
    equipment: Vec<Equipment>,
    synonyms: Vec<(String, String)>,
    vectors: OnceLock<Option<VecIndex>>,
}

impl std::fmt::Debug for Pack {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Pack")
            .field("dir", &self.dir)
            .field("pack_id", &self.manifest.pack_id)
            .field("version", &self.manifest.version)
            .finish()
    }
}

impl Pack {
    /// Verify (signature + every file hash) and open.
    pub fn open(dir: &Path, keys: &[TrustedKey]) -> Result<Self> {
        Self::open_with(dir, keys, Verify::Full)
    }

    /// Verify per `verify` and open.
    pub fn open_with(dir: &Path, keys: &[TrustedKey], verify: Verify) -> Result<Self> {
        let manifest = packs::read_manifest(dir, keys)?;
        if manifest.is_delta() {
            return Err(Error::Pack("a delta pack cannot be opened directly".into()));
        }
        let stamped = verify == Verify::InstallStamp && packs::stamp_matches(dir, &manifest)?;
        if !stamped {
            packs::verify_files(dir, &manifest)?;
        }
        let db = dir.join(&manifest.database()?.path);
        let conn = Connection::open_with_flags(
            &db,
            OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )?;
        conn.pragma_update(None, "query_only", true)?;
        for table in REQUIRED_TABLES {
            let found: Option<String> = conn
                .query_row(
                    "SELECT name FROM sqlite_master WHERE name = ?1",
                    [table],
                    |r| r.get(0),
                )
                .optional()?;
            if found.is_none() {
                return Err(Error::Pack(format!("missing table {table}")));
            }
        }
        let meta: BTreeMap<String, String> = {
            let mut stmt = conn.prepare("SELECT key, value FROM pack_meta")?;
            stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
                .collect::<rusqlite::Result<_>>()?
        };
        for (key, want) in [
            ("pack_id", manifest.pack_id.as_str()),
            ("version", manifest.version.as_str()),
        ] {
            match meta.get(key) {
                Some(v) if v == want => {}
                other => {
                    return Err(Error::Pack(format!(
                        "pack_meta.{key} is {other:?}, manifest says {want:?}"
                    )));
                }
            }
        }
        if meta.get("schema_version").map(String::as_str)
            != Some(manifest.schema_version.to_string().as_str())
        {
            return Err(Error::Pack(
                "pack_meta.schema_version differs from manifest".into(),
            ));
        }
        let equipment = {
            let mut stmt =
                conn.prepare("SELECT equip_id, parent_id, name, aliases FROM equipment")?;
            stmt.query_map([], |r| {
                let aliases: String = r.get(3)?;
                Ok(Equipment {
                    equip_id: r.get(0)?,
                    parent_id: r.get(1)?,
                    name: r.get(2)?,
                    aliases: serde_json::from_str(&aliases).unwrap_or_default(),
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?
        };
        let synonyms = load_synonyms(&conn)?;
        Ok(Self {
            dir: dir.to_path_buf(),
            manifest,
            conn: Mutex::new(conn),
            meta,
            equipment,
            synonyms,
            vectors: OnceLock::new(),
        })
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }
    pub fn manifest(&self) -> &Manifest {
        &self.manifest
    }
    pub fn pack_id(&self) -> &str {
        &self.manifest.pack_id
    }
    pub fn version(&self) -> &str {
        &self.manifest.version
    }
    /// A `pack_meta` value.
    pub fn meta(&self, key: &str) -> Option<&str> {
        self.meta.get(key).map(String::as_str)
    }
    pub fn equipment(&self) -> &[Equipment] {
        &self.equipment
    }
    /// `(phrase, canonical)` pairs from the optional `synonym` table, phrases
    /// already normalized.
    pub fn synonyms(&self) -> &[(String, String)] {
        &self.synonyms
    }

    pub(crate) fn conn(&self) -> MutexGuard<'_, Connection> {
        // A panic while holding the lock leaves a read-only connection intact.
        self.conn.lock().unwrap_or_else(|p| p.into_inner())
    }

    /// One section by id.
    pub fn section(&self, id: &str) -> Result<Option<Section>> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(
            "SELECT section_id, source_id, parent_id, ord, depth, kind, citation, heading, text, lang
             FROM section WHERE section_id = ?1",
        )?;
        Ok(stmt
            .query_row([id], |r| {
                Ok(Section {
                    section_id: r.get(0)?,
                    source_id: r.get(1)?,
                    parent_id: r.get(2)?,
                    ord: r.get(3)?,
                    depth: r.get(4)?,
                    kind: r.get(5)?,
                    citation: r.get(6)?,
                    heading: r.get(7)?,
                    text: r.get(8)?,
                    lang: r.get(9)?,
                })
            })
            .optional()?)
    }

    /// True when a section with this id exists.
    pub fn section_exists(&self, id: &str) -> Result<bool> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached("SELECT 1 FROM section WHERE section_id = ?1")?;
        Ok(stmt.exists([id])?)
    }

    /// The section and its ancestors, nearest first.
    pub fn section_lineage(&self, id: &str) -> Result<Vec<String>> {
        let conn = self.conn();
        let mut stmt =
            conn.prepare_cached("SELECT parent_id FROM section WHERE section_id = ?1")?;
        let mut out = vec![id.to_string()];
        let mut cur = id.to_string();
        while out.len() < 64 {
            let parent: Option<Option<String>> = stmt.query_row([&cur], |r| r.get(0)).optional()?;
            match parent.flatten() {
                Some(p) if !out.contains(&p) => {
                    out.push(p.clone());
                    cur = p;
                }
                _ => break,
            }
        }
        Ok(out)
    }

    /// Facts stated by a section.
    pub fn facts_for_section(&self, id: &str) -> Result<Vec<Fact>> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(
            "SELECT fact_id, section_id, kind, statement, quote, value, unit
             FROM fact WHERE section_id = ?1 ORDER BY fact_id",
        )?;
        let rows = stmt
            .query_map([id], |r| {
                Ok(Fact {
                    fact_id: r.get(0)?,
                    section_id: r.get(1)?,
                    kind: r.get(2)?,
                    statement: r.get(3)?,
                    quote: r.get(4)?,
                    value: r.get(5)?,
                    unit: r.get(6)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    }

    /// A procedure by id.
    pub fn procedure(&self, id: &str) -> Result<Option<Procedure>> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(
            // All or nothing: a procedure shows only when it and every one
            // of its steps passed verification (a missing step is unsafe).
            "SELECT proc_id, title, kind, summary, roles FROM procedure p WHERE proc_id = ?1
             AND prov_id IN (SELECT prov_id FROM provenance WHERE verdict = 'pass')
             AND NOT EXISTS (SELECT 1 FROM proc_step s WHERE s.proc_id = p.proc_id
                 AND s.prov_id NOT IN (SELECT prov_id FROM provenance WHERE verdict = 'pass'))",
        )?;
        let row: Option<(String, String, String, String, String)> = stmt
            .query_row([id], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?))
            })
            .optional()?;
        row.map(|(proc_id, title, kind, summary, roles)| {
            Ok(Procedure {
                roles: serde_json::from_str(&roles)
                    .map_err(|e| Error::Pack(format!("procedure {proc_id}: roles: {e}")))?,
                proc_id,
                title,
                kind,
                summary,
            })
        })
        .transpose()
    }

    /// The steps of a procedure, in order. A malformed JSON column is an
    /// error, so a broken step can never be shown.
    pub fn proc_steps(&self, proc_id: &str) -> Result<Vec<ProcStep>> {
        type Row = (i64, String, String, String, String, Option<String>, bool);
        let rows: Vec<Row> = {
            let conn = self.conn();
            let mut stmt = conn.prepare_cached(
                "SELECT ord, text, detail, check_kind, section_ids, deficiency,
                        prov_id IN (SELECT prov_id FROM provenance WHERE verdict = 'pass')
                 FROM proc_step WHERE proc_id = ?1 ORDER BY ord",
            )?;
            stmt.query_map([proc_id], |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                    r.get(6)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?
        };
        // Never a procedure with a step missing: one unverified step makes
        // the whole procedure unavailable.
        if let Some(r) = rows.iter().find(|r| !r.6) {
            return Err(Error::Pack(format!(
                "procedure {proc_id}: step {} did not pass verification",
                r.0
            )));
        }
        rows.into_iter()
            .map(
                |(ord, text, detail, check_kind, section_ids, deficiency, _)| {
                    let bad = |what: &str, e: serde_json::Error| {
                        Error::Pack(format!("proc_step {proc_id}#{ord}: {what}: {e}"))
                    };
                    Ok(ProcStep {
                        proc_id: proc_id.to_string(),
                        ord,
                        text,
                        detail: serde_json::from_str(&detail).map_err(|e| bad("detail", e))?,
                        check_kind,
                        section_ids: serde_json::from_str(&section_ids)
                            .map_err(|e| bad("section_ids", e))?,
                        deficiency: deficiency
                            .filter(|d| !d.trim().is_empty() && d.trim() != "null")
                            .map(|d| serde_json::from_str(&d).map_err(|e| bad("deficiency", e)))
                            .transpose()?,
                    })
                },
            )
            .collect()
    }

    /// The plain-language explanation of a section at a level, if baked.
    pub fn explanation(&self, section_id: &str, level: &str, lang: &str) -> Result<Option<String>> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(
            "SELECT body FROM explanation WHERE section_id = ?1 AND level = ?2 AND lang = ?3",
        )?;
        Ok(stmt
            .query_row(params![section_id, level, lang], |r| r.get(0))
            .optional()?)
    }

    /// A cached answer by id. A body that is not valid answer-segment JSON is
    /// an error, so a malformed row can never render.
    pub fn answer(&self, id: &str) -> Result<Option<CachedAnswer>> {
        let row: Option<(String, String, String, String, Option<String>)> = {
            let conn = self.conn();
            let mut stmt = conn.prepare_cached(
                "SELECT answer_id, question, body, section_ids, level FROM answer WHERE answer_id = ?1
                 AND prov_id IN (SELECT prov_id FROM provenance WHERE verdict = 'pass')",
            )?;
            stmt.query_row([id], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?))
            })
            .optional()?
        };
        let Some((answer_id, question, body, section_ids, level)) = row else {
            return Ok(None);
        };
        Ok(Some(CachedAnswer {
            answer_id,
            question,
            body: serde_json::from_str(&body)
                .map_err(|e| Error::Pack(format!("answer {id}: body: {e}")))?,
            section_ids: serde_json::from_str(&section_ids)
                .map_err(|e| Error::Pack(format!("answer {id}: section_ids: {e}")))?,
            level,
        }))
    }

    /// Equipment ids a row applies to (empty: applies to all).
    pub fn applies_to(&self, ref_kind: &str, ref_id: &str) -> Result<Vec<String>> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(
            "SELECT equip_id FROM applies_to WHERE ref_kind = ?1 AND ref_id = ?2 ORDER BY equip_id",
        )?;
        let rows = stmt
            .query_map(params![ref_kind, ref_id], |r| r.get(0))?
            .collect::<rusqlite::Result<Vec<String>>>()?;
        Ok(rows)
    }

    /// An equipment id and its ancestors, nearest first. Unknown ids yield
    /// just themselves.
    pub fn equip_lineage(&self, equip_id: &str) -> Vec<String> {
        let by_id: HashMap<&str, &Equipment> = self
            .equipment
            .iter()
            .map(|e| (e.equip_id.as_str(), e))
            .collect();
        let mut out = vec![equip_id.to_string()];
        let mut cur = equip_id;
        while let Some(p) = by_id.get(cur).and_then(|e| e.parent_id.as_deref()) {
            if out.iter().any(|o| o == p) || out.len() >= 32 {
                break;
            }
            out.push(p.to_string());
            cur = p;
        }
        out
    }

    /// True when `ancestor` is `equip_id` or one of its ancestors.
    pub fn equip_is_within(&self, equip_id: &str, ancestor: &str) -> bool {
        self.equip_lineage(equip_id).iter().any(|e| e == ancestor)
    }

    /// The section a chunk's referenced row belongs to.
    ///
    /// `section` → `ref_id` is the section id; `explanation` → `<section_id>:<level>`; `fact`, `term` →
    /// their `section_id`; `answer`, `question`, `diagram` → their first
    /// `section_ids`; `proc_step` → `ref_id` is `<proc_id>#<ord>`, its first
    /// `section_ids`. Anything else has no section.
    pub fn chunk_section(&self, ref_kind: &str, ref_id: &str) -> Result<Option<String>> {
        let conn = self.conn();
        let single = |sql: &str, arg: &str| -> Result<Option<String>> {
            let mut stmt = conn.prepare_cached(sql)?;
            Ok(stmt.query_row([arg], |r| r.get(0)).optional()?)
        };
        let first_of = |json: Option<String>| -> Option<String> {
            json.and_then(|j| serde_json::from_str::<Vec<String>>(&j).ok())
                .and_then(|v| v.into_iter().next())
        };
        Ok(match ref_kind {
            "section" => Some(ref_id.to_string()),
            // `<section_id>:<level>` (the pipeline's form) or a bare section id.
            "explanation" => Some(
                ref_id
                    .rsplit_once(':')
                    .filter(|(_, level)| ["trainee", "operator", "inspector"].contains(level))
                    .map_or(ref_id, |(s, _)| s)
                    .to_string(),
            ),
            "fact" => single("SELECT section_id FROM fact WHERE fact_id = ?1", ref_id)?,
            "term" => single("SELECT section_id FROM term WHERE term_id = ?1", ref_id)?,
            "answer" => first_of(single(
                "SELECT section_ids FROM answer WHERE answer_id = ?1",
                ref_id,
            )?),
            "question" => first_of(single(
                "SELECT section_ids FROM question WHERE q_id = ?1",
                ref_id,
            )?),
            "diagram" => first_of(single(
                "SELECT section_ids FROM diagram WHERE diagram_id = ?1",
                ref_id,
            )?),
            "proc_step" => {
                let Some((proc_id, ord)) = ref_id.rsplit_once('#') else {
                    return Ok(None);
                };
                let Ok(ord) = ord.parse::<i64>() else {
                    return Ok(None);
                };
                let mut stmt = conn.prepare_cached(
                    "SELECT section_ids FROM proc_step WHERE proc_id = ?1 AND ord = ?2",
                )?;
                first_of(
                    stmt.query_row(params![proc_id, ord], |r| r.get(0))
                        .optional()?,
                )
            }
            _ => None,
        })
    }

    /// One chunk by id.
    pub fn chunk(&self, id: &str) -> Result<Option<Chunk>> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(
            "SELECT chunk_id, ref_kind, ref_id, text FROM chunk WHERE chunk_id = ?1",
        )?;
        Ok(stmt
            .query_row([id], |r| {
                Ok(Chunk {
                    chunk_id: r.get(0)?,
                    ref_kind: r.get(1)?,
                    ref_id: r.get(2)?,
                    text: r.get(3)?,
                })
            })
            .optional()?)
    }

    /// Dense vectors, when the pack has them for `embedder_id` at `dim`.
    pub(crate) fn vectors(&self, embedder_id: &str, dim: usize) -> Result<Option<&VecIndex>> {
        if self.meta("embedder_id") != Some(embedder_id)
            || self.meta("embed_dim").and_then(|d| d.parse::<usize>().ok()) != Some(dim)
        {
            return Ok(None);
        }
        if let Some(v) = self.vectors.get() {
            return Ok(v.as_ref());
        }
        let loaded = self.load_vectors(dim)?;
        Ok(self.vectors.get_or_init(|| loaded).as_ref())
    }

    fn load_vectors(&self, dim: usize) -> Result<Option<VecIndex>> {
        let conn = self.conn();
        let mut stmt =
            conn.prepare("SELECT chunk_id, vec, scale FROM chunk_vec ORDER BY chunk_id")?;
        let mut rows = stmt.query([])?;
        let mut index = VecIndex {
            dim,
            ids: Vec::new(),
            data: Vec::new(),
            factor: Vec::new(),
        };
        while let Some(r) = rows.next()? {
            let id: String = r.get(0)?;
            let blob: Vec<u8> = r.get(1)?;
            let scale: f64 = r.get(2)?;
            if blob.len() != dim {
                return Err(Error::Pack(format!(
                    "chunk_vec {id}: {} bytes, embed_dim is {dim}",
                    blob.len()
                )));
            }
            let norm = blob
                .iter()
                .map(|&b| {
                    let x = b as i8 as f32;
                    x * x
                })
                .sum::<f32>()
                .sqrt();
            index.ids.push(id);
            index.data.extend(blob.iter().map(|&b| b as i8));
            // cosine(q, scale * v) = dot(q_unit, v) / |v|: the scale cancels,
            // but a zero or negative scale marks a vector to ignore.
            index.factor.push(if norm > 0.0 && scale > 0.0 {
                1.0 / norm
            } else {
                0.0
            });
        }
        Ok(if index.ids.is_empty() {
            None
        } else {
            Some(index)
        })
    }

    /// Row counts of the main tables (for `verify` output).
    pub fn row_counts(&self) -> Result<BTreeMap<String, i64>> {
        let conn = self.conn();
        let mut out = BTreeMap::new();
        for t in [
            "source",
            "section",
            "fact",
            "term",
            "answer",
            "answer_alias",
            "question",
            "procedure",
            "chunk",
            "chunk_vec",
        ] {
            let n: i64 = conn.query_row(&format!("SELECT count(*) FROM {t}"), [], |r| r.get(0))?;
            out.insert(t.to_string(), n);
        }
        Ok(out)
    }
}

/// The optional `synonym (phrase, canonical, lang)` table. Absent → none.
fn load_synonyms(conn: &Connection) -> Result<Vec<(String, String)>> {
    let exists: bool = conn
        .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'synonym'")?
        .exists([])?;
    if !exists {
        return Ok(Vec::new());
    }
    let mut stmt = conn.prepare("SELECT phrase, canonical FROM synonym")?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows
        .into_iter()
        .map(|(p, c)| (crate::normalize::fold(&p), crate::normalize::fold(&c)))
        .filter(|(p, c)| !p.is_empty() && !c.is_empty())
        .collect())
}
