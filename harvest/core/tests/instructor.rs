//! The Instructor: turns built from the course tree, rules quoted from the pack, model prose checked.
mod common;

use harvest_core::course::CourseTree;
use harvest_core::instructor::{Answered, Block, Input, Instructor, Learner, TurnRequest};
use harvest_core::llm::{Llm, LlmRequest};
use harvest_core::{Engine, HashingEmbedder, Pack, fixture};
use serde_json::{Value, json};
use std::sync::Arc;

fn exams() -> Value {
    json!([{"id": "core", "title": "Core exam", "minutes": 90,
            "domains": [{"id": "core.site", "title": "Site", "weight": 0.6, "count": 54, "skillIds": ["skill-clearance"]},
                        {"id": "core.ops", "title": "Operations", "weight": 0.4, "count": 36, "skillIds": []}]}])
}

/// A model that answers from the prompt it is given.
struct Dyn(Box<dyn Fn(&Value) -> Value + Send + Sync>);
impl Llm for Dyn {
    fn id(&self) -> String {
        "dyn-test".into()
    }
    fn complete(&self, req: &LlmRequest) -> harvest_core::Result<String> {
        let user: Value = serde_json::from_str(&req.user).unwrap();
        Ok((self.0)(&user).to_string())
    }
}

/// The handle of the first sentence of the passage cited `cite` that contains `needle`.
fn handle(user: &Value, cite: &str, needle: &str) -> String {
    for (i, r) in user["rules"].as_array().unwrap().iter().enumerate() {
        if r["citation"] == cite {
            for s in r["sentences"].as_array().unwrap() {
                if s["text"].as_str().unwrap().contains(needle) {
                    return s["h"].as_str().unwrap().to_string();
                }
            }
        }
        let _ = i;
    }
    panic!("no {needle:?} in {cite}: {user}");
}

/// Sentences the turn finally dropped (not the first pass a repair replaced).
fn final_drops(t: &harvest_core::instructor::Turn) -> usize {
    t.trace
        .dropped
        .iter()
        .filter(|d| !d.starts_with("repaired:"))
        .count()
}

fn plan(intent: &str, node: Option<&str>, evidence: Vec<String>, say: &str) -> Value {
    json!({"intent": intent, "node_id": node, "fields": [], "show": [], "evidence": evidence, "say": say,
           "tool": null, "kv": null, "traveling": null, "search": null})
}

fn instructor(pack: &Arc<Pack>, llm: Option<Arc<dyn Llm>>) -> Instructor {
    let e =
        Engine::new(pack.clone()).with_embedder(Arc::new(HashingEmbedder::new(fixture::EMBED_DIM)));
    Instructor::new(
        Arc::new(e),
        llm,
        CourseTree::from_pack(pack, Some(exams())).unwrap(),
    )
}

fn ask(text: &str) -> TurnRequest {
    TurnRequest {
        history: vec![],
        learner: Learner::default(),
        at: None,
        ask: Some(text.into()),
        input: None,
    }
}

#[test]
fn welcome_opens_on_the_exam_with_the_domains_as_follow_ups() {
    let b = common::pack();
    let i = instructor(&b.pack, None);
    let t = i.welcome(&Learner::default()).unwrap();
    assert_eq!(
        t.blocks,
        vec![Block::Exam {
            exam_id: "core".into()
        }]
    );
    let labels: Vec<&str> = t.follow_ups.iter().map(|f| f.label.as_str()).collect();
    assert_eq!(labels, ["Site", "Operations"]);
    assert_eq!(t.at.as_deref(), Some("course"));
    // A tap is answered from the tree, no model.
    let tap = TurnRequest {
        input: t.follow_ups[0].input.clone(),
        ask: None,
        ..ask("")
    };
    let t2 = i.turn(&tap).unwrap();
    assert!(matches!(&t2.blocks[0], Block::Node { node_id, .. } if node_id == "domain:core.site"));
    assert_eq!(t2.follow_ups[0].label, "Minimum clearance");
    assert!(t2.model.is_none());
}

