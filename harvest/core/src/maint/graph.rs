//! Fault-tree validation: the rules a pack's trees must meet before a
//! technician walks them. The bake calls it (`harvest verify` reports it);
//! it reports every violation instead of stopping at the first.

use super::branch::{self, Expect, Interval, fold};
use super::search;
use super::{Cond, GUARD_KINDS, NodeKind, REQUIREMENT_KINDS, Target};
use crate::error::Result;
use crate::pack::Pack;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, HashMap};

/// One broken rule.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Violation {
    /// A stable rule code, e.g. `edge.coverage`.
    pub rule: String,
    pub tree_id: Option<String>,
    pub node_id: Option<String>,
    pub detail: String,
}

/// What was checked.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct GraphCounts {
    pub trees: u64,
    pub nodes: u64,
    pub edges: u64,
    pub facets: u64,
    pub symptoms: u64,
    pub signals: u64,
    pub guards: u64,
    pub requirements: u64,
    pub assets: u64,
}

/// The validation report.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct GraphReport {
    pub ok: bool,
    pub counts: GraphCounts,
    pub violations: Vec<Violation>,
}

struct Out {
    v: Vec<Violation>,
}

impl Out {
    fn add(
        &mut self,
        rule: &str,
        tree: Option<&str>,
        node: Option<&str>,
        detail: impl Into<String>,
    ) {
        self.v.push(Violation {
            rule: rule.into(),
            tree_id: tree.map(str::to_string),
            node_id: node.map(str::to_string),
            detail: detail.into(),
        });
    }
}

fn count(pack: &Pack, table: &str) -> Result<u64> {
    if !pack.has_table(table)? {
        return Ok(0);
    }
    let n: i64 = pack
        .conn()
        .query_row(&format!("SELECT count(*) FROM {table}"), [], |r| r.get(0))?;
    Ok(n as u64)
}

/// Validate every maintenance table the pack has.
pub fn validate(pack: &Pack) -> Result<GraphReport> {
    let mut out = Out { v: Vec::new() };
    let mut counts = GraphCounts::default();
    if let Err(e) = pack.levels() {
        out.add("pack.levels", None, None, e.to_string());
    }
    if let Err(e) = pack.facet_defs() {
        out.add("pack.facets", None, None, e.to_string());
    }
    let tree_ids: Vec<String> = if pack.has_fault_trees()? {
        let conn = pack.conn();
        let mut stmt = conn.prepare("SELECT tree_id FROM fault_tree ORDER BY tree_id")?;
        stmt.query_map([], |r| r.get(0))?
            .collect::<rusqlite::Result<_>>()?
    } else {
        Vec::new()
    };
    let procedures: BTreeSet<String> = pack
        .procedures()?
        .into_iter()
        .map(|p| p.procedure.proc_id)
        .collect();
    let all_trees: BTreeSet<String> = tree_ids.iter().cloned().collect();
    let mut node_tree: HashMap<String, String> = HashMap::new();
    // (tree, goto node, target tree, target node): checked once every tree is read.
    let mut goto_nodes: Vec<(String, String, String, String)> = Vec::new();
    for tree_id in &tree_ids {
        counts.trees += 1;
        validate_tree(
            pack,
            tree_id,
            &all_trees,
            &procedures,
            &mut out,
            &mut counts,
            &mut node_tree,
            &mut goto_nodes,
        )?;
    }
    for (tree, node, to_tree, to_node) in &goto_nodes {
        if all_trees.contains(to_tree) && node_tree.get(to_node) != Some(to_tree) {
            out.add(
                "node.target",
                Some(tree),
                Some(node),
                format!("node {to_node:?} is not in tree {to_tree:?}"),
            );
        }
    }
    if pack.has_fault_trees()? {
        let passed: BTreeSet<String> = pack
            .fault_trees(None)?
            .into_iter()
            .map(|t| t.tree_id)
            .collect();
        for t in &tree_ids {
            if !passed.contains(t) {
                out.add(
                    "tree.provenance",
                    Some(t),
                    None,
                    "the tree did not pass verification",
                );
            }
        }
    }
    validate_symptoms(pack, &all_trees, &mut out, &mut counts)?;
    validate_signals(pack, &node_tree, &all_trees, &mut out, &mut counts)?;
    validate_guards(pack, &mut out, &mut counts)?;
    validate_requirements(
        pack,
        &all_trees,
        &procedures,
        &node_tree,
        &mut out,
        &mut counts,
    )?;
    validate_assets(pack, &mut out, &mut counts)?;
    validate_locs(pack, &mut out)?;
    Ok(GraphReport {
        ok: out.v.is_empty(),
        counts,
        violations: out.v,
    })
}

