//! The support checker. Every answer body passes through it before display.
//!
//! - every `quote` is an exact substring of its section's text after
//!   whitespace normalization, and its section exists;
//! - every `cite` names an existing section, every `diagram` an existing
//!   diagram;
//! - a paragraph is a run of `text` segments followed by the `quote` / `cite`
//!   / `diagram` segments after them; a paragraph with no surviving quote or
//!   cite loses its text (an unsupported claim);
//! - strict mode (anything a model wrote) also drops a text segment whose
//!   content words are mostly absent from its paragraph's sources (all of
//!   them, for a sentence under three content words), or whose negation
//!   differs from the source sentence it restates, and enforces verbatim
//!   mode: every number in a text segment must appear in a supporting source,
//!   and if it is the value of a limit, clearance, capacity or interval fact
//!   the paraphrase is replaced by that fact's verbatim quote.

use crate::error::Result;
use crate::normalize::{self, normalize_ws};
use crate::pack::Pack;
use crate::segments::Segment;
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

/// The `check` object of CONTRACT's `ask --json`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct Check {
    /// Every quote in the input was verbatim and named an existing section.
    pub quotes_ok: bool,
    /// Every cite in the input named an existing section.
    pub cites_ok: bool,
    /// Segments removed (bad quotes, bad cites, unsupported claims).
    pub dropped: usize,
}

/// Checker options.
#[derive(Debug, Clone, Copy)]
pub struct CheckOptions {
    /// Apply the overlap and verbatim rules (model-written bodies).
    pub strict: bool,
    /// Share of a text segment's content stems that must occur in its
    /// paragraph's sources (strict mode).
    pub min_overlap: f64,
}

impl CheckOptions {
    /// Baked and template bodies: structure only.
    pub const STRUCTURAL: Self = Self {
        strict: false,
        min_overlap: 0.6,
    };
    /// Model-composed bodies.
    pub const STRICT: Self = Self {
        strict: true,
        min_overlap: 0.75,
    };
}

/// True when `quote` occurs verbatim in `text` (whitespace-normalized).
pub fn quote_in(quote: &str, text: &str) -> bool {
    let q = normalize_ws(quote);
    !q.is_empty() && normalize_ws(text).contains(&q)
}

/// Check `body` against `pack`. Returns the surviving segments and the check.
pub fn check(pack: &Pack, body: &[Segment], opts: CheckOptions) -> Result<(Vec<Segment>, Check)> {
    let mut report = Check {
        quotes_ok: true,
        cites_ok: true,
        dropped: 0,
    };

    // 1. Structural validity of each segment.
    let mut valid: Vec<Segment> = Vec::with_capacity(body.len());
    for seg in body {
        match seg {
            Segment::Quote { section_id, text } => {
                let ok = match pack.section(section_id)? {
                    Some(s) => quote_in(text, &s.text),
                    None => false,
                };
                if ok {
                    valid.push(seg.clone());
                } else {
                    report.quotes_ok = false;
                    report.dropped += 1;
                }
            }
            Segment::Cite { section_id } => {
                if pack.section_exists(section_id)? {
                    valid.push(seg.clone());
                } else {
                    report.cites_ok = false;
                    report.dropped += 1;
                }
            }
            Segment::Diagram { diagram_id } => {
                let exists = {
                    let conn = pack.conn();
                    let mut stmt = conn.prepare_cached(
                        "SELECT 1 FROM diagram WHERE diagram_id = ?1
                         AND prov_id IN (SELECT prov_id FROM provenance WHERE verdict = 'pass')",
                    )?;
                    stmt.query_row([diagram_id], |_| Ok(()))
                        .optional()?
                        .is_some()
                };
                if exists {
                    valid.push(seg.clone());
                } else {
                    report.dropped += 1;
                }
            }
            Segment::Text { text } => {
                if text.trim().is_empty() {
                    report.dropped += 1;
                } else {
                    valid.push(seg.clone());
                }
            }
        }
    }

    // 2. Paragraphs: text run + the supports after it.
    let mut out: Vec<Segment> = Vec::with_capacity(valid.len());
    let mut i = 0;
    while i < valid.len() {
        let start = i;
        while i < valid.len() && matches!(valid[i], Segment::Text { .. }) {
            i += 1;
        }
        let text_end = i;
        while i < valid.len() && !matches!(valid[i], Segment::Text { .. }) {
            i += 1;
        }
        let para = &valid[start..i];
        let texts = &valid[start..text_end];
        let supports = &valid[text_end..i];
        let sections: Vec<&str> = supports.iter().filter_map(Segment::section_id).collect();
        if sections.is_empty() {
            report.dropped += texts.len();
            out.extend(supports.iter().cloned());
            continue;
        }
        if !opts.strict {
            out.extend(para.iter().cloned());
            continue;
        }
        strict_paragraph(
            pack,
            texts,
            supports,
            &sections,
            opts,
            &mut out,
            &mut report,
        )?;
    }
    Ok((out, report))
}