#[test]
fn a_baked_welcome_is_checked_like_any_turn() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("p");
    let welcome = json!({"who": "instructor", "status": "done", "model": null, "follow_ups": [], "blocks": [
        {"t": "text", "text": "Welcome."},
        {"t": "quote", "section_id": "ex.2", "text": "closer than 10 feet to an energized line"},
        {"t": "quote", "section_id": "ex.2", "text": "closer than 99 feet"},
        {"t": "lesson", "lesson_id": "no-such-lesson"}]});
    fixture::build_with(&dir, "2026.1.1-1", |c| {
        c.execute(
            "INSERT INTO pack_meta VALUES ('instructor_welcome', ?1)",
            [welcome.to_string()],
        )?;
        Ok(())
    })
    .unwrap();
    let pack = Arc::new(Pack::open(&dir, &[fixture::trusted_key()]).unwrap());
    let t = instructor(&pack, None)
        .welcome(&Learner::default())
        .unwrap();
    assert_eq!(t.blocks.len(), 2, "{:?}", t.blocks);
    assert_eq!(t.trace.dropped.len(), 2);
}

#[test]
fn rule_quotes_come_from_the_pack_and_unsupported_prose_is_dropped() {
    let b = common::pack();
    let llm = Dyn(Box::new(|u| {
        let a = handle(u, "§2", "must identify energized lines");
        let c = handle(u, "§2", "No part of the machine");
        plan(
            "rule",
            None,
            vec![a, c],
            "The controlling party must identify energized lines within the work zone before work begins. \
             No part of the machine may come closer than 10 feet to a line rated up to 50 kV. \
             You must also wear a hard hat rated for the line.",
        )
    }));
    let i = instructor(&b.pack, Some(Arc::new(llm)));
    let t = i
        .turn(&ask("what do i do about power lines before work"))
        .unwrap();
    assert_eq!(
        t.blocks[0],
        Block::Text {
            text: "The controlling party must identify energized lines within the work zone before work begins. \
                   No part of the machine may come closer than 10 feet to a line rated up to 50 kV."
                .into()
        }
    );
    assert_eq!(final_drops(&t), 1, "{:?}", t.trace.dropped);
    let quotes: Vec<&Block> = t
        .blocks
        .iter()
        .filter(|b| matches!(b, Block::Quote { .. }))
        .collect();
    assert_eq!(
        quotes.len(),
        1,
        "adjacent sentences quote as one run: {:?}",
        t.blocks
    );
    let Block::Quote { section_id, text } = quotes[0] else {
        unreachable!()
    };
    assert_eq!(section_id, "ex.2");
    assert!(
        text.starts_with("Before work begins") && text.ends_with("rated up to 50 kV."),
        "{text}"
    );
    assert_eq!(
        t.blocks.last(),
        Some(&Block::Cite {
            section_id: "ex.2".into()
        })
    );
    assert_eq!(t.model.as_deref(), Some("dyn-test"));
}

#[test]
fn support_is_only_the_rule_sentences_shown() {
    let b = common::pack();
    // The model names only the first sentence of §2; the 10-foot limit is in
    // the same section but not shown, so it cannot support the claim.
    let llm = Dyn(Box::new(|u| {
        let a = handle(u, "§2", "must identify energized lines");
        plan(
            "rule",
            None,
            vec![a],
            "Keep the machine 10 feet from the line.",
        )
    }));
    let i = instructor(&b.pack, Some(Arc::new(llm)));
    let t = i
        .turn(&ask("what do i do about power lines before work"))
        .unwrap();
    assert!(
        !t.blocks.iter().any(|b| matches!(b, Block::Text { .. })),
        "{:?}",
        t.blocks
    );
    assert_eq!(final_drops(&t), 1);
}

#[test]
fn a_rule_answer_with_no_evidence_states_nothing_and_shows_the_search() {
    let b = common::pack();
    let llm = Dyn(Box::new(|_| {
        plan(
            "rule",
            None,
            vec!["r9.9".into()],
            "You must stay 30 feet away. I could not find this exactly.",
        )
    }));
    let i = instructor(&b.pack, Some(Arc::new(llm)));
    let t = i.turn(&ask("how far from a 900 kv line")).unwrap();
    assert_eq!(
        t.blocks[0],
        Block::Text {
            text: "I could not find this exactly.".into()
        }
    );
    assert!(
        matches!(t.blocks.last(), Some(Block::Search { query }) if query == "how far from a 900 kv line")
    );
    assert!(!t.blocks.iter().any(|b| matches!(b, Block::Quote { .. })));
}

