//! The content read API: what the app renders, from a verified pack only.
mod common;

use harvest_core::Role;
use harvest_core::records::{Outcome, Records, StartRun, StepInput};
use serde_json::json;

#[test]
fn every_content_table_reads_through_the_engine() {
    let b = common::pack();
    let p = &b.pack;
    let info = p.info().unwrap();
    assert_eq!(
        (info.pack_id.as_str(), info.version.as_str()),
        ("fixture", "2026.1.1-1")
    );
    assert_eq!(info.sources.len(), 1);
    assert!(info.row_counts["section"] > 0);

    let sections = p.sections().unwrap();
    assert!(sections.windows(2).all(|w| w[0].ord <= w[1].ord));
    let kids = p.children("ex.2").unwrap();
    assert!(kids.iter().any(|s| s.section_id == "ex.2(a)"));

    assert_eq!(p.topics().unwrap()[0].topic_id, "topic-lines");
    assert_eq!(p.skills().unwrap()[0].skill_id, "skill-clearance");
    assert_eq!(p.terms().unwrap()[0].term, "spotter");

    let lesson = p.lesson("lesson-lines").unwrap().unwrap();
    assert!(lesson.check.cites_ok && !lesson.body.is_empty());
    assert_eq!(p.lessons().unwrap().len(), 1);

    let d = p.diagram("dia-clearance").unwrap().unwrap();
    assert_eq!(d.section_ids, vec!["ex.2".to_string()]);

    let q = p.question("q-clear-1").unwrap().unwrap();
    assert_eq!(
        (q.kind.as_str(), q.answer.as_str(), q.choices.len()),
        ("mc", "1", 4)
    );
    assert_eq!(q.rationales.len(), 4);
    assert_eq!(p.questions_for_skill("skill-clearance").unwrap(), vec![q]);

    let procs = p.procedures().unwrap();
    assert_eq!(procs[0].procedure.proc_id, "proc-shift");
    assert_eq!(procs[0].steps[0].check_kind, "pass_fail");

    let answers = p.answers().unwrap();
    assert!(answers.iter().any(|a| a.answer_id == "a-clearance"));
    // Role variants: the trainee gets the trainee wording of the same answer.
    let (a, check) = p
        .answer_for("a-periodic-op", Role::Trainee)
        .unwrap()
        .unwrap();
    assert_eq!(a.answer_id, "a-periodic-tr");
    assert!(check.quotes_ok);
    let (a, _) = p
        .answer_for("a-periodic-tr", Role::Inspector)
        .unwrap()
        .unwrap();
    assert_eq!(
        a.answer_id, "a-periodic-tr",
        "no inspector variant: the row itself"
    );
    assert!(p.answer_for("nope", Role::Operator).unwrap().is_none());

    // App data in pack_meta is optional.
    assert_eq!(p.exams().unwrap(), json!([]));
    assert!(p.prereqs().unwrap().is_empty());
    assert!(p.starters(Role::Operator).unwrap().is_empty());
}

fn pack_with(edit: &'static str) -> (tempfile::TempDir, harvest_core::Pack) {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("p");
    harvest_core::fixture::build_with(&dir, "2026.1.1-1", move |c| {
        c.execute_batch(edit)?;
        Ok(())
    })
    .unwrap();
    let pack = harvest_core::Pack::open(&dir, &[harvest_core::fixture::trusted_key()]).unwrap();
    (tmp, pack)
}

#[test]
fn rows_that_failed_verification_never_render() {
    let (_t, p) = pack_with(
        "INSERT INTO provenance VALUES ('prov-bad', 'claude-cli', 'm', 'p', '1', 'x', 'x', 'x',
           '2026-01-01T00:00:00Z', 'verifier', 'fail', 'wrong citation');
         INSERT INTO question VALUES ('q-bad', 'skill-clearance', NULL, 'mc', 'Bad?', '[\"a\",\"b\"]', '0',
           '[\"x\",\"y\"]', '[\"ex.2\"]', 0.5, 'en', 'prov-bad', NULL);
         INSERT INTO lesson VALUES ('lesson-bad', 'topic-lines', 2, 'Bad', '[{\"t\":\"text\",\"text\":\"x\"}]', 'en', 'prov-bad');
         INSERT INTO answer VALUES ('a-bad', 'q', '[{\"t\":\"cite\",\"section_id\":\"ex.2\"}]', '[\"ex.2\"]', NULL, 'en', 'prov-bad');
         INSERT INTO procedure VALUES ('proc-bad', 'Bad', 'inspection', 's', '[\"operator\"]', 'en', 'prov-bad');",
    );
    assert!(p.question("q-bad").unwrap().is_none());
    assert!(p.lesson("lesson-bad").unwrap().is_none());
    assert!(p.answer("a-bad").unwrap().is_none());
    assert!(p.procedure("proc-bad").unwrap().is_none());
    assert!(
        !p.procedures()
            .unwrap()
            .iter()
            .any(|f| f.procedure.proc_id == "proc-bad")
    );
}

