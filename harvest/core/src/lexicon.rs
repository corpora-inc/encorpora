//! A forgiving reading of query words against the pack's own vocabulary.
//!
//! The FTS index matches only words it holds. A query word it does not hold
//! is read, in order, as a British-to-American spelling variant, the two
//! halves of a run-together word ("powerline"), or the nearest indexed word
//! within one or two edits ("outrigers"). A hyphenated word ("de-energized")
//! is also read joined. Readings add search terms; they never remove one.
//!
//! Words are compared by their Snowball English (Porter2) stem, the stemmer
//! the crane app's browser engine uses, so both read a query alike.

use crate::normalize::{fold, is_stopword, stem, tokens};
use schemars::JsonSchema;
use serde::Serialize;
use std::collections::{HashMap, HashSet};

/// How a query word the pack does not hold as typed was read.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct Reading {
    /// The word as typed.
    pub word: String,
    /// The indexed words it was read as.
    #[serde(rename = "as")]
    pub as_words: Vec<String>,
    /// "spelling", "split", "typo" or "join".
    pub via: &'static str,
}

/// Longer words are not read: a pasted blob must not stall a search.
const MAX_WORD: usize = 32;
/// Distinct words read from one query.
const MAX_WORDS: usize = 32;

/// The pack's vocabulary: stems with document frequency and commonest word,
/// every word as written, and every pair of adjacent words.
#[derive(Debug, Default)]
pub struct Lexicon {
    /// Stem → (documents holding it, the commonest word that produced it).
    terms: HashMap<String, (u32, String)>,
    /// Every content word as written → its stem.
    words: HashMap<String, String>,
    /// "power line": adjacent words, to confirm a run-together reading.
    pairs: HashSet<String>,
}

impl Lexicon {
    /// Build from the retrieval texts, one document each.
    pub fn build<'a>(docs: impl IntoIterator<Item = &'a str>) -> Self {
        let mut df: HashMap<String, u32> = HashMap::new();
        let mut counts: HashMap<String, HashMap<String, u32>> = HashMap::new();
        let mut pairs: HashSet<String> = HashSet::new();
        for doc in docs {
            let toks = tokens(doc);
            for w in toks.windows(2) {
                pairs.insert(format!("{} {}", w[0], w[1]));
            }
            let mut seen = HashSet::new();
            for t in toks {
                if is_stopword(&t) || is_number(&t) {
                    continue;
                }
                let s = stem(&t);
                *counts.entry(s.clone()).or_default().entry(t).or_insert(0) += 1;
                if seen.insert(s.clone()) {
                    *df.entry(s).or_insert(0) += 1;
                }
            }
        }
        let mut words = HashMap::new();
        let mut terms = HashMap::new();
        for (s, n) in df {
            let m = counts.remove(&s).unwrap_or_default();
            let surface = m
                .iter()
                .max_by(|a, b| a.1.cmp(b.1).then_with(|| b.0.cmp(a.0)))
                .map_or_else(|| s.clone(), |(w, _)| w.clone());
            for w in m.into_keys() {
                words.insert(w, s.clone());
            }
            terms.insert(s, (n, surface));
        }
        Self {
            terms,
            words,
            pairs,
        }
    }

    fn df(&self, stem: &str) -> u32 {
        self.terms.get(stem).map_or(0, |t| t.0)
    }

    fn surface(&self, stem: &str) -> String {
        self.terms
            .get(stem)
            .map_or_else(|| stem.to_string(), |t| t.1.clone())
    }

    /// Readings for the words of `query` the pack does not hold as typed.
    pub fn read(&self, query: &str) -> Vec<Reading> {
        let mut out: Vec<Reading> = Vec::new();
        let folded = fold(query);
        // Hyphenated words, joined: "de-energized" also searches "deenergized".
        for word in folded.split(|c: char| !(c.is_alphanumeric() || c == '-')) {
            let parts: Vec<&str> = word.split('-').filter(|p| !p.is_empty()).collect();
            if parts.len() < 2 || word.chars().count() > MAX_WORD {
                continue;
            }
            let joined: String = parts.concat();
            let word = word.trim_matches('-').to_string();
            if self.df(&stem(&joined)) > 0 && !out.iter().any(|r| r.word == word) {
                out.push(Reading {
                    word,
                    as_words: vec![self.surface(&stem(&joined))],
                    via: "join",
                });
            }
        }
        let mut seen = HashSet::new();
        for w in tokens(query) {
            if is_stopword(&w) || is_number(&w) || w.chars().count() > MAX_WORD || seen.contains(&w)
            {
                continue;
            }
            if seen.len() >= MAX_WORDS {
                break;
            }
            seen.insert(w.clone());
            let s = stem(&w);
            if self.df(&s) > 0 {
                // A rare run-together form ("powerline") also searches the two
                // words the pack writes side by side ("power line").
                if self.df(&s) <= 2
                    && let Some(halves) = self.split(&w, true)
                {
                    out.push(Reading {
                        word: w,
                        as_words: halves,
                        via: "split",
                    });
                }
                continue;
            }
            let reading = if let Some(v) = spelling_variants(&w)
                .into_iter()
                .find(|v| self.df(&stem(v)) > 0)
            {
                Some((vec![v], "spelling"))
            } else if let Some(near) = self.nearest(&w) {
                Some((vec![near], "typo"))
            } else {
                self.split(&w, false).map(|h| (h, "split"))
            };
            if let Some((as_words, via)) = reading {
                out.push(Reading {
                    word: w,
                    as_words,
                    via,
                });
            }
        }
        out
    }

    /// "powerline" → ["power", "line"]: both halves, four letters or more,
    /// are words the pack holds, the most even cut first. With `adjacent`,
    /// the pack must also write the two side by side.
    fn split(&self, w: &str, adjacent: bool) -> Option<Vec<String>> {
        let chars: Vec<char> = w.chars().collect();
        if chars.len() < 8 {
            return None;
        }
        let mid = chars.len() / 2;
        let mut cuts: Vec<usize> = (4..=chars.len() - 4).collect();
        cuts.sort_by_key(|i| i.abs_diff(mid));
        for i in cuts {
            let a: String = chars[..i].iter().collect();
            let b: String = chars[i..].iter().collect();
            if self.words.contains_key(&a)
                && self.words.contains_key(&b)
                && (!adjacent || self.pairs.contains(&format!("{a} {b}")))
            {
                return Some(vec![a, b]);
            }
        }
        None
    }

    /// The closest word the pack holds, compared as whole words (a stemmer
    /// cuts a correct word harder than a misspelt one): one edit for words of
    /// 5 to 7 letters, two from 8. Ties go to the commoner stem, then the
    /// first alphabetically.
    fn nearest(&self, w: &str) -> Option<String> {
        let n = w.chars().count();
        if n < 5 || !w.chars().all(char::is_alphabetic) {
            return None;
        }
        let max = if n >= 8 { 2 } else { 1 };
        let mut best: Option<(&str, usize, u32)> = None;
        for (cand, s) in &self.words {
            if cand.chars().count().abs_diff(n) > max {
                continue;
            }
            let d = edit_distance(w, cand, max);
            if d > max {
                continue;
            }
            let df = self.df(s);
            let better = match best {
                None => true,
                Some((bw, bd, bdf)) => {
                    d < bd || (d == bd && (df > bdf || (df == bdf && cand.as_str() < bw)))
                }
            };
            if better {
                best = Some((cand.as_str(), d, df));
            }
        }
        best.map(|b| b.0.to_string())
    }
}