#[test]
fn a_node_turn_shows_the_node_and_numbers_only_from_what_it_shows() {
    let b = common::pack();
    let llm = Dyn(Box::new(|u| {
        assert!(
            u["nodes"]
                .as_array()
                .unwrap()
                .iter()
                .any(|n| n["node_id"] == "domain:core.site"),
            "{u}"
        );
        plan(
            "node",
            Some("domain:core.site"),
            vec![],
            "Site is 60% of the exam. It has 7 hard parts.",
        )
    }));
    let i = instructor(&b.pack, Some(Arc::new(llm)));
    let t = i
        .turn(&ask("tell me about the site part of the test"))
        .unwrap();
    assert_eq!(
        t.blocks[0],
        Block::Text {
            text: "Site is 60% of the exam.".into()
        }
    );
    assert!(matches!(&t.blocks[1], Block::Node { node_id, .. } if node_id == "domain:core.site"));
    assert_eq!(t.at.as_deref(), Some("domain:core.site"));
}

#[test]
fn review_focus_practice_and_model_off() {
    let b = common::pack();
    let learner = Learner {
        mastery: [("skill-clearance".to_string(), 0.2)].into(),
        recent: vec![Answered {
            q_id: "q-clear-1".into(),
            chosen: 0,
        }],
        ..Learner::default()
    };
    let llm = Dyn(Box::new(|u| {
        assert_eq!(u["learner"]["last_answer"]["chose"], "5 feet");
        plan("review", None, vec![], "You picked 5 feet.")
    }));
    let i = instructor(&b.pack, Some(Arc::new(llm)));
    let t = i
        .turn(&TurnRequest {
            learner: learner.clone(),
            ..ask("why was i wrong")
        })
        .unwrap();
    assert!(t.blocks.contains(&Block::Question {
        q_id: "q-clear-1".into(),
        chosen: Some(0)
    }));

    let t = i
        .turn(&TurnRequest {
            learner: learner.clone(),
            input: Some(Input::Focus),
            ask: None,
            ..ask("")
        })
        .unwrap();
    let Block::Focus { items } = &t.blocks[0] else {
        panic!()
    };
    assert_eq!(
        (items[0].node_id.as_str(), items[0].mastery),
        ("skill:skill-clearance", Some(0.2))
    );

    let t = i
        .turn(&TurnRequest {
            input: Some(Input::Practice {
                skill_id: "skill-clearance".into(),
            }),
            ask: None,
            ..ask("")
        })
        .unwrap();
    assert_eq!(
        t.blocks,
        vec![Block::Question {
            q_id: "q-clear-1".into(),
            chosen: None
        }]
    );

    let off = instructor(&b.pack, None);
    let t = off.turn(&ask("energized lines")).unwrap();
    assert!(matches!(&t.blocks[0], Block::Node { node_id, .. } if node_id == "topic:topic-lines"));
    let t = off.turn(&ask("zzzz qqqq")).unwrap();
    assert!(matches!(&t.blocks[0], Block::Search { .. }));
}