#[allow(clippy::too_many_arguments)]
fn validate_tree(
    pack: &Pack,
    tree_id: &str,
    all_trees: &BTreeSet<String>,
    procedures: &BTreeSet<String>,
    out: &mut Out,
    counts: &mut GraphCounts,
    node_tree: &mut HashMap<String, String>,
    goto_nodes: &mut Vec<(String, String, String, String)>,
) -> Result<()> {
    let t = Some(tree_id);
    let entry: String = pack.conn().query_row(
        "SELECT entry_node FROM fault_tree WHERE tree_id = ?1",
        [tree_id],
        |r| r.get(0),
    )?;
    let raw = pack.tree_rows(tree_id)?;
    counts.nodes += raw.nodes.len() as u64;
    counts.edges += raw.edges.len() as u64;
    counts.facets += raw.facets.len() as u64;
    let ids: BTreeSet<&str> = raw.nodes.iter().map(|n| n.node_id.as_str()).collect();
    for n in &raw.nodes {
        node_tree.insert(n.node_id.clone(), tree_id.to_string());
    }
    if !ids.contains(entry.as_str()) {
        out.add(
            "tree.entry",
            t,
            Some(&entry),
            "the entry node is not a node of this tree",
        );
    }
    let mut edges_from: BTreeMap<&str, Vec<&super::RawEdge>> = BTreeMap::new();
    for e in &raw.edges {
        edges_from.entry(e.from_node.as_str()).or_default().push(e);
        if !ids.contains(e.to_node.as_str()) {
            out.add(
                "edge.target",
                t,
                Some(&e.from_node),
                format!(
                    "edge {} goes to {:?}, not a node of this tree (use a goto node to leave it)",
                    e.ord, e.to_node
                ),
            );
        }
    }
    for n in &raw.nodes {
        let node = Some(n.node_id.as_str());
        if !n.passed {
            out.add(
                "node.provenance",
                t,
                node,
                "the node did not pass verification",
            );
        }
        if let Err(m) = pack.verbatim(&n.text, &n.section_id) {
            out.add("node.verbatim", t, node, m);
        }
        let Some(kind) = NodeKind::parse(&n.kind) else {
            out.add("node.kind", t, node, format!("unknown kind {:?}", n.kind));
            continue;
        };
        let expect = match n
            .expect
            .as_deref()
            .filter(|e| !e.trim().is_empty() && e.trim() != "null")
            .map(serde_json::from_str::<Expect>)
            .transpose()
        {
            Ok(e) => e,
            Err(e) => {
                out.add("node.expect", t, node, format!("expect: {e}"));
                continue;
            }
        };
        let target = match n.target.as_deref().filter(|s| !s.trim().is_empty()) {
            None => None,
            Some(s) => match Target::parse(s) {
                Some(x) => Some(x),
                None => {
                    out.add(
                        "node.target",
                        t,
                        node,
                        format!("target {s:?}: tree:<id>, tree:<id>#<node_id> or procedure:<id>"),
                    );
                    None
                }
            },
        };
        match &target {
            Some(Target::Tree { id, .. }) if !all_trees.contains(id) => {
                out.add("node.target", t, node, format!("no tree {id:?}"))
            }
            Some(Target::Tree {
                id,
                node_id: Some(to),
            }) => goto_nodes.push((
                tree_id.to_string(),
                n.node_id.clone(),
                id.clone(),
                to.clone(),
            )),
            Some(Target::Procedure { id }) if !procedures.contains(id) => out.add(
                "node.target",
                t,
                node,
                format!("no procedure {id:?} (or it did not pass)"),
            ),
            _ => {}
        }
        if let Some(r) = &n.reference
            && let Err(m) = pack.verbatim(r, &n.section_id)
        {
            out.add("node.reference", t, node, m);
        }
        if kind == NodeKind::Goto && target.is_none() {
            out.add("node.target", t, node, "a goto names its target");
        }
        if let Some(p) = n.proc_id.as_deref().filter(|p| !p.trim().is_empty())
            && !procedures.contains(p)
        {
            out.add(
                "node.proc",
                t,
                node,
                format!("no procedure {p:?} (or it did not pass)"),
            );
        }
        let edges = edges_from
            .get(n.node_id.as_str())
            .cloned()
            .unwrap_or_default();
        if edges.is_empty() {
            if !kind.may_end() {
                out.add(
                    "node.dead_end",
                    t,
                    node,
                    format!("a {} node has no branches; a path ends only in action, escalate, goto or end", n.kind),
                );
            }
            if expect.is_some() {
                out.add(
                    "node.expect",
                    t,
                    node,
                    "a node with no branches records no result",
                );
            }
            continue;
        }
        if matches!(kind, NodeKind::Goto | NodeKind::Escalate | NodeKind::End) {
            out.add(
                "node.edges",
                t,
                node,
                format!("a {} node has no branches", n.kind),
            );
        }
        let Some(expect) = expect else {
            out.add(
                "node.expect",
                t,
                node,
                "a node with branches says how its result is recorded",
            );
            continue;
        };
        if kind == NodeKind::Check && expect == Expect::Ack {
            out.add(
                "node.expect",
                t,
                node,
                "a check records a result, not an acknowledgement",
            );
        }
        coverage(&expect, &edges, t, node, out);
    }
    let defs = pack.facet_defs().unwrap_or_default();
    let mut unlabelled: BTreeSet<&str> = BTreeSet::new();
    for f in &raw.facets {
        if !defs.iter().any(|d| d.id == f.facet) && unlabelled.insert(f.facet.as_str()) {
            out.add(
                "facet.label",
                t,
                Some(&f.node_id),
                format!("facet {:?} has no heading in pack_meta.facets", f.facet),
            );
        }
        if let Err(m) = pack.verbatim(&f.text, &f.section_id) {
            out.add(
                "facet.verbatim",
                t,
                Some(&f.node_id),
                format!("{} #{}: {m}", f.facet, f.ord),
            );
        }
        if !ids.contains(f.node_id.as_str()) {
            out.add(
                "facet.node",
                t,
                Some(&f.node_id),
                "facet of a node not in this tree",
            );
        }
    }
    // Reachability over every edge, from the entry.
    let mut seen: BTreeSet<&str> = BTreeSet::new();
    let mut stack = vec![entry.as_str()];
    while let Some(id) = stack.pop() {
        if !ids.contains(id) || !seen.insert(id) {
            continue;
        }
        for e in edges_from.get(id).into_iter().flatten() {
            stack.push(e.to_node.as_str());
        }
    }
    for id in &ids {
        if !seen.contains(id) {
            out.add(
                "node.unreachable",
                t,
                Some(id),
                "no path from the entry reaches this node",
            );
        }
    }
    // Cycles over non-retry edges.
    let mut color: HashMap<&str, u8> = HashMap::new();
    for start in &ids {
        if color.get(start).copied().unwrap_or(0) == 0 {
            dfs(start, &edges_from, &mut color, t, out);
        }
    }
    Ok(())
}

