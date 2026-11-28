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
         INSERT INTO fault_node VALUES ('nc.x', 't-nocrank', 'goto', 'The fault is corrected.', 'm40.3-1.end', NULL, NULL, NULL, 'en', 'prov-pump40');
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
        .filter(|v| v.rule == "guard.resolve")
        .collect();
    assert_eq!(guard.len(), 2, "{:#?}", r.violations);
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
        view::node_view(p, &hot, "oh.1", &level, e, &[])
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
        view::task_view(p, "proc-battery", Some("pump40-diesel"))
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
        let v = view::node_view(p, &t, "nc.2", l, Some("pump40-diesel"), &[]).unwrap();
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
    let tp = view::node_view(p, &t, "nc.2", &levels[0], None, &[])
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
    let goto = view::node_view(p, &t, "nc.2a", &lvl, None, &[]).unwrap();
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
    let t = view::task_view(&b.pack, "proc-battery", Some("pump40-diesel"))
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
            node_id: "oh.0".into()
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
    // One word of three: closest.
    let (hits, _) = search::symptom_search(
        &b.pack,
        Some("engine smoke and knocking"),
        &[],
        None,
        None,
        5,
    )
    .unwrap();
    assert_eq!(hits[0].confidence, search::Confidence::Closest);
    // A pack can raise the bar.
    let strict = pump_with(exec(
        "INSERT INTO pack_meta VALUES ('symptom_confident_coverage', '1.01');",
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
