//! Maintenance content in a pack: validation, deterministic branching,
//! verbatim checks, variant filtering, levels, identification, signals.

mod common;

use harvest_core::fixture;
use harvest_core::fixture_maint;
use harvest_core::maint::branch::{self, RecordedResult};
use harvest_core::maint::graph::{self, GraphReport};
use harvest_core::maint::resolve::{self, Plate};
use harvest_core::maint::search::{self, Observation};
use harvest_core::maint::view;
use harvest_core::{Error, Pack};
use rusqlite::Connection;
use std::sync::Arc;

struct Built {
    _tmp: tempfile::TempDir,
    pack: Arc<Pack>,
}

fn pump() -> Built {
    pump_with(|_| Ok(()))
}

fn pump_with(edit: impl FnOnce(&Connection) -> harvest_core::Result<()>) -> Built {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("pump40");
    fixture_maint::build_with(&dir, "2026.3.1-1", edit).unwrap();
    let pack = Arc::new(Pack::open(&dir, &[fixture::trusted_key()]).unwrap());
    Built { _tmp: tmp, pack }
}

fn rules(r: &GraphReport) -> Vec<String> {
    r.violations.iter().map(|v| v.rule.clone()).collect()
}

fn exec(sql: &str) -> impl FnOnce(&Connection) -> harvest_core::Result<()> + '_ {
    move |c| {
        c.execute_batch(sql)?;
        Ok(())
    }
}

#[test]
fn fixture_validates_clean() {
    let b = pump();
    let r = graph::validate(&b.pack).unwrap();
    assert!(r.ok, "{:#?}", r.violations);
    assert_eq!(r.counts.trees, 2);
    assert_eq!(r.counts.nodes, fixture_maint::NODES.len() as u64);
    assert_eq!(r.counts.guards, fixture_maint::GUARDS.len() as u64);
    assert!(r.counts.requirements >= 10);
    assert_eq!(r.counts.assets, 2);
}

#[test]
fn crane_shaped_pack_has_no_trees_and_the_three_default_levels() {
    let b = common::pack();
    assert!(!b.pack.has_fault_trees().unwrap());
    assert!(b.pack.fault_trees(None).unwrap().is_empty());
    assert!(b.pack.symptoms(None).unwrap().is_empty());
    let ids: Vec<String> = b.pack.levels().unwrap().into_iter().map(|l| l.id).collect();
    assert_eq!(ids, ["trainee", "operator", "inspector"]);
    assert!(graph::validate(&b.pack).unwrap().ok);
}

fn tree(b: &Built, id: &str) -> harvest_core::maint::Tree {
    b.pack.fault_tree(id).unwrap().unwrap()
}

fn choose(
    t: &harvest_core::maint::Tree,
    node: &str,
    r: RecordedResult,
) -> harvest_core::Result<String> {
    let n = t.node(node).unwrap();
    let edges = t.edges_from(node);
    branch::choose(n, &edges, &r).map(|e| e.to_node.clone())
}

fn outcome(o: &str) -> RecordedResult {
    RecordedResult {
        outcome: Some(o.into()),
        ..Default::default()
    }
}

fn volts(v: f64, unit: &str) -> RecordedResult {
    RecordedResult {
        value: Some(v),
        unit: Some(unit.into()),
        ..Default::default()
    }
}

#[test]
fn branching_is_chosen_by_code_from_the_result() {
    let b = pump();
    let t = tree(&b, "t-nocrank");
    assert_eq!(choose(&t, "nc.1", outcome("yes")).unwrap(), "nc.2");
    assert_eq!(choose(&t, "nc.1", outcome(" NO ")).unwrap(), "nc.1a");
    assert_eq!(choose(&t, "nc.0", outcome("done")).unwrap(), "nc.1");
    assert_eq!(choose(&t, "nc.4", outcome("fail")).unwrap(), "nc.4f");
    // Measured value: below, the half-open middle band, and its bounds.
    assert_eq!(choose(&t, "nc.2", volts(11.2, "V")).unwrap(), "nc.2a");
    assert_eq!(choose(&t, "nc.2", volts(11.5, "V")).unwrap(), "nc.2b");
    assert_eq!(choose(&t, "nc.2", volts(12.49, "v")).unwrap(), "nc.2b");
    assert_eq!(choose(&t, "nc.2", volts(12.5, "V")).unwrap(), "nc.3");
    // The same result always takes the same branch.
    for _ in 0..5 {
        assert_eq!(choose(&t, "nc.2", volts(12.0, "V")).unwrap(), "nc.2b");
    }
    let hot = tree(&b, "t-hot");
    assert_eq!(choose(&hot, "oh.2", outcome("Loose")).unwrap(), "oh.2l");
    assert_eq!(choose(&hot, "oh.2", outcome("broken")).unwrap(), "oh.2b");
}

#[test]
fn a_result_that_does_not_fit_the_node_is_refused() {
    let b = pump();
    let t = tree(&b, "t-nocrank");
    let invalid = |r: harvest_core::Result<String>| matches!(r, Err(Error::Invalid(_)));
    assert!(invalid(choose(&t, "nc.1", outcome("maybe"))));
    assert!(invalid(choose(&t, "nc.1", outcome("pass"))));
    assert!(invalid(choose(&t, "nc.1", volts(1.0, "V"))));
    // No unit conversion: millivolts are refused, not guessed.
    assert!(invalid(choose(&t, "nc.2", volts(12000.0, "mV"))));
    assert!(invalid(choose(
        &t,
        "nc.2",
        RecordedResult {
            value: Some(12.0),
            ..Default::default()
        }
    )));
    assert!(invalid(choose(&t, "nc.2", outcome("yes"))));
    // Outside what the meter reads (0 to 30 V).
    assert!(invalid(choose(&t, "nc.2", volts(48.0, "V"))));
    assert!(invalid(choose(&t, "nc.2", volts(f64::NAN, "V"))));
    // A node where the path ends records nothing.
    assert!(invalid(choose(&t, "nc.4f", outcome("done"))));
}

#[test]
fn validation_reports_a_missing_branch() {
    let b = pump_with(exec(
        "DELETE FROM fault_edge WHERE from_node = 'nc.1' AND ord = 2;",
    ));
    let r = graph::validate(&b.pack).unwrap();
    assert!(!r.ok);
    assert!(r.violations.iter().any(|v| v.rule == "edge.coverage"
        && v.node_id.as_deref() == Some("nc.1")
        && v.detail.contains("\"no\"")));
    // nc.1a is now unreachable.
    assert!(
        r.violations
            .iter()
            .any(|v| v.rule == "node.unreachable" && v.node_id.as_deref() == Some("nc.1a"))
    );
}

#[test]
fn validation_reports_numeric_overlap_and_gap() {
    let overlap = pump_with(exec(
        r#"UPDATE fault_edge SET cond = '{"op":"<=","value":11.5}' WHERE from_node = 'nc.2' AND ord = 1;"#,
    ));
    let r = graph::validate(&overlap.pack).unwrap();
    assert!(
        r.violations
            .iter()
            .any(|v| v.rule == "edge.coverage" && v.detail.contains("overlaps")),
        "{:#?}",
        r.violations
    );
    let gap = pump_with(exec(
        r#"UPDATE fault_edge SET cond = '{"op":">","value":12.5}' WHERE from_node = 'nc.2' AND ord = 3;"#,
    ));
    let r = graph::validate(&gap.pack).unwrap();
    assert!(
        r.violations
            .iter()
            .any(|v| v.rule == "edge.coverage" && v.detail.contains("no edge takes")),
        "{:#?}",
        r.violations
    );
    let short = pump_with(exec(
        "DELETE FROM fault_edge WHERE from_node = 'nc.2' AND ord = 3;",
    ));
    let r = graph::validate(&short.pack).unwrap();
    assert!(
        r.violations
            .iter()
            .any(|v| v.rule == "edge.coverage" && v.detail.contains("above 12.5")),
        "{:#?}",
        r.violations
    );
    let uncond = pump_with(exec(
        "UPDATE fault_edge SET cond = NULL WHERE from_node = 'nc.2' AND ord = 2;",
    ));
    assert!(rules(&graph::validate(&uncond.pack).unwrap()).contains(&"edge.coverage".to_string()));
}

#[test]
fn validation_reports_a_loop_unless_it_is_a_retry() {
    let b = pump_with(exec(
        "UPDATE fault_edge SET retry = 0 WHERE from_node = 'nc.2b';",
    ));
    let r = graph::validate(&b.pack).unwrap();
    assert!(
        r.violations.iter().any(|v| v.rule == "tree.cycle"),
        "{:#?}",
        r.violations
    );
}

