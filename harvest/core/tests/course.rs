//! The course knowledge tree: baked or derived, walked, searched.
mod common;

use harvest_core::course::CourseTree;
use harvest_core::{Engine, HashingEmbedder, Pack, fixture};
use serde_json::json;
use std::sync::Arc;

fn exams() -> serde_json::Value {
    json!([{
        "id": "core", "title": "Operator written exam, core", "minutes": 90,
        "domains": [
            {"id": "core.site", "title": "Site", "weight": 0.5, "skillIds": ["skill-clearance", "no-such-skill"]},
            {"id": "core.ops", "title": "Operations", "weight": 0.5, "skillIds": []}
        ]
    }])
}

#[test]
fn a_pack_without_a_tree_gets_one_derived_from_its_rows() {
    let b = common::pack();
    let t = CourseTree::from_pack(&b.pack, Some(exams())).unwrap();
    assert!(t.derived);
    let root = t.root().unwrap();
    assert_eq!(root.node_id, "course");
    let kids: Vec<&str> = t
        .children("course")
        .iter()
        .map(|n| n.node_id.as_str())
        .collect();
    assert_eq!(kids, ["exam:core", "topic:topic-lines"]);
    // A domain reaches its skills through links; an unknown skill id is dropped.
    let site: Vec<&str> = t
        .children("domain:core.site")
        .iter()
        .map(|n| n.node_id.as_str())
        .collect();
    assert_eq!(site, ["skill:skill-clearance"]);
    let skill = t.node("skill:skill-clearance").unwrap();
    assert_eq!(skill.links.q_ids, ["q-clear-1"]);
    assert_eq!(skill.section_ids, ["ex.2"]);
    assert_eq!(skill.links.diagram_ids, ["dia-clearance"]);
    assert_eq!(
        t.node("topic:topic-lines").unwrap().links.lesson_ids,
        ["lesson-lines"]
    );
    let path: Vec<&str> = t
        .path("skill:skill-clearance")
        .iter()
        .map(|n| n.node_id.as_str())
        .collect();
    assert_eq!(
        path,
        ["course", "topic:topic-lines", "skill:skill-clearance"]
    );
    assert!(!skill.has_text());
}

fn baked() -> (tempfile::TempDir, Arc<Pack>) {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("p");
    fixture::build_with(&dir, "2026.1.1-1", |c| {
        c.execute_batch(
            r#"
            INSERT INTO provenance VALUES ('prov-bad', 'deterministic', 'none', 'fixture', '1', 'x', 'x', 'x',
              '2026-01-01T00:00:00Z', 'fixture', 'fail', NULL);
            INSERT INTO lesson VALUES ('lesson-held', 'topic-lines', 2, 'Held', '[]', 'en', 'prov-bad');
            INSERT INTO course_node VALUES ('course', NULL, 0, 'course', 'Machine course',
              'Rules for working near lines and inspecting machines.', 'Clearance tables.', '', '', '{"node_ids":["topic:lines"]}', '[]', '[]', 'en', 'prov-fixture');
            INSERT INTO course_node VALUES ('topic:lines', 'course', 1, 'topic', 'Energized lines',
              'How close a machine may work to a power line.', 'Picking the voltage band.',
              'Measuring from the cab instead of the closest part of the load.', 'Expect a table lookup by voltage.',
              '{"lesson_ids":["lesson-lines","lesson-held"],"q_ids":["q-clear-1"]}', '["ex.2"]',
              '[{"section_id":"ex.2","quote":"closer than 10 feet to an energized line"},{"section_id":"ex.2","quote":"closer than 99 feet"}]', 'en', 'prov-fixture');
            INSERT INTO course_node VALUES ('topic:inspect', 'course', 2, 'topic', 'Inspections',
              'Shift and periodic inspections.', '', '', '', '{}', '["ex.3"]', '[]', 'en', 'prov-fixture');
            INSERT INTO course_node VALUES ('topic:draft', 'course', 3, 'topic', 'Unreviewed draft',
              'Voltage voltage voltage.', '', '', '', '{}', '[]', '[]', 'en', 'prov-bad');
            "#,
        )?;
        Ok(())
    })
    .unwrap();
    let pack = Arc::new(Pack::open(&dir, &[fixture::trusted_key()]).unwrap());
    (tmp, pack)
}

#[test]
fn a_baked_tree_ships_passed_nodes_with_verbatim_quotes_only() {
    let (_tmp, pack) = baked();
    let t = CourseTree::from_pack(&pack, None).unwrap();
    assert!(!t.derived);
    let ids: Vec<&str> = t.nodes.iter().map(|n| n.node_id.as_str()).collect();
    assert_eq!(ids, ["course", "topic:inspect", "topic:lines"]);
    let lines = t.node("topic:lines").unwrap();
    assert_eq!(lines.quotes.len(), 1, "the quote not in ex.2 is dropped");
    assert_eq!(
        lines.quotes[0].quote,
        "closer than 10 feet to an energized line"
    );
    assert!(lines.has_text());
    // A link to a row that did not ship is dropped.
    assert_eq!(lines.links.lesson_ids, ["lesson-lines"]);
    assert_eq!(lines.links.q_ids, ["q-clear-1"]);
    // Children by order, link-only nodes once.
    let kids: Vec<&str> = t
        .children("course")
        .iter()
        .map(|n| n.node_id.as_str())
        .collect();
    assert_eq!(kids, ["topic:lines", "topic:inspect"]);
}

#[test]
fn tree_search_finds_nodes_by_what_they_teach_and_stays_out_of_answers() {
    let (_tmp, pack) = baked();
    let t = CourseTree::from_pack(&pack, None).unwrap();
    let e =
        Engine::new(pack.clone()).with_embedder(Arc::new(HashingEmbedder::new(fixture::EMBED_DIM)));
    let hits = t
        .search(
            &e.retriever(),
            "what do people get wrong measuring near a power line",
            3,
        )
        .unwrap();
    assert_eq!(hits[0].node_id, "topic:lines", "{hits:?}");
    assert!(hits[0].lexical > 0.0 && hits[0].dense > 0.0, "{hits:?}");
    let hits = t.search(&e.retriever(), "periodic inspections", 3).unwrap();
    assert_eq!(hits[0].node_id, "topic:inspect");
    // A failed node is never found, however well it matches.
    let hits = t.search(&e.retriever(), "voltage", 5).unwrap();
    assert!(hits.iter().all(|h| h.node_id != "topic:draft"));
    // Rule retrieval never returns tree nodes.
    let r = e
        .retriever()
        .search("what do people get wrong measuring", &Default::default())
        .unwrap();
    assert!(r.hits.iter().all(|h| !h.ref_kind.contains("node")));
}

#[test]
fn an_older_pack_without_the_tables_still_opens_and_derives() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("old");
    fixture::build_with(&dir, "2026.1.1-1", |c| {
        c.execute_batch("DROP TABLE course_node; DROP TABLE course_node_vec;")?;
        Ok(())
    })
    .unwrap();
    let pack = Arc::new(Pack::open(&dir, &[fixture::trusted_key()]).unwrap());
    assert!(pack.course_nodes().unwrap().is_empty());
    let t = CourseTree::from_pack(&pack, None).unwrap();
    assert!(t.derived);
    let e =
        Engine::new(pack.clone()).with_embedder(Arc::new(HashingEmbedder::new(fixture::EMBED_DIM)));
    let hits = t.search(&e.retriever(), "energized lines", 3).unwrap();
    assert_eq!(hits[0].node_id, "topic:topic-lines");
    assert_eq!(hits[0].dense, 0.0);
}