#[test]
fn unsupported_lesson_quotes_are_dropped_and_bad_rows_are_errors() {
    let (_t, p) = pack_with(
        "UPDATE lesson SET body = '[{\"t\":\"text\",\"text\":\"Claim.\"},{\"t\":\"quote\",\"section_id\":\"ex.2\",\"text\":\"never said\"}]'
           WHERE lesson_id = 'lesson-lines';
         UPDATE question SET answer = '7' WHERE q_id = 'q-clear-1';",
    );
    // Its only claim lost its support: nothing left to show, so no lesson.
    assert!(p.lesson("lesson-lines").unwrap().is_none());
    assert!(p.lessons().unwrap().is_empty());
    // An mc answer outside its choices is a pack error, not a quiz bug.
    assert!(p.question("q-clear-1").is_err());
}

#[test]
fn lesson_self_checks_render_and_never_support_a_claim() {
    use harvest_core::Segment;
    let (_t, p) = pack_with(
        r#"UPDATE lesson SET body = '[{"t":"text","text":"Keep clear of the line."},{"t":"cite","section_id":"ex.2"},
             {"t":"check","question":"Who keeps watch?","answer":"A dedicated spotter."},
             {"t":"text","text":"An unsupported claim after a check."},
             {"t":"check","question":"","answer":"blank question"}]'
           WHERE lesson_id = 'lesson-lines';"#,
    );
    let l = p.lesson("lesson-lines").unwrap().unwrap();
    let kinds: Vec<&str> = l
        .body
        .iter()
        .map(|s| match s {
            Segment::Text { .. } => "text",
            Segment::Cite { .. } => "cite",
            Segment::Check { .. } => "check",
            _ => "other",
        })
        .collect();
    // The check is kept on its own; the claim after it has no support (a check
    // supports nothing) and goes; a check with no question goes.
    assert_eq!(kinds, ["text", "cite", "check"]);
    assert_eq!(l.check.dropped, 2);
    // A model-composed (strict) body may not carry a check.
    let (kept, _) = harvest_core::check::check(
        &p,
        &[Segment::Check {
            question: "q".into(),
            answer: "a".into(),
        }],
        harvest_core::check::CheckOptions::STRICT,
    )
    .unwrap();
    assert!(kept.is_empty());
}

#[test]
fn practice_deficiencies_carry_no_rule_and_say_so() {
    let (_t, p) = pack_with(
        r#"INSERT INTO proc_step VALUES ('proc-shift', 2, 'Recheck level after the first lift.', '{}', 'pass_fail', '[]',
             '{"guidance":"The crane settled out of level.","action":"Stop and re-level.","section_id":null,"quote":null}',
             'en', 'prov-fixture');
           INSERT INTO proc_step VALUES ('proc-shift', 3, 'Brief the crew.', '{}', 'pass_fail', '[]',
             '{"guidance":"Not briefed.","basis":"practice","section_id":null,"quote":null}', 'en', 'prov-fixture');"#,
    );
    let steps = p.proc_steps("proc-shift").unwrap();
    let basis = |i: usize| steps[i].deficiency.as_ref().unwrap().basis;
    assert_eq!(
        basis(0),
        Some(harvest_core::pack::Basis::Rule),
        "a cited row is a rule"
    );
    assert_eq!(
        basis(1),
        Some(harvest_core::pack::Basis::Practice),
        "an uncited row is practice"
    );
    assert!(steps[1].deficiency.as_ref().unwrap().section_id.is_none());
    assert_eq!(basis(2), Some(harvest_core::pack::Basis::Practice));

    // A row that claims a rule but cites none, or practice that cites one, is a pack error.
    for d in [
        r#"{"guidance":"g","basis":"rule","section_id":null,"quote":null}"#,
        r#"{"guidance":"g","basis":"practice","section_id":"ex.2","quote":"x"}"#,
        r#"{"guidance":"g","section_id":"ex.2","quote":null}"#,
    ] {
        let (_t, p) = pack_with(
            format!(
            "INSERT INTO proc_step VALUES ('proc-shift', 2, 'x', '{{}}', 'pass_fail', '[]', '{d}', 'en', 'prov-fixture');"
                    )
            .leak(),
        );
        assert!(p.proc_steps("proc-shift").is_err(), "{d}");
    }
}