#[test]
fn validation_reports_dead_ends_bad_targets_and_dangling_edges() {
    let b = pump_with(exec(
        "DELETE FROM fault_edge WHERE from_node = 'nc.3';
         UPDATE fault_node SET expect = NULL WHERE node_id = 'nc.3';
         INSERT INTO fault_node VALUES ('nc.x', 't-nocrank', 'goto', 'The fault is corrected.', 'm40.3-1.end', NULL, NULL, NULL, 'en', 'prov-pump40', NULL);
         INSERT INTO fault_edge VALUES ('nc.4', 3, 'Maybe', NULL, 'nc.nowhere', 0);
         UPDATE fault_node SET target = 'tree:t-missing' WHERE node_id = 'nc.2a';
         UPDATE fault_node SET proc_id = 'proc-missing' WHERE node_id = 'nc.4';",
    ));
    let r = graph::validate(&b.pack).unwrap();
    let has = |rule: &str, node: &str| {
        r.violations
            .iter()
            .any(|v| v.rule == rule && v.node_id.as_deref() == Some(node))
    };
    assert!(has("node.dead_end", "nc.3"), "{:#?}", r.violations);
    assert!(has("node.target", "nc.x"), "goto without target");
    assert!(has("node.unreachable", "nc.x"));
    assert!(has("edge.target", "nc.4"));
    assert!(
        has("edge.coverage", "nc.4"),
        "a branch for an outcome the node does not record"
    );
    assert!(has("node.target", "nc.2a"));
    assert!(has("node.proc", "nc.4"));
}

#[test]
fn validation_reports_text_that_is_not_verbatim() {
    let b = pump_with(exec(
        "UPDATE fault_node SET text = 'Is the battery switch on and the fuse fine?' WHERE node_id = 'nc.1';
         UPDATE fault_facet SET text = 'A blown fuse is common.' WHERE node_id = 'nc.1' AND facet = 'reason';
         UPDATE requirement SET text = 'Digital voltmeter' WHERE ref_kind = 'fault_tree' AND ord = 2;
         UPDATE signal_map SET quote = 'Code E21: motor hot.' WHERE pattern = 'E21';",
    ));
    let r = graph::validate(&b.pack).unwrap();
    for rule in [
        "node.verbatim",
        "facet.verbatim",
        "requirement.verbatim",
        "signal.quote",
    ] {
        assert!(
            rules(&r).contains(&rule.to_string()),
            "{rule}: {:#?}",
            r.violations
        );
    }
}

#[test]
fn validation_reports_unresolved_guards_and_unsigned_assets() {
    let b = pump_with(exec(
        "INSERT INTO xref VALUES ('m40.3-1.setup', 'm40.3-1.q1', 'guards');
         INSERT INTO xref VALUES ('m40.3.w1', 'm40.no-such', 'guards');
         INSERT INTO asset VALUES ('fig-x', 'assets/missing.svg', 'abc', 'image/svg+xml', 1, NULL, NULL);",
    ));
    let r = graph::validate(&b.pack).unwrap();
    let guard: Vec<_> = r
        .violations
        .iter()
        .filter(|v| v.rule == "guard.resolve" || v.rule == "guard.class")
        .collect();
    assert_eq!(guard.len(), 2, "{:#?}", r.violations);
    assert!(
        rules(&r).contains(&"guard.class".to_string()),
        "a paragraph is no guard class"
    );
    assert!(rules(&r).contains(&"asset.signed".to_string()));
}

#[test]
fn a_tree_with_text_that_is_not_verbatim_is_refused_on_read() {
    let b = pump_with(exec(
        "UPDATE fault_node SET text = 'Check the relay.' WHERE node_id = 'nc.4';",
    ));
    assert!(matches!(
        b.pack.fault_tree("t-nocrank"),
        Err(Error::Pack(_))
    ));
    // The other tree still reads.
    assert!(b.pack.fault_tree("t-hot").unwrap().is_some());
    let facet = pump_with(exec(
        "UPDATE fault_facet SET text = 'Something else.' WHERE node_id = 'oh.1' AND facet = 'reason';",
    ));
    assert!(matches!(
        facet.pack.fault_tree("t-hot"),
        Err(Error::Pack(_))
    ));
}

#[test]
fn a_tree_with_an_unverified_node_is_refused() {
    let b = pump_with(exec(
        "INSERT INTO provenance VALUES ('prov-bad', 'human', 'none', 'x', '1', 'x', 'x', 'x', '2026-01-01', 'x', 'fail', NULL);
         UPDATE fault_node SET prov_id = 'prov-bad' WHERE node_id = 'oh.2t';",
    ));
    assert!(matches!(b.pack.fault_tree("t-hot"), Err(Error::Pack(_))));
    assert!(rules(&graph::validate(&b.pack).unwrap()).contains(&"node.provenance".to_string()));
}

#[test]
fn reads_are_filtered_to_the_variant() {
    let b = pump();
    let p = &b.pack;
    let trees = |e: Option<&str>| -> Vec<String> {
        p.fault_trees(e)
            .unwrap()
            .into_iter()
            .map(|t| t.tree_id)
            .collect()
    };
    assert_eq!(trees(Some("pump40-electric")), ["t-hot"]);
    assert_eq!(trees(Some("pump40-diesel")).len(), 2);
    // Only the model known: everything shows, labelled with applies_to.
    assert_eq!(trees(Some("pump40")).len(), 2);
    assert_eq!(trees(None).len(), 2);
    let syms: Vec<String> = p
        .symptoms(Some("pump40-electric"))
        .unwrap()
        .into_iter()
        .map(|s| s.symptom_id)
        .collect();
    assert_eq!(syms, ["s-hot"]);
    // Guards of the cooling tree: each variant sees its own warning.
    let hot = tree(&b, "t-hot");
    let level = p.level("expert").unwrap();
    let guards = |e: Option<&str>| -> Vec<String> {
        view::node_view(
            p,
            &hot,
            "oh.1",
            &level,
            e,
            &harvest_core::maint::applic::AttrValues::new(),
            &[],
        )
        .unwrap()
        .guards
        .into_iter()
        .map(|g| g.section_id)
        .collect()
    };
    assert_eq!(guards(Some("pump40-diesel")), ["m40.3.w1", "m40.3-2.w1"]);
    assert_eq!(guards(Some("pump40-electric")), ["m40.3.w1", "m40.3-2.w2"]);
    assert_eq!(guards(None), ["m40.3.w1", "m40.3-2.w1", "m40.3-2.w2"]);
    // Fleet history: a parent's event applies to its variants, a sibling's does not.
    let hist: Vec<String> = p
        .history_for(Some("pump40-electric"))
        .unwrap()
        .into_iter()
        .map(|h| h.event_id)
        .collect();
    assert!(
        hist.contains(&"h-strainer-2025".to_string())
            && hist.contains(&"h-winding-2025".to_string())
    );
    assert!(!hist.contains(&"h-relay-2026".to_string()));
    let modes: Vec<String> = p
        .failure_modes_for(Some("pump40-electric"))
        .unwrap()
        .into_iter()
        .map(|m| m.mode_id)
        .collect();
    assert_eq!(modes, ["fm-strainer"]);
    // Tasks: the battery task is diesel only.
    assert!(
        view::task_view(
            p,
            "proc-battery",
            Some("pump40-diesel"),
            &harvest_core::maint::applic::AttrValues::new()
        )
        .unwrap()
        .is_some()
    );
    assert!(!p.applies(
        &p.applies_to("procedure", "proc-battery").unwrap(),
        Some("pump40-electric")
    ));
    // Attributes inherit, nearest wins.
    let a = p.equip_attrs("pump40-electric").unwrap();
    assert_eq!(a["drive"], "7.5 kW motor");
    assert_eq!(a["rated_flow"], "400 L/min");
}

