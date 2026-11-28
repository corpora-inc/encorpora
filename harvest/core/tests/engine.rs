mod common;

use harvest_core::check::{self, CheckOptions};
use harvest_core::retrieval::DenseStatus;
use harvest_core::{AskOptions, Engine, HashingEmbedder, Mode, Role, SearchOptions, Segment};
use std::sync::Arc;

#[test]
fn schema_matches_contract() {
    let contract = include_str!("../../CONTRACT.md");
    let start = contract.find("## Schema v1").unwrap();
    let block = &contract[start..];
    let sql_start = block.find("```sql\n").unwrap() + "```sql\n".len();
    let sql_end = block[sql_start..].find("```").unwrap();
    assert_eq!(
        &block[sql_start..sql_start + sql_end],
        harvest_core::pack::SCHEMA_V1
    );
}

#[test]
fn opening_checks_meta_against_manifest() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("p");
    harvest_core::fixture::build_with(&dir, "2026.1.1-1", |c| {
        c.execute(
            "UPDATE pack_meta SET value = '2020.1.1-1' WHERE key = 'version'",
            [],
        )?;
        Ok(())
    })
    .unwrap();
    let err = harvest_core::Pack::open(&dir, &[harvest_core::fixture::trusted_key()]).unwrap_err();
    assert!(err.to_string().contains("pack_meta.version"), "{err}");
}

#[test]
fn lexical_and_dense_find_the_right_section() {
    let b = common::pack();
    let e = common::engine(&b);
    let r = e
        .retriever()
        .search("clearance from energized lines", &SearchOptions::default())
        .unwrap();
    assert_eq!(r.dense, DenseStatus::Used);
    assert_eq!(r.hits[0].section_id.as_deref(), Some("ex.2"));
    assert!(r.hits[0].lexical > 0.0 && r.hits[0].dense > 0.0);

    // Chunk → section for every ref kind the pipeline writes.
    for (kind, id, want) in [
        ("section", "ex.3", Some("ex.3")),
        ("explanation", "ex.2:trainee", Some("ex.2")),
        ("explanation", "ex.2", Some("ex.2")),
        ("fact", "f-clear-10", Some("ex.2")),
        ("term", "t-spotter", Some("ex.2(a)")),
        ("answer", "a-clearance", Some("ex.2")),
        ("question", "q-clear-1", Some("ex.2")),
        ("diagram", "dia-clearance", Some("ex.2")),
        ("proc_step", "proc-shift#1", Some("ex.3")),
        ("proc_step", "proc-shift#x", None),
        ("lesson", "lesson-lines", None),
    ] {
        assert_eq!(
            b.pack.chunk_section(kind, id).unwrap().as_deref(),
            want,
            "{kind} {id}"
        );
    }

    // Pack synonym: "power line" → "energized line".
    let r = e
        .retriever()
        .search("power line", &SearchOptions::default())
        .unwrap();
    assert!(r.expansions.contains(&"energized line".to_string()));
    assert_eq!(r.hits[0].section_id.as_deref(), Some("ex.2"));
}

#[test]
fn lexical_only_without_embedder_and_refused_on_mismatch() {
    let b = common::pack();
    let plain = Engine::new(b.pack.clone());
    let r = plain
        .retriever()
        .search("periodic inspection", &SearchOptions::default())
        .unwrap();
    assert_eq!(r.dense, DenseStatus::NoEmbedder);
    assert_eq!(r.hits[0].section_id.as_deref(), Some("ex.3"));
    assert!(r.hits.iter().all(|h| h.dense == 0.0));

    let wrong = Engine::new(b.pack.clone()).with_embedder(Arc::new(HashingEmbedder::new(128)));
    let r = wrong
        .retriever()
        .search("periodic inspection", &SearchOptions::default())
        .unwrap();
    assert!(
        matches!(r.dense, DenseStatus::Mismatch { .. }),
        "{:?}",
        r.dense
    );
    assert!(r.hits.iter().all(|h| h.dense == 0.0));
}

