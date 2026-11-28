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
    /// The reference-table row the rule resolves to, as it applies.
    #[serde(default, skip_deserializing)]
    pub row: Option<super::table::RowView>,
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
    /// For each unmatched text observation, the closest entries in the
    /// manual: never a match, never a start. The app says "no exact
    /// entry; closest entries in this manual".
    pub closest: Vec<Closest>,
}

/// The closest entries for one text observation no rule matched.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Closest {
    pub observed: Observation,
    /// The words searched: the text with a leading tag (`PreArm:`) taken
    /// off and numbers and instance digits dropped.
    pub query: String,
    /// The symptom index, ranked and rated as `symptom.search` does.
    pub symptoms: Vec<SymptomHit>,
    /// Text rules of the same signal kind, rated by the same rule.
    pub signals: Vec<ClosestSignal>,
}

/// A signal rule close to an unmatched text.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct ClosestSignal {
    pub rule: SignalRule,
    pub score: f64,
    pub coverage: f64,
    pub strong_hits: u32,
    /// The score's lead over the best other rule (its own score alone).
    pub margin: f64,
    pub confidence: Confidence,
    pub citation: Option<String>,
    pub section: Option<SignalSection>,
    pub has_tree: bool,
}

/// How many closest entries of each kind come back.
const CLOSEST_K: usize = 3;

/// The words of a status text to search with, or `None` when it is not
/// text (a code, a number). A leading tag ending in `:` is dropped, a word
/// starting with a digit is dropped, and digits inside words are dropped
/// (`Battery 1`, `Compass2` → `Battery`, `Compass`).
pub fn closest_query(value: &str) -> Option<String> {
    let mut v = value.trim();
    if let Some(i) = v.find(':') {
        let tag = &v[..i];
        if !tag.is_empty()
            && tag.len() <= 24
            && tag
                .chars()
                .all(|c| c.is_alphanumeric() || c == '_' || c == '-')
        {
            v = v[i + 1..].trim_start();
        }
    }
    let words: Vec<String> = v
        .split_whitespace()
        .filter(|w| !w.starts_with(|c: char| c.is_ascii_digit()))
        .map(|w| {
            w.chars()
                .filter(|c| !c.is_ascii_digit())
                .collect::<String>()
        })
        .filter(|w| w.chars().filter(|c| c.is_alphabetic()).count() >= 2)
        .collect();
    if words.len() < 2 {
        return None;
    }
    let q = words.join(" ");
    (!normalize::content_stems(&q).is_empty()).then_some(q)
}

/// A phrase against query stems: `(dice, coverage, strong hits)`, or
/// `None` with no strong word in common.
fn rate_phrase(q: &[String], weak: &BTreeSet<String>, phrase: &str) -> Option<(f64, f64, u32)> {
    let p: BTreeSet<String> = normalize::content_stems(phrase).into_iter().collect();
    if p.is_empty() || q.is_empty() {
        return None;
    }
    let qs: BTreeSet<&String> = q.iter().collect();
    let words: Vec<&String> = p.iter().filter(|w| qs.contains(w)).collect();
    let strong = words.iter().filter(|w| !weak.contains(**w)).count();
    if strong == 0 {
        return None;
    }
    let strong_q = qs.iter().filter(|w| !weak.contains(**w)).count();
    let strong_hits = strong.min(strong_q);
    let coverage = if strong_q == 0 {
        0.0
    } else {
        strong_hits as f64 / strong_q as f64
    };
    let dice = 2.0 * words.len().min(qs.len()) as f64 / (qs.len() + p.len()) as f64;
    Some((dice, coverage, strong_hits as u32))
}