#[test]
fn a_value_in_a_range_table_leads_with_its_row() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("p");
    fixture::build_with(&dir, "2026.1.1-1", |c| {
        c.execute_batch(
            "INSERT INTO section VALUES ('ex.t', 'ex-rules', 'ex.2', 99, 2, 'table', '§2 Table A',
               'Table A—Minimum Clearance Distances',
               'Voltage (nominal, kV) | Minimum clearance distance (feet)\nup to 50 | 10\nover 50 to 200 | 15\nover 200 to 350 | 20',
               'x', 'en');
             INSERT INTO chunk VALUES ('c-ex.t', 'section', 'ex.t',
               'Table A Minimum Clearance Distances voltage kV clearance feet power line', 'en');",
        )?;
        Ok(())
    })
    .unwrap();
    let pack = Arc::new(Pack::open(&dir, &[fixture::trusted_key()]).unwrap());
    let llm = Dyn(Box::new(|_| {
        plan(
            "rule",
            None,
            vec![],
            "Here is the table row for that voltage.",
        )
    }));
    let i = instructor(&pack, Some(Arc::new(llm)));
    let t = i
        .turn(&ask("whats the clearance for a 200 kv power line"))
        .unwrap();
    assert_eq!(
        t.blocks[0],
        Block::Text {
            text: "For 200 kV, Table A—Minimum Clearance Distances: 15 feet.".into()
        }
    );
    assert_eq!(
        t.blocks[1],
        Block::Text {
            text: "Here is the table row for that voltage.".into()
        }
    );
    assert!(t.blocks.contains(&Block::Quote {
        section_id: "ex.t".into(),
        text: "over 50 to 200 | 15".into()
    }));
    assert!(!t.blocks.iter().any(|b| matches!(b, Block::Search { .. })));
}

#[test]
fn rule_claims_are_told_from_teaching() {
    use harvest_core::instructor::is_rule_claim;
    for s in [
        "The operator must stop.",
        "A signal person is required when the view is blocked.",
        "Stay at least 20 feet away.",
        "You have to be certified to run it.",
        "You need to get the employer's approval first.",
    ] {
        assert!(is_rule_claim(s), "{s}");
    }
    for s in [
        "Never ride the load.",
        "Riding the hook is forbidden.",
        "You can't swing a load over workers.",
        "Only a qualified rigger can attach loads.",
        "You should always wear a harness.",
        "You should wear a harness.",
        "You may lift over workers if the horn sounds.",
        "No one may ride the hook.",
        "Do not stand under the load.",
        "You can\u{2019}t swing over people.",
        "\u{201C}Never\u{201D} means stay clear of the swing radius.",
    ] {
        assert!(is_rule_claim(s), "{s}");
    }
    for s in [
        "You have to read the chart and do the math carefully.",
        "You should practice the load chart questions.",
        "You can find the load on the chart.",
        "Load charts are where most people lose points.",
        "Let's look at radius next.",
    ] {
        assert!(!is_rule_claim(s), "{s}");
    }
}

#[test]
fn a_leading_no_is_a_verdict_only_before_punctuation() {
    use harvest_core::check::holds;
    let src = "Parts of the machine may come closer than 10 feet to a de-energized line.";
    // "No part …" negates the claim; it must not pass against a positive source.
    assert!(!holds(
        "No part of the machine may come closer than 10 feet to a de-energized line.",
        src,
        0.75
    ));
    assert!(holds(
        "No, parts of the machine may come closer than 10 feet to a de-energized line.",
        src,
        0.75
    ));
}

#[test]
fn a_claim_takes_its_numbers_from_one_row_and_odd_first_characters_are_safe() {
    use harvest_core::check::holds;
    let rows =
        "Voltage (kV) | Minimum clearance distance (feet)\nup to 50 | 10\nover 50 to 200 | 15";
    assert!(holds("Over 50 to 200 kV is 15 feet.", rows, 0.5));
    assert!(
        !holds("Over 50 kV is 10 feet.", rows, 0.5),
        "50 and 10 from different rows"
    );
    for s in [
        "\u{201C}No\u{201D} is the answer.",
        "\u{2014}no",
        "\u{1F600} yes",
    ] {
        let _ = holds(s, rows, 0.75); // no panic on a multi-byte first character
    }
}

#[test]
fn outside_rule_turns_a_quote_must_back_a_claim() {
    let b = common::pack();
    let llm = Dyn(Box::new(|u| {
        let a = handle(u, "§2", "must identify energized lines");
        plan(
            "node",
            Some("domain:core.site"),
            vec![a],
            "Site is 60% of the exam.",
        )
    }));
    let i = instructor(&b.pack, Some(Arc::new(llm)));
    let t = i
        .turn(&ask(
            "tell me about the site part of the test and power lines",
        ))
        .unwrap();
    assert!(
        !t.blocks
            .iter()
            .any(|b| matches!(b, Block::Quote { .. } | Block::Cite { .. })),
        "{:?}",
        t.blocks
    );
}

