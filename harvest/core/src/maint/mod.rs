//! Maintenance content in a pack: fault trees, typed blocks (steps,
//! warnings, cautions, notes), requirements, page and figure locations,
//! assets, symptoms, signal maps, variant identification, fleet history and
//! depth levels (CONTRACT "Maintenance tables").
//!
//! Every table is optional and detected on its own, so a pack without them
//! (crane) reads exactly as before. Text that shows as the manual's words is
//! checked verbatim against its section on read: a fault tree with one node
//! that fails the check is refused whole, like a procedure with one
//! unverified step.

pub mod applic;
pub mod branch;
pub mod graph;
pub mod resolve;
pub mod search;
pub mod table;
pub mod view;

use crate::check;
use crate::error::{Error, Result};
use crate::pack::Pack;
use rusqlite::{OptionalExtension, Row};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

pub use branch::{Cond, CondOp, Expect, RecordedResult};

/// The maintenance DDL (optional tables), verbatim from `harvest/CONTRACT.md`.
pub const SCHEMA_MAINT: &str = include_str!("../schema_maint.sql");

/// Rows whose provenance passed verification.
const PASSED: &str = "prov_id IN (SELECT prov_id FROM provenance WHERE verdict = 'pass')";

/// The guard classes a pack gets when it declares none.
pub const GUARD_KINDS: &[&str] = &["warning", "caution", "note"];

/// A safety or advisory class as the manual defines it
/// (`pack_meta.guard_classes`, most severe first).
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct GuardClass {
    /// The section kind that carries it (`danger`, `warning`, `notice`, …).
    pub id: String,
    /// As printed (`DANGER`, `WARNING`).
    pub label: String,
    /// 1 is the most severe.
    pub rank: u32,
    /// Shown at every level, never collapsed (the bake sets it for every
    /// class at or above caution).
    pub must_show: bool,
}

/// The features a pack uses that a base (level 1) reader does not know:
/// they need `pack_meta.min_reader` 2.
pub fn reader_features(pack: &Pack) -> Result<Vec<String>> {
    let mut out = Vec::new();
    if pack.meta("guard_classes").is_some() {
        out.push("guard_classes".to_string());
    }
    let rows = |t: &str| -> Result<i64> {
        if !pack.has_table(t)? {
            return Ok(0);
        }
        Ok(pack
            .conn()
            .query_row(&format!("SELECT count(*) FROM {t}"), [], |r| r.get(0))?)
    };
    if pack.meta("attributes").is_some() || rows("applic")? > 0 {
        out.push("applicability conditions".to_string());
    }
    if rows("ref_table")? > 0 {
        out.push("reference tables".to_string());
    }
    if pack.has_table("fault_node")? {
        let edges = pack.has_table("fault_edge")?;
        let conn = pack.conn();
        let n: i64 = conn.query_row(
            "SELECT count(*) FROM fault_node WHERE expect LIKE '%\"labels\"%'",
            [],
            |r| r.get(0),
        )?;
        let e: i64 = if edges {
            conn.query_row(
                "SELECT count(*) FROM fault_edge WHERE cond LIKE '%_inclusive%'",
                [],
                |r| r.get(0),
            )?
        } else {
            0
        };
        if n > 0 || e > 0 {
            out.push("value readings or inclusive bounds".to_string());
        }
    }
    Ok(out)
}

/// warning, caution and note, all shown at every level.
pub fn default_guard_classes() -> Vec<GuardClass> {
    ["WARNING", "CAUTION", "NOTE"]
        .iter()
        .enumerate()
        .map(|(i, l)| GuardClass {
            id: l.to_lowercase(),
            label: l.to_string(),
            rank: i as u32 + 1,
            must_show: true,
        })
        .collect()
}

/// The highest pack feature level this reader understands
/// (`pack_meta.min_reader`; 1 is the base).
pub const READER_LEVEL: u32 = 2;

/// Requirement kinds.
pub const REQUIREMENT_KINDS: &[&str] = &[
    "tool",
    "part",
    "consumable",
    "personnel",
    "condition",
    "reference",
];

/// What a fault-tree node is.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum NodeKind {
    /// The reported symptom, where a tree usually begins.
    Symptom,
    /// A question the technician answers by a test or an observation.
    Check,
    /// Something to do (replace, adjust, repair).
    Action,
    /// Continue in another tree or a procedure.
    Goto,
    /// Beyond this level of maintenance: hand it up.
    Escalate,
    /// The tree ends here.
    End,
}

impl NodeKind {
    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "symptom" => Self::Symptom,
            "check" => Self::Check,
            "action" => Self::Action,
            "goto" => Self::Goto,
            "escalate" => Self::Escalate,
            "end" => Self::End,
            _ => return None,
        })
    }
    /// Kinds a path may end on.
    pub fn may_end(self) -> bool {
        matches!(self, Self::Action | Self::Goto | Self::Escalate | Self::End)
    }
}

/// Where a `goto` (or an `action` that is a task) leads.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Target {
    /// Another tree, at its entry or at `node_id` ("go to Table 3-2,
    /// step 4").
    Tree {
        id: String,
        node_id: Option<String>,
    },
    Procedure {
        id: String,
    },
}