#[test]
fn guards_show_at_every_level_and_levels_only_fold_facets_and_steps() {
    let b = pump();
    let p = &b.pack;
    let t = tree(&b, "t-nocrank");
    let levels = p.levels().unwrap();
    assert_eq!(levels.len(), 3);
    let mut guard_sets = Vec::new();
    for l in &levels {
        let v = view::node_view(
            p,
            &t,
            "nc.2",
            l,
            Some("pump40-diesel"),
            &harvest_core::maint::applic::AttrValues::new(),
            &[],
        )
        .unwrap();
        let tp = v.test_procedure.as_ref().unwrap();
        let mut g: Vec<String> = v.guards.iter().map(|g| g.section_id.clone()).collect();
        g.extend(tp.guards.iter().map(|g| g.section_id.clone()));
        for s in &tp.steps {
            g.extend(s.guards.iter().map(|g| g.section_id.clone()));
        }
        guard_sets.push(g);
        let expanded: Vec<(String, bool)> = v
            .facets
            .iter()
            .map(|f| (f.facet.clone(), f.expanded))
            .collect();
        match l.id.as_str() {
            "apprentice" => {
                assert!(expanded.iter().all(|(_, e)| *e));
                assert!(tp.expanded);
            }
            "technician" => {
                assert!(expanded.contains(&("possible".into(), true)));
                assert!(expanded.contains(&("reason".into(), false)));
                assert!(!tp.expanded);
            }
            "expert" => {
                assert!(expanded.iter().all(|(_, e)| !*e));
                assert!(!tp.expanded);
            }
            other => panic!("level {other}"),
        }
        // Facets are always delivered, folded or not.
        assert_eq!(v.facets.len(), 4);
    }
    assert!(
        guard_sets.windows(2).all(|w| w[0] == w[1]),
        "{guard_sets:?}"
    );
    // The battery test: the task's warning once at its head, the caution
    // and the note before their own steps only.
    assert_eq!(
        guard_sets[0],
        ["m40.3.w1", "m40.4-2.w1", "m40.4-2.c1", "m40.4-2.n1"]
    );
    let tp = view::node_view(
        p,
        &t,
        "nc.2",
        &levels[0],
        None,
        &harvest_core::maint::applic::AttrValues::new(),
        &[],
    )
    .unwrap()
    .test_procedure
    .unwrap();
    assert_eq!(tp.guards.len(), 1);
    assert!(tp.steps[0].guards.is_empty());
    assert_eq!(tp.steps[1].guards[0].kind, "caution");
    assert_eq!(tp.steps[2].guards[0].kind, "note");
    // A level that tries to name a guard as a facet still cannot hide it.
    let b2 = pump_with(exec(
        r#"UPDATE pack_meta SET value = '[{"id":"x","label":"X","facets":["warning","caution","note"],"test_steps":"collapsed"}]' WHERE key = 'levels';"#,
    ));
    let t2 = tree(&b2, "t-nocrank");
    let v = view::node_view(
        &b2.pack,
        &t2,
        "nc.4",
        &b2.pack.level("x").unwrap(),
        None,
        &harvest_core::maint::applic::AttrValues::new(),
        &[],
    )
    .unwrap();
    let kinds: Vec<String> = v.guards.iter().map(|g| g.kind.clone()).collect();
    assert_eq!(kinds, ["warning", "caution"]);
}

#[test]
fn a_step_view_carries_the_citation_requirements_assets_and_open_causes() {
    let b = pump();
    let p = &b.pack;
    let t = tree(&b, "t-nocrank");
    let lvl = p.level("apprentice").unwrap();
    let v = view::node_view(
        p,
        &t,
        "nc.2",
        &lvl,
        Some("pump40-diesel"),
        &harvest_core::maint::applic::AttrValues::new(),
        &["nc.0".into(), "nc.1".into()],
    )
    .unwrap();
    assert_eq!(
        v.citation.source_title,
        "Model 40 Utility Pump Field Maintenance Manual"
    );
    assert_eq!(v.citation.edition, "Revision C, 2026-03-01");
    assert_eq!(v.citation.page_label.as_deref(), Some("3-2"));
    let path: Vec<&str> = v
        .citation
        .path
        .iter()
        .map(|c| c.section_id.as_str())
        .collect();
    assert_eq!(path, ["m40.3", "m40.3-1", "m40.3-1.q2"]);
    assert_eq!(v.setup.len(), 5);
    assert!(v.setup.iter().all(|r| r.verbatim));
    assert_eq!(v.record.branches.len(), 3);
    assert_eq!(
        v.possible_open,
        [
            "Battery discharged.",
            "Starter relay K1 failed.",
            "Starter motor failed."
        ]
    );
    assert_eq!(v.detail.len(), 2);
    // The tree's page image comes up from the tree section.
    assert!(
        v.assets
            .iter()
            .any(|a| a.asset_id == "page-3-2" && a.role.as_deref() == Some("page"))
    );
    // An end node with no facets of its own keeps the last open causes.
    let end = view::node_view(
        p,
        &t,
        "nc.4f",
        &lvl,
        None,
        &harvest_core::maint::applic::AttrValues::new(),
        &[
            "nc.0".into(),
            "nc.1".into(),
            "nc.2".into(),
            "nc.3".into(),
            "nc.4".into(),
        ],
    )
    .unwrap();
    assert!(end.terminal);
    assert!(end.record.expect.is_none());
    assert_eq!(
        end.possible_open,
        ["Starter relay K1 failed.", "Starter motor failed."]
    );
    let goto = view::node_view(
        p,
        &t,
        "nc.2a",
        &lvl,
        None,
        &harvest_core::maint::applic::AttrValues::new(),
        &[],
    )
    .unwrap();
    assert_eq!(
        goto.target.unwrap().title.as_deref(),
        Some("Battery replacement (task 4-3)")
    );
    // A figure section carries its figure label and crop.
    let fig = view::citation(p, "m40.3-1.f1").unwrap();
    assert_eq!(fig.figure_label.as_deref(), Some("Figure 3-1"));
    let (asset, file) = p.asset_file("fig-3-1").unwrap().unwrap();
    assert_eq!(asset.media_type, "image/svg+xml");
    assert!(file.is_file());
}

#[test]
fn a_task_lists_tools_and_parts() {
    let b = pump();
    let t = view::task_view(
        &b.pack,
        "proc-battery",
        Some("pump40-diesel"),
        &harvest_core::maint::applic::AttrValues::new(),
    )
    .unwrap()
    .unwrap();
    let kinds: Vec<&str> = t.requirements.iter().map(|r| r.kind.as_str()).collect();
    assert_eq!(kinds, ["tool", "tool", "part", "consumable", "personnel"]);
    let part = &t.requirements[2];
    assert_eq!(part.ident.as_deref(), Some("P40-118"));
    assert_eq!(part.qty.as_deref(), Some("1"));
    assert!(t.requirements.iter().all(|r| r.verbatim));
    assert_eq!(t.steps.len(), 5);
    assert_eq!(t.steps[1].guards[0].kind, "caution");
    assert_eq!(t.steps[2].guards[0].kind, "warning");
}

#[test]
fn identification_picks_the_most_specific_variant() {
    let b = pump();
    let r = |plate: Plate| resolve::resolve(&b.pack, &plate).unwrap();
    let d = r(Plate {
        serial: Some("P40D-2310".into()),
        ..Default::default()
    });
    assert_eq!(d.equip_id.as_deref(), Some("pump40-diesel"));
    assert_eq!(d.attrs["drive"], "2-cylinder diesel engine");
    let e = r(Plate {
        model: Some("p40 e".into()),
        firmware: Some("MC-2.4.1".into()),
        ..Default::default()
    });
    assert_eq!(e.equip_id.as_deref(), Some("pump40-electric"));
    assert_eq!(e.candidates[0].matched.len(), 2);
    // Text only: the model, not a variant.
    let m = r(Plate {
        text: Some("MODEL 40 UTILITY PUMP".into()),
        ..Default::default()
    });
    assert_eq!(m.equip_id.as_deref(), Some("pump40"));
    // A diesel serial with an electric model number: the diesel is
    // contradicted by its own model rule, the electric by its serial rule.
    let c = r(Plate {
        model: Some("P40-E".into()),
        serial: Some("P40D-2310".into()),
        ..Default::default()
    });
    assert!(c.candidates.is_empty(), "{c:#?}");
    assert_eq!(c.rejected.len(), 2);
    assert_eq!(c.equip_id, None);
    // A firmware that is not the electric's rejects it.
    let f = r(Plate {
        model: Some("P40-E".into()),
        firmware: Some("MC-1.9".into()),
        ..Default::default()
    });
    assert_eq!(f.equip_id, None);
    assert_eq!(f.rejected[0].contradicted[0].kind, "firmware");
    assert_eq!(r(Plate::default()).equip_id, None);
}

fn obs(kind: &str, value: &str) -> Observation {
    Observation {
        signal_kind: Some(kind.into()),
        value: value.into(),
    }
}