fn is_number(t: &str) -> bool {
    t.chars().next().is_some_and(|c| c.is_ascii_digit())
}

/// British spellings rewritten to the American spelling. Each rewrite is a
/// candidate only: a word takes it when the pack holds the rewrite and not
/// the word itself.
pub fn spelling_variants(w: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let push = |v: String, out: &mut Vec<String>| {
        if v != w && !out.contains(&v) {
            out.push(v);
        }
    };
    for v in one_step(w) {
        push(v.clone(), &mut out);
        // Two rules at once: "manoeuvres" → "maneuvers".
        for v2 in one_step(&v) {
            push(v2, &mut out);
        }
    }
    out
}

fn one_step(w: &str) -> Vec<String> {
    const WHOLE: &[(&str, &str)] = &[
        ("tyre", "tire"),
        ("tyres", "tires"),
        ("kerb", "curb"),
        ("kerbs", "curbs"),
        ("storey", "story"),
        ("storeys", "stories"),
    ];
    const PREFIX: &[(&str, &str)] = &[
        ("grey", "gray"),
        ("aluminium", "aluminum"),
        ("plough", "plow"),
        ("draught", "draft"),
        ("manoeuvre", "maneuver"),
        ("manoeuv", "maneuv"),
    ];
    // (suffix, replacement, the letter before it must not be a vowel)
    const SUFFIX: &[(&str, &str, bool)] = &[
        ("ours", "ors", false),
        ("oured", "ored", false),
        ("ouring", "oring", false),
        ("our", "or", false),
        ("res", "ers", true),
        ("red", "ered", true),
        ("re", "er", true),
        ("isations", "izations", false),
        ("isation", "ization", false),
        ("isers", "izers", false),
        ("iser", "izer", false),
        ("ising", "izing", false),
        ("ised", "ized", false),
        ("ises", "izes", false),
        ("ise", "ize", false),
        ("ysing", "yzing", false),
        ("ysed", "yzed", false),
        ("yses", "yzes", false),
        ("yse", "yze", false),
        ("ence", "ense", false),
        ("ogue", "og", false),
        ("lling", "ling", false),
        ("lled", "led", false),
        ("ller", "ler", false),
        ("llers", "lers", false),
        ("lment", "llment", false),
    ];
    let mut out = Vec::new();
    for (from, to) in WHOLE {
        if w == *from {
            out.push((*to).to_string());
        }
    }
    for (from, to) in PREFIX {
        if let Some(rest) = w.strip_prefix(from) {
            out.push(format!("{to}{rest}"));
        }
    }
    for (pair, to) in [("ae", "e"), ("oe", "e")] {
        if let Some(i) = w.find(pair) {
            out.push(format!("{}{}{}", &w[..i], to, &w[i + pair.len()..]));
        }
    }
    for (suf, to, consonant) in SUFFIX {
        if let Some(stem) = w.strip_suffix(suf) {
            if stem.is_empty() {
                continue;
            }
            if *consonant && stem.chars().last().is_some_and(|c| "aeiou".contains(c)) {
                continue;
            }
            out.push(format!("{stem}{to}"));
            break;
        }
    }
    out
}