fn dfs<'a>(
    id: &'a str,
    edges_from: &BTreeMap<&'a str, Vec<&'a super::RawEdge>>,
    color: &mut HashMap<&'a str, u8>,
    t: Option<&str>,
    out: &mut Out,
) {
    color.insert(id, 1);
    for e in edges_from.get(id).into_iter().flatten() {
        if e.retry {
            continue;
        }
        match color.get(e.to_node.as_str()).copied().unwrap_or(0) {
            0 => dfs(e.to_node.as_str(), edges_from, color, t, out),
            1 => out.add(
                "tree.cycle",
                t,
                Some(id),
                format!(
                    "edge {} back to {} makes a loop; mark it a retry if the manual loops on purpose",
                    e.ord, e.to_node
                ),
            ),
            _ => {}
        }
    }
    color.insert(id, 2);
}

fn coverage(
    expect: &Expect,
    edges: &[&super::RawEdge],
    t: Option<&str>,
    node: Option<&str>,
    out: &mut Out,
) {
    let mut conds: Vec<(String, Option<Cond>)> = Vec::new();
    for e in edges {
        let c = match e
            .cond
            .as_deref()
            .filter(|c| !c.trim().is_empty() && c.trim() != "null")
            .map(serde_json::from_str::<Cond>)
            .transpose()
        {
            Ok(c) => c,
            Err(x) => {
                out.add("edge.cond", t, node, format!("edge {}: {x}", e.ord));
                return;
            }
        };
        conds.push((e.label.clone(), c));
    }
    match expect {
        Expect::Value {
            min, max, labels, ..
        } => {
            let named: Vec<String> = labels.iter().map(|l| fold(l)).collect();
            if named.iter().collect::<BTreeSet<_>>().len() != named.len() {
                out.add("node.expect", t, node, "repeated reading labels");
            }
            if named.iter().any(|l| l.is_empty()) {
                out.add("node.expect", t, node, "a reading label is blank");
            }
            let mut ivs: Vec<(String, Interval)> = Vec::new();
            let mut got: BTreeMap<String, usize> = BTreeMap::new();
            for (label, c) in &conds {
                match c.as_ref().map(Cond::interval) {
                    Some(Ok(i)) => ivs.push((label.clone(), i)),
                    Some(Err(m)) => out.add("edge.cond", t, node, format!("edge {label:?}: {m}")),
                    // A plain branch is a named reading.
                    None if named.contains(&fold(label)) => {
                        *got.entry(fold(label)).or_insert(0) += 1
                    }
                    None => out.add(
                        "edge.coverage",
                        t,
                        node,
                        format!(
                            "edge {label:?} of a measured value has no numeric condition and is not one of its reading labels"
                        ),
                    ),
                }
            }
            for w in &named {
                match got.get(w) {
                    None => out.add(
                        "edge.coverage",
                        t,
                        node,
                        format!("no branch for reading {w:?}"),
                    ),
                    Some(n) if *n > 1 => out.add(
                        "edge.coverage",
                        t,
                        node,
                        format!("{n} branches for reading {w:?}"),
                    ),
                    _ => {}
                }
            }
            // The numeric branches partition the range; labels are apart.
            for p in branch::partition_problems(&ivs, branch::domain(*min, *max)) {
                out.add("edge.coverage", t, node, p);
            }
        }
        Expect::Ack => {
            if conds.len() != 1 || conds[0].1.is_some() {
                out.add(
                    "edge.coverage",
                    t,
                    node,
                    "an acknowledged node has exactly one plain branch",
                );
            }
        }
        _ => {
            let want: BTreeSet<String> = expect.outcomes().into_iter().collect();
            if want.len() != expect.outcomes().len() {
                out.add("node.expect", t, node, "repeated choice options");
            }
            let mut got: BTreeMap<String, usize> = BTreeMap::new();
            for (label, c) in &conds {
                if c.is_some() {
                    out.add("edge.cond", t, node, format!("edge {label:?}: a categorical branch matches by its label, not a condition"));
                }
                *got.entry(fold(label)).or_insert(0) += 1;
            }
            for w in &want {
                match got.get(w) {
                    None => out.add("edge.coverage", t, node, format!("no branch for {w:?}")),
                    Some(n) if *n > 1 => {
                        out.add("edge.coverage", t, node, format!("{n} branches for {w:?}"))
                    }
                    _ => {}
                }
            }
            for g in got.keys() {
                if !want.contains(g) {
                    out.add(
                        "edge.coverage",
                        t,
                        node,
                        format!("branch {g:?} is not an outcome this node records"),
                    );
                }
            }
        }
    }
}