fn strict_paragraph(
    pack: &Pack,
    texts: &[Segment],
    supports: &[Segment],
    sections: &[&str],
    opts: CheckOptions,
    out: &mut Vec<Segment>,
    report: &mut Check,
) -> Result<()> {
    // Sources of this paragraph: quoted text, cited sections, their facts.
    let mut source_text = String::new();
    let mut facts = Vec::new();
    let mut seen = BTreeSet::new();
    for s in supports {
        if let Segment::Quote { text, .. } = s {
            source_text.push_str(text);
            source_text.push(' ');
        }
    }
    for id in sections {
        if !seen.insert(*id) {
            continue;
        }
        if let Some(sec) = pack.section(id)? {
            source_text.push_str(&sec.text);
            source_text.push(' ');
            if let Some(h) = &sec.heading {
                source_text.push_str(h);
                source_text.push(' ');
            }
        }
        facts.extend(pack.facts_for_section(id)?);
    }
    let source_stems = normalize::stem_set(&source_text);
    let source_sentences = sentences(&source_text);
    let source_numbers: BTreeSet<String> = normalize::tokens(&source_text)
        .into_iter()
        .filter(|t| is_number(t))
        .collect();
    let quoted: String = supports
        .iter()
        .filter_map(|s| match s {
            Segment::Quote { text, .. } => Some(normalize_ws(text)),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join(" ");

    let mut kept_texts = Vec::new();
    let mut inserted = Vec::new();
    for t in texts {
        let Segment::Text { text } = t else { continue };
        let numbers = text_numbers(text);
        if numbers.iter().any(|n| !source_numbers.contains(n)) {
            report.dropped += 1; // a number no source states
            continue;
        }
        // Verbatim mode: a stated limit/clearance/capacity/interval value
        // is shown as the source's words, never as a paraphrase.
        let verbatim: Vec<_> = facts
            .iter()
            .filter(|f| f.is_verbatim() && quote_in(&f.quote, &source_text))
            .filter(|f| {
                let fact_numbers = normalize::tokens(&f.quote);
                numbers.iter().any(|n| fact_numbers.contains(n))
            })
            .collect();
        if !verbatim.is_empty() {
            report.dropped += 1;
            for f in verbatim {
                if !quoted.contains(&normalize_ws(&f.quote))
                    && !inserted.iter().any(
                        |s: &Segment| matches!(s, Segment::Quote { text, .. } if text == &f.quote),
                    )
                {
                    inserted.push(Segment::quote(f.section_id.clone(), f.quote.clone()));
                }
            }
            continue;
        }
        let stems: Vec<String> = normalize::content_stems(text)
            .into_iter()
            .filter(|s| !is_number(s) && !DISCOURSE.contains(&s.as_str()))
            .collect();
        let hit = stems.iter().filter(|s| source_stems.contains(*s)).count();
        // Short sentences have no slack: every content word must be sourced.
        let need = if stems.len() < 3 {
            1.0
        } else {
            opts.min_overlap
        };
        if !stems.is_empty() && (hit as f64) / (stems.len() as f64) < need {
            report.dropped += 1;
            continue;
        }
        // Polarity: a sentence must be negated exactly when the source
        // sentence it restates is ("not required" vs "required").
        if !stems.is_empty() && !polarity_ok(&source_sentences, &stems, text) {
            report.dropped += 1;
            continue;
        }
        kept_texts.push(t.clone());
    }
    out.extend(kept_texts);
    out.extend(supports.iter().cloned());
    // Inserted verbatim quotes carry their own cite.
    for q in inserted {
        let id = q.section_id().map(str::to_string);
        out.push(q);
        if let Some(id) = id
            && !sections.contains(&id.as_str())
        {
            out.push(Segment::cite(id));
        }
    }
    Ok(())
}

/// Stems of framing words a teaching sentence uses without making a claim
/// ("First, remember the key thing"); ignored by the overlap rule. No
/// domain words: a crane term never goes here.
const DISCOURSE: &[&str] = &[
    "also", "first", "follow", "import", "key", "rememb", "second", "simpl", "thing", "third",
];

fn is_number(t: &str) -> bool {
    t.chars().next().is_some_and(|c| c.is_ascii_digit())
}

/// Every number in `text` (number words already turned into digits). Each
/// one must be stated by a source; a count the sources never state is
/// dropped like any other number.
fn text_numbers(text: &str) -> Vec<String> {
    normalize::tokens(text)
        .into_iter()
        .filter(|t| is_number(t))
        .collect()
}

const NEGATIONS: &[&str] = &[
    "not",
    "no",
    "never",
    "cannot",
    "without",
    "nor",
    "neither",
    "none",
    "prohibited",
    "except",
    "unless",
];

/// True when `text` is negated or exempting ("not", "no", "cannot", "n't", …).
pub(crate) fn negated(text: &str) -> bool {
    let f = normalize::fold(text);
    f.contains("n't")
        || normalize::tokens(&f)
            .iter()
            .any(|t| NEGATIONS.contains(&t.as_str()))
}

/// True when a source sentence that shares the most content stems with
/// `stems` has the same negation as `text`. No sentence sharing a stem fails.
fn polarity_ok(sentences: &[String], stems: &[String], text: &str) -> bool {
    let scored: Vec<(usize, &String)> = sentences
        .iter()
        .map(|s| {
            let set = normalize::stem_set(s);
            (stems.iter().filter(|x| set.contains(*x)).count(), s)
        })
        .collect();
    let best = scored.iter().map(|(n, _)| *n).max().unwrap_or(0);
    best > 0
        && scored
            .iter()
            .filter(|(n, _)| *n == best)
            .any(|(_, s)| negated(s) == negated(text))
}

/// Split source text into sentences for the polarity rule.
fn sentences(text: &str) -> Vec<String> {
    text.split(['.', ';', '\n'])
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect()
}