#[test]
fn signals_lead_to_an_entry_point() {
    let b = pump();
    let m = search::signal_match(&b.pack, &[obs("j1939.dm1", "SPN:110/FMI:0")], None).unwrap();
    // The exact rule ranks before the glob.
    assert_eq!(m.hits.len(), 2);
    assert_eq!(m.hits[0].matched, search::MatchKind::Exact);
    assert!(m.hits[0].rule.quote_verified);
    assert_eq!(m.suggested.as_ref().unwrap().node_id, "oh.0");
    let e = search::signal_match(&b.pack, &[obs("pump40.code", "e21")], None).unwrap();
    assert_eq!(e.suggested.unwrap().node_id, "oh.1");
    let g = search::signal_match(&b.pack, &[obs("j1939.dm1", "spn:110/fmi:16")], None).unwrap();
    assert_eq!(
        g.suggested.unwrap(),
        search::EntryPoint {
            tree_id: "t-hot".into(),
            node_id: "oh.0".into(),
            applicability: None,
        }
    );
    let none = search::signal_match(&b.pack, &[obs("obd2.dtc", "P0300")], None).unwrap();
    assert!(none.suggested.is_none());
    assert_eq!(none.unmatched.len(), 1);
    // Battery voltage low leads into the diesel tree, which an electric unit does not have.
    let batt = [obs("j1939.dm1", "spn:168/fmi:1")];
    assert_eq!(
        search::signal_match(&b.pack, &batt, Some("pump40-diesel"))
            .unwrap()
            .suggested
            .unwrap()
            .node_id,
        "nc.2"
    );
    assert!(
        search::signal_match(&b.pack, &batt, Some("pump40-electric"))
            .unwrap()
            .suggested
            .is_none()
    );
    let both = search::signal_match(
        &b.pack,
        &[batt[0].clone(), obs("pump40.code", "E21")],
        Some("pump40-diesel"),
    )
    .unwrap();
    assert!(both.ambiguous);
}

#[test]
fn symptom_search_ranks_and_says_why() {
    let b = pump();
    let (hits, dense) =
        search::symptom_search(&b.pack, Some("it keeps running hot"), &[], None, None, 5).unwrap();
    assert!(!dense);
    assert_eq!(hits[0].symptom.symptom_id, "s-hot");
    assert!(
        matches!(&hits[0].why[0], search::Why::Words { phrase, .. } if phrase == "running hot")
    );
    let (hits, _) = search::symptom_search(
        &b.pack,
        Some("starter does nothing"),
        &[],
        Some("pump40-electric"),
        None,
        5,
    )
    .unwrap();
    assert!(
        hits.iter().all(|h| h.symptom.symptom_id != "s-nocrank"),
        "diesel-only symptom filtered out"
    );
    let (hits, _) =
        search::symptom_search(&b.pack, None, &[obs("pump40.code", "E21")], None, None, 5).unwrap();
    assert_eq!(hits[0].symptom.symptom_id, "s-hot");
    assert!(matches!(&hits[0].why[0], search::Why::Signal { .. }));
    let e = harvest_core::HashingEmbedder::new(fixture::EMBED_DIM);
    let (hits, dense) = search::symptom_search(
        &b.pack,
        Some("engine will not crank"),
        &[],
        None,
        Some(&e),
        5,
    )
    .unwrap();
    assert!(dense);
    assert_eq!(hits[0].symptom.symptom_id, "s-nocrank");
    assert!(
        hits[0]
            .why
            .iter()
            .any(|w| matches!(w, search::Why::Dense { .. }))
    );
    let (none, _) =
        search::symptom_search(&b.pack, Some("paint is peeling"), &[], None, None, 5).unwrap();
    assert!(none.is_empty());
}

#[test]
fn the_maint_schema_in_code_matches_contract() {
    let contract =
        std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/../CONTRACT.md")).unwrap();
    let start = contract
        .find("-- Maintenance tables (optional")
        .expect("maintenance DDL in CONTRACT");
    let block = &contract[start..];
    let end = block.find("```").unwrap();
    assert_eq!(
        block[..end].trim(),
        harvest_core::maint::SCHEMA_MAINT.trim()
    );
}

#[test]
fn a_citation_points_at_the_passage_on_its_page() {
    let b = pump();
    let c = view::citation(&b.pack, "m40.3-1.q1").unwrap();
    assert_eq!(c.page_asset_id.as_deref(), Some("page-3-2"));
    assert_eq!(c.boxes.len(), 2);
    assert!(c.boxes.iter().all(|x| x.valid()));
    // A passage without boxes of its own takes none from elsewhere when it has its own page.
    let s = view::citation(&b.pack, "m40.3-1.q3").unwrap();
    assert!(s.boxes.is_empty());
    let bad = pump_with(exec(
        r#"UPDATE section_loc SET boxes = '[{"x0":0.5,"y0":0.2,"x1":0.4,"y1":1.2}]' WHERE section_id = 'm40.3-1.q2';"#,
    ));
    assert!(matches!(
        view::citation(&bad.pack, "m40.3-1.q2"),
        Err(Error::Pack(_))
    ));
    assert!(rules(&graph::validate(&bad.pack).unwrap()).contains(&"loc.box".to_string()));
    // A pack baked before the column reads as before.
    let old = pump_with(exec("ALTER TABLE section_loc DROP COLUMN boxes;"));
    let c = view::citation(&old.pack, "m40.3-1.q2").unwrap();
    assert!(c.boxes.is_empty());
    assert_eq!(c.page_label.as_deref(), Some("3-2"));
}

#[test]
fn facets_carry_the_manuals_headings_in_its_order() {
    let b = pump();
    let t = tree(&b, "t-nocrank");
    let v = view::node_view(
        &b.pack,
        &t,
        "nc.1",
        &b.pack.level("apprentice").unwrap(),
        None,
        &harvest_core::maint::applic::AttrValues::new(),
        &[],
    )
    .unwrap();
    let got: Vec<(String, Option<String>)> = v
        .facets
        .iter()
        .map(|f| (f.facet.clone(), f.label.clone()))
        .collect();
    assert_eq!(
        got,
        [
            ("test_option".to_string(), Some("Test options".to_string())),
            ("reason".into(), Some("Reason for question".into())),
            ("known".into(), Some("Known info".into())),
            ("possible".into(), Some("Possible problems".into())),
        ]
    );
    let nolabel = pump_with(exec("DELETE FROM pack_meta WHERE key = 'facets';"));
    assert!(rules(&graph::validate(&nolabel.pack).unwrap()).contains(&"facet.label".to_string()));
}

#[test]
fn symptom_matches_say_how_sure_they_are() {
    let b = pump();
    let e = harvest_core::HashingEmbedder::new(fixture::EMBED_DIM);
    let conf = |text: &str, emb: Option<&dyn harvest_core::Embedder>| {
        search::symptom_search(&b.pack, Some(text), &[], Some("pump40-diesel"), emb, 5)
            .unwrap()
            .0
            .first()
            .map(|h| (h.symptom.symptom_id.clone(), h.confidence))
    };
    for emb in [None, Some(&e as &dyn harvest_core::Embedder)] {
        assert_eq!(
            conf("starter does nothing", emb),
            Some(("s-nocrank".into(), search::Confidence::Confident))
        );
        assert_eq!(
            conf("it keeps running hot", emb),
            Some(("s-hot".into(), search::Confidence::Confident))
        );
        // Not in the manual: never confident; "runs" alone matches nothing.
        let r = conf("runs but the pressure is low", emb);
        assert!(
            r.as_ref()
                .is_none_or(|(_, c)| *c != search::Confidence::Confident),
            "{r:?}"
        );
        let r = conf("it runs", emb);
        assert!(r.is_none_or(|(_, c)| c != search::Confidence::Confident));
    }
    // A signal makes a match confident.
    let (hits, _) =
        search::symptom_search(&b.pack, None, &[obs("pump40.code", "E21")], None, None, 5).unwrap();
    assert_eq!(hits[0].confidence, search::Confidence::Confident);
    // One meaningful word of four (below 0.30): closest.
    let (hits, _) = search::symptom_search(
        &b.pack,
        Some("engine smoke, knocking and rattling"),
        &[],
        None,
        None,
        5,
    )
    .unwrap();
    assert_eq!(hits[0].confidence, search::Confidence::Closest);
    // A pack can raise the bar.
    let strict = pump_with(exec(
        "INSERT INTO pack_meta VALUES ('symptom_confident_coverage_lexical', '1.01');",
    ));
    let (hits, _) = search::symptom_search(
        &strict.pack,
        Some("starter does nothing"),
        &[],
        None,
        None,
        5,
    )
    .unwrap();
    assert_eq!(hits[0].confidence, search::Confidence::Closest);
}

