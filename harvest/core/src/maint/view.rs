//! What one screen needs, in one object: a node of a tree (or a step of a
//! task) with its verbatim text, full citation, the warnings, cautions and
//! notes that guard it in manual order, requirements, figures and pages,
//! facets per level, the test procedure, and how to record the result.
//!
//! Warnings, cautions and notes are shown at every level: a level chooses
//! which facets open expanded and whether the test procedure opens, never
//! whether a guard is shown.

use super::PageBox;
use super::applic::{Applicability, AttrValues};
use super::branch::{Cond, Expect};
use super::{FaultNode, Fold, Level, PackAsset, Requirement, Target, Tree};
use crate::error::{Error, Result};
use crate::pack::{Pack, ProcStep, Procedure};
use schemars::JsonSchema;
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};

/// One level of a citation path.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct CitePart {
    pub section_id: String,
    pub citation: String,
    pub heading: Option<String>,
}

/// A citation down to the page: manual, edition, the section path
/// (chapter, paragraph …), page and figure.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct Citation {
    pub section_id: String,
    pub citation: String,
    pub heading: Option<String>,
    pub source_id: String,
    pub source_title: String,
    pub publisher: String,
    pub edition: String,
    /// Root first, ending with this section.
    pub path: Vec<CitePart>,
    pub page_label: Option<String>,
    pub page_index: Option<i64>,
    pub figure_label: Option<String>,
    /// The page image to open (a signed asset), when the pack has one.
    pub page_asset_id: Option<String>,
    /// Where the passage sits on that page image, normalized 0 to 1.
    pub boxes: Vec<PageBox>,
}

/// A safety or advisory block (a class the pack declares), verbatim.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct Guard {
    pub section_id: String,
    /// The class id (`warning`, `caution`, `note` by default; the pack's
    /// own, `danger` … `tip`, when it declares them).
    pub kind: String,
    /// As printed.
    pub label: String,
    /// 1 is the most severe.
    pub rank: u32,
    /// Never hidden or collapsed at any level.
    pub must_show: bool,
    /// How it looks: `danger` | `warning` | `caution` | `notice` | `note`.
    pub tone: super::GuardTone,
    /// When its applicability has statements (`unknown` is flagged, never
    /// dropped).
    pub applicability: Option<super::applic::Applicability>,
    pub heading: Option<String>,
    pub text: String,
    pub citation: Citation,
    pub applies_to: Vec<String>,
}

/// One verbatim facet text.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct FacetText {
    pub text: String,
    pub section_id: String,
    /// Its section's statements for the asset, when it has any (a text
    /// that does not apply is left out).
    pub applicability: Option<Applicability>,
}

/// A node's facet (`reason`, `known`, `possible`, `test_option`, …), in
/// order, and whether the level opens it.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct FacetGroup {
    pub facet: String,
    /// The manual's own heading for it (`pack_meta.facets`); `None` when
    /// the pack names none (validation reports that).
    pub label: Option<String>,
    pub expanded: bool,
    pub texts: Vec<FacetText>,
}

/// A branch the technician can take, as code will take it.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct Branch {
    pub label: String,
    /// The outcome to send for a categorical branch (`yes`, `fail`, an
    /// option, `done`); `None` for a measured value.
    pub outcome: Option<String>,
    pub cond: Option<Cond>,
    pub to_node: String,
    pub retry: bool,
}

/// How to record the result here. `expect` is `None` at the end of a path.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct RecordHow {
    pub expect: Option<Expect>,
    pub branches: Vec<Branch>,
}

/// Baked detail text for a level (the section's explanation).
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct LevelText {
    pub level: String,
    pub label: String,
    pub text: String,
}

/// One step of a task or test procedure.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct TaskStep {
    pub ord: i64,
    /// Verbatim from the manual.
    pub text: String,
    pub check_kind: String,
    pub section_ids: Vec<String>,
    pub citation: Option<Citation>,
    /// Shown before the step, in manual order, at every level.
    pub guards: Vec<Guard>,
    pub assets: Vec<PackAsset>,
    /// Detail per level, as baked.
    pub detail: BTreeMap<String, String>,
    /// Equipment the step is limited to (empty: all), and whether it
    /// applies to the equipment asked about (and to the asset, by its
    /// statements: `false` only when it does not apply).
    pub applies_to: Vec<String>,
    pub applies: bool,
    /// The step's statements (and its section's), when it has any; an
    /// `unknown` one is flagged for the technician to settle.
    pub applicability: Option<Applicability>,
}

