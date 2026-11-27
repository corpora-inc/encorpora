//! Free-text grading against a baked rubric.
//!
//! Rubric JSON (`question.answer` for `kind = free_text`; CONTRACT, "Free-text
//! rubric"). The same shape is read by `harvest/practice` (`parseRubric`):
//!
//! ```json
//! { "points": [ { "id": "p1", "point": "Names the hazard of arcing",
//!                 "any": ["arc", "arcing", "energized line"] } ],
//!   "pass": 1,
//!   "sample_answer": "…", "misconceptions": ["…"] }
//! ```
//!
//! A point is met when any one of its `any` phrases appears in the answer (all
//! of that phrase's content words, after stemming). `pass` is the number of
//! points needed (1..=points, default all). With a model, the model judges
//! each point against its `point` text and must quote the learner's words as
//! evidence; a point whose evidence is not in the answer falls back to the
//! phrase rule.

use crate::error::{Error, Result};
use crate::llm::{Llm, LlmRequest, complete_json};
use crate::normalize;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::BTreeSet;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct RubricPoint {
    pub id: String,
    /// The criterion, in plain words (shown when missed; what a model judges).
    pub point: String,
    /// Alternative phrases; any one meets the point.
    pub any: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Rubric {
    pub points: Vec<RubricPoint>,
    /// Points needed to pass; all of them when absent.
    #[serde(default)]
    pub pass: Option<usize>,
    #[serde(default)]
    pub sample_answer: Option<String>,
    #[serde(default)]
    pub misconceptions: Vec<String>,
}

impl Rubric {
    pub fn parse(json: &str) -> Result<Self> {
        let r: Self =
            serde_json::from_str(json).map_err(|e| Error::Invalid(format!("rubric: {e}")))?;
        if r.points.is_empty() {
            return Err(Error::Invalid("rubric has no points".into()));
        }
        let mut ids = BTreeSet::new();
        for p in &r.points {
            if p.id.trim().is_empty() || !ids.insert(p.id.as_str()) {
                return Err(Error::Invalid(format!(
                    "rubric point id {:?} is empty or repeated",
                    p.id
                )));
            }
            if p.point.trim().is_empty() || p.any.iter().all(|a| a.trim().is_empty()) {
                return Err(Error::Invalid(format!(
                    "rubric point {:?} needs `point` text and at least one `any` phrase",
                    p.id
                )));
            }
        }
        if let Some(n) = r.pass
            && (n == 0 || n > r.points.len())
        {
            return Err(Error::Invalid(format!(
                "rubric pass {n} is not between 1 and {} points",
                r.points.len()
            )));
        }
        Ok(r)
    }

    /// Points needed to pass.
    pub fn needed(&self) -> usize {
        self.pass.unwrap_or(self.points.len())
    }
}

/// A numeric key (`question.answer` for `kind = numeric`): `25`, `25±0.5`,
/// `25 +/- 0.5`, `1,200`. Returns `(value, tolerance)`; the same grammar as
/// `harvest/practice` `parseNumericKey`.
pub fn parse_numeric_key(answer: &str) -> Option<(f64, f64)> {
    let (v, t) = match answer.split_once('±') {
        Some((v, t)) => (v, Some(t)),
        None => match answer.split_once("+/-").or_else(|| answer.split_once("+-")) {
            Some((v, t)) => (v, Some(t)),
            None => (answer, None),
        },
    };
    let value = plain_number(v)?;
    let tolerance = match t {
        Some(t) => plain_number(t).filter(|t| *t >= 0.0)?,
        None => 0.0,
    };
    Some((value, tolerance))
}

/// A plain decimal with optional thousands commas (`1,200.5`), nothing else.
fn plain_number(text: &str) -> Option<f64> {
    let t = text.trim();
    // An optional minus; a leading plus is refused, as harvest/practice refuses it.
    let (sign, digits) = match t.strip_prefix('-') {
        Some(rest) => (&t[..1], rest),
        None => ("", t),
    };
    let (int, frac) = digits.split_once('.').unwrap_or((digits, ""));
    let groups: Vec<&str> = int.split(',').collect();
    let int_ok = if groups.len() == 1 {
        groups[0].chars().all(|c| c.is_ascii_digit())
    } else {
        (1..=3).contains(&groups[0].len())
            && groups.iter().all(|g| g.chars().all(|c| c.is_ascii_digit()))
            && groups[1..].iter().all(|g| g.len() == 3)
    };
    if !int_ok || !frac.chars().all(|c| c.is_ascii_digit()) || (int.is_empty() && frac.is_empty()) {
        return None;
    }
    let n: f64 = format!(
        "{sign}{}.{}",
        int.replace(',', ""),
        if frac.is_empty() { "0" } else { frac }
    )
    .trim_end_matches('.')
    .parse()
    .ok()?;
    n.is_finite().then_some(n)
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
    /// Share of points met, 0..1.
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
    let mut criterion = normalize::stem_set(&point.point);
    for p in &point.any {
        criterion.extend(normalize::stem_set(p));
    }
    stems.iter().any(|s| criterion.contains(s))
}

fn keyword_met(point: &RubricPoint, answer: &BTreeSet<String>) -> bool {
    point.any.iter().any(|p| phrase_in(p, answer))
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
                .map(|p| json!({"id": p.id, "criterion": p.point}))
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
    let mut got = 0usize;
    for p in &rubric.points {
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
            got += 1;
        }
        results.push(r);
    }
    let score = got as f64 / rubric.points.len() as f64;
    Ok(Grade {
        score,
        passed: got >= rubric.needed(),
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