#[test]
fn equipment_filters_and_boosts() {
    let b = common::pack();
    let e = common::engine(&b);
    let q = "must stabilizers be fully extended";
    let tracked = SearchOptions {
        equip: Some("machine-tracked".into()),
        ..SearchOptions::default()
    };
    let r = e.retriever().search(q, &tracked).unwrap();
    assert!(
        r.hits
            .iter()
            .all(|h| h.section_id.as_deref() != Some("ex.4")),
        "wheeled-only dropped"
    );
    let wheeled = SearchOptions {
        equip: Some("machine-wheeled".into()),
        ..SearchOptions::default()
    };
    let r = e.retriever().search(q, &wheeled).unwrap();
    assert_eq!(r.hits[0].section_id.as_deref(), Some("ex.4"));
    // A parent-level user sees children's rows.
    let any = SearchOptions {
        equip: Some("machine".into()),
        ..SearchOptions::default()
    };
    let r = e.retriever().search(q, &any).unwrap();
    assert_eq!(r.hits[0].section_id.as_deref(), Some("ex.4"));
}

#[test]
fn reranker_hook_reorders() {
    struct Reverse;
    impl harvest_core::Reranker for Reverse {
        fn id(&self) -> &str {
            "reverse"
        }
        fn rerank(&self, _q: &str, c: &[harvest_core::Hit]) -> harvest_core::Result<Vec<f64>> {
            Ok((0..c.len()).map(|i| i as f64).collect())
        }
    }
    let b = common::pack();
    let base = common::engine(&b);
    let opts = SearchOptions {
        k: 50,
        ..SearchOptions::default()
    };
    let plain = base.retriever().search("inspection", &opts).unwrap();
    let e = common::engine(&b).with_reranker(Arc::new(Reverse));
    let r = e.retriever().search("inspection", &opts).unwrap();
    assert_eq!(r.reranker.as_deref(), Some("reverse"));
    assert_eq!(
        r.hits.first().unwrap().chunk_id,
        plain.hits.last().unwrap().chunk_id
    );
}

#[test]
fn baked_answer_from_the_cache() {
    let b = common::pack();
    let e = common::engine(&b);
    for q in [
        "How close can the machine get to a power line?",
        "how close can a machine get to power lines",
        "Minimum clearance from power lines?",
    ] {
        let r = e.ask(q, &AskOptions::default()).unwrap();
        assert_eq!(r.mode, Mode::Baked, "{q}");
        assert_eq!(r.answer_id.as_deref(), Some("a-clearance"));
        assert_eq!(r.citations, vec!["ex.2".to_string()]);
        assert!(r.check.quotes_ok && r.check.cites_ok && r.check.dropped == 0);
    }
}

#[test]
fn role_picks_the_level() {
    let b = common::pack();
    let e = common::engine(&b);
    let q = "How often is a periodic inspection required?";
    let op = e.ask(q, &AskOptions::default()).unwrap();
    assert_eq!(op.answer_id.as_deref(), Some("a-periodic-op"));
    let tr = e
        .ask(
            q,
            &AskOptions {
                role: Role::Trainee,
                ..AskOptions::default()
            },
        )
        .unwrap();
    assert_eq!(tr.answer_id.as_deref(), Some("a-periodic-tr"));
}

#[test]
fn a_different_number_is_a_different_question() {
    let b = common::pack();
    let e = common::engine(&b);
    let r = e
        .ask(
            "How close can the machine get to a 500 kV power line?",
            &AskOptions::default(),
        )
        .unwrap();
    assert_ne!(r.mode, Mode::Baked);
}

