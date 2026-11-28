//! Answer quality: local support, table lookups, answer first, cache intent.
mod common;

use harvest_core::fixture;
use harvest_core::tools::RangeTable;
use harvest_core::{AskOptions, Engine, HashingEmbedder, Mode, Pack, Segment};
use std::sync::Arc;

const TABLE: &str = "Table A—Minimum Clearance Distances\nVoltage (nominal, kV, alternating current) | Minimum clearance distance (feet)\nup to 50 | 10\nover 50 to 200 | 15\nover 200 to 350 | 20\nover 1,000 | (as established by the utility owner/operator).\nNote: The value that follows “to” is up to and includes that value.";

fn pack_with(sql: &'static str) -> (tempfile::TempDir, Arc<Pack>) {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("p");
    fixture::build_with(&dir, "2026.1.1-1", move |c| {
        c.execute_batch(sql)?;
        c.execute(
            "INSERT INTO section VALUES ('ex.2-table-A', 'ex-rules', 'ex.2', 90, 2, 'table', 'Table A to §2',
               'Table A—Minimum Clearance Distances', ?1, 'x', 'en')",
            [TABLE],
        )?;
        c.execute(
            "INSERT INTO chunk VALUES ('c-tableA', 'section', 'ex.2-table-A', ?1, 'en')",
            [TABLE],
        )?;
        Ok(())
    })
    .unwrap();
    let pack = Arc::new(Pack::open(&dir, &[fixture::trusted_key()]).unwrap());
    (tmp, pack)
}

fn engine(p: &Arc<Pack>) -> Engine {
    Engine::new(p.clone()).with_embedder(Arc::new(HashingEmbedder::new(fixture::EMBED_DIM)))
}

fn texts(body: &[Segment]) -> Vec<String> {
    body.iter()
        .filter_map(|s| match s {
            Segment::Text { text } => Some(text.clone()),
            _ => None,
        })
        .collect()
}

#[test]
fn range_tables_parse_and_look_up_inclusive_bounds() {
    let (_t, p) = pack_with("");
    let t = RangeTable::parse(&p.section("ex.2-table-A").unwrap().unwrap()).unwrap();
    assert_eq!(
        (t.unit.as_str(), t.result_unit.as_deref()),
        ("kv", Some("feet"))
    );
    assert_eq!(t.bands.len(), 4);
    let row = |x: f64| {
        t.bands
            .iter()
            .find(|b| b.contains(x))
            .map(|b| b.value.clone())
    };
    assert_eq!(row(50.0).as_deref(), Some("10"));
    assert_eq!(row(50.1).as_deref(), Some("15"));
    assert_eq!(
        row(200.0).as_deref(),
        Some("15"),
        "the number after 'to' is included"
    );
    assert_eq!(row(500.0), None, "a gap in the table is not filled in");
    assert!(row(2000.0).unwrap().contains("utility"));
    assert_eq!(
        t.values_in("how close to a 138kv line, or 13.8 kV"),
        vec![138.0, 13.8]
    );
    assert!(t.values_in("how close to a power line").is_empty());
    // Not a range table: ordinary prose sections.
    assert!(RangeTable::parse(&p.section("ex.2").unwrap().unwrap()).is_none());
}

#[test]
fn a_number_in_a_tables_unit_is_answered_from_the_table() {
    let (_t, p) = pack_with("");
    let r = engine(&p)
        .ask(
            "how close can the machine get to a 200 kV energized line under Table A minimum clearance",
            &AskOptions {
                cache_threshold: 2.0,
                ..AskOptions::default()
            },
        )
        .unwrap();
    assert_eq!(r.mode, Mode::Composed, "{r:?}");
    assert_eq!(r.tool.as_deref(), Some("range_table:ex.2-table-A"));
    assert_eq!(
        texts(&r.body)[0],
        "For 200 kV, Table A—Minimum Clearance Distances: 15 feet."
    );
    assert!(
        r.body
            .contains(&Segment::quote("ex.2-table-A", "over 50 to 200 | 15"))
    );
    // On a band's edge the note that says the bound is included is quoted.
    assert!(
        r.body
            .iter()
            .any(|s| matches!(s, Segment::Quote { text, .. } if text.starts_with("Note:")))
    );
    assert!(r.check.quotes_ok && r.check.cites_ok);
}

