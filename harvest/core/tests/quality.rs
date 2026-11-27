//! Answer quality: support is local to a passage.
use harvest_core::fixture;
use harvest_core::{AskOptions, Engine, HashingEmbedder, Mode, Pack};
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
