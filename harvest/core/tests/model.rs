mod common;

use harvest_core::llm::ScriptedLlm;
use harvest_core::{AskOptions, Mode, Role, Segment};
use serde_json::json;
use std::sync::Arc;

fn out(v: serde_json::Value) -> String {
    v.to_string()
}

fn expansion(queries: &[&str]) -> String {
    out(json!({"queries": queries, "ambiguous": false, "clarify": null}))
}

#[test]
fn composes_from_retrieved_text_and_the_checker_cleans_it() {
    let b = common::pack();
    let fact = b.pack.facts_for_section("ex.2").unwrap()[0].quote.clone();
    let llm = Arc::new(ScriptedLlm::new([
        expansion(&[
            "minimum clearance energized line",
            "spotter clearance distance",
        ]),
        out(json!({"segments": [
            {"t": "text", "text": "There are two things to know near energized lines."},
            {"t": "text", "text": "First, identify energized lines before work begins:"},
            {"t": "quote", "section_id": "ex.2", "text": "Before work begins, the controlling party must identify energized lines within the work zone."},
            {"t": "cite", "section_id": "ex.2"},
            {"t": "text", "text": "Keep at least 10 feet away from lines up to 50 kV."},
            {"t": "cite", "section_id": "ex.2"},
            {"t": "text", "text": "Use a dedicated spotter:"},
            {"t": "quote", "section_id": "ex.2(a)", "text": "A dedicated spotter must be used"},
            {"t": "text", "text": "Helmets must be painted orange on Tuesdays."},
            {"t": "quote", "section_id": "ex.2", "text": "a sentence the section never says"}
        ]})),
    ]));
    let e = common::engine(&b).with_llm(llm.clone());
    let (r, trace) = e
        .ask_traced(
            "what do I need to know about working near power lines",
            &AskOptions::default(),
        )
        .unwrap();
    assert_eq!(r.mode, Mode::Composed, "{:?}", trace.model_error);
    assert_eq!(r.model.as_deref(), Some("scripted-test-model"));
    assert_eq!(llm.asked(), vec!["expansion", "answer_segments"]);
    assert!(
        trace
            .expansions
            .contains(&"spotter clearance distance".to_string())
    );
    // The limit paraphrase became the verbatim quote; the fabricated quote and
    // its unsupported claim are gone.
    assert!(r.body.contains(&Segment::quote("ex.2", fact)));
    assert!(!r.body.iter().any(|s| matches!(s, Segment::Text { text } if text.contains("10 feet") || text.contains("orange"))));
    // Framing ("two things to know") survives; it states no value.
    assert_eq!(
        r.body[0],
        Segment::text("There are two things to know near energized lines.")
    );
    assert!(!r.check.quotes_ok);
    assert_eq!(r.check.dropped, 3);
    assert_eq!(r.citations, vec!["ex.2".to_string(), "ex.2(a)".to_string()]);
    // The model saw only pack text.
    let req = &llm.requests.lock().unwrap()[1];
    assert!(req.user.contains("controlling party must identify"));
    assert!(req.user.contains("must_quote_verbatim"));
}

#[test]
fn the_cache_wins_before_the_model_runs() {
    let b = common::pack();
    let llm = Arc::new(ScriptedLlm::new([]));
    let e = common::engine(&b).with_llm(llm.clone());
    let r = e
        .ask(
            "How close can the machine get to a power line?",
            &AskOptions::default(),
        )
        .unwrap();
    assert_eq!(r.mode, Mode::Baked);
    assert!(llm.asked().is_empty());
}