#[test]
fn a_goto_can_enter_another_tree_at_a_named_node() {
    let b = pump();
    let t = tree(&b, "t-nocrank");
    let g = t.node("nc.1g").unwrap();
    assert_eq!(
        g.target,
        Some(harvest_core::maint::Target::Tree {
            id: "t-hot".into(),
            node_id: Some("oh.1".into())
        })
    );
    let lvl = b.pack.level("expert").unwrap();
    let v = view::node_view(
        &b.pack,
        &t,
        "nc.1g",
        &lvl,
        None,
        &harvest_core::maint::applic::AttrValues::new(),
        &[],
    )
    .unwrap();
    assert_eq!(v.target.unwrap().title.as_deref(), Some("Pump overheats"));
    // The node must exist in that tree.
    let bad = pump_with(exec(
        "UPDATE fault_node SET target = 'tree:t-hot#nc.2' WHERE node_id = 'nc.1g';",
    ));
    let r = graph::validate(&bad.pack).unwrap();
    assert!(
        r.violations
            .iter()
            .any(|v| v.rule == "node.target" && v.detail.contains("not in tree")),
        "{:#?}",
        r.violations
    );
    let malformed = pump_with(exec(
        "UPDATE fault_node SET target = 'tree:t-hot#' WHERE node_id = 'nc.1g';",
    ));
    assert!(rules(&graph::validate(&malformed.pack).unwrap()).contains(&"node.target".to_string()));
}

#[test]
fn a_printed_reference_with_no_target_is_kept_and_marked() {
    let b = pump();
    let t = tree(&b, "t-nocrank");
    let lvl = b.pack.level("expert").unwrap();
    let v = view::node_view(
        &b.pack,
        &t,
        "nc.3n",
        &lvl,
        None,
        &harvest_core::maint::applic::AttrValues::new(),
        &[],
    )
    .unwrap();
    assert!(v.target.is_none());
    assert_eq!(
        v.reference.as_deref(),
        Some("Refer to field maintenance for wiring repair.")
    );
    let resolved = view::node_view(
        &b.pack,
        &t,
        "nc.2a",
        &lvl,
        None,
        &harvest_core::maint::applic::AttrValues::new(),
        &[],
    )
    .unwrap();
    assert!(resolved.target.is_some() && resolved.reference.is_some());
    let bad = pump_with(exec(
        "UPDATE fault_node SET reference = 'See the depot manual.' WHERE node_id = 'nc.3n';",
    ));
    assert!(rules(&graph::validate(&bad.pack).unwrap()).contains(&"node.reference".to_string()));
    // A pack baked before the column reads as before.
    let old = pump_with(exec("ALTER TABLE fault_node DROP COLUMN reference;"));
    assert!(
        old.pack
            .fault_tree("t-nocrank")
            .unwrap()
            .unwrap()
            .node("nc.3n")
            .unwrap()
            .reference
            .is_none()
    );
}

#[test]
fn page_index_is_the_physical_page() {
    let b = pump();
    assert_eq!(b.pack.section_loc("m40.1").unwrap().page_index, Some(1));
    assert_eq!(
        b.pack.section_loc("m40.3-1.q2").unwrap().page_index,
        Some(3)
    );
    assert_eq!(
        b.pack.section_loc("m40.4-3.s5").unwrap().page_index,
        Some(10)
    );
}

#[test]
fn a_signal_can_lead_to_a_section_with_no_tree() {
    let b = pump();
    let m = search::signal_match(&b.pack, &[obs("pump40.code", "E40")], None).unwrap();
    assert_eq!(m.hits.len(), 1);
    let h = &m.hits[0];
    assert!(!h.has_tree && h.rule.tree_id.is_none());
    let sec = h.section.as_ref().unwrap();
    assert_eq!(sec.section_id, "m40.3-2.codes");
    assert!(
        sec.text
            .contains("Code E40: suction pressure below the warning limit.")
    );
    assert!(m.suggested.is_none(), "no tree to enter");
    assert!(graph::validate(&b.pack).unwrap().ok);
    // With a tree-hit alongside, the tree is suggested.
    let both = search::signal_match(
        &b.pack,
        &[obs("pump40.code", "E40"), obs("pump40.code", "E21")],
        None,
    )
    .unwrap();
    assert_eq!(both.suggested.unwrap().node_id, "oh.1");
    assert!(!both.ambiguous);
    let bad = pump_with(exec(
        "UPDATE signal_map SET section_id = NULL WHERE pattern = 'E40';",
    ));
    assert!(rules(&graph::validate(&bad.pack).unwrap()).contains(&"signal.target".to_string()));
}

#[test]
fn an_unmatched_status_text_gets_closest_entries_never_a_match() {
    // The vehicle adds a tag and an instance number the table does not print.
    let b = pump_with(exec(
        "INSERT INTO signal_map VALUES ('mavlink.statustext', 'Battery below minimum arming voltage', 'Battery below minimum arming voltage', NULL, NULL, 'm40.3-2.codes', NULL, 'prov-pump40', NULL);
         INSERT INTO symptom VALUES ('s-arm', 't-nocrank', 'Battery below minimum arming voltage', 'starting', '[]', 'en', 'prov-pump40');",
    ));
    assert_eq!(
        search::closest_query("PreArm: Battery 1 below minimum arming voltage").as_deref(),
        Some("Battery below minimum arming voltage")
    );
    assert_eq!(search::closest_query("E40"), None, "a code is not text");
    assert_eq!(search::closest_query("12.5 V"), None);
    let o = obs(
        "mavlink.statustext",
        "PreArm: Battery 1 below minimum arming voltage",
    );
    let m = search::signal_match(&b.pack, std::slice::from_ref(&o), None).unwrap();
    assert!(
        m.hits.is_empty() && m.suggested.is_none(),
        "never a match or a start"
    );
    assert_eq!(m.unmatched, vec![o.clone()]);
    let c = &m.closest[0];
    assert_eq!(c.symptoms[0].symptom.symptom_id, "s-arm");
    assert_eq!(c.symptoms[0].confidence, search::Confidence::Confident);
    assert_eq!(
        c.signals[0].rule.pattern,
        "Battery below minimum arming voltage"
    );
    assert_eq!(c.signals[0].confidence, search::Confidence::Confident);
    assert!(!c.signals[0].has_tree);
    assert_eq!(
        c.signals[0].section.as_ref().unwrap().section_id,
        "m40.3-2.codes"
    );
    // Deterministic.
    assert_eq!(search::signal_match(&b.pack, &[o], None).unwrap(), m);
    // One shared word is only "closest".
    let weak = search::signal_match(
        &b.pack,
        &[obs(
            "mavlink.statustext",
            "PreArm: Compass2 voltage odd reading",
        )],
        None,
    )
    .unwrap();
    assert!(
        weak.closest[0]
            .signals
            .iter()
            .all(|s| s.confidence == search::Confidence::Closest)
    );
}

#[test]
fn a_pack_sets_its_ranking_in_pack_meta() {
    let d = search::Ranking::for_pack(&pump().pack).unwrap();
    assert_eq!(d, search::Ranking::default());
    assert_eq!(
        (
            d.lexical_weight,
            d.margin,
            d.coverage,
            d.strong_hits,
            d.dense_alone
        ),
        (0.10, 0.05, 0.30, 1, 0.80)
    );
    assert_eq!(
        (d.margin_lexical, d.coverage_lexical, d.strong_hits_lexical),
        (0.15, 0.30, 1)
    );
    let b = pump_with(exec(
        "INSERT INTO pack_meta VALUES ('symptom_fusion', 'rrf');
         INSERT INTO pack_meta VALUES ('symptom_fusion_lexical_weight', '0.7');
         INSERT INTO pack_meta VALUES ('symptom_confident_margin', '0.05');
         INSERT INTO pack_meta VALUES ('symptom_confident_strong_hits', '2');
         INSERT INTO pack_meta VALUES ('symptom_confident_margin_lexical', '0.2');
         INSERT INTO pack_meta VALUES ('symptom_weak_words_add', '[\"pump\"]');",
    ));
    let r = search::Ranking::for_pack(&b.pack).unwrap();
    assert_eq!(r.fusion, search::Fusion::Rrf);
    assert_eq!(
        (r.lexical_weight, r.margin, r.strong_hits, r.margin_lexical),
        (0.7, 0.05, 2, 0.2)
    );
    assert_eq!(r.coverage, search::CONFIDENT_COVERAGE);
    assert!(
        r.weak_words.contains(&"run".to_string()) && r.weak_words.contains(&"pump".to_string())
    );
    let bad = pump_with(exec(
        "INSERT INTO pack_meta VALUES ('symptom_fusion', 'max');",
    ));
    assert!(search::Ranking::for_pack(&bad.pack).is_err());
    let w = pump_with(exec(
        "INSERT INTO pack_meta VALUES ('symptom_fusion_lexical_weight', '1.5');",
    ));
    assert!(search::Ranking::for_pack(&w.pack).is_err());
}