/// Damerau-Levenshtein (optimal string alignment) distance over characters;
/// returns `max + 1` as soon as the distance must exceed `max`.
pub fn edit_distance(a: &str, b: &str, max: usize) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    if a.len().abs_diff(b.len()) > max {
        return max + 1;
    }
    let mut prev2: Vec<usize> = Vec::new();
    let mut prev: Vec<usize> = (0..=b.len()).collect();
    for i in 1..=a.len() {
        let mut cur = vec![i; b.len() + 1];
        let mut row_best = i;
        for j in 1..=b.len() {
            let cost = usize::from(a[i - 1] != b[j - 1]);
            let mut d = (prev[j] + 1).min(cur[j - 1] + 1).min(prev[j - 1] + cost);
            if i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1] {
                d = d.min(prev2[j - 2] + 1);
            }
            cur[j] = d;
            row_best = row_best.min(d);
        }
        if row_best > max {
            return max + 1;
        }
        prev2 = prev;
        prev = cur;
    }
    prev[b.len()]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lex() -> Lexicon {
        Lexicon::build([
            "Outriggers must be fully extended. The outrigger pads must be on firm ground.",
            "Hand signals to operators must be by the Standard Method.",
            "Before work, the power line must be deenergized and grounded.",
            "Keep the power line clearance. Tires must be inflated to the rated pressure.",
        ])
    }

    #[test]
    fn stems_agree_with_the_browser_engine() {
        for w in ["signalling", "signaling", "signals", "signal"] {
            assert_eq!(stem(w), "signal", "{w}");
        }
    }

    #[test]
    fn typos_variants_splits_and_joins() {
        let l = lex();
        assert_eq!(
            l.read("outrigers"),
            vec![Reading {
                word: "outrigers".into(),
                as_words: vec!["outriggers".into()],
                via: "typo"
            }]
        );
        assert_eq!(
            l.read("tyre pressure")[0].as_words,
            vec!["tire".to_string()]
        );
        assert_eq!(
            l.read("powerline")[0].as_words,
            vec!["power".to_string(), "line".to_string()]
        );
        let de = l.read("de-energized");
        assert!(
            de.iter()
                .any(|r| r.via == "join" && r.as_words == vec!["deenergized".to_string()]),
            "{de:?}"
        );
        assert!(
            l.read("signalling outriggers").is_empty(),
            "words the pack holds are not re-read"
        );
        assert!(l.read("xyzzy qwerty").is_empty());
    }

    #[test]
    fn a_rare_word_the_pack_holds_is_split_only_into_words_it_writes_side_by_side() {
        let l = Lexicon::build([
            "Nothing may be hinged. Offering ring buoys.",
            "Keep the powerline clear. The power line is energized.",
        ]);
        assert!(
            l.read("nothing offering").is_empty(),
            "{:?}",
            l.read("nothing offering")
        );
        assert_eq!(
            l.read("powerline"),
            vec![Reading {
                word: "powerline".into(),
                as_words: vec!["power".into(), "line".into()],
                via: "split"
            }]
        );
    }

    #[test]
    fn long_input_is_not_read() {
        let l = lex();
        let t = std::time::Instant::now();
        assert!(l.read(&"x".repeat(20_000)).is_empty());
        let many: Vec<String> = (0..2000).map(|i| format!("zq{i}word")).collect();
        let _ = l.read(&many.join(" "));
        assert!(t.elapsed().as_millis() < 500, "{:?}", t.elapsed());
    }

    #[test]
    fn spelling_and_distance() {
        assert!(spelling_variants("metre").contains(&"meter".to_string()));
        assert!(spelling_variants("licence").contains(&"license".to_string()));
        assert!(spelling_variants("manoeuvres").contains(&"maneuvers".to_string()));
        assert!(spelling_variants("energised").contains(&"energized".to_string()));
        assert_eq!(edit_distance("outrig", "outrigg", 2), 1);
        assert_eq!(edit_distance("ab", "ba", 2), 1);
        assert_eq!(edit_distance("abc", "xyzabc", 2), 3);
    }
}
