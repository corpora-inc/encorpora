//! The support checker. Every answer body passes through it before display.
//!
//! - every `quote` is an exact substring of its section's text after
//!   whitespace normalization, and its section exists;
//! - every `cite` names an existing section, every `diagram` an existing
//!   diagram; a `check` (a lesson self-check) needs a question and an answer,
//!   stands alone, and is dropped in strict mode;
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
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

/// The `check` object of CONTRACT's `ask --json`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default, JsonSchema)]
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
            // Baked lessons carry self-checks; a model-composed body never may.
            Segment::Check { question, answer } => {
                if opts.strict || question.trim().is_empty() || answer.trim().is_empty() {
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
        // A self-check stands alone: it ends a paragraph and supports nothing.
        if matches!(valid[i], Segment::Check { .. }) {
            out.push(valid[i].clone());
            i += 1;
            continue;
        }
        let start = i;
        while i < valid.len() && matches!(valid[i], Segment::Text { .. }) {
            i += 1;
        }
        let text_end = i;
        while i < valid.len() && !matches!(valid[i], Segment::Text { .. } | Segment::Check { .. }) {
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
        let Segment::Text { text: shown } = t else {
            continue;
        };
        // A leading "Yes," / "No," is the verdict; the claim after it is what
        // the sources must support. A bare "Yes." or "No." states nothing the
        // checker can hold to a source, so it never stands alone.
        let text = &strip_verdict(shown);
        if text.trim().is_empty() {
            report.dropped += 1;
            continue;
        }
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
    "say", "state", "list", "mean", "tell", "show",
];

/// True when `text` (one sentence) holds against `source` alone, by the
/// strict rules: every number in it is in `source`, its content stems
/// overlap `source` by `min_overlap` (all of them under 3 stems), and it is
/// negated exactly when the source sentence it restates is. Unlike
/// [`check`], nothing outside `source` counts: no whole section, no facts.
pub fn holds(text: &str, source: &str, min_overlap: f64) -> bool {
    let text = strip_verdict(text);
    if text.trim().is_empty() {
        return false;
    }
    let source_numbers: BTreeSet<String> = figures(source).into_iter().collect();
    let numbers = figures(&text);
    if numbers.iter().any(|n| !source_numbers.contains(n)) {
        return false;
    }
    // The numbers of one claim come from one source sentence or table row,
    // with the same range words: "over 50 kV, 10 feet" takes neither 10 from
    // the "up to 50 | 10" row nor 50 from one row and 10 from another.
    if !numbers.is_empty() {
        let text_toks = normalize::tokens(&text);
        let ranges: Vec<&str> = RANGE_WORDS
            .iter()
            .copied()
            .filter(|w| text_toks.iter().any(|t| t == w))
            .collect();
        let one = claim_units(source).iter().any(|s| {
            let figs = figures(s);
            let toks = normalize::tokens(s);
            numbers.iter().all(|n| figs.contains(n))
                && ranges.iter().all(|w| toks.iter().any(|t| t == w))
        });
        if !one {
            return false;
        }
    }
    let source_stems = normalize::stem_set(source);
    let stems: Vec<String> = normalize::content_stems(&text)
        .into_iter()
        .filter(|s| !is_number(s) && !DISCOURSE.contains(&s.as_str()))
        .collect();
    if stems.is_empty() {
        return false;
    }
    let hit = stems.iter().filter(|s| source_stems.contains(*s)).count();
    let need = if stems.len() < 3 { 1.0 } else { min_overlap };
    (hit as f64) / (stems.len() as f64) >= need && polarity_ok(&sentences(source), &stems, &text)
}

/// The figures in `text`, one spelling each: "0.75" and ".75" alike,
/// "1,000" as 1000, number words as digits.
fn figures(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    // ".75" before tokenizing (the tokenizer drops a leading point).
    let spaced: String = {
        let mut s = String::with_capacity(text.len());
        let chars: Vec<char> = text.chars().collect();
        for (i, c) in chars.iter().enumerate() {
            let lead = *c == '.'
                && chars.get(i + 1).is_some_and(|d| d.is_ascii_digit())
                && !chars
                    .get(i.wrapping_sub(1))
                    .is_some_and(|d| d.is_ascii_digit());
            if lead {
                s.push_str(" 0.");
            } else if *c == ','
                && i > 0
                && chars[i - 1].is_ascii_digit()
                && (1..=3).all(|k| chars.get(i + k).is_some_and(|d| d.is_ascii_digit()))
                && !chars.get(i + 4).is_some_and(|d| d.is_ascii_digit())
            {
                // a thousands comma
            } else {
                s.push(*c);
            }
        }
        s
    };
    for t in normalize::tokens(&spaced) {
        if is_number(&t) {
            // One spelling for a plain number; anything else (a version-like
            // "1.2.3", a citation "1926.1400") is compared as written.
            match t.trim_end_matches('.').parse::<f64>() {
                Ok(v) if !t.contains('.') || t.matches('.').count() == 1 && t.len() < 8 => {
                    out.push(format!("{v}"))
                }
                _ => out.push(t),
            }
        }
    }
    out
}

/// A source split into the units one claim may draw its numbers from:
/// lines (table rows), then sentences ending in ". " or ";" (a decimal point
/// never splits).
fn claim_units(source: &str) -> Vec<String> {
    let mut out = Vec::new();
    for line in source.lines() {
        let mut cur = String::new();
        let chars: Vec<char> = line.chars().collect();
        for (i, c) in chars.iter().enumerate() {
            cur.push(*c);
            let end = (*c == '.' || *c == '?' || *c == '!')
                && chars.get(i + 1).is_none_or(|n| n.is_whitespace())
                || *c == ';';
            if end {
                if !cur.trim().is_empty() {
                    out.push(cur.trim().to_string());
                }
                cur.clear();
            }
        }
        if !cur.trim().is_empty() {
            out.push(cur.trim().to_string());
        }
    }
    out
}

/// Words that say which side of a number a value falls.
const RANGE_WORDS: &[&str] = &[
    "over", "under", "above", "below", "up", "more", "less", "least", "most", "exceed", "exceeds",
    "beyond", "within",
];

fn is_number(t: &str) -> bool {
    t.chars().next().is_some_and(|c| c.is_ascii_digit())
}

/// `text` without a leading yes/no verdict ("No, the rule…" → "the rule…").
fn strip_verdict(text: &str) -> String {
    let t = text.trim_start();
    for v in ["yes", "no"] {
        if t.get(..v.len()).is_some_and(|h| h.eq_ignore_ascii_case(v)) {
            let rest = &t[v.len()..];
            // "No, …" is a verdict; "No part of …" is a negated claim and
            // keeps its "No".
            if rest.is_empty() || rest.starts_with([',', '.', ';', ':', '!', '—', '-']) {
                return rest
                    .trim_start_matches([',', '.', ';', ':', '!', ' ', '—', '-'])
                    .to_string();
            }
        }
    }
    t.to_string()
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