#[test]
fn the_confidence_rule_is_pinned_on_constructed_inputs() {
    use search::Confidence::{Closest, Confident};
    let r = search::Ranking::default();
    // rate(dense_active, signal, coverage, strong_hits, cosine, margin)
    // A signal: always confident, whatever else.
    assert_eq!(r.rate(true, true, 0.0, 0, Some(0.1), Some(-1.0)), Confident);
    assert_eq!(r.rate(false, true, 0.0, 0, None, Some(-1.0)), Confident);
    // Dense active, words branch: margin 0.05, coverage 0.30, one strong hit.
    assert_eq!(
        r.rate(true, false, 0.30, 1, Some(0.2), Some(0.05)),
        Confident
    );
    assert_eq!(
        r.rate(true, false, 0.29, 1, Some(0.2), Some(0.5)),
        Closest,
        "coverage"
    );
    assert_eq!(
        r.rate(true, false, 0.50, 0, Some(0.2), Some(0.5)),
        Closest,
        "strong hits"
    );
    assert_eq!(
        r.rate(true, false, 1.0, 3, Some(0.9), Some(0.049)),
        Closest,
        "margin"
    );
    // Dense active, meaning branch: cosine 0.80 with no word at all.
    assert_eq!(
        r.rate(true, false, 0.0, 0, Some(0.80), Some(0.05)),
        Confident
    );
    assert_eq!(r.rate(true, false, 0.0, 0, Some(0.799), Some(0.5)), Closest);
    // A single hit satisfies the margin.
    assert_eq!(r.rate(true, false, 0.0, 0, Some(0.81), None), Confident);
    assert_eq!(r.rate(false, false, 0.3, 1, None, None), Confident);
    // Dense off: coverage 0.30, one strong hit, margin 0.15; cosine ignored.
    assert_eq!(r.rate(false, false, 0.30, 1, None, Some(0.15)), Confident);
    assert_eq!(r.rate(false, false, 0.29, 1, None, Some(0.9)), Closest);
    assert_eq!(r.rate(false, false, 0.9, 1, None, Some(0.149)), Closest);
    assert_eq!(r.rate(false, false, 0.9, 0, None, Some(0.9)), Closest);
    assert_eq!(r.rate(false, false, 0.0, 0, Some(0.99), None), Closest);
}

#[test]
fn a_value_node_takes_closed_ranges_and_named_readings() {
    let b = pump_with(exec(
        r#"UPDATE fault_node SET expect = '{"kind":"value","unit":"V","min":0,"max":30,"labels":["No indication"]}' WHERE node_id = 'nc.2';
           UPDATE fault_edge SET label = 'Less than 11.5', cond = '{"op":"<","value":11.5}' WHERE from_node = 'nc.2' AND ord = 1;
           UPDATE fault_edge SET label = '11.5 to 12.5', cond = '{"op":"between","min":11.5,"max":12.5,"min_inclusive":true,"max_inclusive":true}' WHERE from_node = 'nc.2' AND ord = 2;
           UPDATE fault_edge SET label = 'More than 12.5', cond = '{"op":">","value":12.5}' WHERE from_node = 'nc.2' AND ord = 3;
           INSERT INTO fault_edge VALUES ('nc.2', 4, 'No indication', NULL, 'nc.3n', 0);"#,
    ));
    let report = graph::validate(&b.pack).unwrap();
    assert!(report.ok, "{:?}", report.violations);
    let t = tree(&b, "t-nocrank");
    assert_eq!(
        choose(&t, "nc.2", volts(12.5, "V")).unwrap(),
        "nc.2b",
        "12.5 is in the closed range"
    );
    assert_eq!(choose(&t, "nc.2", volts(11.5, "V")).unwrap(), "nc.2b");
    assert_eq!(choose(&t, "nc.2", volts(12.51, "V")).unwrap(), "nc.3");
    assert_eq!(
        choose(&t, "nc.2", outcome("no INDICATION")).unwrap(),
        "nc.3n"
    );
    assert!(choose(&t, "nc.2", outcome("flat")).is_err());
    // The view lists the keypad's ranges and the named reading together.
    let level = b.pack.levels().unwrap()[0].clone();
    let v = view::node_view(
        &b.pack,
        &t,
        "nc.2",
        &level,
        None,
        &harvest_core::maint::applic::AttrValues::new(),
        &[],
    )
    .unwrap();
    let outcomes: Vec<_> = v
        .record
        .branches
        .iter()
        .map(|br| br.outcome.clone())
        .collect();
    assert_eq!(
        outcomes,
        vec![None, None, None, Some("no indication".to_string())]
    );
    // A gap at 12.5 (both neighbours open) and a plain branch that is not a
    // reading label both fail validation.
    let gap = pump_with(exec(
        r#"UPDATE fault_edge SET cond = '{"op":"between","min":11.5,"max":12.5}' WHERE from_node = 'nc.2' AND ord = 2;
           UPDATE fault_edge SET cond = '{"op":">","value":12.5}' WHERE from_node = 'nc.2' AND ord = 3;"#,
    ));
    let r = graph::validate(&gap.pack).unwrap();
    assert!(
        r.violations
            .iter()
            .any(|v| v.rule == "edge.coverage" && v.detail.contains("12.5")),
        "{:?}",
        r.violations
    );
    for (expect, why) in [
        (
            r#"{"kind":"value","unit":"V","labels":["No indication","no  INDICATION"]}"#,
            "repeated",
        ),
        (
            r#"{"kind":"value","unit":"V","labels":["No indication"," "]}"#,
            "blank",
        ),
        (
            r#"{"kind":"value","unit":"V","labels":["No indication","Off scale"]}"#,
            "no branch",
        ),
    ] {
        let sql = format!(
            "UPDATE fault_node SET expect = '{expect}' WHERE node_id = 'nc.2';
             INSERT INTO fault_edge VALUES ('nc.2', 4, 'No indication', NULL, 'nc.3n', 0);"
        );
        let bad = pump_with(exec(&sql));
        let r = graph::validate(&bad.pack).unwrap();
        assert!(
            r.violations.iter().any(|v| v.detail.contains(why)),
            "{why}: {:?}",
            r.violations
        );
    }
    assert!(
        choose(&t, "nc.2", outcome(" ")).is_err(),
        "a blank outcome is no reading"
    );
    let stray = pump_with(exec(
        "INSERT INTO fault_edge VALUES ('nc.2', 4, 'Flat', NULL, 'nc.3n', 0);",
    ));
    assert!(rules(&graph::validate(&stray.pack).unwrap()).contains(&"edge.coverage".to_string()));
}

// ------------------------------------------- generalized manual structure

fn vals(pairs: &[(&str, &str)]) -> harvest_core::maint::applic::AttrValues {
    pairs
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect()
}

