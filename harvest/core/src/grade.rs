//! Free-text grading against a baked rubric.
//!
//! Rubric JSON (`question.answer` for `kind = free_text`):
//!
//! ```json
//! { "points": [ { "id": "p1", "text": "Names the hazard",
//!                 "keywords": [["arc", "contact"], "energized line"], "weight": 1 } ],
//!   "pass": 0.7 }
//! ```
//!
//! A keyword entry is a phrase (all its words must appear) or a list of
//! alternatives (any one phrase). A point is met when every entry is. With a
//! model, the model judges each point and must quote the learner's words as
//! evidence; a point whose evidence is not in the answer falls back to the
//! keyword rule.

use crate::error::{Error, Result};
use crate::llm::{Llm, LlmRequest, complete_json};
use crate::normalize;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::BTreeSet;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum Keyword {
    Phrase(String),
    AnyOf(Vec<String>),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RubricPoint {
    pub id: String,
    pub text: String,
    #[serde(default)]
    pub keywords: Vec<Keyword>,
    #[serde(default = "one")]
    pub weight: f64,
}

fn one() -> f64 {
    1.0
}

fn default_pass() -> f64 {
    0.7
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Rubric {
    pub points: Vec<RubricPoint>,
    #[serde(default = "default_pass")]
    pub pass: f64,
}

impl Rubric {
    pub fn parse(json: &str) -> Result<Self> {
        let r: Self =
            serde_json::from_str(json).map_err(|e| Error::Invalid(format!("rubric: {e}")))?;
        if r.points.is_empty() {
            return Err(Error::Invalid("rubric has no points".into()));
        }
        Ok(r)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PointResult {
    pub id: String,
    pub met: bool,
    /// The learner's words that meet it (model mode, verified substring).
    pub evidence: Option<String>,
    /// `model` or `keyword`.
    pub by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Grade {
    /// Weighted share of points met, 0..1.
    pub score: f64,
    pub passed: bool,
    pub points: Vec<PointResult>,
    /// Ids of points missed, in rubric order (the app shows their text).
    pub missed: Vec<String>,
    /// `model` when a model judged any point, else `keyword`.
    pub mode: String,
    pub model: Option<String>,
    /// Why the model's verdict was not used, when a model was given.
    pub model_error: Option<String>,
}

fn phrase_in(phrase: &str, answer: &BTreeSet<String>) -> bool {
    let stems = normalize::content_stems(phrase);
    !stems.is_empty() && stems.iter().all(|s| answer.contains(s))
}

/// Model evidence counts only when it is the learner's own words and says
/// something: three content words, or one that the criterion or its
/// keywords use. "the" or "I don't know" never meets a point.
fn evidence_ok(evidence: &str, folded_answer: &str, point: &RubricPoint) -> bool {
    let e = normalize::fold(evidence);
    if e.trim().is_empty() || !folded_answer.contains(e.trim()) {
        return false;
    }
    let stems = normalize::content_stems(&e);
    if stems.len() >= 3 {
        return true;
    }
    let mut criterion = normalize::stem_set(&point.text);
    for k in &point.keywords {
        match k {
            Keyword::Phrase(p) => criterion.extend(normalize::stem_set(p)),
            Keyword::AnyOf(alts) => alts
                .iter()
                .for_each(|p| criterion.extend(normalize::stem_set(p))),
        }
    }
    stems.iter().any(|s| criterion.contains(s))
}

fn keyword_met(point: &RubricPoint, answer: &BTreeSet<String>) -> bool {
    !point.keywords.is_empty()
        && point.keywords.iter().all(|k| match k {
            Keyword::Phrase(p) => phrase_in(p, answer),
            Keyword::AnyOf(alts) => alts.iter().any(|p| phrase_in(p, answer)),
        })
}

#[derive(Deserialize)]
struct ModelPoint {
    id: String,
    met: bool,
    #[serde(default)]
    evidence: String,
}

#[derive(Deserialize)]
struct ModelGrade {
    points: Vec<ModelPoint>,
}

/// Grade `answer` against `rubric`; with `llm`, the model judges.
pub fn grade(answer: &str, rubric: &Rubric, llm: Option<&dyn Llm>) -> Result<Grade> {
    let stems = normalize::stem_set(answer);
    let folded_answer = normalize::fold(answer);
    let mut model_error = None;
    let model_points: Option<Vec<ModelPoint>> = match llm {
        Some(m) if !answer.trim().is_empty() => {
            let points: Vec<_> = rubric
                .points
                .iter()
                .map(|p| json!({"id": p.id, "criterion": p.text}))
                .collect();
            let req = LlmRequest {
                system: "You grade a learner's explanation against rubric criteria. For each \
                         criterion decide if the learner's answer meets it. Judge meaning, not \
                         wording. For a met criterion, copy the learner's exact words that meet \
                         it into evidence. Never invent evidence."
                    .into(),
                user: json!({"criteria": points, "answer": answer}).to_string(),
                schema: (
                    "grade".into(),
                    json!({
                        "type": "object",
                        "properties": {"points": {"type": "array", "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "met": {"type": "boolean"},
                                "evidence": {"type": "string"}
                            },
                            "required": ["id", "met", "evidence"],
                            "additionalProperties": false
                        }}},
                        "required": ["points"],
                        "additionalProperties": false
                    }),
                ),
                max_tokens: 512,
                temperature: 0.0,
            };
            match complete_json::<ModelGrade>(m, &req) {
                Ok(g) => Some(g.points),
                Err(e) => {
                    // Keywords decide; the caller sees why.
                    model_error = Some(e.to_string());
                    None
                }
            }
        }
        _ => None,
    };
    let mut results = Vec::with_capacity(rubric.points.len());
    let mut any_model = false;
    let (mut got, mut total) = (0.0, 0.0);
    for p in &rubric.points {
        total += p.weight;
        let judged = model_points
            .as_ref()
            .and_then(|mp| mp.iter().find(|x| x.id == p.id));
        let r = match judged {
            Some(j) if !j.met => {
                any_model = true;
                PointResult {
                    id: p.id.clone(),
                    met: false,
                    evidence: None,
                    by: "model".into(),
                }
            }
            Some(j) if evidence_ok(&j.evidence, &folded_answer, p) => {
                any_model = true;
                PointResult {
                    id: p.id.clone(),
                    met: true,
                    evidence: Some(j.evidence.clone()),
                    by: "model".into(),
                }
            }
            // No verdict, or "met" without verifiable evidence: keywords decide.
            _ => PointResult {
                id: p.id.clone(),
                met: keyword_met(p, &stems),
                evidence: None,
                by: "keyword".into(),
            },
        };
        if r.met {
            got += p.weight;
        }
        results.push(r);
    }
    let score = if total > 0.0 { got / total } else { 0.0 };
    Ok(Grade {
        score,
        passed: score + 1e-9 >= rubric.pass,
        missed: results
            .iter()
            .filter(|r| !r.met)
            .map(|r| r.id.clone())
            .collect(),
        points: results,
        mode: if any_model { "model" } else { "keyword" }.into(),
        model: if any_model { llm.map(|m| m.id()) } else { None },
        model_error,
    })
}
