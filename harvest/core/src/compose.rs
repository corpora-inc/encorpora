//! The model-on half of the answer loop: expand, select, compose. The model
//! sees only retrieved pack text; its output is schema-bound and then goes
//! through the strict support checker.

use crate::error::Result;
use crate::llm::{Llm, LlmRequest, complete_json};
use crate::normalize::normalize_ws;
use crate::pack::Pack;
use crate::segments::Segment;
use serde::Deserialize;
use serde_json::{Value, json};

/// Query expansion and ambiguity.
#[derive(Debug, Clone, Default, Deserialize, PartialEq)]
pub struct Expansion {
    #[serde(default)]
    pub queries: Vec<String>,
    /// True only when the request cannot be answered without knowing more.
    #[serde(default)]
    pub ambiguous: bool,
    #[serde(default)]
    pub clarify: Option<String>,
}

/// A passage offered to the model.
#[derive(Debug, Clone)]
pub struct Passage {
    pub section_id: String,
    pub citation: String,
    pub heading: Option<String>,
    pub text: String,
    /// Verbatim-kind fact quotes in this section.
    pub limits: Vec<String>,
}

pub fn expand(llm: &dyn Llm, question: &str, context: &str) -> Result<Expansion> {
    let req = LlmRequest {
        system: "You turn a user's question into search queries for a document index. Write up to \
                 four short queries in the document's own vocabulary covering what the user needs \
                 to know. Set ambiguous to true only when the question cannot be answered without \
                 one more fact from the user, and then write one short clarifying question."
            .into(),
        user: json!({"question": question, "context": context}).to_string(),
        schema: (
            "expansion".into(),
            json!({
                "type": "object",
                "properties": {
                    "queries": {"type": "array", "items": {"type": "string"}, "maxItems": 4},
                    "ambiguous": {"type": "boolean"},
                    "clarify": {"type": ["string", "null"]}
                },
                "required": ["queries", "ambiguous", "clarify"],
                "additionalProperties": false
            }),
        ),
        max_tokens: 200,
        temperature: 0.0,
    };
    let mut e: Expansion = complete_json(llm, &req)?;
    e.queries.retain(|q| !q.trim().is_empty());
    e.queries.truncate(4);
    if e.clarify.as_deref().is_none_or(|c| c.trim().is_empty()) {
        e.ambiguous = false;
    }
    Ok(e)
}

#[derive(Deserialize)]
struct Selection {
    section_ids: Vec<String>,
}

/// Pick the passages that answer the question, at most `max`.
pub fn select(
    llm: &dyn Llm,
    question: &str,
    passages: &[Passage],
    max: usize,
) -> Result<Vec<String>> {
    let offered: Vec<Value> = passages
        .iter()
        .map(|p| json!({"section_id": p.section_id, "heading": p.heading, "text": clip(&p.text, 500)}))
        .collect();
    let req = LlmRequest {
        system: format!(
            "Choose the passages needed to answer the question, most important first, at most {max}. \
             Return their section_id values only."
        ),
        user: json!({"question": question, "passages": offered}).to_string(),
        schema: (
            "selection".into(),
            json!({
                "type": "object",
                "properties": {"section_ids": {"type": "array", "items": {"type": "string"}, "maxItems": max}},
                "required": ["section_ids"],
                "additionalProperties": false
            }),
        ),
        max_tokens: 120,
        temperature: 0.0,
    };
    let s: Selection = complete_json(llm, &req)?;
    let mut out: Vec<String> = Vec::new();
    for id in s.section_ids {
        if passages.iter().any(|p| p.section_id == id) && !out.contains(&id) {
            out.push(id);
        }
    }
    out.truncate(max);
    Ok(out)
}

/// The answer-segment schema the model must emit.
pub fn segment_schema() -> Value {
    json!({
        "type": "object",
        "properties": {"segments": {"type": "array", "items": {"anyOf": [
            {"type": "object", "properties": {"t": {"const": "text"}, "text": {"type": "string"}},
             "required": ["t", "text"], "additionalProperties": false},
            {"type": "object", "properties": {"t": {"const": "quote"}, "section_id": {"type": "string"}, "text": {"type": "string"}},
             "required": ["t", "section_id", "text"], "additionalProperties": false},
            {"type": "object", "properties": {"t": {"const": "cite"}, "section_id": {"type": "string"}},
             "required": ["t", "section_id"], "additionalProperties": false}
        ]}}},
        "required": ["segments"],
        "additionalProperties": false
    })
}

/// The sentences of a passage, as the model sees them numbered: split after
/// `.`, `;` or `:` followed by a space. Joining a run of them with spaces
/// gives back a verbatim (whitespace-normalized) substring of the passage.
pub fn sentences(text: &str) -> Vec<String> {
    let t = normalize_ws(text);
    let b = t.as_bytes();
    let mut out = Vec::new();
    let mut start = 0;
    for i in 1..b.len() {
        if b[i] == b' ' && matches!(b[i - 1], b'.' | b';' | b':') {
            out.push(t[start..i].to_string());
            start = i + 1;
        }
    }
    if start < t.len() {
        out.push(t[start..].to_string());
    }
    out
}

#[derive(Deserialize)]
struct Evidence {
    #[serde(default)]
    p: usize,
    #[serde(default)]
    s: Vec<usize>,
}