/// A task (procedure) ready to show.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct TaskView {
    #[serde(flatten)]
    pub procedure: Procedure,
    /// Guards on the task (its section or above), shown once at its head;
    /// a step carries only the guards on that step.
    pub guards: Vec<Guard>,
    pub requirements: Vec<Requirement>,
    pub steps: Vec<TaskStep>,
    pub applies_to: Vec<String>,
    /// The procedure's statements, when it has any.
    pub applicability: Option<Applicability>,
}

/// The test procedure that answers a node's question.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct TestProcedure {
    pub proc_id: String,
    pub title: String,
    /// Whether it opens expanded at this level.
    pub expanded: bool,
    /// Guards on the whole procedure, shown once before its steps.
    pub guards: Vec<Guard>,
    pub requirements: Vec<Requirement>,
    pub steps: Vec<TaskStep>,
    /// The procedure's statements, when it has any.
    pub applicability: Option<Applicability>,
}

/// Where a `goto` or task action leads.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct TargetView {
    pub target: Target,
    pub title: Option<String>,
}

/// The tree a node belongs to.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct TreeSummary {
    pub tree_id: String,
    pub title: String,
    pub system: Option<String>,
    pub applies_to: Vec<String>,
    /// The tree's statements, when it has any.
    pub applicability: Option<Applicability>,
}

/// Everything one troubleshooting screen needs (manual content only; a job
/// adds its path and field notes).
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct NodeView {
    pub pack_id: String,
    pub pack_version: String,
    pub tree: TreeSummary,
    pub node: FaultNode,
    /// True when no branch leaves this node (the path ends here).
    pub terminal: bool,
    /// The node's statements (and its section's), when it has any.
    pub applicability: Option<Applicability>,
    pub citation: Citation,
    /// Warnings, cautions and notes guarding this node, manual order.
    pub guards: Vec<Guard>,
    /// The tree's initial setup (conditions, tools, references, personnel).
    pub setup: Vec<Requirement>,
    /// What this node itself needs.
    pub requirements: Vec<Requirement>,
    pub facets: Vec<FacetGroup>,
    /// The candidate causes still open at this point (the node's `possible`
    /// facet, else the nearest one earlier on the path).
    pub possible_open: Vec<String>,
    pub test_procedure: Option<TestProcedure>,
    pub assets: Vec<PackAsset>,
    pub record: RecordHow,
    pub detail: Vec<LevelText>,
    pub level: Level,
    /// Where this node leads in the pack; `None` when it names nothing the
    /// pack holds (then `reference` is the manual's printed reference, to
    /// show as "see … in the manual").
    pub target: Option<TargetView>,
    /// The printed cross-reference, verbatim, when the node has one.
    pub reference: Option<String>,
}

/// The facet whose texts are the open candidate causes
/// (`pack_meta.open_facet`, default `possible`).
pub fn open_facet(pack: &Pack) -> String {
    pack.meta("open_facet")
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("possible")
        .to_string()
}

/// The full citation of a section.
pub fn citation(pack: &Pack, section_id: &str) -> Result<Citation> {
    let sec = pack
        .section(section_id)?
        .ok_or_else(|| Error::Pack(format!("no section {section_id}")))?;
    let source = pack
        .sources()?
        .into_iter()
        .find(|s| s.source_id == sec.source_id)
        .ok_or_else(|| Error::Pack(format!("section {section_id}: no source {}", sec.source_id)))?;
    let mut path = Vec::new();
    for id in pack.section_lineage(section_id)?.into_iter().rev() {
        if let Some(s) = pack.section(&id)? {
            path.push(CitePart {
                section_id: s.section_id,
                citation: s.citation,
                heading: s.heading,
            });
        }
    }
    let loc = pack.section_loc_inherited(section_id)?;
    let page_asset_id = assets_for(pack, section_id)?
        .into_iter()
        .find(|a| a.role.as_deref() == Some("page"))
        .map(|a| a.asset_id);
    Ok(Citation {
        section_id: sec.section_id,
        citation: sec.citation,
        heading: sec.heading,
        source_id: source.source_id,
        source_title: source.title,
        publisher: source.publisher,
        edition: source.edition,
        path,
        page_label: loc.page_label,
        page_index: loc.page_index,
        figure_label: loc.figure_label,
        page_asset_id,
        boxes: loc.boxes,
    })
}