fn validate_symptoms(
    pack: &Pack,
    trees: &BTreeSet<String>,
    out: &mut Out,
    counts: &mut GraphCounts,
) -> Result<()> {
    if !pack.has_table("symptom")? {
        return Ok(());
    }
    let rows: Vec<(String, String, String)> = {
        let conn = pack.conn();
        let mut stmt =
            conn.prepare("SELECT symptom_id, tree_id, synonyms FROM symptom ORDER BY symptom_id")?;
        stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
            .collect::<rusqlite::Result<_>>()?
    };
    for (id, tree, syn) in rows {
        counts.symptoms += 1;
        if !trees.contains(&tree) {
            out.add(
                "symptom.tree",
                Some(&tree),
                None,
                format!("symptom {id}: no tree {tree:?}"),
            );
        }
        if serde_json::from_str::<Vec<String>>(&syn).is_err() {
            out.add(
                "symptom.synonyms",
                Some(&tree),
                None,
                format!("symptom {id}: synonyms is not a JSON array of strings"),
            );
        }
    }
    Ok(())
}

fn validate_signals(
    pack: &Pack,
    node_tree: &HashMap<String, String>,
    trees: &BTreeSet<String>,
    out: &mut Out,
    counts: &mut GraphCounts,
) -> Result<()> {
    for s in pack.signal_rules()? {
        counts.signals += 1;
        let what = format!("signal {} {}", s.signal_kind, s.pattern);
        match &s.tree_id {
            Some(tree) => {
                if !trees.contains(tree) {
                    out.add(
                        "signal.target",
                        Some(tree),
                        None,
                        format!("{what}: no tree"),
                    );
                }
                if let Some(n) = &s.node_id
                    && node_tree.get(n) != Some(tree)
                {
                    out.add(
                        "signal.target",
                        Some(tree),
                        Some(n),
                        format!("{what}: the node is not in that tree"),
                    );
                }
            }
            // A cause with no troubleshooting: the section is the answer.
            None => {
                let ok = match &s.section_id {
                    Some(sid) => pack.section_exists(sid)?,
                    None => false,
                };
                if !ok || s.node_id.is_some() {
                    out.add(
                        "signal.target",
                        None,
                        None,
                        format!(
                            "{what}: a rule with no tree cites an existing section and no node"
                        ),
                    );
                }
            }
        }
        if let Err(m) = search::pattern_matches(&s.pattern, "") {
            out.add(
                "signal.pattern",
                s.tree_id.as_deref(),
                None,
                format!("{what}: {m}"),
            );
        }
        if s.quote.is_some() && !s.quote_verified {
            out.add(
                "signal.quote",
                s.tree_id.as_deref(),
                None,
                format!("{what}: the quote is not verbatim in its section"),
            );
        }
    }
    Ok(())
}

