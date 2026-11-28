//! Ways into a tree: symptom search (typed or spoken words, and machine
//! signals) and signal matching. Ranking is deterministic and says why each
//! result matched; the dense half runs only with an embedder that matches
//! the pack.

use super::{Pack, SignalRule, Symptom};
use crate::embed::{Embedder, normalize_l2};
use crate::error::Result;
use crate::normalize;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

/// A normalized machine observation (protocol decoding happens before
/// this): `{"signal_kind": "j1939.dm1", "value": "spn:110/fmi:0"}`,
/// `{"signal_kind": "obd2.dtc", "value": "P0217"}`.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Observation {
    pub signal_kind: String,
    pub value: String,
}

/// How a pattern matched.
#[derive(
    Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq, PartialOrd, Ord,
)]
#[serde(rename_all = "snake_case")]
pub enum MatchKind {
    Exact,
    Glob,
    Prefix,
    Regex,
}

fn fold(s: &str) -> String {
    super::branch::fold(s)
}

/// Does `pattern` match `observed`? `Err` for a malformed pattern.
pub fn pattern_matches(
    pattern: &str,
    observed: &str,
) -> std::result::Result<Option<MatchKind>, String> {
    let obs = fold(observed);
    if let Some(p) = pattern.strip_prefix("re:") {
        let re = regex_lite::RegexBuilder::new(p)
            .case_insensitive(true)
            .build()
            .map_err(|e| format!("regex {p:?}: {e}"))?;
        return Ok(re.is_match(observed.trim()).then_some(MatchKind::Regex));
    }
    if let Some(p) = pattern.strip_prefix("prefix:") {
        let p = fold(p);
        if p.is_empty() {
            return Err("empty prefix".into());
        }
        return Ok(obs.starts_with(&p).then_some(MatchKind::Prefix));
    }
    if let Some(p) = pattern.strip_prefix("glob:") {
        let p = fold(p);
        if p.is_empty() {
            return Err("empty glob".into());
        }
        return Ok(glob(&p, &obs).then_some(MatchKind::Glob));
    }
    let p = fold(pattern);
    if p.is_empty() {
        return Err("empty pattern".into());
    }
    Ok((p == obs).then_some(MatchKind::Exact))
}

/// `*` any run, `?` one character.
fn glob(p: &str, s: &str) -> bool {
    let (p, s): (Vec<char>, Vec<char>) = (p.chars().collect(), s.chars().collect());
    let (mut pi, mut si, mut star, mut mark) = (0usize, 0usize, None::<usize>, 0usize);
    while si < s.len() {
        if pi < p.len() && (p[pi] == '?' || p[pi] == s[si]) {
            pi += 1;
            si += 1;
        } else if pi < p.len() && p[pi] == '*' {
            star = Some(pi);
            mark = si;
            pi += 1;
        } else if let Some(st) = star {
            pi = st + 1;
            mark += 1;
            si = mark;
        } else {
            return false;
        }
    }
    while pi < p.len() && p[pi] == '*' {
        pi += 1;
    }
    pi == p.len()
}

/// One signal rule an observation matched.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct SignalHit {
    pub observed: Observation,
    pub matched: MatchKind,
    pub rule: SignalRule,
    /// The rule's section citation, when it cites one.
    pub citation: Option<String>,
}

/// Where the signals suggest starting.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct EntryPoint {
    pub tree_id: String,
    /// The node to start at (the tree's entry when the rule names none).
    pub node_id: String,
}

/// The result of matching observations.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct SignalMatch {
    /// Most specific first: exact, glob, prefix, regex; then observation order.
    pub hits: Vec<SignalHit>,
    pub suggested: Option<EntryPoint>,
    /// True when the hits lead to more than one tree.
    pub ambiguous: bool,
    /// Observations no rule matched.
    pub unmatched: Vec<Observation>,
}