/// The warnings, cautions and notes guarding `section_ids` (or any of
/// their ancestors), for `equip`, in manual order, each once. No level
/// takes part: guards are shown at every level.
pub fn guards(pack: &Pack, section_ids: &[String], equip: Option<&str>) -> Result<Vec<Guard>> {
    guards_with(pack, section_ids, equip, &AttrValues::new())
}

/// [`guards`] for an asset's attribute `values` (a guard that does not
/// apply is dropped; one not determined is kept and flagged).
pub fn guards_with(
    pack: &Pack,
    section_ids: &[String],
    equip: Option<&str>,
    values: &AttrValues,
) -> Result<Vec<Guard>> {
    let mut targets: BTreeSet<String> = BTreeSet::new();
    for s in section_ids {
        targets.extend(pack.section_lineage(s)?);
    }
    guards_on_with(pack, &targets, equip, values)
}

/// The guards whose target is one of `targets` exactly.
fn guards_on_with(
    pack: &Pack,
    targets: &BTreeSet<String>,
    equip: Option<&str>,
    values: &super::applic::AttrValues,
) -> Result<Vec<Guard>> {
    let classes = pack.guard_classes()?;
    let mut seen = BTreeSet::new();
    let mut out: Vec<(i64, Guard)> = Vec::new();
    for t in targets {
        for x in pack.xrefs_to(t)? {
            if x.kind != "guards" || !seen.insert(x.from_id.clone()) {
                continue;
            }
            let Some(sec) = pack.section(&x.from_id)? else {
                return Err(Error::Pack(format!("guard {}: no such section", x.from_id)));
            };
            let Some(class) = classes.iter().find(|c| c.id == sec.kind) else {
                return Err(Error::Pack(format!(
                    "guard {}: a {} section; the pack's guard classes are {}",
                    sec.section_id,
                    sec.kind,
                    classes
                        .iter()
                        .map(|c| c.id.as_str())
                        .collect::<Vec<_>>()
                        .join(", ")
                )));
            };
            let applies_to = pack.section_applies_to(&sec.section_id)?;
            if !pack.applies(&applies_to, equip) {
                continue;
            }
            let applicability = pack.applicability("section", &sec.section_id, values)?;
            if !super::applic::Applicability::shown(&applicability) {
                continue;
            }
            out.push((
                sec.ord,
                Guard {
                    citation: citation(pack, &sec.section_id)?,
                    label: class.label.clone(),
                    rank: class.rank,
                    must_show: class.must_show,
                    tone: class.tone(),
                    applicability,
                    section_id: sec.section_id,
                    kind: sec.kind,
                    heading: sec.heading,
                    text: sec.text,
                    applies_to,
                },
            ));
        }
    }
    out.sort_by(|a, b| {
        a.0.cmp(&b.0)
            .then_with(|| a.1.section_id.cmp(&b.1.section_id))
    });
    Ok(out.into_iter().map(|(_, g)| g).collect())
}

/// Figures of a section and the page it is on (nearest page image up the
/// lineage).
pub fn assets_for(pack: &Pack, section_id: &str) -> Result<Vec<PackAsset>> {
    let mut out: Vec<PackAsset> = pack.section_assets(section_id)?;
    if !out.iter().any(|a| a.role.as_deref() == Some("page")) {
        for anc in pack.section_lineage(section_id)?.into_iter().skip(1) {
            let pages: Vec<PackAsset> = pack
                .section_assets(&anc)?
                .into_iter()
                .filter(|a| a.role.as_deref() == Some("page"))
                .collect();
            if !pages.is_empty() {
                out.extend(pages);
                break;
            }
        }
    }
    Ok(out)
}