#[test]
fn guard_classes_are_the_packs_own() {
    let b = pump();
    assert!(
        graph::validate(&b.pack).unwrap().ok,
        "{:?}",
        graph::validate(&b.pack).unwrap().violations
    );
    let t = tree(&b, "t-hot");
    let level = b.pack.level("expert").unwrap();
    let novals = harvest_core::maint::applic::AttrValues::new();
    let g = view::node_view(
        &b.pack,
        &t,
        "oh.1",
        &level,
        Some("pump40-diesel"),
        &novals,
        &[],
    )
    .unwrap()
    .guards;
    assert_eq!(
        (
            g[0].kind.as_str(),
            g[0].label.as_str(),
            g[0].rank,
            g[0].must_show
        ),
        ("warning", "WARNING", 1, true),
        "the default three"
    );
    // A manual that prints DANGER … TIP.
    let six = pump_with(exec(
        r#"DELETE FROM pack_meta WHERE key = 'guard_classes';
           INSERT INTO pack_meta VALUES ('guard_classes', '[{"id":"danger","label":"DANGER","rank":1,"must_show":true},{"id":"warning","label":"WARNING","rank":2,"must_show":true},{"id":"caution","label":"CAUTION","rank":3,"must_show":true},{"id":"notice","label":"NOTICE","rank":4,"must_show":true},{"id":"note","label":"NOTE","rank":5,"must_show":false},{"id":"tip","label":"TIP","rank":6,"must_show":false}]');
           UPDATE section SET kind = 'danger' WHERE section_id = 'm40.3.w1';"#,
    ));
    let r = graph::validate(&six.pack).unwrap();
    assert!(
        !rules(&r).contains(&"guard.class".to_string()),
        "{:?}",
        r.violations
    );
    let t = tree(&six, "t-hot");
    let g = view::node_view(
        &six.pack,
        &t,
        "oh.1",
        &level,
        Some("pump40-diesel"),
        &novals,
        &[],
    )
    .unwrap()
    .guards;
    assert_eq!(
        (g[0].kind.as_str(), g[0].label.as_str(), g[0].rank),
        ("danger", "DANGER", 1)
    );
    assert_eq!(g[1].rank, 2, "manual order kept, each with its rank");
    // A class the pack does not declare fails validation.
    let bad = pump_with(exec(
        "UPDATE section SET kind = 'danger' WHERE section_id = 'm40.3.w1';",
    ));
    assert!(rules(&graph::validate(&bad.pack).unwrap()).contains(&"guard.class".to_string()));
    // Classes must run most severe first.
    let order = pump_with(exec(
        r#"DELETE FROM pack_meta WHERE key = 'guard_classes';
           INSERT INTO pack_meta VALUES ('guard_classes', '[{"id":"note","label":"NOTE","rank":3,"must_show":false},{"id":"warning","label":"WARNING","rank":1,"must_show":true}]');"#,
    ));
    assert!(order.pack.guard_classes().is_err());
    // Tone: declared, else by the standard word, else note; an unknown tone
    // is refused.
    use harvest_core::maint::GuardTone;
    let three = pump_with(exec(
        r#"UPDATE pack_meta SET value = '[{"id":"warning","label":"WARNING","rank":1,"must_show":true},{"id":"caution","label":"CAUTION","rank":2,"must_show":true},{"id":"hint","label":"HINT","rank":3,"must_show":false}]' WHERE key = 'guard_classes';"#,
    ));
    let tones: Vec<GuardTone> = three
        .pack
        .guard_classes()
        .unwrap()
        .iter()
        .map(|c| c.tone())
        .collect();
    assert_eq!(
        tones,
        [GuardTone::Warning, GuardTone::Caution, GuardTone::Note],
        "CAUTION at rank 2 still looks like a caution"
    );
    let mixed = pump_with(exec(
        r#"UPDATE pack_meta SET value = '[{"id":"Danger","label":"DANGER","rank":1,"must_show":true},{"id":"NOTICE","label":"NOTICE","rank":2,"must_show":true}]' WHERE key = 'guard_classes';"#,
    ));
    let tones: Vec<GuardTone> = mixed
        .pack
        .guard_classes()
        .unwrap()
        .iter()
        .map(|c| c.tone())
        .collect();
    assert_eq!(tones, [GuardTone::Danger, GuardTone::Notice]);
    // A must-show class with its own word needs a declared tone.
    let hazard = pump_with(exec(
        r#"UPDATE pack_meta SET value = '[{"id":"hazard","label":"HAZARD","rank":1,"must_show":true},{"id":"warning","label":"WARNING","rank":2,"must_show":true},{"id":"caution","label":"CAUTION","rank":3,"must_show":true},{"id":"note","label":"NOTE","rank":4,"must_show":true}]' WHERE key = 'guard_classes';"#,
    ));
    assert!(rules(&graph::validate(&hazard.pack).unwrap()).contains(&"guard.tone".to_string()));
    let bad = pump_with(exec(
        r#"UPDATE pack_meta SET value = '[{"id":"warning","label":"WARNING","rank":1,"must_show":true,"tone":"scary"}]' WHERE key = 'guard_classes';"#,
    ));
    assert!(bad.pack.guard_classes().is_err());
    assert!(
        rules(&graph::validate(&bad.pack).unwrap()).contains(&"pack.guard_classes".to_string())
    );
}

#[test]
fn reference_tables_hold_codes_and_printed_limits() {
    use harvest_core::maint::table::{self, Cell};
    let b = pump();
    let r = graph::validate(&b.pack).unwrap();
    assert!(r.ok, "{:?}", r.violations);
    assert_eq!((r.counts.tables, r.counts.rows), (2, 6));
    let none = vals(&[]);
    // A code, exactly.
    let hits = table::lookup(&b.pack, None, Some("e40"), None, None, &none, 5).unwrap();
    assert_eq!(hits.len(), 1);
    let row = &hits[0].row;
    assert_eq!(
        row.cells["meaning"],
        Cell::Text("Suction pressure low".into())
    );
    assert_eq!(
        row.cells["remedy"],
        Cell::List(vec![
            "clean the strainer".into(),
            "tighten the hose clamps".into()
        ])
    );
    assert_eq!(row.citation.section_id, "m40.3-3");
    // Words.
    let hits = table::lookup(
        &b.pack,
        None,
        None,
        Some("wear ring clearance"),
        None,
        &none,
        5,
    )
    .unwrap();
    assert_eq!(hits[0].row.row_id, "tab-6-1#1");
    let Cell::Value(v) = &hits[0].row.cells["std"] else {
        panic!()
    };
    assert_eq!(
        (v.text.as_str(), v.unit.as_deref(), v.min, v.max),
        ("0.15 to 0.25 mm", Some("mm"), Some(0.15), Some(0.25))
    );
    assert!(table::lookup(&b.pack, None, None, None, None, &none, 5).is_err());
    // Every cell verbatim; roles known; cells name columns.
    for (sql, rule) in [
        (
            "UPDATE ref_row SET cells = '{\"code\":\"E99\"}' WHERE table_id = 'tab-3-3' AND ord = 1;",
            "table.verbatim",
        ),
        (
            "UPDATE ref_row SET cells = '{\"colour\":\"E21\"}' WHERE table_id = 'tab-3-3' AND ord = 1;",
            "table.cells",
        ),
        (
            "UPDATE ref_table SET columns = '[{\"id\":\"code\",\"label\":\"Code\",\"role\":\"mystery\"}]' WHERE table_id = 'tab-3-3';",
            "table.columns",
        ),
    ] {
        let bad = pump_with(exec(sql));
        assert!(
            rules(&graph::validate(&bad.pack).unwrap()).contains(&rule.to_string()),
            "{rule}"
        );
    }
}

#[test]
fn a_displayed_code_resolves_to_its_row_and_its_tree() {
    let b = pump();
    // E21: a tree and a row.
    let m = search::signal_match(&b.pack, &[obs("pump40.code", "E21")], None).unwrap();
    let h = &m.hits[0];
    assert!(h.has_tree);
    assert_eq!(h.row.as_ref().unwrap().row_id, "tab-3-3#1");
    // E52: a row only, shown by firmware 2.4 and later.
    let e52 = |v: &[(&str, &str)]| {
        search::signal_match_with(&b.pack, &[obs("pump40.code", "E52")], None, &vals(v))
            .unwrap()
            .hits
            .remove(0)
    };
    let h = e52(&[]);
    assert!(!h.has_tree && m.suggested.is_some());
    let a = h.row.unwrap().applicability.unwrap();
    assert_eq!(a.status, harvest_core::maint::applic::Tri::Unknown);
    assert_eq!(a.missing, vec!["firmware".to_string()]);
    assert_eq!(
        a.message.as_deref(),
        Some("applicability not determined: firmware 2.4 and later")
    );
    let h = e52(&[("firmware", "2.10")]);
    assert_eq!(
        h.row.unwrap().applicability.unwrap().status,
        harvest_core::maint::applic::Tri::Applies
    );
    assert!(
        e52(&[("firmware", "2.3.1")]).row.is_none(),
        "the row does not apply"
    );
    let bad = pump_with(exec(
        "UPDATE signal_map SET row_id = 'tab-3-3#9' WHERE pattern = 'E52';",
    ));
    assert!(rules(&graph::validate(&bad.pack).unwrap()).contains(&"signal.row".to_string()));
}