/// Match observations against the pack's signal map, for `equip`.
pub fn signal_match(
    pack: &Pack,
    observations: &[Observation],
    equip: Option<&str>,
) -> Result<SignalMatch> {
    let rules = pack.signal_rules()?;
    let trees: Vec<super::FaultTree> = pack.fault_trees(equip)?;
    let mut hits: Vec<(usize, SignalHit)> = Vec::new();
    let mut unmatched = Vec::new();
    for (i, o) in observations.iter().enumerate() {
        let mut any = false;
        for r in rules
            .iter()
            .filter(|r| fold(&r.signal_kind) == fold(&o.signal_kind))
        {
            if !trees.iter().any(|t| t.tree_id == r.tree_id) {
                continue;
            }
            match pattern_matches(&r.pattern, &o.value) {
                Ok(Some(kind)) => {
                    any = true;
                    let citation = match &r.section_id {
                        Some(s) => pack.section(s)?.map(|s| s.citation),
                        None => None,
                    };
                    hits.push((
                        i,
                        SignalHit {
                            observed: o.clone(),
                            matched: kind,
                            rule: r.clone(),
                            citation,
                        },
                    ));
                }
                Ok(None) => {}
                Err(m) => eprintln!(
                    "harvest: signal rule {} {}: {m}; skipped",
                    r.signal_kind, r.pattern
                ),
            }
        }
        if !any {
            unmatched.push(o.clone());
        }
    }
    hits.sort_by(|a, b| {
        a.1.matched
            .cmp(&b.1.matched)
            .then(a.0.cmp(&b.0))
            .then_with(|| a.1.rule.pattern.cmp(&b.1.rule.pattern))
    });
    let hits: Vec<SignalHit> = hits.into_iter().map(|(_, h)| h).collect();
    let tree_set: BTreeSet<&str> = hits.iter().map(|h| h.rule.tree_id.as_str()).collect();
    let suggested = hits.first().map(|h| EntryPoint {
        tree_id: h.rule.tree_id.clone(),
        node_id: h.rule.node_id.clone().unwrap_or_else(|| {
            trees
                .iter()
                .find(|t| t.tree_id == h.rule.tree_id)
                .map(|t| t.entry_node.clone())
                .unwrap_or_default()
        }),
    });
    Ok(SignalMatch {
        ambiguous: tree_set.len() > 1,
        hits,
        suggested,
        unmatched,
    })
}

/// Why a symptom matched.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Why {
    /// Query words found in the symptom's title or one of its synonyms.
    Words { words: Vec<String>, phrase: String },
    /// An observation matched a signal rule for the symptom's tree.
    Signal {
        signal_kind: String,
        value: String,
        pattern: String,
    },
    /// Embedding similarity (only with the pack's embedder).
    Dense { cosine: f64 },
}

/// One ranked symptom.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct SymptomHit {
    pub symptom: Symptom,
    pub score: f64,
    pub why: Vec<Why>,
}

/// Lowest cosine that counts as a dense match on its own.
const DENSE_ALONE: f64 = 0.5;