#[test]
fn a_long_list_section_does_not_support_every_question() {
    // A definitions list that mentions every word, retrievable by its chunk.
    let (_t, p) = pack_with(
        "INSERT INTO section VALUES ('ex.defs', 'ex-rules', NULL, 99, 1, 'section', '§9', 'Definitions',
           'Competent person means one who can identify hazards. Inspection means an examination of the machine. Machine means a lifting machine. Shift means a work period. Spotter means a person who watches clearance. Load line means the rope that holds the load. Periodic means at set intervals. Qualified person means one with a degree or certificate. Wind speed means air speed at the boom tip. Ground means the surface the machine stands on. Energized line means a line carrying current. Clearance means the distance kept from a line.',
           'x', 'en');
         INSERT INTO chunk VALUES ('c-defs', 'section', 'ex.defs',
           'Definitions. Competent person, inspection, machine, shift, spotter, load line, periodic, qualified person, wind speed, ground, energized line, clearance.', 'en');",
    );
    let e = engine(&p);
    let opts = AskOptions {
        cache_threshold: 2.0,
        ..AskOptions::default()
    };
    let r = e
        .ask("who must inspect the machine each shift", &opts)
        .unwrap();
    assert_eq!(r.mode, Mode::Composed);
    assert!(
        r.citations.contains(&"ex.3".to_string()),
        "{:?}",
        r.citations
    );
    assert!(
        !r.citations.contains(&"ex.defs".to_string()),
        "{:?}",
        r.citations
    );
    // A question about a definition still gets the definitions.
    let r = e
        .ask("what does spotter mean in the definitions", &opts)
        .unwrap();
    assert!(
        r.citations.contains(&"ex.defs".to_string()),
        "{:?}",
        r.citations
    );
}

#[test]
fn answers_open_with_the_answer_not_a_header() {
    let b = common::pack();
    let r = common::engine(&b)
        .ask(
            "how far does the machine have to stay from a 40 kV energized line",
            &AskOptions {
                cache_threshold: 2.0,
                ..AskOptions::default()
            },
        )
        .unwrap();
    assert_eq!(r.mode, Mode::Composed);
    let Segment::Text { text } = &r.body[0] else {
        panic!("opens with {:?}", r.body[0])
    };
    assert!(!text.starts_with('§'), "{text}");
    // The lead is the baked, verified fact for that limit.
    assert_eq!(
        text,
        "Keep the machine at least 10 feet from lines rated up to 50 kV."
    );
}

#[test]
fn a_near_threshold_cache_hit_must_be_the_same_question() {
    let b = common::pack();
    // Dice 0.83 against "how close can the machine get to a power line".
    let q = "how close can the machine get to a power line on site today";
    let base = AskOptions::default();
    let lexical = Engine::new(b.pack.clone());
    assert_ne!(
        lexical.ask(q, &base).unwrap().mode,
        Mode::Baked,
        "no embedder to confirm it"
    );
    let e = common::engine(&b);
    assert_ne!(
        e.ask(q, &base).unwrap().mode,
        Mode::Baked,
        "the embedder says it differs"
    );
    let lenient = AskOptions {
        cache_intent_min: 0.5,
        ..AskOptions::default()
    };
    assert_eq!(e.ask(q, &lenient).unwrap().mode, Mode::Baked);
    // Well above the threshold, no confirmation is needed.
    assert_eq!(
        lexical
            .ask("how close can the machine get to a power line", &base)
            .unwrap()
            .mode,
        Mode::Baked
    );
}
