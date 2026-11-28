//! Read access to a pack's content tables for the app: everything a screen
//! renders comes through here, from a pack whose signature and hashes were
//! checked on open. The app never opens the SQLite file itself.
//!
//! Generated rows are returned only when their provenance verdict is `pass`
//! (CONTRACT: only passing rows ship; this holds even if one slipped in).
//! Answer-segment bodies (lessons, cached answers) go through the structural
//! support checker, so a quote that is not verbatim never renders. Rows
//! serialize to the CONTRACT's field names, ready to hand to the UI.

use crate::answer::Role;
use crate::check::{self, Check, CheckOptions};
use crate::error::{Error, Result};
use crate::pack::{CachedAnswer, Pack, ProcStep, Procedure, Section};
use crate::segments::Segment;
use rusqlite::{OptionalExtension, Row};
use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;

/// Rows whose provenance passed verification.
const PASSED: &str = "prov_id IN (SELECT prov_id FROM provenance WHERE verdict = 'pass')";

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Source {
    pub source_id: String,
    pub title: String,
    pub publisher: String,
    pub url: String,
    pub edition: String,
    pub retrieved_at: String,
    pub sha256: String,
    pub media_type: String,
    pub license: String,
}

/// What the About screen shows.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct PackInfo {
    pub pack_id: String,
    pub version: String,
    pub schema_version: u32,
    pub built_at: Option<String>,
    pub corpus_id: Option<String>,
    pub sources: Vec<Source>,
    pub row_counts: BTreeMap<String, i64>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Xref {
    pub from_id: String,
    pub to_id: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Term {
    pub term_id: String,
    pub term: String,
    pub definition: String,
    pub section_id: String,
    pub quote: Option<String>,
    pub lang: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Topic {
    pub topic_id: String,
    pub parent_id: Option<String>,
    pub ord: i64,
    pub title: String,
    pub summary: String,
    pub lang: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Skill {
    pub skill_id: String,
    pub topic_id: String,
    pub title: String,
    pub lang: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Lesson {
    pub lesson_id: String,
    pub topic_id: String,
    pub ord: i64,
    pub title: String,
    /// Checked: segments the checker could not support are already gone.
    pub body: Vec<Segment>,
    pub check: Check,
    pub lang: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Diagram {
    pub diagram_id: String,
    /// As baked. The host renders it as an image (not inline markup).
    pub svg: String,
    pub caption: String,
    pub alt: String,
    pub section_ids: Vec<String>,
    pub lang: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Question {
    pub q_id: String,
    pub skill_id: String,
    pub variant_of: Option<String>,
    /// `mc` | `numeric` | `free_text`.
    pub kind: String,
    pub stem: String,
    pub choices: Vec<String>,
    /// mc: the choice index as text; numeric: the value; free_text: rubric JSON.
    pub answer: String,
    pub rationales: Vec<String>,
    pub section_ids: Vec<String>,
    pub difficulty: f64,
    pub lang: String,
}

/// A procedure with its steps, for the Do screens.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct FullProcedure {
    #[serde(flatten)]
    pub procedure: Procedure,
    pub steps: Vec<ProcStep>,
}

/// One answer-cache row, without its body (for lists and starters).
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct AnswerSummary {
    pub answer_id: String,
    pub question: String,
    pub level: Option<String>,
    pub section_ids: Vec<String>,
}

fn json_list(id: &str, what: &str, raw: Option<String>) -> Result<Vec<String>> {
    match raw {
        None => Ok(Vec::new()),
        Some(s) if s.trim().is_empty() || s.trim() == "null" => Ok(Vec::new()),
        Some(s) => serde_json::from_str(&s).map_err(|e| Error::Pack(format!("{id}: {what}: {e}"))),
    }
}

impl Pack {
    fn rows<T>(
        &self,
        sql: &str,
        args: &[&dyn rusqlite::ToSql],
        f: impl Fn(&Row) -> rusqlite::Result<T>,
    ) -> Result<Vec<T>> {
        let conn = self.conn();
        let mut stmt = conn.prepare_cached(sql)?;
        let out = stmt
            .query_map(args, |r| f(r))?
            .collect::<rusqlite::Result<Vec<T>>>()?;
        Ok(out)
    }

    /// Identity, sources and row counts.
    pub fn info(&self) -> Result<PackInfo> {
        Ok(PackInfo {
            pack_id: self.pack_id().to_string(),
            version: self.version().to_string(),
            schema_version: self.manifest().schema_version,
            built_at: self.meta("built_at").map(str::to_string),
            corpus_id: self.meta("corpus_id").map(str::to_string),
            sources: self.sources()?,
            row_counts: self.row_counts()?,
        })
    }

    pub fn sources(&self) -> Result<Vec<Source>> {
        self.rows(
            "SELECT source_id, title, publisher, url, edition, retrieved_at, sha256, media_type, license
             FROM source ORDER BY source_id",
            &[],
            |r| {
                Ok(Source {
                    source_id: r.get(0)?,
                    title: r.get(1)?,
                    publisher: r.get(2)?,
                    url: r.get(3)?,
                    edition: r.get(4)?,
                    retrieved_at: r.get(5)?,
                    sha256: r.get(6)?,
                    media_type: r.get(7)?,
                    license: r.get(8)?,
                })
            },
        )
    }

    fn section_rows(&self, filter: &str, args: &[&dyn rusqlite::ToSql]) -> Result<Vec<Section>> {
        let ids: Vec<String> = self.rows(
            &format!("SELECT section_id FROM section {filter} ORDER BY ord"),
            args,
            |r| r.get(0),
        )?;
        ids.iter()
            .map(|id| {
                self.section(id)?
                    .ok_or_else(|| Error::Pack(format!("section {id} vanished")))
            })
            .collect()
    }

    /// Every section, in document order.
    pub fn sections(&self) -> Result<Vec<Section>> {
        self.section_rows("", &[])
    }

    /// The sentences that introduce the lists a list-item section sits in,
    /// outermost first, at most two levels: "(v) The load is over a
    /// cofferdam" means nothing without "...in any of the following
    /// circumstances:". A parent qualifies when its first line ends with
    /// ':', '—' or "following" and `shown` does not already contain it.
    pub fn list_lead_ins(&self, section_id: &str, shown: &str) -> Result<Vec<(String, String)>> {
        let mut out = Vec::new();
        let Some(mut child) = self.section(section_id)? else {
            return Ok(out);
        };
        for _ in 0..2 {
            if !child.text.trim_start().starts_with('(') {
                break;
            }
            let Some(pid) = child.parent_id.clone() else {
                break;
            };
            let Some(parent) = self.section(&pid)? else {
                break;
            };
            let first = crate::normalize::normalize_ws(parent.text.lines().next().unwrap_or(""));
            let intro =
                first.ends_with(':') || first.ends_with('\u{2014}') || first.ends_with("following");
            if !intro || first.is_empty() || crate::normalize::normalize_ws(shown).contains(&first)
            {
                break;
            }
            out.insert(0, (pid, first));
            child = parent;
        }
        Ok(out)
    }

    /// The direct children of a section, in document order.
    pub fn children(&self, section_id: &str) -> Result<Vec<Section>> {
        self.section_rows("WHERE parent_id = ?1", &[&section_id])
    }

    fn xrefs(&self, col: &str, id: &str) -> Result<Vec<Xref>> {
        self.rows(
            &format!(
                "SELECT from_id, to_id, kind FROM xref WHERE {col} = ?1 ORDER BY from_id, to_id"
            ),
            &[&id],
            |r| {
                Ok(Xref {
                    from_id: r.get(0)?,
                    to_id: r.get(1)?,
                    kind: r.get(2)?,
                })
            },
        )
    }

    /// Cross-references this section makes.
    pub fn xrefs_from(&self, section_id: &str) -> Result<Vec<Xref>> {
        self.xrefs("from_id", section_id)
    }

    /// Cross-references to this section.
    pub fn xrefs_to(&self, section_id: &str) -> Result<Vec<Xref>> {
        self.xrefs("to_id", section_id)
    }

    /// The glossary. A term's quote is kept only when it is verbatim in its
    /// section.
    pub fn terms(&self) -> Result<Vec<Term>> {
        let mut terms = self.rows(
            &format!(
                "SELECT term_id, term, definition, section_id, quote, lang FROM term
                 WHERE {PASSED} ORDER BY term COLLATE NOCASE"
            ),
            &[],
            |r| {
                Ok(Term {
                    term_id: r.get(0)?,
                    term: r.get(1)?,
                    definition: r.get(2)?,
                    section_id: r.get(3)?,
                    quote: r.get(4)?,
                    lang: r.get(5)?,
                })
            },
        )?;
        for t in &mut terms {
            if let Some(q) = &t.quote {
                let ok = self
                    .section(&t.section_id)?
                    .is_some_and(|s| check::quote_in(q, &s.text));
                if !ok {
                    t.quote = None;
                }
            }
        }
        Ok(terms)
    }

    pub fn topics(&self) -> Result<Vec<Topic>> {
        self.rows(
            "SELECT topic_id, parent_id, ord, title, summary, lang FROM topic ORDER BY ord, topic_id",
            &[],
            |r| {
                Ok(Topic {
                    topic_id: r.get(0)?,
                    parent_id: r.get(1)?,
                    ord: r.get(2)?,
                    title: r.get(3)?,
                    summary: r.get(4)?,
                    lang: r.get(5)?,
                })
            },
        )
    }

    pub fn skills(&self) -> Result<Vec<Skill>> {
        self.rows(
            "SELECT skill_id, topic_id, title, lang FROM skill ORDER BY topic_id, skill_id",
            &[],
            |r| {
                Ok(Skill {
                    skill_id: r.get(0)?,
                    topic_id: r.get(1)?,
                    title: r.get(2)?,
                    lang: r.get(3)?,
                })
            },
        )
    }

    fn lesson_rows(&self, filter: &str, args: &[&dyn rusqlite::ToSql]) -> Result<Vec<Lesson>> {
        type L = (String, String, i64, String, String, String);
        let rows: Vec<L> = self.rows(
            &format!(
                "SELECT lesson_id, topic_id, ord, title, body, lang FROM lesson
                 WHERE {PASSED} {filter} ORDER BY topic_id, ord"
            ),
            args,
            |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                ))
            },
        )?;
        rows.into_iter()
            .map(|(lesson_id, topic_id, ord, title, body, lang)| {
                let segs: Vec<Segment> = serde_json::from_str(&body)
                    .map_err(|e| Error::Pack(format!("lesson {lesson_id}: body: {e}")))?;
                let (body, check) = check::check(self, &segs, CheckOptions::STRUCTURAL)?;
                Ok((!body.is_empty()).then_some(Lesson {
                    lesson_id,
                    topic_id,
                    ord,
                    title,
                    body,
                    check,
                    lang,
                }))
            })
            .filter_map(Result::transpose)
            .collect()
    }

    /// Every lesson with something left to show, by topic and order, bodies
    /// checked (a lesson the checker emptied is left out).
    pub fn lessons(&self) -> Result<Vec<Lesson>> {
        self.lesson_rows("", &[])
    }

    pub fn lesson(&self, lesson_id: &str) -> Result<Option<Lesson>> {
        Ok(self.lesson_rows("AND lesson_id = ?1", &[&lesson_id])?.pop())
    }

    fn diagram_rows(&self, filter: &str, args: &[&dyn rusqlite::ToSql]) -> Result<Vec<Diagram>> {
        type D = (String, String, String, String, String, String);
        let rows: Vec<D> = self.rows(
            &format!(
                "SELECT diagram_id, svg, caption, alt, section_ids, lang FROM diagram
                 WHERE {PASSED} {filter} ORDER BY diagram_id"
            ),
            args,
            |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                ))
            },
        )?;
        rows.into_iter()
            .map(|(diagram_id, svg, caption, alt, ids, lang)| {
                Ok(Diagram {
                    section_ids: json_list(&diagram_id, "section_ids", Some(ids))?,
                    diagram_id,
                    svg,
                    caption,
                    alt,
                    lang,
                })
            })
            .collect()
    }

    pub fn diagrams(&self) -> Result<Vec<Diagram>> {
        self.diagram_rows("", &[])
    }

    pub fn diagram(&self, diagram_id: &str) -> Result<Option<Diagram>> {
        Ok(self
            .diagram_rows("AND diagram_id = ?1", &[&diagram_id])?
            .pop())
    }

    fn question_rows(&self, filter: &str, args: &[&dyn rusqlite::ToSql]) -> Result<Vec<Question>> {
        type Q = (
            String,
            String,
            Option<String>,
            String,
            String,
            Option<String>,
            String,
            Option<String>,
            String,
            f64,
            String,
        );
        let rows: Vec<Q> = self.rows(
            &format!(
                "SELECT q_id, skill_id, variant_of, kind, stem, choices, answer, rationales,
                        section_ids, difficulty, lang
                 FROM question WHERE {PASSED} {filter} ORDER BY skill_id, q_id"
            ),
            args,
            |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                    r.get(6)?,
                    r.get(7)?,
                    r.get(8)?,
                    r.get(9)?,
                    r.get(10)?,
                ))
            },
        )?;
        rows.into_iter()
            .map(
                |(
                    q_id,
                    skill_id,
                    variant_of,
                    kind,
                    stem,
                    choices,
                    answer,
                    rationales,
                    ids,
                    difficulty,
                    lang,
                )| {
                    let choices = json_list(&q_id, "choices", choices)?;
                    let rationales = json_list(&q_id, "rationales", rationales)?;
                    let bad = |m: String| Error::Pack(format!("question {q_id}: {m}"));
                    match kind.as_str() {
                        "mc" if !rationales.is_empty() && rationales.len() != choices.len() => {
                            return Err(bad(format!(
                                "{} rationales for {} choices",
                                rationales.len(),
                                choices.len()
                            )));
                        }
                        "numeric" if crate::grade::parse_numeric_key(&answer).is_none() => {
                            return Err(bad(format!(
                                "numeric answer {answer:?} is not a number or number±tolerance"
                            )));
                        }
                        "free_text" => {
                            crate::grade::Rubric::parse(&answer)
                                .map_err(|e| bad(format!("rubric: {e}")))?;
                        }
                        "mc" | "numeric" => {}
                        other => return Err(bad(format!("unknown kind {other:?}"))),
                    }
                    if kind == "mc" {
                        let i: usize = answer.trim().parse().map_err(|_| {
                            Error::Pack(format!(
                                "question {q_id}: mc answer {answer:?} is not an index"
                            ))
                        })?;
                        if i >= choices.len() {
                            return Err(Error::Pack(format!(
                                "question {q_id}: answer {i} out of {} choices",
                                choices.len()
                            )));
                        }
                    }
                    Ok(Question {
                        rationales,
                        section_ids: json_list(&q_id, "section_ids", Some(ids))?,
                        q_id,
                        skill_id,
                        variant_of,
                        kind,
                        stem,
                        choices,
                        answer,
                        difficulty,
                        lang,
                    })
                },
            )
            .collect()
    }

    /// The question bank.
    pub fn questions(&self) -> Result<Vec<Question>> {
        self.question_rows("", &[])
    }

    pub fn questions_for_skill(&self, skill_id: &str) -> Result<Vec<Question>> {
        self.question_rows("AND skill_id = ?1", &[&skill_id])
    }

    pub fn question(&self, q_id: &str) -> Result<Option<Question>> {
        Ok(self.question_rows("AND q_id = ?1", &[&q_id])?.pop())
    }

    /// Every procedure with its steps.
    pub fn procedures(&self) -> Result<Vec<FullProcedure>> {
        let ids: Vec<String> = self.rows(
            &format!("SELECT proc_id FROM procedure WHERE {PASSED} ORDER BY title"),
            &[],
            |r| r.get(0),
        )?;
        ids.iter()
            .filter_map(|id| self.procedure(id).transpose())
            .map(|p| {
                let procedure = p?;
                Ok(FullProcedure {
                    steps: self.proc_steps(&procedure.proc_id)?,
                    procedure,
                })
            })
            .collect()
    }

    /// The answer cache, without bodies.
    pub fn answers(&self) -> Result<Vec<AnswerSummary>> {
        type A = (String, String, Option<String>, String);
        let rows: Vec<A> = self.rows(
            &format!(
                "SELECT answer_id, question, level, section_ids FROM answer
                 WHERE {PASSED} ORDER BY question, answer_id"
            ),
            &[],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )?;
        rows.into_iter()
            .map(|(answer_id, question, level, ids)| {
                Ok(AnswerSummary {
                    section_ids: json_list(&answer_id, "section_ids", Some(ids))?,
                    answer_id,
                    question,
                    level,
                })
            })
            .collect()
    }

    /// A cached answer for `role`: the row itself when it fits the role (or
    /// has no level), else its variant for the role (the row with the same
    /// question and that level). The body is checked.
    pub fn answer_for(&self, answer_id: &str, role: Role) -> Result<Option<(CachedAnswer, Check)>> {
        let Some(a) = self.answer(answer_id)? else {
            return Ok(None);
        };
        let pick = match a.level.as_deref() {
            None => a,
            Some(l) if l == role.as_str() => a,
            Some(_) => {
                let variant: Option<String> = {
                    let conn = self.conn();
                    conn.query_row(
                        &format!(
                            "SELECT answer_id FROM answer WHERE question = ?1 AND level = ?2 AND {PASSED}
                             ORDER BY answer_id LIMIT 1"
                        ),
                        [a.question.as_str(), role.as_str()],
                        |r| r.get(0),
                    )
                    .optional()?
                };
                match variant {
                    Some(id) => self.answer(&id)?.unwrap_or(a),
                    None => a,
                }
            }
        };
        let (body, check) = check::check(self, &pick.body, CheckOptions::STRUCTURAL)?;
        Ok(Some((CachedAnswer { body, ..pick }, check)))
    }

    fn meta_json(&self, key: &str, empty: Value) -> Result<Value> {
        match self.meta(key) {
            None => Ok(empty),
            Some(s) => {
                serde_json::from_str(s).map_err(|e| Error::Pack(format!("pack_meta.{key}: {e}")))
            }
        }
    }

    /// Exam blueprints (`pack_meta.exam_blueprints`, a JSON array), as baked.
    pub fn exams(&self) -> Result<Value> {
        let v = self.meta_json("exam_blueprints", Value::Array(Vec::new()))?;
        if !v.is_array() {
            return Err(Error::Pack(
                "pack_meta.exam_blueprints is not an array".into(),
            ));
        }
        Ok(v)
    }

    /// Skill prerequisites (`pack_meta.skill_prereqs`: `{skill: [skill]}`).
    pub fn prereqs(&self) -> Result<BTreeMap<String, Vec<String>>> {
        let v = self.meta_json("skill_prereqs", Value::Object(Default::default()))?;
        serde_json::from_value(v).map_err(|e| Error::Pack(format!("pack_meta.skill_prereqs: {e}")))
    }

    /// Suggested first questions for a role (`pack_meta.starter_answers`:
    /// `{role: [answer_id]}`), only those that exist and passed.
    pub fn starters(&self, role: Role) -> Result<Vec<AnswerSummary>> {
        let v = self.meta_json("starter_answers", Value::Object(Default::default()))?;
        let by_role: BTreeMap<String, Vec<String>> = serde_json::from_value(v)
            .map_err(|e| Error::Pack(format!("pack_meta.starter_answers: {e}")))?;
        let all = self.answers()?;
        Ok(by_role
            .get(role.as_str())
            .into_iter()
            .flatten()
            .filter_map(|id| all.iter().find(|a| &a.answer_id == id).cloned())
            .collect())
    }
}