/// Rank the pack's symptoms for `text` and/or `observations`, for `equip`.
pub fn symptom_search(
    pack: &Pack,
    text: Option<&str>,
    observations: &[Observation],
    equip: Option<&str>,
    embedder: Option<&dyn Embedder>,
    k: usize,
) -> Result<(Vec<SymptomHit>, bool)> {
    let symptoms = pack.symptoms(equip)?;
    let text = text.map(str::trim).filter(|t| !t.is_empty());
    // Query stems; pack synonyms add their canonical words as alternatives.
    let q: Vec<String> = text
        .map(|t| {
            let mut v = normalize::content_stems(t);
            v.dedup();
            v.into_iter().collect::<BTreeSet<_>>().into_iter().collect()
        })
        .unwrap_or_default();
    let mut q_alt: BTreeSet<String> = q.iter().cloned().collect();
    if let Some(t) = text {
        let folded = normalize::fold(t);
        for (phrase, canonical) in pack.synonyms() {
            if folded.contains(phrase.as_str()) {
                q_alt.extend(normalize::content_stems(canonical));
            }
        }
    }
    let signals = if observations.is_empty() {
        None
    } else {
        Some(signal_match(pack, observations, equip)?)
    };
    // Dense: the query against each symptom's chunk vector.
    let mut dense_used = false;
    let mut qvec: Option<Vec<f32>> = None;
    let index = match (embedder, text) {
        (Some(e), Some(t)) => match pack.vectors(e.id(), e.dim())? {
            Some(ix) => {
                let mut v = e.embed_query(t)?;
                normalize_l2(&mut v);
                if v.len() == ix.dim {
                    qvec = Some(v);
                    dense_used = true;
                    Some(ix)
                } else {
                    None
                }
            }
            None => None,
        },
        _ => None,
    };
    let mut out = Vec::new();
    for s in symptoms {
        let mut why = Vec::new();
        let mut lex = 0.0f64;
        if !q.is_empty() {
            let mut best: Option<(f64, Vec<String>, String)> = None;
            for phrase in std::iter::once(&s.title).chain(s.synonyms.iter()) {
                let p: BTreeSet<String> = normalize::content_stems(phrase).into_iter().collect();
                if p.is_empty() {
                    continue;
                }
                let words: Vec<String> = p.iter().filter(|w| q_alt.contains(*w)).cloned().collect();
                let overlap = words.len().min(q.len()) as f64;
                let dice = 2.0 * overlap / (q.len() + p.len()) as f64;
                if dice > 0.0 && best.as_ref().is_none_or(|b| dice > b.0) {
                    best = Some((dice, words, phrase.clone()));
                }
            }
            if let Some((d, words, phrase)) = best {
                lex = d;
                why.push(Why::Words { words, phrase });
            }
        }
        let mut dense = 0.0f64;
        if let (Some(ix), Some(qv)) = (index, qvec.as_ref()) {
            let chunk_ids: Vec<String> = {
                let conn = pack.conn();
                let mut stmt = conn.prepare_cached(
                    "SELECT chunk_id FROM chunk WHERE ref_kind = 'symptom' AND ref_id = ?1",
                )?;
                stmt.query_map([&s.symptom_id], |r| r.get(0))?
                    .collect::<rusqlite::Result<_>>()?
            };
            for cid in chunk_ids {
                if let Some(i) = ix.ids.iter().position(|x| x == &cid) {
                    let row = &ix.data[i * ix.dim..(i + 1) * ix.dim];
                    let dot: f32 = row.iter().zip(qv).map(|(&a, &b)| a as f32 * b).sum();
                    dense = dense.max((dot * ix.factor[i]) as f64);
                }
            }
        }
        let mut signal = 0.0;
        if let Some(sm) = &signals {
            for h in sm.hits.iter().filter(|h| h.rule.tree_id == s.tree_id) {
                signal = 1.0;
                why.push(Why::Signal {
                    signal_kind: h.observed.signal_kind.clone(),
                    value: h.observed.value.clone(),
                    pattern: h.rule.pattern.clone(),
                });
            }
        }
        let dense_counts = dense_used && (lex > 0.0 || dense >= DENSE_ALONE);
        if dense_counts {
            why.push(Why::Dense {
                cosine: (dense * 1000.0).round() / 1000.0,
            });
        }
        if lex <= 0.0 && signal <= 0.0 && !dense_counts {
            continue;
        }
        let score = if dense_used {
            0.6 * lex + 0.4 * dense.max(0.0)
        } else {
            lex
        } + signal;
        out.push(SymptomHit {
            symptom: s,
            score: (score * 1_000_000.0).round() / 1_000_000.0,
            why,
        });
    }
    out.sort_by(|a, b| {
        b.score
            .total_cmp(&a.score)
            .then_with(|| a.symptom.symptom_id.cmp(&b.symptom.symptom_id))
    });
    out.truncate(k.max(1));
    Ok((out, dense_used))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn patterns() {
        assert_eq!(
            pattern_matches("P0217", " p0217 "),
            Ok(Some(MatchKind::Exact))
        );
        assert_eq!(
            pattern_matches("glob:spn:110/fmi:*", "SPN:110/FMI:16"),
            Ok(Some(MatchKind::Glob))
        );
        assert_eq!(
            pattern_matches("glob:spn:110/fmi:?", "spn:110/fmi:16"),
            Ok(None)
        );
        assert_eq!(
            pattern_matches("prefix:PreArm:", "PreArm: Battery low"),
            Ok(Some(MatchKind::Prefix))
        );
        assert_eq!(
            pattern_matches("re:^E0[1-3]$", "E02"),
            Ok(Some(MatchKind::Regex))
        );
        assert!(pattern_matches("re:(", "x").is_err());
    }
}