impl Target {
    /// `tree:<id>`, `tree:<id>#<node_id>` or `procedure:<id>`.
    pub fn parse(s: &str) -> Option<Self> {
        let (k, id) = s.split_once(':')?;
        let id = id.trim();
        if id.is_empty() {
            return None;
        }
        match k.trim() {
            "tree" => match id.split_once('#') {
                Some((t, n)) if !t.trim().is_empty() && !n.trim().is_empty() => Some(Self::Tree {
                    id: t.trim().to_string(),
                    node_id: Some(n.trim().to_string()),
                }),
                Some(_) => None,
                None => Some(Self::Tree {
                    id: id.to_string(),
                    node_id: None,
                }),
            },
            "procedure" => Some(Self::Procedure { id: id.to_string() }),
            _ => None,
        }
    }
}

/// A troubleshooting tree.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct FaultTree {
    pub tree_id: String,
    pub title: String,
    pub system: Option<String>,
    pub entry_node: String,
    pub section_ids: Vec<String>,
    pub lang: String,
    /// Equipment the tree is limited to (empty: all).
    pub applies_to: Vec<String>,
    /// The tree's statements (and its first section's) for the asset, when
    /// it has any; an `unknown` tree is offered flagged, one that does not
    /// apply is never offered.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub applicability: Option<applic::Applicability>,
}

/// One node of a tree. `text` is the manual's own words.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct FaultNode {
    pub node_id: String,
    pub tree_id: String,
    pub kind: NodeKind,
    pub text: String,
    pub section_id: String,
    pub expect: Option<Expect>,
    pub target: Option<Target>,
    /// The procedure whose steps tell how to answer this node's question.
    pub proc_id: Option<String>,
    /// The manual's printed cross-reference ("Refer to field maintenance"),
    /// verbatim; kept also when it resolves to no target in the pack.
    pub reference: Option<String>,
    pub applies_to: Vec<String>,
}

/// One branch out of a node, chosen by code from the recorded result.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct FaultEdge {
    pub from_node: String,
    pub ord: i64,
    pub label: String,
    /// A numeric predicate; `None` matches by label equality.
    pub cond: Option<Cond>,
    pub to_node: String,
    /// An explicit loop back (re-test after an adjustment).
    pub retry: bool,
}

/// One verbatim facet text of a node (`reason`, `known`, `possible`,
/// `test_option`, …: the pack names them; the core treats them as opaque).
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Facet {
    pub node_id: String,
    pub facet: String,
    pub ord: i64,
    pub text: String,
    pub section_id: String,
}

/// A whole tree, checked: every node passed and its text is verbatim.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Tree {
    pub tree: FaultTree,
    pub nodes: Vec<FaultNode>,
    pub edges: Vec<FaultEdge>,
    pub facets: Vec<Facet>,
}

impl Tree {
    pub fn node(&self, id: &str) -> Option<&FaultNode> {
        self.nodes.iter().find(|n| n.node_id == id)
    }
    /// Edges out of `node_id`, in order.
    pub fn edges_from(&self, node_id: &str) -> Vec<&FaultEdge> {
        let mut out: Vec<&FaultEdge> = self
            .edges
            .iter()
            .filter(|e| e.from_node == node_id)
            .collect();
        out.sort_by_key(|e| e.ord);
        out
    }
    /// Facets of a node, in order.
    pub fn facets_of(&self, node_id: &str) -> Vec<&Facet> {
        let mut out: Vec<&Facet> = self
            .facets
            .iter()
            .filter(|f| f.node_id == node_id)
            .collect();
        out.sort_by(|a, b| a.facet.cmp(&b.facet).then(a.ord.cmp(&b.ord)));
        out
    }
    /// SHA-256 of what a job is recorded against: the tree, its nodes and
    /// its edges (texts, kinds, conditions, targets).
    pub fn sha256(&self) -> Result<String> {
        let mut nodes = self.nodes.clone();
        nodes.sort_by(|a, b| a.node_id.cmp(&b.node_id));
        let mut edges = self.edges.clone();
        edges.sort_by(|a, b| a.from_node.cmp(&b.from_node).then(a.ord.cmp(&b.ord)));
        let body = serde_json::to_string(&(&self.tree, &nodes, &edges))?;
        Ok(crate::packs::hex_encode(&Sha256::digest(body.as_bytes())))
    }
}

/// What a task, tree or node needs.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Requirement {
    pub ref_kind: String,
    pub ref_id: String,
    pub ord: i64,
    /// `tool` | `part` | `consumable` | `personnel` | `condition` | `reference`.
    pub kind: String,
    pub text: String,
    /// Part number, tool number or document number.
    pub ident: Option<String>,
    pub qty: Option<String>,
    pub section_id: Option<String>,
    /// True when `text` is verbatim in `section_id`'s text.
    pub verbatim: bool,
}

/// Printed location of a section.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct SectionLoc {
    pub page_label: Option<String>,
    pub page_index: Option<i64>,
    pub figure_label: Option<String>,
    /// Where the passage sits on its page image, normalized 0 to 1 (a
    /// passage may take more than one box).
    #[serde(default)]
    pub boxes: Vec<PageBox>,
}

/// A box on a page image, normalized 0 to 1 against the image: `x0 < x1`,
/// `y0 < y1`, origin top left.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct PageBox {
    pub x0: f64,
    pub y0: f64,
    pub x1: f64,
    pub y1: f64,
}

impl PageBox {
    /// Inside the page and not empty.
    pub fn valid(&self) -> bool {
        let unit = |v: f64| (0.0..=1.0).contains(&v);
        [self.x0, self.y0, self.x1, self.y1]
            .iter()
            .all(|v| unit(*v))
            && self.x0 < self.x1
            && self.y0 < self.y1
    }
}