fn task_step(
    pack: &Pack,
    s: &ProcStep,
    equip: Option<&str>,
    values: &AttrValues,
) -> Result<TaskStep> {
    let step_id = format!("{}#{}", s.proc_id, s.ord);
    let applies_to = pack.applies_to("proc_step", &step_id)?;
    let first = s.section_ids.first();
    let applicability =
        pack.applicability_with_section("proc_step", &step_id, first.map(String::as_str), values)?;
    Ok(TaskStep {
        ord: s.ord,
        text: s.text.clone(),
        check_kind: s.check_kind.clone(),
        section_ids: s.section_ids.clone(),
        citation: first.map(|f| citation(pack, f)).transpose()?,
        guards: guards_on_with(
            pack,
            &s.section_ids.iter().cloned().collect(),
            equip,
            values,
        )?,
        assets: match first {
            Some(f) => assets_for(pack, f)?,
            None => Vec::new(),
        },
        detail: s.detail.clone(),
        applies: pack.applies(&applies_to, equip) && Applicability::shown(&applicability),
        applies_to,
        applicability,
    })
}

/// A task with its steps, guards and requirements, for `equip` and the
/// asset's attribute `values`.
pub fn task_view(
    pack: &Pack,
    proc_id: &str,
    equip: Option<&str>,
    values: &AttrValues,
) -> Result<Option<TaskView>> {
    let Some(procedure) = pack.procedure(proc_id)? else {
        return Ok(None);
    };
    let rows = pack.proc_steps(proc_id)?;
    let applicability = pack.applicability("procedure", proc_id, values)?;
    // A step carries the procedure's statements with its own.
    let steps = rows
        .iter()
        .map(|s| {
            let mut st = task_step(pack, s, equip, values)?;
            if applicability.is_some() {
                st.applicability = Applicability::and(applicability.clone(), st.applicability);
                st.applies = st.applies && Applicability::shown(&st.applicability);
            }
            Ok(st)
        })
        .collect::<Result<Vec<_>>>()?;
    // What guards the task as a whole: everything above its steps.
    let own: BTreeSet<String> = rows.iter().flat_map(|s| s.section_ids.clone()).collect();
    let mut above: BTreeSet<String> = BTreeSet::new();
    for s in &own {
        above.extend(
            pack.section_lineage(s)?
                .into_iter()
                .filter(|a| !own.contains(a)),
        );
    }
    Ok(Some(TaskView {
        applicability,
        guards: guards_on_with(pack, &above, equip, values)?,
        requirements: pack.requirements_for("procedure", proc_id, equip)?,
        applies_to: pack.applies_to("procedure", proc_id)?,
        procedure,
        steps,
    }))
}