fn closest_for(
    pack: &Pack,
    o: &Observation,
    rules: &[SignalRule],
    equip: Option<&str>,
    applies: &dyn Fn(&SignalRule) -> Result<bool>,
) -> Result<Option<Closest>> {
    let Some(query) = closest_query(&o.value) else {
        return Ok(None);
    };
    let (symptoms, _) = symptom_search(pack, Some(&query), &[], equip, None, CLOSEST_K)?;
    let mut q = normalize::content_stems(&query);
    q.sort();
    q.dedup();
    let rank = Ranking::for_pack(pack)?;
    let weak = rank.weak_stems();
    let mut signals = Vec::new();
    for r in rules.iter().filter(|r| {
        o.signal_kind
            .as_deref()
            .is_none_or(|k| fold(&r.signal_kind) == fold(k))
    }) {
        // Only plain-text rules: a code pattern is no phrase.
        if ["prefix:", "glob:", "re:"]
            .iter()
            .any(|p| r.pattern.starts_with(p))
            || !applies(r)?
        {
            continue;
        }
        let best = [r.pattern.as_str(), r.title.as_str()]
            .into_iter()
            .filter_map(|ph| rate_phrase(&q, &weak, ph))
            .max_by(|a, b| a.0.total_cmp(&b.0).then(a.1.total_cmp(&b.1)));
        let Some((dice, coverage, hits)) = best else {
            continue;
        };
        let sec = match &r.section_id {
            Some(s) => pack.section(s)?,
            None => None,
        };
        signals.push(ClosestSignal {
            rule: r.clone(),
            score: round6(dice),
            coverage: (coverage * 1000.0).round() / 1000.0,
            strong_hits: hits,
            margin: 0.0,
            confidence: Confidence::Closest,
            citation: sec.as_ref().map(|s| s.citation.clone()),
            section: sec.map(|s| SignalSection {
                section_id: s.section_id,
                citation: s.citation,
                heading: s.heading,
                text: s.text,
            }),
            has_tree: r.tree_id.is_some(),
        });
    }
    // The same rule as symptom search with dense off (signal rules have
    // no vectors).
    let leads = margins(&signals.iter().map(|s| s.score).collect::<Vec<_>>());
    for (s, lead) in signals.iter_mut().zip(leads) {
        s.margin = round6(lead.unwrap_or(s.score));
        s.confidence = rank.rate(
            false,
            false,
            s.coverage,
            s.strong_hits,
            None,
            lead.map(round6),
        );
    }
    signals.sort_by(|a, b| {
        b.score
            .total_cmp(&a.score)
            .then_with(|| a.rule.signal_kind.cmp(&b.rule.signal_kind))
            .then_with(|| a.rule.pattern.cmp(&b.rule.pattern))
    });
    signals.truncate(CLOSEST_K);
    Ok(Some(Closest {
        observed: o.clone(),
        query,
        symptoms,
        signals,
    }))
}

/// Match observations against the pack's signal map, for `equip`.
pub fn signal_match(
    pack: &Pack,
    observations: &[Observation],
    equip: Option<&str>,
) -> Result<SignalMatch> {
    signal_match_with(pack, observations, equip, &super::applic::AttrValues::new())
}