#[test]
fn composed_answer_quotes_verbatim_with_citations() {
    let b = common::pack();
    let e = common::engine(&b);
    let r = e
        .ask(
            "Who must inspect the machine each shift?",
            &AskOptions::default(),
        )
        .unwrap();
    assert_eq!(r.mode, Mode::Composed);
    assert_eq!(r.citations.first().map(String::as_str), Some("ex.3"));
    let sec = b.pack.section("ex.3").unwrap().unwrap();
    for s in &r.body {
        if let Segment::Quote { section_id, text } = s {
            let src = b.pack.section(section_id).unwrap().unwrap();
            assert!(check::quote_in(text, &src.text));
        }
    }
    assert!(
        r.body
            .iter()
            .any(|s| matches!(s, Segment::Quote { text, .. } if sec.text.contains(text.as_str())))
    );
    assert!(r.check.quotes_ok && r.check.cites_ok);
}

#[test]
fn composed_uses_the_role_explanation() {
    let b = common::pack();
    let e = common::engine(&b);
    let r = e
        .ask(
            "spotter near energized line clearance distance",
            &AskOptions {
                role: Role::Trainee,
                ..AskOptions::default()
            },
        )
        .unwrap();
    assert_eq!(r.mode, Mode::Composed);
    let trainee = b
        .pack
        .explanation("ex.2", "trainee", "en")
        .unwrap()
        .unwrap();
    assert!(r.body.contains(&Segment::text(trainee)));
}

#[test]
fn declines_with_nearest_sections_when_support_is_weak() {
    let b = common::pack();
    let e = common::engine(&b);
    for q in [
        "What is the speed of light in a vacuum?",
        "best pizza recipe",
        "inspection of the moon rocket",
    ] {
        let r = e.ask(q, &AskOptions::default()).unwrap();
        assert_eq!(r.mode, Mode::Declined, "{q}");
        assert!(r.body.is_empty() && r.citations.is_empty());
    }
    let r = e
        .ask("inspection of the moon rocket", &AskOptions::default())
        .unwrap();
    assert!(r.nearest.contains(&"ex.3".to_string()), "{:?}", r.nearest);
}

#[test]
fn checker_structural_rules() {
    let b = common::pack();
    let body = vec![
        Segment::text("Intro with no support."),
        Segment::text("Still the same paragraph."),
        Segment::quote("ex.2", "closer than 10 feet"),
        Segment::text("A claim with a fabricated quote."),
        Segment::quote("ex.2", "closer than 3 feet"),
        Segment::text("A claim citing nothing real."),
        Segment::cite("ex.999"),
        Segment::text("Trailing claim."),
    ];
    let (out, c) = check::check(&b.pack, &body, CheckOptions::STRUCTURAL).unwrap();
    assert!(!c.quotes_ok && !c.cites_ok);
    // bad quote, bad cite, and the three unsupported texts after them.
    assert_eq!(c.dropped, 5);
    assert_eq!(
        out,
        vec![
            Segment::text("Intro with no support."),
            Segment::text("Still the same paragraph."),
            Segment::quote("ex.2", "closer than 10 feet"),
        ]
    );
    // Whitespace differences are allowed in quotes; nothing else.
    assert!(check::quote_in(
        "closer  than\n10 feet",
        &b.pack.section("ex.2").unwrap().unwrap().text
    ));
    assert!(!check::quote_in(
        "Closer than 10 feet",
        &b.pack.section("ex.2").unwrap().unwrap().text
    ));
}

#[test]
fn checker_strict_verbatim_and_numbers() {
    let b = common::pack();
    let body = vec![
        Segment::text("Stay 10 feet away from lines up to 50 kV."),
        Segment::cite("ex.2"),
        Segment::text("Stay 25 feet away from every line."),
        Segment::cite("ex.2"),
        Segment::text("Bananas taste wonderful with chocolate sauce."),
        Segment::cite("ex.2"),
        Segment::text("Identify energized lines before work begins."),
        Segment::cite("ex.2"),
    ];
    let (out, c) = check::check(&b.pack, &body, CheckOptions::STRICT).unwrap();
    assert_eq!(c.dropped, 3);
    let fact_quote = b.pack.facts_for_section("ex.2").unwrap()[0].quote.clone();
    assert_eq!(
        out,
        vec![
            Segment::cite("ex.2"),
            Segment::quote("ex.2", fact_quote),
            Segment::cite("ex.2"),
            Segment::cite("ex.2"),
            Segment::text("Identify energized lines before work begins."),
            Segment::cite("ex.2"),
        ]
    );
}

