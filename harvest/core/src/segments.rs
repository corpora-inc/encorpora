//! Answer-segment JSON (CONTRACT "Answer-segment JSON").

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// One segment of an answer or lesson body.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "t", rename_all = "lowercase")]
pub enum Segment {
    /// Plain prose. A claim: it must be supported in its paragraph.
    Text { text: String },
    /// A verbatim substring of the section's text.
    Quote { section_id: String, text: String },
    /// A citation of a section.
    Cite { section_id: String },
    /// A pack diagram.
    Diagram { diagram_id: String },
    /// A self-check in a lesson: the reader answers `question`, then sees
    /// `answer`. It recalls what the lesson's cited paragraphs taught; it is
    /// not a claim and supports nothing (CONTRACT "Answer-segment JSON").
    Check { question: String, answer: String },
}

impl Segment {
    pub fn text(text: impl Into<String>) -> Self {
        Self::Text { text: text.into() }
    }
    pub fn quote(section_id: impl Into<String>, text: impl Into<String>) -> Self {
        Self::Quote {
            section_id: section_id.into(),
            text: text.into(),
        }
    }
    pub fn cite(section_id: impl Into<String>) -> Self {
        Self::Cite {
            section_id: section_id.into(),
        }
    }

    /// The section a quote or cite names.
    pub fn section_id(&self) -> Option<&str> {
        match self {
            Self::Quote { section_id, .. } | Self::Cite { section_id } => Some(section_id),
            _ => None,
        }
    }
}

/// Section ids cited or quoted, first-seen order, no duplicates.
pub fn citations(body: &[Segment]) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for s in body {
        if let Some(id) = s.section_id()
            && !out.iter().any(|o| o == id)
        {
            out.push(id.to_string());
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_contract_json() {
        let json = r#"[{"t":"text","text":"There are three."},
            {"t":"quote","section_id":"a(1)","text":"exact"},
            {"t":"cite","section_id":"a(1)"},{"t":"diagram","diagram_id":"d1"},
            {"t":"check","question":"How far?","answer":"20 feet."}]"#;
        let body: Vec<Segment> = serde_json::from_str(json).unwrap();
        assert_eq!(body.len(), 5);
        assert_eq!(citations(&body), vec!["a(1)".to_string()]);
        let back = serde_json::to_string(&body).unwrap();
        assert!(back.contains(r#"{"t":"quote","section_id":"a(1)","text":"exact"}"#));
        assert!(back.contains(r#"{"t":"check","question":"How far?","answer":"20 feet."}"#));
    }

    #[test]
    fn unknown_segment_kind_is_an_error() {
        assert!(serde_json::from_str::<Vec<Segment>>(r#"[{"t":"video","url":"x"}]"#).is_err());
    }
}
