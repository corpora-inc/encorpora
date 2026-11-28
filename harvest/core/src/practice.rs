//! The question bank as the Learn screen reads it: topics, skills with
//! their prerequisites, and questions with a full citation for each
//! choice's rationale. Pass-only (the bake's verdict) and filtered to the
//! equipment variant like every other pack read. The mastery model lives in
//! the app (`harvest/practice`); attempts are device records
//! ([`crate::records::Records::record_practice`]).

use crate::check::quote_in;
use crate::error::Result;
use crate::maint::view::{Citation, citation};
use crate::pack::Pack;
use schemars::JsonSchema;
use serde::Serialize;

#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct PracticeTopic {
    pub topic_id: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct PracticeSkill {
    pub skill_id: String,
    pub title: String,
    pub topic_id: String,
    /// Skills to practise first (`pack_meta.skill_prereqs`).
    pub prereqs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct PracticeQuestion {
    pub q_id: String,
    pub skill_id: String,
    /// `mc` | `numeric` | `free_text`.
    pub kind: String,
    pub stem: String,
    pub choices: Vec<String>,
    /// mc: the choice index as text; numeric: the value; free_text: rubric JSON.
    pub answer: String,
    pub difficulty: f64,
    pub variant_of: Option<String>,
    pub note: Option<String>,
    /// One per choice: why right, why wrong.
    pub rationales: Vec<String>,
    /// One per rationale: where the manual says it. The answer's comes from
    /// the question's own section; a wrong choice's from the section that
    /// holds the passage its rationale quotes (or the choice itself), when
    /// one does; `null` otherwise.
    pub rationale_citations: Vec<Option<Citation>>,
    /// The question's own citations (its `section_ids`).
    pub citations: Vec<Citation>,
}

#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct PracticeItems {
    pub topics: Vec<PracticeTopic>,
    pub skills: Vec<PracticeSkill>,
    pub questions: Vec<PracticeQuestion>,
}

/// The quoted passages of a rationale (`“…”` or `"…"`), longest first.
fn quotes(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    for (open, close) in [('“', '”'), ('"', '"')] {
        let mut rest = text;
        while let Some(i) = rest.find(open) {
            let after = &rest[i + open.len_utf8()..];
            let Some(j) = after.find(close) else { break };
            let q = after[..j].trim();
            if q.chars().count() >= 4 {
                out.push(q.to_string());
            }
            rest = &after[j + close.len_utf8()..];
        }
    }
    out.sort_by_key(|q| std::cmp::Reverse(q.len()));
    out
}

/// Everything the Learn screen needs for `equip`.
pub fn items(pack: &Pack, equip: Option<&str>) -> Result<PracticeItems> {
    let prereqs = pack.prereqs()?;
    let topics = pack
        .topics()?
        .into_iter()
        .map(|t| PracticeTopic {
            topic_id: t.topic_id,
            title: t.title,
        })
        .collect();
    let skills = pack
        .skills()?
        .into_iter()
        .map(|s| PracticeSkill {
            prereqs: prereqs.get(&s.skill_id).cloned().unwrap_or_default(),
            skill_id: s.skill_id,
            title: s.title,
            topic_id: s.topic_id,
        })
        .collect();
    // Sections once, shortest first: a quote is cited to the most specific
    // section that holds it.
    let mut sections: Vec<(String, String)> = pack
        .sections()?
        .into_iter()
        .map(|s| (s.section_id, s.text))
        .collect();
    sections.sort_by(|a, b| a.1.len().cmp(&b.1.len()).then_with(|| a.0.cmp(&b.0)));
    let find = |needle: &str| -> Option<String> {
        sections
            .iter()
            .find(|(_, text)| quote_in(needle, text))
            .map(|(id, _)| id.clone())
    };
    let mut questions = Vec::new();
    for q in pack.questions()? {
        // Variant filtering: the question's own rows, else its first section's.
        let rows = pack.applies_to("question", &q.q_id)?;
        let rows = match (rows.is_empty(), q.section_ids.first()) {
            (true, Some(s)) => pack.section_applies_to(s)?,
            _ => rows,
        };
        if !pack.applies(&rows, equip) {
            continue;
        }
        let answer_ix: Option<usize> = (q.kind == "mc")
            .then(|| q.answer.trim().parse().ok())
            .flatten();
        let own = q.section_ids.first().cloned();
        let mut rationale_citations = Vec::with_capacity(q.rationales.len());
        for (i, r) in q.rationales.iter().enumerate() {
            let sid = if Some(i) == answer_ix {
                own.clone()
            } else {
                quotes(r)
                    .iter()
                    .find_map(|qt| find(qt))
                    .or_else(|| q.choices.get(i).and_then(|c| find(c)))
            };
            rationale_citations.push(match sid {
                Some(s) => citation(pack, &s).ok(),
                None => None,
            });
        }
        let citations = q
            .section_ids
            .iter()
            .filter_map(|s| citation(pack, s).ok())
            .collect();
        questions.push(PracticeQuestion {
            q_id: q.q_id,
            skill_id: q.skill_id,
            kind: q.kind,
            stem: q.stem,
            choices: q.choices,
            answer: q.answer,
            difficulty: q.difficulty,
            variant_of: q.variant_of,
            note: q.note,
            rationales: q.rationales,
            rationale_citations,
            citations,
        });
    }
    Ok(PracticeItems {
        topics,
        skills,
        questions,
    })
}

#[cfg(test)]
mod tests {
    #[test]
    fn quotes_are_found_longest_first() {
        let q = super::quotes(
            "That is the cause the manual gives for “Scripting: xxx out of memory”. See \"Board\" or “EKF3 not ready”.",
        );
        assert_eq!(q[0], "Scripting: xxx out of memory");
        assert!(q.contains(&"EKF3 not ready".to_string()) && q.contains(&"Board".to_string()));
    }
}