#[test]
fn a_question_note_is_optional_and_older_packs_still_read() {
    let (_t, p) = pack_with("");
    let q = p.question("q-clear-1").unwrap().unwrap();
    assert_eq!(
        q.note.as_deref(),
        Some("Above 50 kV the distance grows with voltage.")
    );
    // A pack baked before `note` existed has no column; its questions read with no note.
    let (_t, old) = pack_with("ALTER TABLE question DROP COLUMN note;");
    let q = old.question("q-clear-1").unwrap().unwrap();
    assert_eq!(q.note, None);
    assert!(!old.questions().unwrap().is_empty());
}

#[test]
fn app_data_comes_from_pack_meta() {
    let (_t, p) = pack_with(
        r#"INSERT INTO pack_meta VALUES ('exam_blueprints', '[{"id":"core","title":"Core","minutes":90,"passPercent":70,"domains":[]}]');
           INSERT INTO pack_meta VALUES ('skill_prereqs', '{"skill-clearance":[]}');
           INSERT INTO pack_meta VALUES ('starter_answers', '{"operator":["a-clearance","a-missing"]}');"#,
    );
    assert_eq!(p.exams().unwrap()[0]["minutes"], 90);
    assert!(p.prereqs().unwrap().contains_key("skill-clearance"));
    let s = p.starters(Role::Operator).unwrap();
    assert_eq!(s.len(), 1, "unknown ids are skipped");
    assert_eq!(s[0].answer_id, "a-clearance");
    assert!(p.starters(Role::Trainee).unwrap().is_empty());
}

#[test]
fn the_run_report_is_the_upload_and_the_export() {
    let b = common::pack();
    let rec = Records::in_memory().unwrap();
    let run = rec
        .start_run(
            &b.pack,
            "proc-shift",
            &StartRun {
                role: "operator".into(),
                ..Default::default()
            },
        )
        .unwrap();
    let before = rec.report(&b.pack, &run.run_id).unwrap();
    assert_eq!(before.format, "harvest-run/1");
    assert_eq!(before.title.as_deref(), Some("Shift inspection"));
    assert_eq!(before.steps.len(), 1);
    assert!(before.steps[0].outcome.is_none() && before.steps[0].text.is_some());
    let mut fail = StepInput::outcome(Outcome::Fail);
    fail.note = Some("broken wires".into());
    rec.record_step(&b.pack, &run.run_id, 1, fail).unwrap();
    rec.finish_run(&b.pack, &run.run_id).unwrap();
    let report = rec.report(&b.pack, &run.run_id).unwrap();
    assert_eq!(report.status, "complete");
    assert_eq!(report.steps[0].outcome, Some(Outcome::Fail));
    assert!(report.steps[0].deficiency);
    // The queued upload is exactly this report.
    let up = rec.pending(10).unwrap();
    let run_item = up.iter().find(|u| u.kind == "run").unwrap();
    let sent: harvest_core::records::RunReport = serde_json::from_str(&run_item.payload).unwrap();
    assert_eq!(sent, report);
}

#[test]
fn a_procedure_with_an_unverified_step_is_not_offered() {
    let (_t, p) = pack_with(
        "INSERT INTO provenance VALUES ('prov-bad', 'claude-cli', 'm', 'p', '1', 'x', 'x', 'x',
           '2026-01-01T00:00:00Z', 'verifier', 'fail', 'wrong citation');
         INSERT INTO proc_step VALUES ('proc-shift', 2, 'Check the hook.', '{}', 'pass_fail', '[\"ex.3\"]', NULL, 'en', 'prov-bad');
         UPDATE term SET quote = 'not in the section' WHERE term_id = 't-spotter';",
    );
    assert!(p.procedure("proc-shift").unwrap().is_none());
    assert!(p.procedures().unwrap().is_empty());
    assert!(p.proc_steps("proc-shift").is_err());
    assert_eq!(p.terms().unwrap()[0].quote, None);
}
