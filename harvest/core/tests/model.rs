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

/// A model that answers by schema: expansions, all offered passages, and
/// evidence for the sentences that start with `targets`.
struct Oracle {
    answer: &'static str,
    targets: Vec<&'static str>,
    note: Option<&'static str>,
    requests: std::sync::Mutex<Vec<harvest_core::LlmRequest>>,
}

impl Oracle {
    fn new(answer: &'static str, targets: Vec<&'static str>) -> Self {
        Self {
            answer,
            targets,
            note: None,
            requests: Default::default(),
        }
    }
    fn asked(&self) -> Vec<String> {
        self.requests
            .lock()
            .unwrap()
            .iter()
            .map(|r| r.schema.0.clone())
            .collect()
    }
}

impl harvest_core::Llm for Oracle {
    fn id(&self) -> String {
        "oracle".into()
    }
    fn complete(&self, req: &harvest_core::LlmRequest) -> harvest_core::Result<String> {
        self.requests.lock().unwrap().push(req.clone());
        let user: serde_json::Value = serde_json::from_str(&req.user).unwrap();
        Ok(match req.schema.0.as_str() {
            "expansion" => expansion(&[]),
            "selection" => out(
                json!({"section_ids": user["passages"].as_array().unwrap().iter()
                .map(|p| p["section_id"].clone()).collect::<Vec<_>>()}),
            ),
            "answer_evidence" => {
                let mut ev = Vec::new();
                for p in user["passages"].as_array().unwrap() {
                    let s: Vec<u64> = p["sentences"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .filter(|x| {
                            self.targets
                                .iter()
                                .any(|t| x["text"].as_str().unwrap().starts_with(t))
                        })
                        .map(|x| x["s"].as_u64().unwrap())
                        .collect();
                    if !s.is_empty() {
                        ev.push(json!({"p": p["p"], "s": s}));
                    }
                }
                out(json!({"answer": self.answer, "evidence": ev, "note": self.note}))
            }
            other => panic!("unexpected {other}"),
        })
    }
}

#[test]
fn composes_from_named_sentences_and_the_checker_cleans_the_answer() {
    let b = common::pack();
    let llm = Arc::new(Oracle::new(
        "Identify energized lines before work begins, and use a dedicated spotter.",
        vec!["Before work begins", "A dedicated spotter must be used"],
    ));
    let e = common::engine(&b).with_llm(llm.clone());
    let (r, trace) = e
        .ask_traced(
            "what do I need to know about working near power lines",
            &AskOptions {
                cache_threshold: 2.0,
                ..AskOptions::default()
            },
        )
        .unwrap();
    assert_eq!(r.mode, Mode::Composed, "{:?}", trace.model_error);
    assert_eq!(r.model.as_deref(), Some("oracle"));
    assert_eq!(llm.asked(), vec!["expansion", "answer_evidence"]);
    // The answer first, then the named sentences copied verbatim by the engine.
    assert_eq!(
        r.body[0],
        Segment::text("Identify energized lines before work begins, and use a dedicated spotter.")
    );
    assert!(r.body.contains(&Segment::quote(
        "ex.2",
        "Before work begins, the controlling party must identify energized lines within the work zone."
    )));
    assert!(r.check.quotes_ok && r.check.cites_ok);
    assert!(
        r.citations.contains(&"ex.2".to_string()) && r.citations.contains(&"ex.2(a)".to_string())
    );
    // The model saw numbered pack sentences only.
    let req = &llm.requests.lock().unwrap()[1];
    assert!(req.user.contains("controlling party must identify") && req.user.contains("\"s\":1"));
}

#[test]
fn an_answer_with_a_number_the_sentences_do_not_state_is_dropped() {
    let b = common::pack();
    let llm = Arc::new(Oracle::new(
        "Keep at least 20 feet from lines up to 50 kV.",
        vec!["No part of the machine"],
    ));
    let (r, _) = common::engine(&b)
        .with_llm(llm)
        .ask_traced(
            "how close can the machine get to a 40 kV energized line",
            &AskOptions {
                cache_threshold: 2.0,
                ..AskOptions::default()
            },
        )
        .unwrap();
    // The wrong number is gone; the verbatim sentence with the right one stays.
    assert!(
        !r.body
            .iter()
            .any(|s| matches!(s, Segment::Text { text } if text.contains("20 feet")))
    );
    assert!(
        r.body
            .iter()
            .any(|s| matches!(s, Segment::Quote { text, .. } if text.contains("10 feet")))
    );
}

#[test]
fn evidence_out_of_range_is_ignored() {
    let b = common::pack();
    let llm = Arc::new(ScriptedLlm::new([
        expansion(&[]),
        out(
            json!({"answer": "A competent person inspects it each shift.",
                   "evidence": [{"p": 9, "s": [1]}, {"p": 1, "s": [99]}], "note": null}),
        ),
    ]));
    let (r, trace) = common::engine(&b)
        .with_llm(llm)
        .ask_traced(
            "who inspects the machine every shift",
            &AskOptions {
                cache_threshold: 2.0,
                ..AskOptions::default()
            },
        )
        .unwrap();
    assert!(
        r.model.is_none(),
        "nothing verifiable: the deterministic answer stands"
    );
    assert!(trace.model_error.is_some());
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
    // Partly covered (inspection, but no tower or schedule): worth a question.
    let r = e
        .ask("tower inspection schedule", &AskOptions::default())
        .unwrap();
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
            json!({"answer": "Inspect each shift before use.", "evidence": [{"p": 1, "s": [1]}], "note": null}),
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
        out(json!({"answer": "Unsupported.", "evidence": [], "note": null})),
    ]));
    let e = common::engine(&b).with_llm(llm);
    let (r, trace) = e
        .ask_traced(
            "Who must inspect the machine each shift?",
            // Few enough candidates that compose is asked without a selection.
            &AskOptions {
                support_threshold: 0.5,
                ..AskOptions::default()
            },
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
        out(
            json!({"answer": "Yes, fully extended.", "evidence": [{"p": 1, "s": [1]}], "note": null}),
        ),
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
fn strict_check_drops_unsourced_numbers_and_flipped_negation() {
    let b = common::pack();
    let body = vec![
        Segment::text("Identify energized lines before work begins."),
        Segment::text("There are two steps."),
        Segment::text("Inspect the line every 3 months."),
        Segment::text("Use a 4:1 safety factor."),
        Segment::text("Energized lines do not need to be identified before work."),
        Segment::text("Not required."),
        Segment::cite("ex.2"),
    ];
    let (kept, check) =
        harvest_core::check::check(&b.pack, &body, harvest_core::check::CheckOptions::STRICT)
            .unwrap();
    assert_eq!(
        kept,
        vec![
            Segment::text("Identify energized lines before work begins."),
            Segment::cite("ex.2"),
        ]
    );
    assert_eq!(check.dropped, 5);
}

#[test]
fn a_clarifying_question_with_a_number_is_not_shown() {
    let b = common::pack();
    let llm = Arc::new(ScriptedLlm::new([
        out(json!({
            "queries": ["clearance"], "ambiguous": true,
            "clarify": "Lines up to 50 kV need 20 feet. Is yours higher?"
        })),
        "not json".to_string(),
    ]));
    let e = common::engine(&b).with_llm(llm);
    let r = e
        .ask("how far from the line", &AskOptions::default())
        .unwrap();
    assert_ne!(r.mode, Mode::Clarify);
    assert!(
        !r.body
            .iter()
            .any(|s| matches!(s, Segment::Text { text } if text.contains("20 feet")))
    );
}

#[test]
fn bare_citations_are_not_a_model_answer() {
    let b = common::pack();
    let llm = Arc::new(ScriptedLlm::new([
        expansion(&["periodic inspection"]),
        out(json!({"answer": "Inspect it every 7 weeks.", "evidence": [], "note": null})),
    ]));
    let e = common::engine(&b).with_llm(llm);
    let (r, trace) = e
        .ask_traced(
            "how often is a periodic inspection needed",
            &AskOptions {
                // Skip the cache so the model path runs.
                cache_threshold: 2.0,
                ..AskOptions::default()
            },
        )
        .unwrap();
    assert_eq!(r.model, None, "{r:?}");
    assert!(trace.model_error.is_some());
}

#[test]
fn answerable_and_off_topic_questions_are_never_turned_into_questions() {
    let b = common::pack();
    let ambiguous = || {
        out(json!({
            "queries": ["inspection"], "ambiguous": true,
            "clarify": "Which machine do you mean?"
        }))
    };
    // Answerable: the model's composition fails, the deterministic answer stands.
    let llm = Arc::new(ScriptedLlm::new([ambiguous(), "not json".to_string()]));
    let r = common::engine(&b)
        .with_llm(llm)
        .ask(
            "who inspects the machine each shift",
            &AskOptions::default(),
        )
        .unwrap();
    assert_ne!(r.mode, Mode::Clarify);
    // Off topic: declined, not questioned.
    let llm = Arc::new(ScriptedLlm::new([ambiguous()]));
    let r = common::engine(&b)
        .with_llm(llm)
        .ask("what color are helmets on tuesday", &AskOptions::default())
        .unwrap();
    assert_eq!(r.mode, Mode::Declined);
}

#[derive(serde::Deserialize, Debug, PartialEq)]
struct Q {
    queries: Vec<String>,
}

fn req() -> harvest_core::LlmRequest {
    harvest_core::LlmRequest {
        system: "s".into(),
        user: "u".into(),
        schema: ("q".into(), json!({})),
        max_tokens: 200,
        temperature: 0.0,
    }
}

#[test]
fn reasoning_around_the_json_is_ignored() {
    use harvest_core::llm::parse_json;
    let want = Q {
        queries: vec!["clearance".into()],
    };
    for raw in [
        "<think>The user asks about lines. {not json}</think>{\"queries\":[\"clearance\"]}",
        "<|channel|>analysis<|message|>Think {\"queries\":[\"wrong\"]} more<|end|><|start|>assistant<|channel|>final<|message|>{\"queries\":[\"clearance\"]}<|return|>",
        "Sure. Here is the JSON you asked for: {\"queries\": [\"clearance\"]} Hope it helps.",
        "```json\n{\"queries\":[\"clearance\"]}\n```",
    ] {
        assert_eq!(parse_json::<Q>(raw).unwrap(), want, "{raw}");
    }
    // Only reasoning, or an unclosed think block: an output failure.
    assert!(parse_json::<Q>("<think>still thinking about {\"queries\"").is_err());
    // A template-opened block: everything before the closing tag is reasoning.
    assert_eq!(
        parse_json::<Q>("maybe {\"queries\":[\"wrong\"]}</think>{\"queries\":[\"clearance\"]}")
            .unwrap(),
        want
    );
    // Harmony cut off inside its analysis channel: never read the draft.
    assert!(
        parse_json::<Q>("<|channel|>analysis<|message|>maybe {\"queries\":[\"wrong\"]}").is_err()
    );
    // Required keys: a stray `{}` in prose is not an answer.
    #[derive(serde::Deserialize, Debug, PartialEq)]
    struct Loose {
        #[serde(default)]
        queries: Vec<String>,
    }
    let schema = json!({"required": ["queries"]});
    let got: Loose =
        harvest_core::llm::parse_json_for("{\"queries\":[\"a\"]} e.g. {}", &schema).unwrap();
    assert_eq!(got.queries, vec!["a".to_string()]);
    assert!(harvest_core::llm::parse_json_for::<Loose>("nothing here {}", &schema).is_err());
}

#[test]
fn a_budget_spent_reasoning_is_retried_once_with_room() {
    use harvest_core::llm::complete_json;
    // First call: the model reasoned and the budget ran out (no JSON).
    let llm = ScriptedLlm::new([
        "<think>Let me consider the user's question carefully".to_string(),
        out(json!({"queries": ["minimum clearance"]})),
    ]);
    let q: Q = complete_json(&llm, &req()).unwrap();
    assert_eq!(q.queries, vec!["minimum clearance".to_string()]);
    let reqs = llm.requests.lock().unwrap();
    assert_eq!(reqs.len(), 2);
    assert_eq!(reqs[0].max_tokens, 200);
    assert!(reqs[1].max_tokens >= 1024 && reqs[1].system.contains("JSON object only"));
    drop(reqs);
    // Twice: an error that says it retried, so the engine falls back.
    let llm = ScriptedLlm::new(["".to_string(), "still nothing".to_string()]);
    let err = complete_json::<Q>(&llm, &req()).unwrap_err().to_string();
    assert!(err.contains("retried"), "{err}");
}

#[test]
fn the_engine_survives_a_reasoning_model() {
    let b = common::pack();
    // Every call first burns its budget thinking, then answers on the retry.
    let think = || "<think>The user wants".to_string();
    let llm = Arc::new(ScriptedLlm::new([
        think(),
        expansion(&["shift inspection competent person"]),
        think(),
        out(json!({"section_ids": ["ex.3"]})),
        think(),
        out(
            json!({"answer": "A competent person must inspect the machine each shift.",
                   "evidence": [{"p": 1, "s": [1]}], "note": null}),
        ),
    ]));
    let (r, trace) = common::engine(&b)
        .with_llm(llm)
        .ask_traced(
            "who checks the machine every shift",
            &AskOptions {
                cache_threshold: 2.0,
                ..AskOptions::default()
            },
        )
        .unwrap();
    assert_eq!(
        r.model.as_deref(),
        Some("scripted-test-model"),
        "{:?}",
        trace.model_error
    );
    assert_eq!(r.mode, Mode::Composed);
}

#[test]
fn a_verdict_stands_only_with_the_rule_that_decides_it() {
    let b = common::pack();
    let check = |t: &str| {
        let body = vec![
            Segment::text(t),
            Segment::quote(
                "ex.3",
                "A competent person must inspect the machine each shift before use.",
            ),
            Segment::cite("ex.3"),
        ];
        harvest_core::check::check(&b.pack, &body, harvest_core::check::CheckOptions::STRICT)
            .unwrap()
            .0
    };
    assert!(
        !check("No.")
            .iter()
            .any(|s| matches!(s, Segment::Text { .. })),
        "bare verdict"
    );
    let kept = check("Yes, a competent person must inspect the machine each shift.");
    assert!(matches!(&kept[0], Segment::Text { text } if text.starts_with("Yes,")));
    // The claim after the verdict is still held to the source.
    assert!(
        !check("Yes, a crane operator inspects the boom annually.")
            .iter()
            .any(|s| matches!(s, Segment::Text { .. }))
    );
}
