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
/// `{"signal_kind": "obd2.dtc", "value": "P0217"}`. A `null` kind (a code
/// typed off a display) is matched against every kind.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Observation {
    #[serde(default)]
    pub signal_kind: Option<String>,
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
    /// The cited section's verbatim text. For a rule with no tree this is
    /// all the manual says (a cause with no corrective action).
    pub section: Option<SignalSection>,
    /// False when the rule leads to no troubleshooting tree.
    pub has_tree: bool,
}

/// The manual text a signal rule cites.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct SignalSection {
    pub section_id: String,
    pub citation: String,
    pub heading: Option<String>,
    pub text: String,
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
    /// True when the hits lead to more than one tree (rules with no tree
    /// do not count).
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
        for r in rules.iter().filter(|r| {
            o.signal_kind
                .as_deref()
                .is_none_or(|k| fold(&r.signal_kind) == fold(k))
        }) {
            let applies = match &r.tree_id {
                Some(tree) => trees.iter().any(|t| &t.tree_id == tree),
                // No tree: the cited section must apply to the equipment.
                None => match &r.section_id {
                    Some(sid) => pack.applies(&pack.section_applies_to(sid)?, equip),
                    None => false,
                },
            };
            if !applies {
                continue;
            }
            match pattern_matches(&r.pattern, &o.value) {
                Ok(Some(kind)) => {
                    any = true;
                    let sec = match &r.section_id {
                        Some(s) => pack.section(s)?,
                        None => None,
                    };
                    hits.push((
                        i,
                        SignalHit {
                            observed: o.clone(),
                            matched: kind,
                            rule: r.clone(),
                            citation: sec.as_ref().map(|s| s.citation.clone()),
                            section: sec.map(|s| SignalSection {
                                section_id: s.section_id,
                                citation: s.citation,
                                heading: s.heading,
                                text: s.text,
                            }),
                            has_tree: r.tree_id.is_some(),
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
    let tree_set: BTreeSet<&str> = hits
        .iter()
        .filter_map(|h| h.rule.tree_id.as_deref())
        .collect();
    // Only a rule with a tree suggests where to start.
    let suggested = hits.iter().find_map(|h| {
        let tree_id = h.rule.tree_id.clone()?;
        Some(EntryPoint {
            node_id: h.rule.node_id.clone().unwrap_or_else(|| {
                trees
                    .iter()
                    .find(|t| t.tree_id == tree_id)
                    .map(|t| t.entry_node.clone())
                    .unwrap_or_default()
            }),
            tree_id,
        })
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

/// How sure a symptom match is, by a fixed rule (CONTRACT "Symptom
/// search"): `confident` when a signal matched, when the query's
/// meaningful words are covered (at least `symptom_confident_coverage` of
/// them, and at least two or all of them), or when the dense cosine
/// reaches `symptom_confident_dense` beside a lexical match; `closest`
/// otherwise; `none` for a search with no hit.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Confidence {
    Confident,
    Closest,
    None,
}

/// One ranked symptom.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct SymptomHit {
    pub symptom: Symptom,
    pub score: f64,
    pub confidence: Confidence,
    /// Share of the query's meaningful words the best phrase covers.
    pub coverage: f64,
    pub why: Vec<Why>,
}

/// Words that say nothing about a fault on their own ("it runs", "it
/// keeps going"): they never make a lexical match by themselves. A pack
/// may replace the list (`pack_meta.symptom_weak_words`, a JSON array).
pub const DEFAULT_WEAK_WORDS: &[&str] = &[
    "run",
    "running",
    "runs",
    "work",
    "works",
    "working",
    "go",
    "goes",
    "going",
    "get",
    "gets",
    "make",
    "makes",
    "keep",
    "keeps",
    "seem",
    "seems",
    "use",
    "used",
    "thing",
    "still",
    "just",
    "now",
    "time",
    "really",
    "bit",
    "little",
    "lot",
    "again",
    "sometimes",
    "problem",
    "issue",
];

/// Default `symptom_confident_coverage`.
pub const CONFIDENT_COVERAGE: f64 = 0.5;
/// Default `symptom_confident_dense`.
pub const CONFIDENT_DENSE: f64 = 0.85;

fn meta_f64(pack: &Pack, key: &str, default: f64) -> f64 {
    pack.meta(key)
        .and_then(|v| v.trim().parse::<f64>().ok())
        .filter(|v| v.is_finite())
        .unwrap_or(default)
}

fn weak_stems(pack: &Pack) -> Result<BTreeSet<String>> {
    let words: Vec<String> = match pack.meta("symptom_weak_words") {
        Some(raw) => serde_json::from_str(raw)
            .map_err(|e| crate::error::Error::Pack(format!("pack_meta.symptom_weak_words: {e}")))?,
        None => DEFAULT_WEAK_WORDS.iter().map(|w| w.to_string()).collect(),
    };
    Ok(words
        .iter()
        .flat_map(|w| normalize::content_stems(w))
        .collect())
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
    let weak = weak_stems(pack)?;
    let strong_q = q.iter().filter(|w| !weak.contains(*w)).count();
    let cov_t = meta_f64(pack, "symptom_confident_coverage", CONFIDENT_COVERAGE);
    let dense_t = meta_f64(pack, "symptom_confident_dense", CONFIDENT_DENSE);
    let mut out = Vec::new();
    for s in symptoms {
        let mut why = Vec::new();
        let mut lex = 0.0f64;
        let mut coverage = 0.0f64;
        let mut strong_hits = 0usize;
        if !q.is_empty() {
            let mut best: Option<(f64, Vec<String>, String, usize)> = None;
            for phrase in std::iter::once(&s.title).chain(s.synonyms.iter()) {
                let p: BTreeSet<String> = normalize::content_stems(phrase).into_iter().collect();
                if p.is_empty() {
                    continue;
                }
                let words: Vec<String> = p.iter().filter(|w| q_alt.contains(*w)).cloned().collect();
                let strong = words.iter().filter(|w| !weak.contains(*w)).count();
                // Weak words alone ("runs") are no match.
                if strong == 0 {
                    continue;
                }
                let overlap = words.len().min(q.len()) as f64;
                let dice = 2.0 * overlap / (q.len() + p.len()) as f64;
                if dice > 0.0 && best.as_ref().is_none_or(|b| dice > b.0) {
                    best = Some((dice, words, phrase.clone(), strong));
                }
            }
            if let Some((d, words, phrase, strong)) = best {
                lex = d;
                strong_hits = strong.min(strong_q);
                coverage = if strong_q == 0 {
                    0.0
                } else {
                    strong_hits as f64 / strong_q as f64
                };
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
            for h in sm
                .hits
                .iter()
                .filter(|h| h.rule.tree_id.as_deref() == Some(s.tree_id.as_str()))
            {
                signal = 1.0;
                why.push(Why::Signal {
                    signal_kind: h.rule.signal_kind.clone(),
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
        let words_cover = coverage >= cov_t && strong_hits >= strong_q.min(2) && strong_hits > 0;
        let confident =
            signal > 0.0 || words_cover || (dense_used && lex > 0.0 && dense >= dense_t);
        out.push(SymptomHit {
            symptom: s,
            score: (score * 1_000_000.0).round() / 1_000_000.0,
            confidence: if confident {
                Confidence::Confident
            } else {
                Confidence::Closest
            },
            coverage: (coverage * 1000.0).round() / 1000.0,
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