#[test]
fn a_baked_answer_with_a_broken_quote_is_not_served() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("p");
    harvest_core::fixture::build_with(&dir, "2026.1.1-1", |c| {
        c.execute(
            "UPDATE answer SET body = '[{\"t\":\"text\",\"text\":\"x\"},{\"t\":\"quote\",\"section_id\":\"ex.2\",\"text\":\"not in the text\"}]' WHERE answer_id = 'a-clearance'",
            [],
        )?;
        Ok(())
    })
    .unwrap();
    let pack =
        Arc::new(harvest_core::Pack::open(&dir, &[harvest_core::fixture::trusted_key()]).unwrap());
    let r = Engine::new(pack)
        .ask(
            "How close can the machine get to a power line?",
            &AskOptions::default(),
        )
        .unwrap();
    assert_ne!(r.mode, Mode::Baked);
}

#[test]
fn latency_on_the_fixture() {
    let b = common::pack();
    let e = common::engine(&b);
    let qs = [
        "How close can the machine get to a power line?",
        "Who must inspect the machine each shift?",
        "What is the speed of light in a vacuum?",
        "must stabilizers be fully extended",
    ];
    // Warm the vector index.
    e.ask(qs[0], &AskOptions::default()).unwrap();
    let n = 200;
    let t = std::time::Instant::now();
    for i in 0..n {
        e.ask(qs[i % qs.len()], &AskOptions::default()).unwrap();
    }
    let ask_us = t.elapsed().as_micros() as f64 / n as f64;
    let t = std::time::Instant::now();
    for i in 0..n {
        e.retriever()
            .search(qs[i % qs.len()], &SearchOptions::default())
            .unwrap();
    }
    let search_us = t.elapsed().as_micros() as f64 / n as f64;
    println!("fixture latency: search {search_us:.0} us, ask {ask_us:.0} us (mean of {n})");
    assert!(ask_us < 50_000.0);
}

/// Replays the gate from `support` alone, as the evaluation does offline.
fn replay(s: &harvest_core::answer::Support, threshold: f64) -> Vec<String> {
    s.candidates
        .iter()
        .filter(|c| c.coverage >= threshold && c.coverage >= s.score - s.window)
        .take(s.max_sections)
        .map(|c| c.section_id.clone())
        .collect()
}

#[test]
fn support_replays_the_gate_offline() {
    let b = common::pack();
    let e = common::engine(&b);
    for q in [
        "who inspects the machine each shift",
        "inspection of the moon rocket",
        "best pizza recipe",
        "dedicated spotter energized line",
    ] {
        let r = e.ask(q, &AskOptions::default()).unwrap();
        let s = &r.support;
        assert_eq!(s.threshold, 0.4);
        assert!(!s.concepts.is_empty(), "{q}");
        assert!(
            s.candidates.windows(2).all(|w| w[0].rank < w[1].rank),
            "{q}"
        );
        for c in &s.candidates {
            assert!((c.coverage - c.covered.len() as f64 / s.concepts.len() as f64).abs() < 1e-9);
        }
        let best = s.candidates.iter().map(|c| c.coverage).fold(0.0, f64::max);
        assert_eq!(best, s.score);
        let chosen = replay(s, s.threshold);
        match r.mode {
            Mode::Declined => assert!(chosen.is_empty(), "{q}"),
            Mode::Composed => {
                assert!(!chosen.is_empty(), "{q}");
                assert!(
                    chosen.iter().all(|id| r.citations.contains(id)),
                    "{q}: {chosen:?} vs {:?}",
                    r.citations
                );
            }
            Mode::Baked => assert!(s.cache_similarity >= s.cache_threshold),
            Mode::Clarify => unreachable!(),
        }
        // A lower threshold, replayed, matches the engine run at it.
        let low = AskOptions {
            support_threshold: 0.25,
            cache_threshold: 2.0,
            ..AskOptions::default()
        };
        let r2 = e.ask(q, &low).unwrap();
        assert_eq!(
            r2.mode == Mode::Declined,
            replay(&r2.support, 0.25).is_empty(),
            "{q}"
        );
    }
}