/// The view of `node_id` in `tree` at `level`, for `equip` and the asset's
/// attribute `values`. `path` lists the nodes already answered, oldest
/// first (for the open candidates).
pub fn node_view(
    pack: &Pack,
    tree: &Tree,
    node_id: &str,
    level: &Level,
    equip: Option<&str>,
    values: &AttrValues,
    path: &[String],
) -> Result<NodeView> {
    let node = tree
        .node(node_id)
        .ok_or_else(|| {
            Error::Invalid(format!("no node {node_id:?} in tree {}", tree.tree.tree_id))
        })?
        .clone();
    let edges = tree.edges_from(node_id);
    let branches = edges
        .iter()
        .map(|e| Branch {
            label: e.label.clone(),
            outcome: match &node.expect {
                // A labelled reading on a value node is chosen by outcome.
                Some(Expect::Value { .. }) if e.cond.is_none() => {
                    Some(super::branch::fold(&e.label))
                }
                Some(Expect::Value { .. }) | None => None,
                Some(Expect::Ack) => Some("done".into()),
                Some(_) => Some(super::branch::fold(&e.label)),
            },
            cond: e.cond.clone(),
            to_node: e.to_node.clone(),
            retry: e.retry,
        })
        .collect();
    let defs = pack.facet_defs()?;
    let mut groups: Vec<FacetGroup> = Vec::new();
    for f in tree.facets_of(node_id) {
        let applicability = pack.applicability("section", &f.section_id, values)?;
        if !Applicability::shown(&applicability) {
            continue;
        }
        match groups.iter_mut().find(|g| g.facet == f.facet) {
            Some(g) => g.texts.push(FacetText {
                text: f.text.clone(),
                section_id: f.section_id.clone(),
                applicability,
            }),
            None => groups.push(FacetGroup {
                facet: f.facet.clone(),
                label: defs
                    .iter()
                    .find(|d| d.id == f.facet)
                    .map(|d| d.label.clone()),
                expanded: level.shows_facet(&f.facet),
                texts: vec![FacetText {
                    text: f.text.clone(),
                    section_id: f.section_id.clone(),
                    applicability,
                }],
            }),
        }
    }
    // The pack's facet order, then any it does not name, by name.
    let rank = |f: &str| defs.iter().position(|d| d.id == f).unwrap_or(usize::MAX);
    groups.sort_by(|a, b| {
        rank(&a.facet)
            .cmp(&rank(&b.facet))
            .then(a.facet.cmp(&b.facet))
    });
    let open = open_facet(pack);
    let possible_open = std::iter::once(node_id.to_string())
        .chain(path.iter().rev().cloned())
        .find_map(|id| {
            // Only causes whose sections apply to the asset stay open.
            let texts: Vec<String> = tree
                .facets_of(&id)
                .into_iter()
                .filter(|f| f.facet == open)
                .filter(|f| {
                    pack.applicability("section", &f.section_id, values)
                        .map(|a| Applicability::shown(&a))
                        .unwrap_or(true)
                })
                .map(|f| f.text.clone())
                .collect();
            (!texts.is_empty()).then_some(texts)
        })
        .unwrap_or_default();
    let test_procedure = match &node.proc_id {
        Some(p) => {
            let task = task_view(pack, p, equip, values)?.ok_or_else(|| {
                Error::Pack(format!(
                    "node {node_id}: procedure {p} is missing or did not pass"
                ))
            })?;
            Some(TestProcedure {
                proc_id: task.procedure.proc_id,
                title: task.procedure.title,
                expanded: level.test_steps == Fold::Expanded,
                guards: task.guards,
                requirements: task.requirements,
                steps: task.steps,
                applicability: task.applicability,
            })
        }
        None => None,
    };
    let target = match &node.target {
        Some(t) => Some(TargetView {
            title: match t {
                Target::Tree { id, .. } => pack
                    .fault_trees(None)?
                    .into_iter()
                    .find(|x| &x.tree_id == id)
                    .map(|x| x.title),
                Target::Procedure { id } => pack.procedure(id)?.map(|p| p.title),
            },
            target: t.clone(),
        }),
        None => None,
    };
    let mut detail = Vec::new();
    let lang = tree.tree.lang.as_str();
    for l in pack.levels()? {
        if let Some(text) = pack.explanation(&node.section_id, &l.id, lang)? {
            detail.push(LevelText {
                level: l.id,
                label: l.label,
                text,
            });
        }
    }
    Ok(NodeView {
        pack_id: pack.pack_id().to_string(),
        pack_version: pack.version().to_string(),
        tree: TreeSummary {
            tree_id: tree.tree.tree_id.clone(),
            title: tree.tree.title.clone(),
            system: tree.tree.system.clone(),
            applies_to: tree.tree.applies_to.clone(),
            applicability: pack.applicability("fault_tree", &tree.tree.tree_id, values)?,
        },
        terminal: edges.is_empty(),
        applicability: pack.applicability_with_section(
            "fault_node",
            node_id,
            Some(&node.section_id),
            values,
        )?,
        citation: citation(pack, &node.section_id)?,
        guards: guards_with(pack, std::slice::from_ref(&node.section_id), equip, values)?,
        setup: pack.requirements_for("fault_tree", &tree.tree.tree_id, equip)?,
        requirements: pack.requirements_for("fault_node", node_id, equip)?,
        facets: groups,
        possible_open,
        test_procedure,
        assets: assets_for(pack, &node.section_id)?,
        record: RecordHow {
            expect: if edges.is_empty() {
                None
            } else {
                node.expect.clone()
            },
            branches,
        },
        detail,
        level: level.clone(),
        target,
        reference: node.reference.clone(),
        node,
    })
}