#[test]
fn applicability_is_three_valued_and_never_silent() {
    use harvest_core::maint::table::{self, Cell};
    let b = pump();
    let torque = |v: &[(&str, &str)]| {
        table::table_view(&b.pack, "tab-6-1", None, &vals(v))
            .unwrap()
            .unwrap()
            .rows
            .remove(2)
    };
    // Unknown modification state: both printed values, both flagged.
    let r = torque(&[]);
    assert!(r.cells.contains_key("std") && r.cells.contains_key("std_sb"));
    assert_eq!(
        r.cell_applicability["std_sb"].message.as_deref(),
        Some("applicability not determined: POST SB 40-07")
    );
    assert_eq!(
        r.cell_applicability["std"].missing,
        vec!["sb_40_07".to_string()]
    );
    // Settled: only the value that applies.
    let r = torque(&[("sb_40_07", "Incorporated")]);
    assert_eq!(
        r.cells.get("std_sb"),
        Some(&Cell::Value(
            serde_json::from_str(r#"{"text":"55 N·m","unit":"N·m","value":55.0}"#).unwrap()
        ))
    );
    assert!(!r.cells.contains_key("std"));
    let r = torque(&[("sb_40_07", "not incorporated")]);
    assert!(r.cells.contains_key("std") && !r.cells.contains_key("std_sb"));
    // A step: not determined is flagged and still shown; not applying is marked.
    let s = pump_with(exec(
        r#"INSERT INTO applic VALUES ('proc_step', 'proc-battv#2', 1, '{"attr":"firmware","op":"ge","value":"2.4"}', 'firmware 2.4 and later', 'm40.3-3', 'prov-pump40');"#,
    ));
    let step = |v: &[(&str, &str)]| {
        view::task_view(&s.pack, "proc-battv", None, &vals(v))
            .unwrap()
            .unwrap()
            .steps
            .remove(1)
    };
    let st = step(&[]);
    assert!(
        st.applies
            && st.applicability.as_ref().unwrap().status
                == harvest_core::maint::applic::Tri::Unknown
    );
    assert!(!step(&[("firmware", "1.0")]).applies);
    assert!(step(&[("firmware", "2.4.0")]).applies);
    // Validation: declared attributes, typed values, verbatim statements.
    for (sql, rule) in [
        (
            r#"INSERT INTO applic VALUES ('section', 'm40.4-2', 1, '{"attr":"colour","op":"eq","value":"red"}', 'firmware 2.4 and later', 'm40.3-3', 'prov-pump40');"#,
            "applic.cond",
        ),
        (
            r#"INSERT INTO applic VALUES ('section', 'm40.4-2', 1, '{"attr":"firmware","op":"ge","value":"2.4"}', 'firmware 9 and later', 'm40.3-3', 'prov-pump40');"#,
            "applic.verbatim",
        ),
        (
            r#"INSERT INTO applic VALUES ('ref_row', 'tab-9#1', 1, '{"attr":"firmware","op":"ge","value":"2.4"}', 'firmware 2.4 and later', 'm40.3-3', 'prov-pump40');"#,
            "applic.ref",
        ),
    ] {
        let bad = pump_with(exec(sql));
        assert!(
            rules(&graph::validate(&bad.pack).unwrap()).contains(&rule.to_string()),
            "{rule}"
        );
    }
}

#[test]
fn a_pack_that_needs_a_newer_reader_says_so() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("pump40");
    fixture_maint::build_with(
        &dir,
        "2026.3.1-1",
        exec("UPDATE pack_meta SET value = '3' WHERE key = 'min_reader';"),
    )
    .unwrap();
    let e = Pack::open(&dir, &[fixture::trusted_key()]).err().unwrap();
    assert!(
        e.to_string()
            .contains("needs a newer reader (level 3; this one reads up to 2)"),
        "{e}"
    );
    // Using level-2 features without declaring it fails validation.
    let quiet = pump_with(exec("DELETE FROM pack_meta WHERE key = 'min_reader';"));
    assert!(rules(&graph::validate(&quiet.pack).unwrap()).contains(&"pack.min_reader".to_string()));
}

#[test]
fn a_procedures_statements_reach_its_steps_and_the_test_procedure() {
    use harvest_core::maint::applic::Tri;
    let b = pump_with(exec(
        r#"INSERT INTO applic VALUES ('procedure', 'proc-battv', 1, '{"attr":"firmware","op":"ge","value":"2.4"}', 'firmware 2.4 and later', 'm40.3-3', 'prov-pump40');"#,
    ));
    let t = tree(&b, "t-nocrank");
    let level = b.pack.level("expert").unwrap();
    let old = vals(&[("firmware", "2.0")]);
    let v = view::node_view(&b.pack, &t, "nc.2", &level, None, &old, &[]).unwrap();
    let tp = v.test_procedure.unwrap();
    assert_eq!(tp.applicability.unwrap().status, Tri::DoesNotApply);
    assert!(
        tp.steps.iter().all(|s| !s.applies),
        "no step applies when the procedure does not"
    );
    let v = view::node_view(&b.pack, &t, "nc.2", &level, None, &vals(&[]), &[]).unwrap();
    let tp = v.test_procedure.unwrap();
    assert!(
        tp.steps
            .iter()
            .all(|s| s.applies && s.applicability.as_ref().unwrap().status == Tri::Unknown)
    );
    // A statement that failed verification leaves its item undecided.
    let failed = pump_with(exec(
        r#"CREATE TEMP TABLE p AS SELECT * FROM provenance WHERE prov_id = 'prov-pump40';
           UPDATE p SET prov_id = 'prov-bad', verdict = 'fail';
           INSERT INTO provenance SELECT * FROM p;
           INSERT INTO applic VALUES ('procedure', 'proc-battv', 1, '{"attr":"firmware","op":"ge","value":"2.4"}', 'firmware 2.4 and later', 'm40.3-3', 'prov-bad');"#,
    ));
    let a = failed
        .pack
        .applicability("procedure", "proc-battv", &vals(&[("firmware", "9.0")]))
        .unwrap()
        .unwrap();
    assert_eq!(a.status, Tri::Unknown);
    assert!(
        rules(&graph::validate(&failed.pack).unwrap()).contains(&"applic.provenance".to_string())
    );
}

#[test]
fn a_tree_that_does_not_apply_is_never_offered() {
    use harvest_core::maint::applic::Tri;
    // The overheating tree is for controller firmware before 2.4 only; one
    // cause of the no-crank tree is post-bulletin only.
    let b = pump_with(exec(
        r#"INSERT INTO applic VALUES ('fault_tree', 't-hot', 1, '{"attr":"firmware","op":"lt","value":"2.4"}', 'firmware 2.4 and later', 'm40.3-3', 'prov-pump40');
           INSERT INTO applic VALUES ('section', 'm40.3-1.q2', 1, '{"attr":"sb_40_07","op":"eq","value":"incorporated"}', 'POST SB 40-07', 'm40.6-1', 'prov-pump40');"#,
    ));
    let ids = |v: &[(&str, &str)]| -> Vec<String> {
        b.pack
            .fault_trees_for(None, &vals(v))
            .unwrap()
            .into_iter()
            .map(|t| t.tree_id)
            .collect()
    };
    assert!(
        !ids(&[("firmware", "3.0")]).contains(&"t-hot".to_string()),
        "does not apply: never offered"
    );
    assert!(ids(&[("firmware", "2.0")]).contains(&"t-hot".to_string()));
    let flagged = b.pack.fault_trees_for(None, &vals(&[])).unwrap();
    let hot = flagged.iter().find(|t| t.tree_id == "t-hot").unwrap();
    assert_eq!(
        hot.applicability.as_ref().unwrap().status,
        Tri::Unknown,
        "not determined: offered, flagged"
    );
    // Symptom search and signal suggestions follow.
    let rank = search::Ranking::for_pack(&b.pack).unwrap();
    let (hits, _) = search::symptom_search_with(
        &b.pack,
        Some("running hot"),
        &[],
        None,
        &vals(&[("firmware", "3.0")]),
        None,
        5,
        &rank,
    )
    .unwrap();
    assert!(hits.iter().all(|h| h.symptom.tree_id != "t-hot"));
    let (hits, _) = search::symptom_search_with(
        &b.pack,
        Some("running hot"),
        &[],
        None,
        &vals(&[]),
        None,
        5,
        &rank,
    )
    .unwrap();
    assert_eq!(
        hits[0].symptom.applicability.as_ref().unwrap().status,
        Tri::Unknown
    );
    let m = search::signal_match_with(
        &b.pack,
        &[obs("pump40.code", "E21")],
        None,
        &vals(&[("firmware", "3.0")]),
    )
    .unwrap();
    assert!(
        m.suggested.is_none(),
        "no suggestion into a tree that does not apply"
    );
    let m =
        search::signal_match_with(&b.pack, &[obs("pump40.code", "E21")], None, &vals(&[])).unwrap();
    assert_eq!(
        m.suggested.unwrap().applicability.unwrap().status,
        Tri::Unknown
    );
    // Facet texts follow their sections' statements.
    let t = tree(&b, "t-nocrank");
    let level = b.pack.level("expert").unwrap();
    let texts = |v: &[(&str, &str)]| -> usize {
        view::node_view(&b.pack, &t, "nc.2", &level, None, &vals(v), &[])
            .unwrap()
            .facets
            .iter()
            .map(|g| g.texts.len())
            .sum()
    };
    assert_eq!(
        texts(&[("sb_40_07", "not incorporated")]),
        0,
        "every nc.2 facet cites m40.3-1.q2"
    );
    assert!(texts(&[("sb_40_07", "incorporated")]) > 0);
    let unknown = view::node_view(&b.pack, &t, "nc.2", &level, None, &vals(&[]), &[]).unwrap();
    assert!(
        unknown.facets.iter().flat_map(|g| &g.texts).all(|x| x
            .applicability
            .as_ref()
            .unwrap()
            .status
            == Tri::Unknown)
    );
}