#[derive(Deserialize)]
struct Composed {
    #[serde(default)]
    answer: String,
    #[serde(default)]
    evidence: Vec<Evidence>,
    #[serde(default)]
    note: Option<String>,
}

/// Most sentences quoted from one passage.
const MAX_EVIDENCE_SENTENCES: usize = 4;

/// The compose schema: a direct answer, the evidence as passage and
/// sentence numbers (the engine copies those sentences verbatim, so the
/// model never has to), and an optional teaching note.
pub fn compose_schema() -> Value {
    json!({
        "type": "object",
        "properties": {
            "answer": {"type": "string"},
            "evidence": {"type": "array", "items": {
                "type": "object",
                "properties": {
                    "p": {"type": "integer"},
                    "s": {"type": "array", "items": {"type": "integer"}}
                },
                "required": ["p", "s"],
                "additionalProperties": false
            }},
            "note": {"type": ["string", "null"]}
        },
        "required": ["answer", "evidence", "note"],
        "additionalProperties": false
    })
}

/// Compose an answer from `passages` only. The model writes the direct
/// answer and names the sentences that support it; the engine builds the
/// segments: the answer, each cited run of sentences quoted verbatim with
/// its cite, then the note. The strict checker then decides what survives.
pub fn compose(
    llm: &dyn Llm,
    question: &str,
    level: &str,
    context: &str,
    passages: &[Passage],
) -> Result<Vec<Segment>> {
    let split: Vec<Vec<String>> = passages.iter().map(|p| sentences(&p.text)).collect();
    let offered: Vec<Value> = passages
        .iter()
        .zip(&split)
        .enumerate()
        .map(|(i, (p, ss))| {
            json!({
                "p": i + 1,
                "citation": p.citation,
                "heading": p.heading,
                "sentences": ss.iter().enumerate().map(|(k, t)| json!({"s": k + 1, "text": t})).collect::<Vec<_>>(),
            })
        })
        .collect();
    let req = LlmRequest {
        system: format!(
            "You answer a {level}'s question from numbered regulation passages. Reply with: \
             answer: one or two plain sentences that answer the question directly, in the cited \
             sentences' own words: the requirement or the number first, or Yes or No followed by \
             the rule that decides it (\"No, excavators are excluded from this standard.\"); keep every \
             \"not\", \"no\", \"must\" and number exactly as the sentences have them; \
             evidence: the passage number p and sentence numbers s that support the answer, the \
             fewest that do; note: an optional short plain explanation of the cited sentences, or \
             null. If no sentence answers the question, give an empty answer and empty evidence."
        ),
        user: json!({"question": question, "context": context, "passages": offered}).to_string(),
        schema: ("answer_evidence".into(), compose_schema()),
        max_tokens: 600,
        temperature: 0.0,
    };
    let c: Composed = complete_json(llm, &req)?;
    let mut out = Vec::new();
    if !c.answer.trim().is_empty() {
        out.push(Segment::text(c.answer.trim()));
    }
    let mut cited = Vec::new();
    for e in &c.evidence {
        let Some((p, ss)) =
            e.p.checked_sub(1)
                .and_then(|i| Some((passages.get(i)?, split.get(i)?)))
        else {
            continue;
        };
        // Runs of consecutive sentences become one quote each.
        let mut idx: Vec<usize> =
            e.s.iter()
                .filter_map(|k| k.checked_sub(1))
                .filter(|k| *k < ss.len())
                .collect();
        idx.sort_unstable();
        idx.dedup();
        // The fewest sentences that support it: a long list is not evidence.
        idx.truncate(MAX_EVIDENCE_SENTENCES);
        let mut k = 0;
        while k < idx.len() {
            let mut end = k;
            while end + 1 < idx.len() && idx[end + 1] == idx[end] + 1 {
                end += 1;
            }
            out.push(Segment::quote(
                p.section_id.clone(),
                ss[idx[k]..=idx[end]].join(" "),
            ));
            k = end + 1;
        }
        if !idx.is_empty() && !cited.contains(&p.section_id) {
            cited.push(p.section_id.clone());
            out.push(Segment::cite(p.section_id.clone()));
        }
    }
    if let Some(n) = c.note.as_deref().map(str::trim).filter(|n| !n.is_empty())
        && let Some(id) = cited.first()
    {
        out.push(Segment::text(n));
        out.push(Segment::cite(id.clone()));
    }
    Ok(out)
}

/// The passages for `section_ids`.
pub fn passages(pack: &Pack, section_ids: &[String], max_chars: usize) -> Result<Vec<Passage>> {
    let mut out = Vec::new();
    for id in section_ids {
        let Some(s) = pack.section(id)? else { continue };
        let limits = pack
            .facts_for_section(id)?
            .into_iter()
            .filter(|f| f.is_verbatim())
            .map(|f| f.quote)
            .collect();
        out.push(Passage {
            section_id: s.section_id,
            citation: s.citation,
            heading: s.heading,
            text: clip(&normalize_ws(&s.text), max_chars),
            limits,
        });
    }
    Ok(out)
}

fn clip(s: &str, n: usize) -> String {
    if s.chars().count() <= n {
        return s.to_string();
    }
    let cut = s.char_indices().nth(n).map_or(s.len(), |(i, _)| i);
    let cut = s[..cut].rfind(' ').unwrap_or(cut);
    s[..cut].to_string()
}