/// A file of the signed pack (a figure crop or a page image).
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct PackAsset {
    pub asset_id: String,
    /// Relative to the pack directory, listed in the signed manifest.
    pub path: String,
    pub sha256: String,
    pub media_type: String,
    pub bytes: i64,
    pub width: Option<i64>,
    pub height: Option<i64>,
    /// `figure` | `page` (absent when read by id).
    pub role: Option<String>,
}

/// A symptom a technician reports, the way into a tree.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Symptom {
    pub symptom_id: String,
    pub tree_id: String,
    pub title: String,
    pub system: Option<String>,
    pub synonyms: Vec<String>,
    pub lang: String,
    pub applies_to: Vec<String>,
    /// Its tree's applicability for the asset, when the tree has statements.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub applicability: Option<applic::Applicability>,
}

/// A machine signal pattern and the entry point it leads to.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct SignalRule {
    pub signal_kind: String,
    /// Exact (case and spacing folded), or `prefix:…`, `glob:…` (`*`, `?`),
    /// `re:…` (a regular expression).
    pub pattern: String,
    pub title: String,
    /// The tree it leads into; `None` when the manual prints a cause with
    /// no troubleshooting (then `section_id` is what it says).
    pub tree_id: Option<String>,
    pub node_id: Option<String>,
    pub section_id: Option<String>,
    pub quote: Option<String>,
    /// True when `quote` is verbatim in `section_id`.
    pub quote_verified: bool,
    /// The reference-table row it resolves to (`<table_id>#<ord>`): a code
    /// or message with its meaning, causes and resolutions.
    pub row_id: Option<String>,
}

/// A kind of machine signal the pack maps (`pack_meta.signal_kinds`, else
/// derived from the signal map with the kind as its label).
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SignalKind {
    pub kind: String,
    pub label: String,
    /// A value as it would be typed or read (`spn:110/fmi:0`, `E21`).
    #[serde(default)]
    pub example: Option<String>,
}

/// One rule that identifies a variant from an observation.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct EquipIdent {
    pub equip_id: String,
    /// `serial_range` | `model` | `firmware` | `param` | `text`.
    pub kind: String,
    pub pattern: String,
}

/// A fleet history event baked in the pack.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct HistoryEvent {
    pub event_id: String,
    pub equip_id: String,
    pub system: Option<String>,
    pub date: String,
    pub text: String,
    pub source_id: Option<String>,
    pub attrs: serde_json::Value,
}

/// How a variant fails across the fleet.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct FailureMode {
    pub mode_id: String,
    pub equip_id: String,
    pub system: Option<String>,
    pub title: String,
    pub count: i64,
    pub share: Option<f64>,
    pub tree_id: Option<String>,
    pub examples: Vec<String>,
}

/// Whether a test procedure opens expanded or collapsed at a level.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum Fold {
    #[default]
    Expanded,
    Collapsed,
}

/// A depth level, from `pack_meta.levels` (ordered, most guidance first).
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Level {
    pub id: String,
    pub label: String,
    /// Facets shown expanded at this level; `None`: all of them. Warnings,
    /// cautions and notes are not facets and are shown at every level.
    #[serde(default)]
    pub facets: Option<Vec<String>>,
    /// How a node's test procedure opens.
    #[serde(default)]
    pub test_steps: Fold,
}

impl Level {
    pub fn shows_facet(&self, facet: &str) -> bool {
        self.facets
            .as_ref()
            .is_none_or(|f| f.iter().any(|x| x == facet))
    }
}

/// A facet the pack names: its id and the manual's heading for it
/// (`pack_meta.facets`, an ordered list; the order is the display order).
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct FacetDef {
    pub id: String,
    pub label: String,
}

/// Default levels when a pack declares none: the three roles every pack
/// has read until now.
pub fn default_levels() -> Vec<Level> {
    [
        ("trainee", "Trainee"),
        ("operator", "Operator"),
        ("inspector", "Inspector"),
    ]
    .into_iter()
    .map(|(id, label)| Level {
        id: id.into(),
        label: label.into(),
        facets: None,
        test_steps: Fold::Expanded,
    })
    .collect()
}

/// Default repeat-discrepancy window, in days.
pub const DEFAULT_REPEAT_WINDOW_DAYS: i64 = 30;

fn json_col<T>(id: &str, what: &str, raw: Option<String>) -> Result<T>
where
    T: serde::de::DeserializeOwned + Default,
{
    match raw {
        None => Ok(T::default()),
        Some(s) if s.trim().is_empty() || s.trim() == "null" => Ok(T::default()),
        Some(s) => serde_json::from_str(&s).map_err(|e| Error::Pack(format!("{id}: {what}: {e}"))),
    }
}

