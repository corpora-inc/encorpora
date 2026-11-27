mod common;

use harvest_core::grade::{Rubric, grade};
use harvest_core::llm::ScriptedLlm;
use harvest_core::notes::{NoteVocab, VocabTerm, structure_keywords, structure_note};
use serde_json::json;

fn rubric() -> Rubric {
    Rubric::parse(
        &json!({
            "points": [
                {"id": "hazard", "text": "Names the hazard of arcing", "keywords": [["arc", "arcing", "jump"]]},
                {"id": "distance", "text": "Says to keep a minimum distance", "keywords": ["minimum distance"], "weight": 2},
                {"id": "spotter", "text": "Mentions a spotter", "keywords": ["spotter"]}
            ],
            "pass": 0.6
        })
        .to_string(),
    )
    .unwrap()
}

#[test]
fn keyword_rubric_without_a_model() {
    let g = grade(
        "Electricity can arc across the gap, so keep the minimum distances.",
        &rubric(),
        None,
    )
    .unwrap();
    assert_eq!(g.mode, "keyword");
    assert!((g.score - 0.75).abs() < 1e-9, "{}", g.score);
    assert!(g.passed);
    assert_eq!(g.missed, vec!["spotter".to_string()]);
    let g = grade("I don't know", &rubric(), None).unwrap();
    assert_eq!(g.score, 0.0);
    assert!(!g.passed);
}

#[test]
fn model_judges_but_must_quote_the_learner() {
    let answer =
        "Power can leap to the boom if you get near, so stay far back and have someone watch.";
    let llm = ScriptedLlm::new([json!({"points": [
        {"id": "hazard", "met": true, "evidence": "Power can leap to the boom"},
        {"id": "distance", "met": true, "evidence": "stay far back"},
        // Fabricated evidence: not the learner's words → keyword rule decides (fails).
        {"id": "spotter", "met": true, "evidence": "use a dedicated spotter"}
    ]})
    .to_string()]);
    let g = grade(answer, &rubric(), Some(&llm)).unwrap();
    assert_eq!(g.mode, "model");
    assert_eq!(g.model.as_deref(), Some("scripted-test-model"));
    let by: Vec<(&str, bool, &str)> = g
        .points
        .iter()
        .map(|p| (p.id.as_str(), p.met, p.by.as_str()))
        .collect();
    assert_eq!(
        by,
        vec![
            ("hazard", true, "model"),
            ("distance", true, "model"),
            ("spotter", false, "keyword")
        ]
    );
    assert!((g.score - 0.75).abs() < 1e-9);
}

#[test]
fn model_garbage_falls_back_to_keywords() {
    let llm = ScriptedLlm::new(["{oops".to_string()]);
    let g = grade(
        "keep the minimum distance and use a spotter",
        &rubric(),
        Some(&llm),
    )
    .unwrap();
    assert_eq!(g.mode, "keyword");
    assert_eq!(g.missed, vec!["hazard".to_string()]);
    assert!(g.model_error.unwrap().contains("schema"));
}

#[test]
fn rubric_validation() {
    assert!(Rubric::parse("{\"points\": []}").is_err());
    assert!(Rubric::parse("nope").is_err());
}

fn vocab() -> NoteVocab {
    let mut v = NoteVocab::generic();
    v.components = vec![
        VocabTerm {
            name: "load line".into(),
            aliases: vec!["hoist rope".into(), "wire rope".into()],
        },
        VocabTerm {
            name: "hook latch".into(),
            aliases: vec!["safety latch".into()],
        },
    ];
    v
}

#[test]
fn keyword_notes() {
    let n = structure_keywords(
        "Hoist rope has broken wires near the drum, tagged out.",
        &vocab(),
    );
    assert_eq!(n.component.as_deref(), Some("load line"));
    assert_eq!(n.condition.as_deref(), Some("frayed"));
    assert_eq!(n.action.as_deref(), Some("remove from service"));
    let n = structure_keywords("all good", &vocab());
    assert_eq!(
        (n.component, n.condition, n.action),
        (None, Some("ok".into()), None)
    );
}

#[test]
fn model_notes_are_grounded() {
    let llm = ScriptedLlm::new([json!({
        "component": "hook latch",
        "condition": "bent",
        "action": "replace the turbocharger"
    })
    .to_string()]);
    let n = structure_note(
        "Safety latch is bent and sticks; swap it.",
        &vocab(),
        Some(&llm),
    )
    .unwrap();
    assert_eq!(n.mode, "model");
    assert_eq!(n.component.as_deref(), Some("hook latch"));
    assert_eq!(n.condition.as_deref(), Some("bent"));
    // Ungrounded action: the keyword result stands.
    assert_eq!(n.action.as_deref(), Some("replace"));
}

#[test]
fn pack_vocab_merges_over_generic() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("p");
    harvest_core::fixture::build_with(&dir, "2026.1.1-1", |c| {
        c.execute(
            "INSERT INTO pack_meta VALUES ('note_vocab', ?1)",
            [
                json!({"components": [{"name": "outrigger pad", "aliases": ["float"]}]})
                    .to_string(),
            ],
        )?;
        Ok(())
    })
    .unwrap();
    let pack = harvest_core::Pack::open(&dir, &[harvest_core::fixture::trusted_key()]).unwrap();
    let v = NoteVocab::from_pack(&pack).unwrap();
    let n = structure_keywords("float cracked", &v);
    assert_eq!(n.component.as_deref(), Some("outrigger pad"));
    assert_eq!(n.condition.as_deref(), Some("cracked"));
}

#[test]
fn malformed_pack_vocab_is_an_error() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("p");
    harvest_core::fixture::build_with(&dir, "2026.1.1-1", |c| {
        c.execute(
            "INSERT INTO pack_meta VALUES ('note_vocab', '{\"components\": 3}')",
            [],
        )?;
        Ok(())
    })
    .unwrap();
    let pack = harvest_core::Pack::open(&dir, &[harvest_core::fixture::trusted_key()]).unwrap();
    let err = NoteVocab::from_pack(&pack).unwrap_err().to_string();
    assert!(err.contains("note_vocab"), "{err}");
}