#[test]
fn clarifies_only_when_the_model_says_ambiguous() {
    let b = common::pack();
    let llm = Arc::new(ScriptedLlm::new([out(json!({
        "queries": ["inspection"], "ambiguous": true,
        "clarify": "Do you mean the shift inspection or the periodic inspection?"
    }))]));
    let e = common::engine(&b).with_llm(llm);
    let r = e.ask("inspection when", &AskOptions::default()).unwrap();
    assert_eq!(r.mode, Mode::Clarify);
    assert_eq!(
        r.body,
        vec![Segment::text(
            "Do you mean the shift inspection or the periodic inspection?"
        )]
    );
    assert!(r.nearest.contains(&"ex.3".to_string()));

    // ambiguous without a question is not a clarification.
    let llm = Arc::new(ScriptedLlm::new([
        out(json!({"queries": [], "ambiguous": true, "clarify": "  "})),
        out(
            json!({"segments": [{"t": "text", "text": "Inspect each shift before use."}, {"t": "cite", "section_id": "ex.3"}]}),
        ),
    ]));
    let e = common::engine(&b).with_llm(llm);
    let r = e.ask("inspection when", &AskOptions::default()).unwrap();
    assert_eq!(r.mode, Mode::Composed);
}

#[test]
fn model_failure_falls_back_to_the_deterministic_answer() {
    let b = common::pack();
    // Garbage instead of JSON.
    let llm = Arc::new(ScriptedLlm::new(["not json".to_string()]));
    let e = common::engine(&b).with_llm(llm);
    let (r, trace) = e
        .ask_traced(
            "Who must inspect the machine each shift?",
            &AskOptions::default(),
        )
        .unwrap();
    assert_eq!(r.mode, Mode::Composed);
    assert!(r.model.is_none());
    assert!(trace.model_error.unwrap().contains("schema"));

    // A composition with nothing supported also falls back.
    let llm = Arc::new(ScriptedLlm::new([
        expansion(&[]),
        out(json!({"segments": [{"t": "text", "text": "Unsupported."}]})),
    ]));
    let e = common::engine(&b).with_llm(llm);
    let (r, trace) = e
        .ask_traced(
            "Who must inspect the machine each shift?",
            &AskOptions::default(),
        )
        .unwrap();
    assert_eq!(r.mode, Mode::Composed);
    assert!(r.model.is_none());
    assert!(trace.model_error.unwrap().contains("no supported segment"));
}

#[test]
fn off_topic_declines_without_asking_the_model_to_compose() {
    let b = common::pack();
    let llm = Arc::new(ScriptedLlm::new([expansion(&["pizza dough recipe"])]));
    let e = common::engine(&b).with_llm(llm.clone());
    let r = e.ask("best pizza recipe", &AskOptions::default()).unwrap();
    assert_eq!(r.mode, Mode::Declined);
    assert_eq!(llm.asked(), vec!["expansion"]);
}

#[test]
fn context_carries_role_and_equipment() {
    let b = common::pack();
    let llm = Arc::new(ScriptedLlm::new([
        expansion(&["stabilizers fully extended"]),
        out(json!({"segments": [
            {"t": "quote", "section_id": "ex.4", "text": "When stabilizers are used, they must be fully extended or deployed as specified in the load chart."},
            {"t": "cite", "section_id": "ex.4"}
        ]})),
    ]));
    let e = common::engine(&b).with_llm(llm.clone());
    let opts = AskOptions {
        role: Role::Trainee,
        equip: Some("machine-wheeled".into()),
        ..AskOptions::default()
    };
    let r = e
        .ask("do my outriggers have to be all the way out", &opts)
        .unwrap();
    assert_eq!(r.mode, Mode::Composed);
    let reqs = llm.requests.lock().unwrap();
    assert!(reqs[0].user.contains("trainee") && reqs[0].user.contains("wheeled machine"));
    assert!(reqs[1].system.contains("trainee"));
}

#[test]
fn small_numbers_that_state_an_interval_need_a_source() {
    let b = common::pack();
    let body = vec![
        Segment::text("There are two steps."),
        Segment::text("Inspect the line every 3 months."),
        Segment::text("Use a 5 to 1 safety factor."),
        Segment::cite("ex.2"),
    ];
    let (kept, check) =
        harvest_core::check::check(&b.pack, &body, harvest_core::check::CheckOptions::STRICT)
            .unwrap();
    assert!(kept.contains(&Segment::text("There are two steps.")));
    assert!(!kept.iter().any(|s| matches!(s, Segment::Text { text } if text.contains("3 months") || text.contains("5 to 1"))));
    assert_eq!(check.dropped, 2);
}