fn validate_guards(pack: &Pack, out: &mut Out, counts: &mut GraphCounts) -> Result<()> {
    let rows: Vec<(String, String)> = {
        let conn = pack.conn();
        let mut stmt = conn.prepare(
            "SELECT from_id, to_id FROM xref WHERE kind = 'guards' ORDER BY from_id, to_id",
        )?;
        stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
            .collect::<rusqlite::Result<_>>()?
    };
    for (from, to) in rows {
        counts.guards += 1;
        match pack.section(&from)? {
            None => out.add(
                "guard.resolve",
                None,
                None,
                format!("guard {from}: no such section"),
            ),
            Some(s) if !GUARD_KINDS.contains(&s.kind.as_str()) => out.add(
                "guard.resolve",
                None,
                None,
                format!(
                    "guard {from}: a {} section; guards are warning, caution or note",
                    s.kind
                ),
            ),
            _ => {}
        }
        if !pack.section_exists(&to)? {
            out.add(
                "guard.resolve",
                None,
                None,
                format!("guard {from} → {to}: no such section"),
            );
        }
    }
    Ok(())
}

fn validate_requirements(
    pack: &Pack,
    trees: &BTreeSet<String>,
    procedures: &BTreeSet<String>,
    nodes: &HashMap<String, String>,
    out: &mut Out,
    counts: &mut GraphCounts,
) -> Result<()> {
    if !pack.has_table("requirement")? {
        return Ok(());
    }
    type R = (String, String, i64, String, String, Option<String>);
    let rows: Vec<R> = {
        let conn = pack.conn();
        let mut stmt = conn.prepare(
            "SELECT ref_kind, ref_id, ord, kind, text, section_id FROM requirement ORDER BY ref_kind, ref_id, ord",
        )?;
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
    for (ref_kind, ref_id, ord, kind, text, section) in rows {
        counts.requirements += 1;
        let what = format!("requirement {ref_kind}:{ref_id}#{ord}");
        let exists = match ref_kind.as_str() {
            "procedure" => procedures.contains(&ref_id),
            "fault_tree" => trees.contains(&ref_id),
            "fault_node" => nodes.contains_key(&ref_id),
            _ => {
                out.add(
                    "requirement.ref",
                    None,
                    None,
                    format!("{what}: unknown ref_kind"),
                );
                true
            }
        };
        if !exists {
            out.add(
                "requirement.ref",
                None,
                None,
                format!("{what}: no such {ref_kind}"),
            );
        }
        if !REQUIREMENT_KINDS.contains(&kind.as_str()) {
            out.add(
                "requirement.kind",
                None,
                None,
                format!("{what}: unknown kind {kind:?}"),
            );
        }
        match section {
            None => out.add(
                "requirement.verbatim",
                None,
                None,
                format!("{what}: cites no section, so its text cannot be checked"),
            ),
            Some(s) => {
                if let Err(m) = pack.verbatim(&text, &s) {
                    out.add("requirement.verbatim", None, None, format!("{what}: {m}"));
                }
            }
        }
    }
    Ok(())
}

fn validate_assets(pack: &Pack, out: &mut Out, counts: &mut GraphCounts) -> Result<()> {
    counts.assets = count(pack, "asset")?;
    if counts.assets == 0 {
        return Ok(());
    }
    let rows: Vec<(String, String, String)> = {
        let conn = pack.conn();
        let mut stmt =
            conn.prepare("SELECT asset_id, path, sha256 FROM asset ORDER BY asset_id")?;
        stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
            .collect::<rusqlite::Result<_>>()?
    };
    for (id, path, sha) in &rows {
        let signed = pack
            .manifest()
            .files
            .iter()
            .any(|f| &f.path == path && f.sha256.eq_ignore_ascii_case(sha));
        if !signed {
            out.add(
                "asset.signed",
                None,
                None,
                format!("asset {id}: {path} is not in the signed manifest with this SHA-256"),
            );
        }
    }
    if pack.has_table("section_asset")? {
        let links: Vec<(String, String, String)> = {
            let conn = pack.conn();
            let mut stmt = conn.prepare(
                "SELECT section_id, asset_id, role FROM section_asset ORDER BY section_id",
            )?;
            stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
                .collect::<rusqlite::Result<_>>()?
        };
        for (s, a, role) in links {
            if !rows.iter().any(|r| r.0 == a) {
                out.add(
                    "asset.ref",
                    None,
                    None,
                    format!("section {s}: no asset {a}"),
                );
            }
            if !pack.section_exists(&s)? {
                out.add(
                    "asset.ref",
                    None,
                    None,
                    format!("asset {a}: no section {s}"),
                );
            }
            if role != "figure" && role != "page" {
                out.add(
                    "asset.ref",
                    None,
                    None,
                    format!("asset {a}: role {role:?} is not figure or page"),
                );
            }
        }
    }
    Ok(())
}

fn validate_locs(pack: &Pack, out: &mut Out) -> Result<()> {
    if !pack.has_table("section_loc")? {
        return Ok(());
    }
    let ids: Vec<String> = {
        let conn = pack.conn();
        let mut stmt = conn.prepare("SELECT section_id FROM section_loc ORDER BY section_id")?;
        stmt.query_map([], |r| r.get(0))?
            .collect::<rusqlite::Result<_>>()?
    };
    for id in ids {
        if !pack.section_exists(&id)? {
            out.add(
                "loc.section",
                None,
                None,
                format!("section_loc {id}: no such section"),
            );
        }
        if let Err(e) = pack.section_loc(&id) {
            out.add("loc.box", None, None, e.to_string());
        }
    }
    Ok(())
}