/// [`signal_match`] for an asset's attribute `values` (a row hit carries
/// the row as it applies to the asset).
pub fn signal_match_with(
    pack: &Pack,
    observations: &[Observation],
    equip: Option<&str>,
    values: &super::applic::AttrValues,
) -> Result<SignalMatch> {
    let rules = pack.signal_rules()?;
    let trees: Vec<super::FaultTree> = pack.fault_trees(equip)?;
    let applies = |r: &SignalRule| -> Result<bool> {
        Ok(match &r.tree_id {
            Some(tree) => trees.iter().any(|t| &t.tree_id == tree),
            // No tree: the cited section must apply to the equipment.
            None => match &r.section_id {
                Some(sid) => pack.applies(&pack.section_applies_to(sid)?, equip),
                None => false,
            },
        })
    };
    let mut hits: Vec<(usize, SignalHit)> = Vec::new();
    let mut unmatched = Vec::new();
    let mut closest = Vec::new();
    for (i, o) in observations.iter().enumerate() {
        let mut any = false;
        for r in rules.iter().filter(|r| {
            o.signal_kind
                .as_deref()
                .is_none_or(|k| fold(&r.signal_kind) == fold(k))
        }) {
            if !applies(r)? {
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
                            row: match &r.row_id {
                                Some(id) => match pack.ref_row(id)? {
                                    Some(row) => super::table::row_view(pack, &row, equip, values)?,
                                    None => None,
                                },
                                None => None,
                            },
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
            if let Some(c) = closest_for(pack, o, &rules, equip, &applies)? {
                closest.push(c);
            }
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
        closest,
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
    /// The confidence rule's inputs, for calibrating it offline: the
    /// lexical Dice of the best phrase, the meaningful query words it
    /// covers and how many the query has, and the dense cosine (whenever
    /// dense ran, counted or not).
    pub lexical: f64,
    pub strong_hits: u32,
    pub strong_query_words: u32,
    pub cosine: Option<f64>,
    /// This hit's score minus the best other hit's (its own score when it
    /// is alone, which satisfies any margin).
    pub margin: f64,
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

/// How lexical and dense scores combine.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Fusion {
    /// `w * lexical + (1 - w) * cosine` with dense active, else `lexical`.
    Weighted,
    /// Reciprocal-rank fusion: `1 / (rrf_k + rank)` summed over the lexical
    /// and the dense ranking (kept for comparison; not the default).
    Rrf,
}

/// The symptom ranking and confidence rule (CONTRACT "Symptom search"):
/// the code defaults, then `pack_meta`, then a caller's overrides. A
/// search returns the values it applied and whether dense was active, so
/// any result can be replayed.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Ranking {
    pub fusion: Fusion,
    /// `symptom_fusion_lexical_weight` w (the cosine weighs `1 - w`).
    pub lexical_weight: f64,
    /// `symptom_rrf_k`.
    pub rrf_k: f64,
    /// `symptom_dense_floor`: a dense hit with no lexical match is listed
    /// from this cosine.
    pub dense_floor: f64,
    /// Dense active: `symptom_confident_margin`, `symptom_confident_coverage`,
    /// `symptom_confident_strong_hits`, `symptom_confident_dense_alone`.
    pub margin: f64,
    pub coverage: f64,
    pub strong_hits: u32,
    pub dense_alone: f64,
    /// Dense off: `symptom_confident_margin_lexical`,
    /// `symptom_confident_coverage_lexical`,
    /// `symptom_confident_strong_hits_lexical`.
    pub margin_lexical: f64,
    pub coverage_lexical: f64,
    pub strong_hits_lexical: u32,
    /// The weak words in force (the core list or the pack's, plus additions).
    pub weak_words: Vec<String>,
    /// Whether the dense half ran for this result (set by the search).
    pub dense_active: bool,
}

/// Overrides of a pack's ranking, field by field.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct RankingParams {
    #[serde(default)]
    pub fusion: Option<Fusion>,
    #[serde(default)]
    pub lexical_weight: Option<f64>,
    #[serde(default)]
    pub rrf_k: Option<f64>,
    #[serde(default)]
    pub dense_floor: Option<f64>,
    #[serde(default)]
    pub margin: Option<f64>,
    #[serde(default)]
    pub coverage: Option<f64>,
    #[serde(default)]
    pub strong_hits: Option<u32>,
    #[serde(default)]
    pub dense_alone: Option<f64>,
    #[serde(default)]
    pub margin_lexical: Option<f64>,
    #[serde(default)]
    pub coverage_lexical: Option<f64>,
    #[serde(default)]
    pub strong_hits_lexical: Option<u32>,
    /// Replace the weak-word list.
    #[serde(default)]
    pub weak_words: Option<Vec<String>>,
    /// Add to it.
    #[serde(default)]
    pub weak_words_add: Vec<String>,
}

/// The calibrated defaults (618 development items; the dense-active
/// confidence set checked on 837 held-out items).
pub const LEXICAL_WEIGHT: f64 = 0.10;
pub const RRF_K: f64 = 60.0;
pub const DENSE_FLOOR: f64 = 0.5;
pub const CONFIDENT_MARGIN: f64 = 0.05;
pub const CONFIDENT_COVERAGE: f64 = 0.30;
pub const CONFIDENT_STRONG_HITS: u32 = 1;
pub const CONFIDENT_DENSE_ALONE: f64 = 0.80;
pub const CONFIDENT_MARGIN_LEXICAL: f64 = 0.15;
pub const CONFIDENT_COVERAGE_LEXICAL: f64 = 0.30;
pub const CONFIDENT_STRONG_HITS_LEXICAL: u32 = 1;

fn meta_list(pack: &Pack, key: &str) -> Result<Option<Vec<String>>> {
    pack.meta(key)
        .map(|raw| {
            serde_json::from_str(raw)
                .map_err(|e| crate::error::Error::Pack(format!("pack_meta.{key}: {e}")))
        })
        .transpose()
}

fn meta_u32(pack: &Pack, key: &str, default: u32) -> u32 {
    pack.meta(key)
        .and_then(|v| v.trim().parse::<u32>().ok())
        .unwrap_or(default)
}

impl Default for Ranking {
    fn default() -> Self {
        Self {
            fusion: Fusion::Weighted,
            lexical_weight: LEXICAL_WEIGHT,
            rrf_k: RRF_K,
            dense_floor: DENSE_FLOOR,
            margin: CONFIDENT_MARGIN,
            coverage: CONFIDENT_COVERAGE,
            strong_hits: CONFIDENT_STRONG_HITS,
            dense_alone: CONFIDENT_DENSE_ALONE,
            margin_lexical: CONFIDENT_MARGIN_LEXICAL,
            coverage_lexical: CONFIDENT_COVERAGE_LEXICAL,
            strong_hits_lexical: CONFIDENT_STRONG_HITS_LEXICAL,
            weak_words: DEFAULT_WEAK_WORDS.iter().map(|w| w.to_string()).collect(),
            dense_active: false,
        }
    }
}

impl Ranking {
    /// The defaults, then the pack's `pack_meta` keys.
    pub fn for_pack(pack: &Pack) -> Result<Self> {
        let d = Self::default();
        let fusion = match pack.meta("symptom_fusion").map(str::trim) {
            None | Some("weighted") => Fusion::Weighted,
            Some("rrf") => Fusion::Rrf,
            Some(other) => {
                return Err(crate::error::Error::Pack(format!(
                    "pack_meta.symptom_fusion {other:?}: weighted or rrf"
                )));
            }
        };
        let mut weak_words = meta_list(pack, "symptom_weak_words")?.unwrap_or(d.weak_words);
        weak_words.extend(meta_list(pack, "symptom_weak_words_add")?.unwrap_or_default());
        let r = Self {
            fusion,
            lexical_weight: meta_f64(pack, "symptom_fusion_lexical_weight", d.lexical_weight),
            rrf_k: meta_f64(pack, "symptom_rrf_k", d.rrf_k),
            dense_floor: meta_f64(pack, "symptom_dense_floor", d.dense_floor),
            margin: meta_f64(pack, "symptom_confident_margin", d.margin),
            coverage: meta_f64(pack, "symptom_confident_coverage", d.coverage),
            strong_hits: meta_u32(pack, "symptom_confident_strong_hits", d.strong_hits),
            dense_alone: meta_f64(pack, "symptom_confident_dense_alone", d.dense_alone),
            margin_lexical: meta_f64(pack, "symptom_confident_margin_lexical", d.margin_lexical),
            coverage_lexical: meta_f64(
                pack,
                "symptom_confident_coverage_lexical",
                d.coverage_lexical,
            ),
            strong_hits_lexical: meta_u32(
                pack,
                "symptom_confident_strong_hits_lexical",
                d.strong_hits_lexical,
            ),
            weak_words,
            dense_active: false,
        };
        if !(0.0..=1.0).contains(&r.lexical_weight) {
            return Err(crate::error::Error::Pack(
                "pack_meta.symptom_fusion_lexical_weight must be within 0..1".into(),
            ));
        }
        Ok(r)
    }

    /// Apply a caller's overrides.
    pub fn with(mut self, p: &RankingParams) -> Result<Self> {
        let finite = |name: &str, v: Option<f64>| -> Result<Option<f64>> {
            match v {
                Some(x) if !x.is_finite() || x < 0.0 => Err(crate::error::Error::Invalid(format!(
                    "ranking.{name} must be a finite number >= 0"
                ))),
                other => Ok(other),
            }
        };
        if let Some(f) = p.fusion {
            self.fusion = f;
        }
        for (name, slot, v) in [
            ("lexical_weight", &mut self.lexical_weight, p.lexical_weight),
            ("rrf_k", &mut self.rrf_k, p.rrf_k),
            ("dense_floor", &mut self.dense_floor, p.dense_floor),
            ("margin", &mut self.margin, p.margin),
            ("coverage", &mut self.coverage, p.coverage),
            ("dense_alone", &mut self.dense_alone, p.dense_alone),
            ("margin_lexical", &mut self.margin_lexical, p.margin_lexical),
            (
                "coverage_lexical",
                &mut self.coverage_lexical,
                p.coverage_lexical,
            ),
        ] {
            if let Some(x) = finite(name, v)? {
                *slot = x;
            }
        }
        if self.lexical_weight > 1.0 {
            return Err(crate::error::Error::Invalid(
                "ranking.lexical_weight must be within 0..1".into(),
            ));
        }
        if let Some(n) = p.strong_hits {
            self.strong_hits = n;
        }
        if let Some(n) = p.strong_hits_lexical {
            self.strong_hits_lexical = n;
        }
        if let Some(w) = &p.weak_words {
            self.weak_words = w.clone();
        }
        self.weak_words.extend(p.weak_words_add.iter().cloned());
        Ok(self)
    }

    fn weak_stems(&self) -> BTreeSet<String> {
        self.weak_words
            .iter()
            .flat_map(|w| normalize::content_stems(w))
            .collect()
    }

    /// The confidence rule on one hit's inputs. `margin` is the hit's score
    /// minus the best other hit's; `None` when it is the only hit (then the
    /// margin is satisfied).
    pub fn rate(
        &self,
        dense_active: bool,
        signal: bool,
        coverage: f64,
        strong_hits: u32,
        cosine: Option<f64>,
        margin: Option<f64>,
    ) -> Confidence {
        if signal {
            return Confidence::Confident;
        }
        let confident = if dense_active {
            margin.is_none_or(|m| m >= self.margin)
                && ((coverage >= self.coverage && strong_hits >= self.strong_hits.max(1))
                    || cosine.is_some_and(|c| c >= self.dense_alone))
        } else {
            margin.is_none_or(|m| m >= self.margin_lexical)
                && coverage >= self.coverage_lexical
                && strong_hits >= self.strong_hits_lexical.max(1)
        };
        if confident {
            Confidence::Confident
        } else {
            Confidence::Closest
        }
    }
}

/// Each score's lead over the best other score; `None` alone.
fn margins(scores: &[f64]) -> Vec<Option<f64>> {
    if scores.len() < 2 {
        return vec![None; scores.len()];
    }
    let mut best = (f64::NEG_INFINITY, f64::NEG_INFINITY);
    for &s in scores {
        if s > best.0 {
            best = (s, best.0);
        } else if s > best.1 {
            best.1 = s;
        }
    }
    scores
        .iter()
        .map(|&s| Some(s - if s >= best.0 { best.1 } else { best.0 }))
        .collect()
}

fn meta_f64(pack: &Pack, key: &str, default: f64) -> f64 {
    pack.meta(key)
        .and_then(|v| v.trim().parse::<f64>().ok())
        .filter(|v| v.is_finite())
        .unwrap_or(default)
}

fn round6(x: f64) -> f64 {
    (x * 1_000_000.0).round() / 1_000_000.0
}

/// Rank the pack's symptoms for `text` and/or `observations`, for `equip`.
pub fn symptom_search(
    pack: &Pack,
    text: Option<&str>,
    observations: &[Observation],
    equip: Option<&str>,
    embedder: Option<&dyn Embedder>,
    k: usize,
) -> Result<(Vec<SymptomHit>, bool)> {
    let rank = Ranking::for_pack(pack)?;
    symptom_search_with(pack, text, observations, equip, embedder, k, &rank)
}

/// [`symptom_search`] under an explicit ranking rule.
pub fn symptom_search_with(
    pack: &Pack,
    text: Option<&str>,
    observations: &[Observation],
    equip: Option<&str>,
    embedder: Option<&dyn Embedder>,
    k: usize,
    rank: &Ranking,
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
    let weak = rank.weak_stems();
    let strong_q = q.iter().filter(|w| !weak.contains(*w)).count();
    let mut out = Vec::new();
    // Raw (lexical, dense, signal, dense counted) per hit, scored after.
    let mut raw: Vec<(f64, f64, f64, bool)> = Vec::new();
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
        let dense_counts = dense_used && (lex > 0.0 || dense >= rank.dense_floor);
        if dense_counts {
            why.push(Why::Dense {
                cosine: (dense * 1000.0).round() / 1000.0,
            });
        }
        if lex <= 0.0 && signal <= 0.0 && !dense_counts {
            continue;
        }
        raw.push((lex, dense, signal, dense_counts));
        out.push(SymptomHit {
            symptom: s,
            score: 0.0,
            confidence: Confidence::Closest,
            coverage: (coverage * 1000.0).round() / 1000.0,
            why,
            lexical: round6(lex),
            strong_hits: strong_hits as u32,
            strong_query_words: strong_q as u32,
            cosine: dense_used.then_some(round6(dense)),
            margin: 0.0,
        });
    }
    // Fuse.
    let w = rank.lexical_weight;
    let scores: Vec<f64> = match rank.fusion {
        Fusion::Weighted => raw
            .iter()
            .map(|&(lex, dense, signal, _)| {
                let fused = if dense_used {
                    w * lex + (1.0 - w) * dense.max(0.0)
                } else {
                    lex
                };
                round6(fused + signal)
            })
            .collect(),
        Fusion::Rrf => {
            // 1-based ranks among the hits that have that half (ties by id).
            let rank_of = |key: &dyn Fn(usize) -> Option<f64>| -> Vec<Option<usize>> {
                let mut idx: Vec<usize> = (0..raw.len()).filter(|&i| key(i).is_some()).collect();
                idx.sort_by(|&a, &b| {
                    key(b)
                        .unwrap_or(0.0)
                        .total_cmp(&key(a).unwrap_or(0.0))
                        .then_with(|| out[a].symptom.symptom_id.cmp(&out[b].symptom.symptom_id))
                });
                let mut r = vec![None; raw.len()];
                for (n, i) in idx.into_iter().enumerate() {
                    r[i] = Some(n + 1);
                }
                r
            };
            let lex_rank = rank_of(&|i| (raw[i].0 > 0.0).then_some(raw[i].0));
            let dense_rank = rank_of(&|i| raw[i].3.then_some(raw[i].1));
            (0..raw.len())
                .map(|i| {
                    let f = |r: Option<usize>| r.map_or(0.0, |r| 1.0 / (rank.rrf_k + r as f64));
                    round6(f(lex_rank[i]) + f(dense_rank[i]) + raw[i].2)
                })
                .collect()
        }
    };
    // Each hit's lead over the best other hit (before truncation), then
    // the confidence rule.
    let leads = margins(&scores);
    for (i, h) in out.iter_mut().enumerate() {
        h.score = scores[i];
        h.margin = round6(leads[i].unwrap_or(scores[i]));
        h.confidence = rank.rate(
            dense_used,
            raw[i].2 > 0.0,
            h.coverage,
            h.strong_hits,
            h.cosine,
            leads[i].map(round6),
        );
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
