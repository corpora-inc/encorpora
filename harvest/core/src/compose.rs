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

#[derive(Deserialize)]
struct Composed {
    segments: Vec<Segment>,
}

/// Compose an answer from `passages` only.
pub fn compose(
    llm: &dyn Llm,
    question: &str,
    level: &str,
    context: &str,
    passages: &[Passage],
) -> Result<Vec<Segment>> {
    let offered: Vec<Value> = passages
        .iter()
        .map(|p| {
            json!({
                "section_id": p.section_id,
                "citation": p.citation,
                "heading": p.heading,
                "text": p.text,
                "must_quote_verbatim": p.limits,
            })
        })
        .collect();
    let req = LlmRequest {
        system: format!(
            "Answer the question using only the passages. Write for a {level}. Teach in plain, short \
             sentences. Rules: every statement is followed by a quote or cite segment of the passage \
             that supports it; a quote copies the passage text exactly, character for character; any \
             limit, distance, capacity, interval or other number is given as a quote, never \
             paraphrased (the must_quote_verbatim strings are ready to quote); never add facts the \
             passages do not state; if the passages do not answer the question, return no segments."
        ),
        user: json!({"question": question, "context": context, "passages": offered}).to_string(),
        schema: ("answer_segments".into(), segment_schema()),
        max_tokens: 900,
        temperature: 0.2,
    };
    Ok(complete_json::<Composed>(llm, &req)?.segments)
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