impl Pack {
    fn maint_rows<T>(
        &self,
        sql: &str,
        args: &[&dyn rusqlite::ToSql],
        f: impl Fn(&Row) -> rusqlite::Result<T>,
    ) -> Result<Vec<T>> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(sql)?;
        let out = stmt
            .query_map(args, |r| f(r))?
            .collect::<rusqlite::Result<Vec<T>>>()?;
        Ok(out)
    }

    /// True when the pack carries fault trees.
    pub fn has_fault_trees(&self) -> Result<bool> {
        self.has_table("fault_tree")
    }

    /// True when the pack has any maintenance table.
    pub fn has_maint_tables(&self) -> Result<bool> {
        for t in [
            "fault_tree",
            "section_loc",
            "asset",
            "requirement",
            "symptom",
            "signal_map",
            "equip_ident",
            "history",
            "failure_mode",
        ] {
            if self.has_table(t)? {
                return Ok(true);
            }
        }
        Ok(false)
    }

    /// The pack's depth levels: `pack_meta.levels`, else the default three.
    pub fn levels(&self) -> Result<Vec<Level>> {
        let Some(raw) = self.meta("levels") else {
            return Ok(default_levels());
        };
        let levels: Vec<Level> =
            serde_json::from_str(raw).map_err(|e| Error::Pack(format!("pack_meta.levels: {e}")))?;
        if levels.is_empty() {
            return Err(Error::Pack("pack_meta.levels is empty".into()));
        }
        for (i, l) in levels.iter().enumerate() {
            if l.id.trim().is_empty() || levels[..i].iter().any(|o| o.id == l.id) {
                return Err(Error::Pack(format!(
                    "pack_meta.levels: empty or repeated id {:?}",
                    l.id
                )));
            }
        }
        Ok(levels)
    }

    /// The pack's guard classes (`pack_meta.guard_classes`, else warning,
    /// caution, note). Ids unique, ranks rising.
    pub fn guard_classes(&self) -> Result<Vec<GuardClass>> {
        let Some(raw) = self.meta("guard_classes") else {
            return Ok(default_guard_classes());
        };
        let cs: Vec<GuardClass> = serde_json::from_str(raw)
            .map_err(|e| Error::Pack(format!("pack_meta.guard_classes: {e}")))?;
        if cs.is_empty() {
            return Err(Error::Pack("pack_meta.guard_classes is empty".into()));
        }
        for (i, c) in cs.iter().enumerate() {
            if c.id.trim().is_empty() || cs[..i].iter().any(|o| o.id == c.id) {
                return Err(Error::Pack(format!(
                    "pack_meta.guard_classes: empty or repeated id {:?}",
                    c.id
                )));
            }
            if i > 0 && c.rank < cs[i - 1].rank {
                return Err(Error::Pack(
                    "pack_meta.guard_classes: list them most severe first (rank rising)".into(),
                ));
            }
        }
        Ok(cs)
    }

    /// The pack's facet headings, in display order (empty when it names none).
    pub fn facet_defs(&self) -> Result<Vec<FacetDef>> {
        match self.meta("facets") {
            None => Ok(Vec::new()),
            Some(raw) => {
                serde_json::from_str(raw).map_err(|e| Error::Pack(format!("pack_meta.facets: {e}")))
            }
        }
    }

    /// One level by id.
    pub fn level(&self, id: &str) -> Result<Level> {
        let levels = self.levels()?;
        levels.iter().find(|l| l.id == id).cloned().ok_or_else(|| {
            Error::Invalid(format!(
                "level {id:?}: this pack has {:?}",
                levels.iter().map(|l| l.id.as_str()).collect::<Vec<_>>()
            ))
        })
    }

    /// Days within which the same asset and symptom (or system) again is a
    /// repeat discrepancy (`pack_meta.repeat_window_days`, default 30).
    pub fn repeat_window_days(&self) -> i64 {
        self.meta("repeat_window_days")
            .and_then(|v| v.trim().parse::<i64>().ok())
            .filter(|d| *d > 0)
            .unwrap_or(DEFAULT_REPEAT_WINDOW_DAYS)
    }

    /// Does a row apply to `equip`? A row with no `applies_to` entries
    /// applies to all; a row for an ancestor applies to its variants; a row
    /// for a more specific variant than the one known is kept (the host
    /// labels it with `applies_to`). With no equipment known, everything
    /// applies.
    pub fn applies(&self, rows: &[String], equip: Option<&str>) -> bool {
        let Some(equip) = equip else { return true };
        if rows.is_empty() {
            return true;
        }
        let lineage = self.equip_lineage(equip);
        rows.iter()
            .any(|a| lineage.contains(a) || self.equip_is_within(a, equip))
    }

    /// `applies_to` of a section: its own rows, else the nearest ancestor's.
    pub fn section_applies_to(&self, section_id: &str) -> Result<Vec<String>> {
        for anc in self.section_lineage(section_id)? {
            let rows = self.applies_to("section", &anc)?;
            if !rows.is_empty() {
                return Ok(rows);
            }
        }
        Ok(Vec::new())
    }

    /// A section's printed location (empty without `section_loc`).
    pub fn section_loc(&self, section_id: &str) -> Result<SectionLoc> {
        if !self.has_table("section_loc")? {
            return Ok(SectionLoc::default());
        }
        // `boxes` is optional: packs baked before it have no such column.
        let boxes_col = if self.has_column("section_loc", "boxes")? {
            "boxes"
        } else {
            "NULL"
        };
        type L = (Option<String>, Option<i64>, Option<String>, Option<String>);
        let row: Option<L> = {
            let conn = self.conn();
            let mut stmt = conn.prepare_cached(&format!(
                "SELECT page_label, page_index, figure_label, {boxes_col} FROM section_loc
                 WHERE section_id = ?1"
            ))?;
            stmt.query_row([section_id], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
            })
            .optional()?
        };
        let Some((page_label, page_index, figure_label, boxes)) = row else {
            return Ok(SectionLoc::default());
        };
        let boxes: Vec<PageBox> = json_col(section_id, "section_loc.boxes", boxes)?;
        if let Some(b) = boxes.iter().find(|b| !b.valid()) {
            return Err(Error::Pack(format!(
                "section_loc {section_id}: box {b:?} is not inside the page (0 to 1, x0 < x1, y0 < y1)"
            )));
        }
        Ok(SectionLoc {
            page_label,
            page_index,
            figure_label,
            boxes,
        })
    }

    /// The nearest printed page of a section or its ancestors, with the
    /// section's own figure label.
    pub fn section_loc_inherited(&self, section_id: &str) -> Result<SectionLoc> {
        let mut own = self.section_loc(section_id)?;
        if own.page_label.is_none() && own.page_index.is_none() {
            for anc in self.section_lineage(section_id)?.into_iter().skip(1) {
                let l = self.section_loc(&anc)?;
                if l.page_label.is_some() || l.page_index.is_some() {
                    own.page_label = l.page_label;
                    own.page_index = l.page_index;
                    // Its boxes stand for this passage only when it has none.
                    if own.boxes.is_empty() {
                        own.boxes = l.boxes;
                    }
                    break;
                }
            }
        }
        Ok(own)
    }

    fn asset_row(r: &Row) -> rusqlite::Result<PackAsset> {
        Ok(PackAsset {
            asset_id: r.get(0)?,
            path: r.get(1)?,
            sha256: r.get(2)?,
            media_type: r.get(3)?,
            bytes: r.get(4)?,
            width: r.get(5)?,
            height: r.get(6)?,
            role: r.get(7)?,
        })
    }

    /// An asset is usable only when the signed manifest lists its file with
    /// the same SHA-256 (so it was verified on open).
    fn asset_signed(&self, a: &PackAsset) -> bool {
        self.manifest()
            .files
            .iter()
            .any(|f| f.path == a.path && f.sha256.eq_ignore_ascii_case(&a.sha256))
    }

    /// Figure and page assets of a section, signed ones only.
    pub fn section_assets(&self, section_id: &str) -> Result<Vec<PackAsset>> {
        if !self.has_table("asset")? || !self.has_table("section_asset")? {
            return Ok(Vec::new());
        }
        let rows = self.maint_rows(
            "SELECT a.asset_id, a.path, a.sha256, a.media_type, a.bytes, a.width, a.height, s.role
             FROM section_asset s JOIN asset a ON a.asset_id = s.asset_id
             WHERE s.section_id = ?1 ORDER BY s.role, a.asset_id",
            &[&section_id],
            Self::asset_row,
        )?;
        Ok(rows
            .into_iter()
            .filter(|a| {
                let ok = self.asset_signed(a);
                if !ok {
                    eprintln!(
                        "harvest: asset {} ({}) is not in the signed manifest; not shown",
                        a.asset_id, a.path
                    );
                }
                ok
            })
            .collect())
    }

    /// One asset and its file on disk, when signed.
    pub fn asset_file(&self, asset_id: &str) -> Result<Option<(PackAsset, std::path::PathBuf)>> {
        if !self.has_table("asset")? {
            return Ok(None);
        }
        let row = self
            .maint_rows(
                "SELECT asset_id, path, sha256, media_type, bytes, width, height, NULL
                 FROM asset WHERE asset_id = ?1",
                &[&asset_id],
                Self::asset_row,
            )?
            .pop();
        Ok(row.filter(|a| self.asset_signed(a)).map(|a| {
            let p = self.dir().join(&a.path);
            (a, p)
        }))
    }

    /// Requirements of a procedure, tree or node, in order.
    pub fn requirements(&self, ref_kind: &str, ref_id: &str) -> Result<Vec<Requirement>> {
        if !self.has_table("requirement")? {
            return Ok(Vec::new());
        }
        type Q = (
            i64,
            String,
            String,
            Option<String>,
            Option<String>,
            Option<String>,
        );
        let rows: Vec<Q> = self.maint_rows(
            &format!(
                "SELECT ord, kind, text, ident, qty, section_id FROM requirement
                     WHERE ref_kind = ?1 AND ref_id = ?2 AND {PASSED} ORDER BY ord"
            ),
            &[&ref_kind, &ref_id],
            |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                ))
            },
        )?;
        rows.into_iter()
            .map(|(ord, kind, text, ident, qty, section_id)| {
                let verbatim = match &section_id {
                    Some(s) => self
                        .section(s)?
                        .is_some_and(|sec| check::quote_in(&text, &sec.text)),
                    None => false,
                };
                Ok(Requirement {
                    ref_kind: ref_kind.to_string(),
                    ref_id: ref_id.to_string(),
                    ord,
                    kind,
                    text,
                    ident,
                    qty,
                    section_id,
                    verbatim,
                })
            })
            .collect()
    }

    /// Requirements that apply to `equip` (`applies_to` ref
    /// `requirement:<ref_kind>:<ref_id>#<ord>`).
    pub fn requirements_for(
        &self,
        ref_kind: &str,
        ref_id: &str,
        equip: Option<&str>,
    ) -> Result<Vec<Requirement>> {
        let mut out = Vec::new();
        for r in self.requirements(ref_kind, ref_id)? {
            let at = self.applies_to("requirement", &format!("{ref_kind}:{ref_id}#{}", r.ord))?;
            if self.applies(&at, equip) {
                out.push(r);
            }
        }
        Ok(out)
    }

    /// Trees whose provenance passed, filtered to `equip`, by title.
    pub fn fault_trees(&self, equip: Option<&str>) -> Result<Vec<FaultTree>> {
        self.fault_trees_for(equip, &applic::AttrValues::new())
    }

    /// The trees for `equip` and an asset's attribute `values`: a tree
    /// whose statements do not apply is left out, one not determined is
    /// kept with its `applicability`.
    pub fn fault_trees_for(
        &self,
        equip: Option<&str>,
        values: &applic::AttrValues,
    ) -> Result<Vec<FaultTree>> {
        if !self.has_fault_trees()? {
            return Ok(Vec::new());
        }
        let ids: Vec<String> = self.maint_rows(
            &format!("SELECT tree_id FROM fault_tree WHERE {PASSED} ORDER BY title, tree_id"),
            &[],
            |r| r.get(0),
        )?;
        let mut out = Vec::new();
        for id in ids {
            if let Some(mut t) = self.fault_tree_row(&id, true)?
                && self.applies(&t.applies_to, equip)
            {
                t.applicability = self.applicability_with_section(
                    "fault_tree",
                    &t.tree_id,
                    t.section_ids.first().map(String::as_str),
                    values,
                )?;
                if applic::Applicability::shown(&t.applicability) {
                    out.push(t);
                }
            }
        }
        Ok(out)
    }

    fn fault_tree_row(&self, id: &str, passed_only: bool) -> Result<Option<FaultTree>> {
        let filter = if passed_only {
            format!("AND {PASSED}")
        } else {
            String::new()
        };
        let row: Option<(String, String, Option<String>, String, String, String)> = self
            .maint_rows(
                &format!(
                    "SELECT tree_id, title, system, entry_node, section_ids, lang FROM fault_tree
                     WHERE tree_id = ?1 {filter}"
                ),
                &[&id],
                |r| {
                    Ok((
                        r.get(0)?,
                        r.get(1)?,
                        r.get(2)?,
                        r.get(3)?,
                        r.get(4)?,
                        r.get(5)?,
                    ))
                },
            )?
            .pop();
        row.map(|(tree_id, title, system, entry_node, ids, lang)| {
            Ok(FaultTree {
                section_ids: json_col(&tree_id, "section_ids", Some(ids))?,
                applies_to: self.applies_to("fault_tree", &tree_id)?,
                applicability: None,
                tree_id,
                title,
                system,
                entry_node,
                lang,
            })
        })
        .transpose()
    }

    /// Nodes, edges and facets of a tree as stored, with each node's
    /// provenance verdict (for validation, which reports instead of refusing).
    pub(crate) fn tree_rows(&self, tree_id: &str) -> Result<RawTree> {
        type N = (
            String,
            String,
            String,
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            bool,
            Option<String>,
        );
        // `reference` is optional: packs baked before it have no such column.
        let reference = if self.has_column("fault_node", "reference")? {
            "reference"
        } else {
            "NULL"
        };
        let nodes: Vec<N> = self.maint_rows(
            &format!(
                "SELECT node_id, kind, text, section_id, expect, target, proc_id, {PASSED}, {reference}
                 FROM fault_node WHERE tree_id = ?1 ORDER BY node_id"
            ),
            &[&tree_id],
            |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                    r.get(6)?,
                    r.get(7)?,
                    r.get(8)?,
                ))
            },
        )?;
        let mut raw = RawTree::default();
        for (node_id, kind, text, section_id, expect, target, proc_id, passed, reference) in nodes {
            raw.nodes.push(RawNode {
                reference: reference.filter(|r| !r.trim().is_empty()),
                applies_to: self.applies_to("fault_node", &node_id)?,
                node_id,
                kind,
                text,
                section_id,
                expect,
                target,
                proc_id,
                passed,
            });
        }
        let edges: Vec<(String, i64, String, Option<String>, String, i64)> = self.maint_rows(
            "SELECT e.from_node, e.ord, e.label, e.cond, e.to_node, e.retry FROM fault_edge e
             JOIN fault_node n ON n.node_id = e.from_node WHERE n.tree_id = ?1
             ORDER BY e.from_node, e.ord",
            &[&tree_id],
            |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                ))
            },
        )?;
        raw.edges = edges
            .into_iter()
            .map(|(from_node, ord, label, cond, to_node, retry)| RawEdge {
                from_node,
                ord,
                label,
                cond,
                to_node,
                retry: retry != 0,
            })
            .collect();
        if self.has_table("fault_facet")? {
            raw.facets = self.maint_rows(
                "SELECT f.node_id, f.facet, f.ord, f.text, f.section_id FROM fault_facet f
                 JOIN fault_node n ON n.node_id = f.node_id WHERE n.tree_id = ?1
                 ORDER BY f.node_id, f.facet, f.ord",
                &[&tree_id],
                |r| {
                    Ok(Facet {
                        node_id: r.get(0)?,
                        facet: r.get(1)?,
                        ord: r.get(2)?,
                        text: r.get(3)?,
                        section_id: r.get(4)?,
                    })
                },
            )?;
        }
        Ok(raw)
    }

    /// A whole tree, checked. `None` when it does not exist or did not pass.
    /// A node that did not pass, a malformed column, or node or facet text
    /// that is not verbatim in its section is an error: a tree is shown
    /// whole or not at all.
    pub fn fault_tree(&self, tree_id: &str) -> Result<Option<Tree>> {
        if !self.has_fault_trees()? {
            return Ok(None);
        }
        let Some(tree) = self.fault_tree_row(tree_id, true)? else {
            return Ok(None);
        };
        let raw = self.tree_rows(tree_id)?;
        let bad = |m: String| Error::Pack(format!("fault tree {tree_id}: {m}"));
        let mut nodes = Vec::new();
        for n in raw.nodes {
            if !n.passed {
                return Err(bad(format!("node {} did not pass verification", n.node_id)));
            }
            let kind = NodeKind::parse(&n.kind)
                .ok_or_else(|| bad(format!("node {}: unknown kind {:?}", n.node_id, n.kind)))?;
            self.verbatim(&n.text, &n.section_id)
                .map_err(|m| bad(format!("node {}: {m}", n.node_id)))?;
            let expect = n
                .expect
                .as_deref()
                .filter(|e| !e.trim().is_empty() && e.trim() != "null")
                .map(serde_json::from_str::<Expect>)
                .transpose()
                .map_err(|e| bad(format!("node {}: expect: {e}", n.node_id)))?;
            let target = n
                .target
                .as_deref()
                .filter(|t| !t.trim().is_empty())
                .map(|t| {
                    Target::parse(t).ok_or_else(|| bad(format!("node {}: target {t:?}", n.node_id)))
                })
                .transpose()?;
            nodes.push(FaultNode {
                node_id: n.node_id,
                tree_id: tree_id.to_string(),
                kind,
                text: n.text,
                section_id: n.section_id,
                expect,
                target,
                proc_id: n.proc_id.filter(|p| !p.trim().is_empty()),
                reference: n.reference,
                applies_to: n.applies_to,
            });
        }
        let mut edges = Vec::new();
        for e in raw.edges {
            let cond = e
                .cond
                .as_deref()
                .filter(|c| !c.trim().is_empty() && c.trim() != "null")
                .map(serde_json::from_str::<Cond>)
                .transpose()
                .map_err(|x| bad(format!("edge {}#{}: cond: {x}", e.from_node, e.ord)))?;
            edges.push(FaultEdge {
                from_node: e.from_node,
                ord: e.ord,
                label: e.label,
                cond,
                to_node: e.to_node,
                retry: e.retry,
            });
        }
        for f in &raw.facets {
            self.verbatim(&f.text, &f.section_id)
                .map_err(|m| bad(format!("facet {}/{}#{}: {m}", f.node_id, f.facet, f.ord)))?;
        }
        if !nodes.iter().any(|n| n.node_id == tree.entry_node) {
            return Err(bad(format!(
                "entry node {} is not in the tree",
                tree.entry_node
            )));
        }
        Ok(Some(Tree {
            tree,
            nodes,
            edges,
            facets: raw.facets,
        }))
    }

    /// Ok when `text` is a verbatim substring of `section_id`'s text.
    pub(crate) fn verbatim(&self, text: &str, section_id: &str) -> std::result::Result<(), String> {
        match self.section(section_id) {
            Ok(Some(s)) if check::quote_in(text, &s.text) => Ok(()),
            Ok(Some(_)) => Err(format!("text is not verbatim in section {section_id}")),
            Ok(None) => Err(format!("section {section_id} does not exist")),
            Err(e) => Err(e.to_string()),
        }
    }

    /// Symptoms whose provenance passed and whose tree applies to `equip`.
    pub fn symptoms(&self, equip: Option<&str>) -> Result<Vec<Symptom>> {
        self.symptoms_for(equip, &applic::AttrValues::new())
    }

    /// The symptoms whose trees apply to `equip` and the asset's `values`
    /// (each with its tree's applicability).
    pub fn symptoms_for(
        &self,
        equip: Option<&str>,
        values: &applic::AttrValues,
    ) -> Result<Vec<Symptom>> {
        if !self.has_table("symptom")? {
            return Ok(Vec::new());
        }
        type S = (String, String, String, Option<String>, String, String);
        let rows: Vec<S> = self.maint_rows(
            &format!(
                "SELECT symptom_id, tree_id, title, system, synonyms, lang FROM symptom
                 WHERE {PASSED} ORDER BY title, symptom_id"
            ),
            &[],
            |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                ))
            },
        )?;
        let trees: BTreeMap<String, FaultTree> = self
            .fault_trees_for(equip, values)?
            .into_iter()
            .map(|t| (t.tree_id.clone(), t))
            .collect();
        let mut out = Vec::new();
        for (symptom_id, tree_id, title, system, synonyms, lang) in rows {
            let Some(tree) = trees.get(&tree_id) else {
                continue;
            };
            let applicability = tree.applicability.clone();
            let applies_to = self.applies_to("symptom", &symptom_id)?;
            if !self.applies(&applies_to, equip) {
                continue;
            }
            out.push(Symptom {
                synonyms: json_col(&symptom_id, "synonyms", Some(synonyms))?,
                symptom_id,
                tree_id,
                title,
                system,
                lang,
                applies_to,
                applicability,
            });
        }
        Ok(out)
    }

    /// The signal map, provenance passed.
    pub fn signal_rules(&self) -> Result<Vec<SignalRule>> {
        if !self.has_table("signal_map")? {
            return Ok(Vec::new());
        }
        type S = (
            String,
            String,
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
        );
        // `row_id` is optional (packs before reference tables have none).
        let row = if self.has_column("signal_map", "row_id")? {
            "row_id"
        } else {
            "NULL"
        };
        let rows: Vec<S> = self.maint_rows(
            &format!(
                "SELECT signal_kind, pattern, title, tree_id, node_id, section_id, quote, {row}
                 FROM signal_map WHERE {PASSED} ORDER BY signal_kind, pattern, tree_id"
            ),
            &[],
            |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                    r.get(6)?,
                    r.get(7)?,
                ))
            },
        )?;
        rows.into_iter()
            .map(
                |(signal_kind, pattern, title, tree_id, node_id, section_id, quote, row_id)| {
                    let quote_verified = match (&section_id, &quote) {
                        (Some(s), Some(q)) => self.verbatim(q, s).is_ok(),
                        _ => false,
                    };
                    Ok(SignalRule {
                        signal_kind,
                        pattern,
                        title,
                        tree_id,
                        node_id,
                        section_id,
                        quote,
                        quote_verified,
                        row_id,
                    })
                },
            )
            .collect()
    }

    /// The signal kinds the pack knows: `pack_meta.signal_kinds`, else one
    /// per kind in the signal map (label = kind, example = its first exact
    /// pattern).
    pub fn signal_kinds(&self) -> Result<Vec<SignalKind>> {
        if let Some(raw) = self.meta("signal_kinds") {
            return serde_json::from_str(raw)
                .map_err(|e| Error::Pack(format!("pack_meta.signal_kinds: {e}")));
        }
        let mut out: Vec<SignalKind> = Vec::new();
        for r in self.signal_rules()? {
            let exact = !["re:", "prefix:", "glob:"]
                .iter()
                .any(|p| r.pattern.starts_with(p));
            match out.iter_mut().find(|k| k.kind == r.signal_kind) {
                Some(k) => {
                    if k.example.is_none() && exact {
                        k.example = Some(r.pattern.clone());
                    }
                }
                None => out.push(SignalKind {
                    label: r.signal_kind.clone(),
                    kind: r.signal_kind,
                    example: exact.then_some(r.pattern),
                }),
            }
        }
        Ok(out)
    }

    /// Identification rules.
    pub fn equip_idents(&self) -> Result<Vec<EquipIdent>> {
        if !self.has_table("equip_ident")? {
            return Ok(Vec::new());
        }
        self.maint_rows(
            "SELECT equip_id, kind, pattern FROM equip_ident ORDER BY equip_id, kind, pattern",
            &[],
            |r| {
                Ok(EquipIdent {
                    equip_id: r.get(0)?,
                    kind: r.get(1)?,
                    pattern: r.get(2)?,
                })
            },
        )
    }

    /// Attributes of a variant, inherited from its ancestors (nearest wins).
    pub fn equip_attrs(&self, equip_id: &str) -> Result<BTreeMap<String, String>> {
        let mut out = BTreeMap::new();
        if !self.has_table("equip_attr")? {
            return Ok(out);
        }
        // Root first, so the variant's own values overwrite.
        for e in self.equip_lineage(equip_id).iter().rev() {
            let rows: Vec<(String, String)> = self.maint_rows(
                "SELECT key, value FROM equip_attr WHERE equip_id = ?1",
                &[e],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )?;
            out.extend(rows);
        }
        Ok(out)
    }

    /// Fleet history for a variant (its own, its ancestors', and more
    /// specific variants' when only a model is known), newest first.
    pub fn history_for(&self, equip: Option<&str>) -> Result<Vec<HistoryEvent>> {
        if !self.has_table("history")? {
            return Ok(Vec::new());
        }
        type H = (
            String,
            String,
            Option<String>,
            String,
            String,
            Option<String>,
            String,
        );
        let rows: Vec<H> = self.maint_rows(
            "SELECT event_id, equip_id, system, date, text, source_id, attrs FROM history
             ORDER BY date DESC, event_id",
            &[],
            |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                    r.get(6)?,
                ))
            },
        )?;
        let mut out = Vec::new();
        for (event_id, equip_id, system, date, text, source_id, attrs) in rows {
            if !self.applies(std::slice::from_ref(&equip_id), equip) {
                continue;
            }
            out.push(HistoryEvent {
                attrs: serde_json::from_str(&attrs)
                    .map_err(|e| Error::Pack(format!("history {event_id}: attrs: {e}")))?,
                event_id,
                equip_id,
                system,
                date,
                text,
                source_id,
            });
        }
        Ok(out)
    }

    /// Failure modes for a variant, most frequent first.
    pub fn failure_modes_for(&self, equip: Option<&str>) -> Result<Vec<FailureMode>> {
        if !self.has_table("failure_mode")? {
            return Ok(Vec::new());
        }
        type F = (
            String,
            String,
            Option<String>,
            String,
            i64,
            Option<f64>,
            Option<String>,
            String,
        );
        let rows: Vec<F> = self.maint_rows(
            "SELECT mode_id, equip_id, system, title, count, share, tree_id, examples
             FROM failure_mode ORDER BY count DESC, mode_id",
            &[],
            |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                    r.get(6)?,
                    r.get(7)?,
                ))
            },
        )?;
        let mut out = Vec::new();
        for (mode_id, equip_id, system, title, count, share, tree_id, examples) in rows {
            if !self.applies(std::slice::from_ref(&equip_id), equip) {
                continue;
            }
            out.push(FailureMode {
                examples: json_col(&mode_id, "examples", Some(examples))?,
                mode_id,
                equip_id,
                system,
                title,
                count,
                share,
                tree_id,
            });
        }
        Ok(out)
    }
}

/// A tree's rows as stored (validation input).
#[derive(Debug, Default)]
pub(crate) struct RawTree {
    pub nodes: Vec<RawNode>,
    pub edges: Vec<RawEdge>,
    pub facets: Vec<Facet>,
}

#[derive(Debug)]
pub(crate) struct RawNode {
    pub node_id: String,
    pub kind: String,
    pub text: String,
    pub section_id: String,
    pub expect: Option<String>,
    pub target: Option<String>,
    pub proc_id: Option<String>,
    pub passed: bool,
    pub applies_to: Vec<String>,
    pub reference: Option<String>,
}

#[derive(Debug)]
pub(crate) struct RawEdge {
    pub from_node: String,
    pub ord: i64,
    pub label: String,
    pub cond: Option<String>,
    pub to_node: String,
    pub retry: bool,
}