#[test]
fn a_reply_that_loses_sentences_is_written_again_once() {
    let b = common::pack();
    let llm = Dyn(Box::new(|u| {
        if u.get("removed").is_some() {
            assert!(
                u["removed"][0].as_str().unwrap().contains("hard hat"),
                "{u}"
            );
            plan(
                "chat",
                None,
                vec![],
                "Glad to help. Want to try a practice question next?",
            )
        } else {
            plan(
                "chat",
                None,
                vec![],
                "Glad to help. You must always wear a hard hat near lines.",
            )
        }
    }));
    let i = instructor(&b.pack, Some(Arc::new(llm)));
    let t = i.turn(&ask("thanks")).unwrap();
    assert_eq!(
        t.blocks[0],
        Block::Text {
            text: "Glad to help. Want to try a practice question next?".into()
        }
    );
    assert_eq!(final_drops(&t), 0);
    assert!(t.trace.dropped[0].starts_with("repaired: "));
    assert_eq!(t.trace.plans.len(), 2);
}

#[test]
fn a_list_item_is_quoted_with_the_sentence_that_introduces_its_list() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("p");
    fixture::build_with(&dir, "2026.1.1-1", |c| {
        c.execute_batch(
            "INSERT INTO section VALUES ('ex.9', 'ex-rules', NULL, 90, 1, 'section', '§9', 'Stopping',
               'The operator must stop the lift in any of the following circumstances:\n(a) The load is over a cofferdam.', 'x', 'en');
             INSERT INTO section VALUES ('ex.9(a)', 'ex-rules', 'ex.9', 91, 2, 'paragraph', '§9(a)', NULL,
               '(a) The load is over a cofferdam.', 'y', 'en');
             INSERT INTO chunk VALUES ('c-ex.9(a)', 'section', 'ex.9(a)', 'Stopping a lift: the load is over a cofferdam.', 'en');",
        )?;
        Ok(())
    })
    .unwrap();
    let pack = Arc::new(Pack::open(&dir, &[fixture::trusted_key()]).unwrap());
    let llm = Dyn(Box::new(|u| {
        let h = handle(u, "§9(a)", "cofferdam");
        plan(
            "rule",
            None,
            vec![h],
            "Yes: a load over a cofferdam is one of the cases.",
        )
    }));
    let i = instructor(&pack, Some(Arc::new(llm)));
    let t = i
        .turn(&ask("do i stop a lift when the load is over a cofferdam"))
        .unwrap();
    let quotes: Vec<&Block> = t
        .blocks
        .iter()
        .filter(|b| matches!(b, Block::Quote { .. }))
        .collect();
    assert_eq!(
        quotes,
        [
            &Block::Quote {
                section_id: "ex.9".into(),
                text: "The operator must stop the lift in any of the following circumstances:"
                    .into()
            },
            &Block::Quote {
                section_id: "ex.9(a)".into(),
                text: "(a) The load is over a cofferdam.".into()
            },
        ],
        "{:?}",
        t.blocks
    );
}

#[test]
fn study_talk_without_an_answer_to_review_shows_the_focus_list() {
    use harvest_core::llm::ScriptedLlm;
    let b = common::pack();
    let llm = Arc::new(ScriptedLlm::new([plan(
        "review",
        None,
        vec![],
        "Here is where to spend your week.",
    )
    .to_string()]));
    let i = instructor(&b.pack, Some(llm.clone()));
    let learner = Learner {
        mastery: [("skill-clearance".to_string(), 0.2)].into(),
        ..Learner::default()
    };
    let t = i
        .turn(&TurnRequest {
            learner,
            ..ask("test is next week what do i study")
        })
        .unwrap();
    assert!(
        matches!(&t.blocks[1], Block::Focus { items } if items[0].node_id == "skill:skill-clearance"),
        "{:?}",
        t.blocks
    );
    assert!(!t.blocks.iter().any(|b| matches!(b, Block::Quote { .. })));
    // No answer to review: the model is not offered `review` at all.
    let schema = &llm.requests.lock().unwrap()[0].schema.1;
    let intents = schema["properties"]["intent"]["enum"].as_array().unwrap();
    assert!(!intents.iter().any(|i| i == "review") && intents.iter().any(|i| i == "focus"));
}