#[test]
fn the_dense_gate_applies_only_when_dense_ran() {
    let b = common::pack();
    let q = "who inspects the machine each shift";
    let strict = AskOptions {
        dense_gate: Some(harvest_core::answer::DenseGate {
            support_threshold: 0.1,
            min_dense: 0.99,
        }),
        cache_threshold: 2.0,
        ..AskOptions::default()
    };
    // Dense ran, and nothing reaches the floor: declined, and the support
    // object says why.
    let r = common::engine(&b).ask(q, &strict).unwrap();
    assert_eq!(r.mode, Mode::Declined);
    assert_eq!(r.support.min_dense, Some(0.99));
    assert!(r.support.top_dense > 0.0 && r.support.top_dense < 0.99);
    assert_eq!(r.support.threshold, 0.1);
    // A floor it reaches, with a low coverage bar: answered.
    let loose = AskOptions {
        dense_gate: Some(harvest_core::answer::DenseGate {
            support_threshold: 0.1,
            min_dense: 0.0,
        }),
        ..strict.clone()
    };
    assert_eq!(
        common::engine(&b).ask(q, &loose).unwrap().mode,
        Mode::Composed
    );
    // No embedder: the dense gate is not in force; coverage-only 0.5 applies.
    let lexical = Engine::new(b.pack.clone()).ask(q, &strict).unwrap();
    assert_eq!(lexical.support.min_dense, None);
    assert_eq!(lexical.support.threshold, 0.4);
    assert_eq!(lexical.mode, Mode::Composed);
}

#[test]
fn a_pack_states_its_dense_gate() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("p");
    harvest_core::fixture::build_with(&dir, "2026.1.1-1", |c| {
        c.execute_batch(
            "INSERT INTO pack_meta VALUES ('gate_dense_support_threshold', '0.2');
             INSERT INTO pack_meta VALUES ('gate_dense_min', '0.77');",
        )?;
        Ok(())
    })
    .unwrap();
    let pack = harvest_core::Pack::open(&dir, &[harvest_core::fixture::trusted_key()]).unwrap();
    assert_eq!(
        AskOptions::for_pack(&pack).dense_gate,
        Some(harvest_core::answer::DenseGate {
            support_threshold: 0.2,
            min_dense: 0.77
        })
    );
    assert_eq!(AskOptions::for_pack(&common::pack().pack).dense_gate, None);
}

#[test]
fn below_the_dense_floor_the_model_is_not_asked() {
    let b = common::pack();
    let llm = Arc::new(harvest_core::llm::ScriptedLlm::new(Vec::<String>::new()));
    let opts = AskOptions {
        dense_gate: Some(harvest_core::answer::DenseGate {
            support_threshold: 0.1,
            min_dense: 0.99,
        }),
        cache_threshold: 2.0,
        ..AskOptions::default()
    };
    let r = common::engine(&b)
        .with_llm(llm.clone())
        .ask("who inspects the machine each shift", &opts)
        .unwrap();
    assert_eq!(r.mode, Mode::Declined);
    assert!(llm.asked().is_empty());
    assert_eq!(r.support.depth, 12);
}
