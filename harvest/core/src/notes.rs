//! Field notes: free text → `{component, condition, action}`.
//!
//! The vocabulary comes from the pack (`pack_meta.note_vocab`, JSON
//! `{"components":[{"name":…,"aliases":[…]}],"conditions":[…],"actions":[…]}`)
//! merged over a small built-in list of generic conditions and actions. With a
//! model, the model extracts the fields; each value must be a vocabulary name
//! or words that occur in the note, otherwise the keyword result stands.

use crate::error::{Error, Result};
use crate::llm::{Llm, LlmRequest, complete_json};
use crate::normalize;
use crate::pack::Pack;
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VocabTerm {
    pub name: String,
    #[serde(default)]
    pub aliases: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct NoteVocab {
    #[serde(default)]
    pub components: Vec<VocabTerm>,
    #[serde(default)]
    pub conditions: Vec<VocabTerm>,
    #[serde(default)]
    pub actions: Vec<VocabTerm>,
}

fn t(name: &str, aliases: &[&str]) -> VocabTerm {
    VocabTerm {
        name: name.into(),
        aliases: aliases.iter().map(|s| s.to_string()).collect(),
    }
}

impl NoteVocab {
    /// Generic maintenance conditions and actions (no components).
    pub fn generic() -> Self {
        Self {
            components: Vec::new(),
            conditions: vec![
                t("cracked", &["crack", "cracks", "fractured"]),
                t("bent", &["deformed", "kinked", "kink", "twisted"]),
                t("worn", &["wear", "worn down", "thin"]),
                t("leaking", &["leak", "leaks", "seeping", "dripping"]),
                t("corroded", &["corrosion", "rust", "rusted", "rusty"]),
                t("loose", &["loosened", "not tight", "play"]),
                t("missing", &["absent", "gone", "not present"]),
                t(
                    "frayed",
                    &["broken wires", "fraying", "birdcaged", "birdcage"],
                ),
                t("damaged", &["damage", "broken", "dented", "gouged"]),
                t(
                    "inoperative",
                    &[
                        "not working",
                        "doesn't work",
                        "does not work",
                        "failed",
                        "dead",
                    ],
                ),
                t(
                    "ok",
                    &["good", "serviceable", "no issues", "fine", "passed"],
                ),
            ],
            actions: vec![
                t(
                    "remove from service",
                    &[
                        "take out of service",
                        "tag out",
                        "lock out",
                        "do not use",
                        "red tag",
                    ],
                ),
                t("replace", &["swap", "change out", "new one"]),
                t("repair", &["fix", "weld", "patch"]),
                t("tighten", &["torque", "retighten"]),
                t("lubricate", &["grease", "oil", "lube"]),
                t("adjust", &["readjust", "set", "realign"]),
                t(
                    "monitor",
                    &["watch", "recheck", "keep an eye", "re-inspect"],
                ),
                t("report", &["notify", "tell supervisor", "inform"]),
            ],
        }
    }

    /// The pack's vocabulary over the generic one. A malformed
    /// `pack_meta.note_vocab` is an error, not a silent fallback.
    pub fn from_pack(pack: &Pack) -> Result<Self> {
        let mut v = Self::generic();
        if let Some(j) = pack.meta("note_vocab") {
            let extra: NoteVocab = serde_json::from_str(j)
                .map_err(|e| Error::Invalid(format!("pack_meta.note_vocab: {e}")))?;
            v.components.extend(extra.components);
            v.conditions.extend(extra.conditions);
            v.actions.extend(extra.actions);
        }
        Ok(v)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StructuredNote {
    pub component: Option<String>,
    pub condition: Option<String>,
    pub action: Option<String>,
    /// `model` or `keyword`.
    pub mode: String,
    pub model: Option<String>,
    /// Why the model's output was not used, when a model was given.
    pub model_error: Option<String>,
}

/// Stems of every token (stopwords kept, so phrases line up), space-joined
/// and padded: "tagged out" and "tag out" both become " tag out ".
fn stem_line(text: &str) -> String {
    let stems: Vec<String> = normalize::tokens(text)
        .iter()
        .map(|t| normalize::stem(t))
        .collect();
    format!(" {} ", stems.join(" "))
}

/// The vocabulary term whose name or alias appears earliest-longest in `text`.
fn find(terms: &[VocabTerm], joined: &str) -> Option<String> {
    let mut best: Option<(usize, usize, &str)> = None; // (pos, -len) ordering
    for term in terms {
        for spelling in std::iter::once(&term.name).chain(term.aliases.iter()) {
            let st = stem_line(spelling);
            if st.trim().is_empty() {
                continue;
            }
            if let Some(pos) = joined.find(&st) {
                let cand = (pos, usize::MAX - st.len(), term.name.as_str());
                if best.is_none_or(|b| (cand.0, cand.1) < (b.0, b.1)) {
                    best = Some(cand);
                }
            }
        }
    }
    best.map(|b| b.2.to_string())
}

/// Deterministic keyword structuring.
pub fn structure_keywords(text: &str, vocab: &NoteVocab) -> StructuredNote {
    let joined = stem_line(text);
    StructuredNote {
        component: find(&vocab.components, &joined),
        condition: find(&vocab.conditions, &joined),
        action: find(&vocab.actions, &joined),
        mode: "keyword".into(),
        model: None,
        model_error: None,
    }
}

#[derive(Deserialize)]
struct ModelNote {
    component: Option<String>,
    condition: Option<String>,
    action: Option<String>,
}

/// A model value is grounded when it is a vocabulary name or its words occur
/// in the note.
fn grounded(value: &str, terms: &[VocabTerm], joined: &str) -> Option<String> {
    let v = value.trim();
    if v.is_empty() {
        return None;
    }
    if let Some(term) = terms.iter().find(|t| t.name.eq_ignore_ascii_case(v)) {
        return Some(term.name.clone());
    }
    let st = stem_line(v);
    (!st.trim().is_empty() && joined.contains(&st)).then(|| v.to_string())
}

/// Structure a field note; with `llm`, the model extracts and the result is
/// grounded per field, falling back to keywords.
pub fn structure_note(
    text: &str,
    vocab: &NoteVocab,
    llm: Option<&dyn Llm>,
) -> Result<StructuredNote> {
    let kw = structure_keywords(text, vocab);
    let Some(m) = llm else { return Ok(kw) };
    let names = |ts: &[VocabTerm]| ts.iter().map(|t| t.name.clone()).collect::<Vec<_>>();
    let req = LlmRequest {
        system: "Extract from an inspection note the component inspected, its condition, and the \
                 action taken or needed. Prefer the listed names; otherwise use the note's own \
                 words. Use null for anything the note does not say."
            .into(),
        user: json!({
            "note": text,
            "components": names(&vocab.components),
            "conditions": names(&vocab.conditions),
            "actions": names(&vocab.actions),
        })
        .to_string(),
        schema: (
            "field_note".into(),
            json!({
                "type": "object",
                "properties": {
                    "component": {"type": ["string", "null"]},
                    "condition": {"type": ["string", "null"]},
                    "action": {"type": ["string", "null"]}
                },
                "required": ["component", "condition", "action"],
                "additionalProperties": false
            }),
        ),
        max_tokens: 128,
        temperature: 0.0,
    };
    let out = match complete_json::<ModelNote>(m, &req) {
        Ok(out) => out,
        Err(e) => {
            return Ok(StructuredNote {
                model_error: Some(e.to_string()),
                ..kw
            });
        }
    };
    let joined = stem_line(text);
    let pick = |model: Option<String>, terms: &[VocabTerm], fallback: Option<String>| {
        model
            .as_deref()
            .and_then(|v| grounded(v, terms, &joined))
            .or(fallback)
    };
    Ok(StructuredNote {
        component: pick(out.component, &vocab.components, kw.component),
        condition: pick(out.condition, &vocab.conditions, kw.condition),
        action: pick(out.action, &vocab.actions, kw.action),
        mode: "model".into(),
        model: Some(m.id()),
        model_error: None,
    })
}