#[test]
fn orders_and_presumptions_are_claims_and_pointers_need_their_block() {
    use harvest_core::instructor::is_rule_claim;
    for s in [
        "Assume every line is live.",
        "Lines are presumed energized until the utility says otherwise.",
        "The controlling entity is responsible for ground conditions.",
        "Keep the boom clear of the line.",
        "Stay out of the swing radius.",
        "Please keep the boom clear of the line.",
        "Remember to stay out of the swing radius.",
    ] {
        assert!(is_rule_claim(s), "{s}");
    }
    for s in [
        "I assume you mean the load chart.",
        "We assume you have seen a load chart.",
        "Presumably you have done a few.",
        "Try the practice question next.",
        "Read the chart title first.",
        "Keep practicing load charts.",
        "Use the clearance tool for your line.",
    ] {
        assert!(!is_rule_claim(s), "{s}");
    }
    let b = common::pack();
    let llm = Dyn(Box::new(|_| {
        plan(
            "node",
            Some("domain:core.site"),
            vec![],
            "For details, see the rule quoted below. Site is 60% of the exam.",
        )
    }));
    let i = instructor(&b.pack, Some(Arc::new(llm)));
    let t = i.turn(&ask("tell me about site")).unwrap();
    assert_eq!(
        t.blocks[0],
        Block::Text {
            text: "Site is 60% of the exam.".into()
        }
    );
    assert!(
        t.trace
            .dropped
            .iter()
            .any(|d| d.contains("points at nothing shown")),
        "{:?}",
        t.trace.dropped
    );
}

#[test]
fn a_node_opens_on_its_overview_and_never_repeats_itself() {
    use harvest_core::instructor::{Message, NodeText};
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("p");
    fixture::build_with(&dir, "2026.1.1-1", |c| {
        c.execute_batch(
            r#"INSERT INTO course_node VALUES ('course', NULL, 0, 'course', 'Machine course', 'All of it.', '', '', '', '{}', '[]', '[]', 'en', 'prov-fixture');
               INSERT INTO course_node VALUES ('topic:lines', 'course', 1, 'topic', 'Energized lines',
                 'How close a machine may work to an energized power line, by voltage.', 'Picking the right voltage band when a value sits on a boundary.',
                 'Measuring from the cab instead of the closest part of the load.', 'Expect a table lookup.', '{}', '["ex.2"]', '[]', 'en', 'prov-fixture');"#,
        )?;
        Ok(())
    })
    .unwrap();
    let pack = Arc::new(Pack::open(&dir, &[fixture::trusted_key()]).unwrap());
    let i = instructor(&pack, None);
    let open = Input::Open {
        node_id: "topic:lines".into(),
        fields: vec![],
    };
    let t = i
        .turn(&TurnRequest {
            input: Some(open.clone()),
            ask: None,
            ..ask("")
        })
        .unwrap();
    let Block::Node { texts, .. } = &t.blocks[0] else {
        panic!("{:?}", t.blocks)
    };
    let fields: Vec<&str> = texts.iter().map(|x| x.field.as_str()).collect();
    assert_eq!(fields, ["summary", "hard"]);
    assert!(
        t.follow_ups
            .iter()
            .any(|f| f.label == "What do people get wrong?")
    );
    // The same node again: what was shown is not shown again.
    let history = vec![Message {
        who: "instructor".into(),
        text: t.plain(),
    }];
    let t2 = i
        .turn(&TurnRequest {
            input: Some(open),
            ask: None,
            history,
            ..ask("")
        })
        .unwrap();
    let Block::Node { texts, .. } = &t2.blocks[0] else {
        panic!()
    };
    assert_eq!(
        texts,
        &[NodeText {
            field: "mistakes".into(),
            text: "Measuring from the cab instead of the closest part of the load.".into()
        }]
    );
}
