//! Query and text normalization: case and punctuation folding, number words
//! to digits, unit spellings to one form, stemming, and synonym expansion from
//! pack data. Corpus-agnostic: the only vocabulary here is English number
//! words, common units and stopwords; domain synonyms come from the pack.

use rust_stemmers::{Algorithm, Stemmer};
use std::collections::BTreeSet;
use std::sync::OnceLock;

fn stemmer() -> &'static Stemmer {
    static S: OnceLock<Stemmer> = OnceLock::new();
    S.get_or_init(|| Stemmer::create(Algorithm::English))
}

/// Lowercase, fold typographic punctuation, drop thousands separators,
/// collapse whitespace.
pub fn fold(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let chars: Vec<char> = s.chars().collect();
    for (i, &c) in chars.iter().enumerate() {
        let c = match c {
            '\u{2018}' | '\u{2019}' | '\u{2032}' => '\'',
            '\u{201C}' | '\u{201D}' | '\u{2033}' => '"',
            '\u{2010}'..='\u{2015}' => '-',
            '\u{00A0}' => ' ',
            _ => c,
        };
        // 1,000 → 1000
        if c == ','
            && i > 0
            && chars[i - 1].is_ascii_digit()
            && chars.get(i + 1).is_some_and(|n| n.is_ascii_digit())
        {
            continue;
        }
        out.extend(c.to_lowercase());
    }
    normalize_ws(&out)
}

/// Collapse every run of whitespace to one space and trim. The only
/// normalization a quote check allows.
pub fn normalize_ws(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for word in s.split_whitespace() {
        if !out.is_empty() {
            out.push(' ');
        }
        out.push_str(word);
    }
    out
}

/// Words with no retrieval value. Negations are kept: they change meaning.
const STOPWORDS: &[&str] = &[
    "a", "about", "after", "all", "also", "am", "an", "and", "any", "are", "as", "at", "be",
    "because", "been", "before", "being", "but", "by", "can", "could", "did", "do", "does",
    "doing", "for", "from", "get", "got", "had", "has", "have", "having", "he", "her", "here",
    "him", "his", "how", "i", "if", "in", "into", "is", "it", "its", "just", "know", "like",
    "many", "me", "much", "my", "need", "of", "ok", "okay", "on", "or", "our", "out", "please",
    "really", "she", "should", "so", "some", "such", "tell", "than", "that", "the", "their",
    "them", "then", "there", "these", "they", "thing", "things", "this", "those", "to", "too",
    "us", "want", "was", "way", "we", "were", "what", "when", "where", "which", "while", "who",
    "whom", "why", "will", "with", "would", "you", "your",
];

pub fn is_stopword(w: &str) -> bool {
    STOPWORDS.binary_search(&w).is_ok()
}

fn number_word(w: &str) -> Option<u64> {
    Some(match w {
        "zero" => 0,
        "one" => 1,
        "two" => 2,
        "three" => 3,
        "four" => 4,
        "five" => 5,
        "six" => 6,
        "seven" => 7,
        "eight" => 8,
        "nine" => 9,
        "ten" => 10,
        "eleven" => 11,
        "twelve" => 12,
        "thirteen" => 13,
        "fourteen" => 14,
        "fifteen" => 15,
        "sixteen" => 16,
        "seventeen" => 17,
        "eighteen" => 18,
        "nineteen" => 19,
        "twenty" => 20,
        "thirty" => 30,
        "forty" => 40,
        "fifty" => 50,
        "sixty" => 60,
        "seventy" => 70,
        "eighty" => 80,
        "ninety" => 90,
        _ => return None,
    })
}

/// `(spellings, canonical, only after a number)`.
const UNITS: &[(&[&str], &str, bool)] = &[
    (&["ft", "feet", "foot"], "feet", false),
    (&["in", "inch", "inches"], "inches", true),
    (&["lb", "lbs", "pound", "pounds"], "pounds", false),
    (&["kg", "kgs", "kilogram", "kilograms"], "kilograms", false),
    (&["m", "meter", "meters", "metre", "metres"], "meters", true),
    (&["mm", "millimeter", "millimeters"], "millimeters", false),
    (&["kv", "kilovolt", "kilovolts"], "kv", false),
    (&["v", "volt", "volts"], "volts", true),
    (&["mph"], "mph", false),
    (&["percent", "pct"], "percent", false),
    (&["deg", "degree", "degrees"], "degrees", false),
    (&["ton", "tons", "tonne", "tonnes"], "tons", false),
    (&["hr", "hrs", "hour", "hours"], "hours", false),
    (&["min", "mins", "minute", "minutes"], "minutes", true),
];

/// True for a canonical unit spelling (`feet`, `kv`, …).
pub fn is_unit(w: &str) -> bool {
    UNITS.iter().any(|(_, canon, _)| *canon == w)
}

fn unit_for(w: &str, after_number: bool) -> Option<&'static str> {
    UNITS.iter().find_map(|(spellings, canon, needs_number)| {
        (spellings.contains(&w) && (after_number || !needs_number)).then_some(*canon)
    })
}

/// Split folded text into tokens: runs of alphanumerics, keeping a decimal
/// point between digits, and a trailing `'` / `"` after a number as feet /
/// inches; `%` and `°` as units.
fn raw_tokens(folded: &str) -> Vec<String> {
    let chars: Vec<char> = folded.chars().collect();
    let mut out = Vec::new();
    let mut cur = String::new();
    let flush = |cur: &mut String, out: &mut Vec<String>| {
        if !cur.is_empty() {
            out.push(std::mem::take(cur));
        }
    };
    for (i, &c) in chars.iter().enumerate() {
        let prev_digit = i > 0 && chars[i - 1].is_ascii_digit();
        let next_digit = chars.get(i + 1).is_some_and(|n| n.is_ascii_digit());
        if c.is_alphanumeric() {
            // 50ft → 50 ft; ft50 stays one token.
            if !cur.is_empty()
                && cur.chars().all(|x| x.is_ascii_digit() || x == '.')
                && !c.is_ascii_digit()
            {
                flush(&mut cur, &mut out);
            }
            cur.push(c);
        } else if c == '.' && prev_digit && next_digit && !cur.is_empty() {
            cur.push(c);
        } else {
            flush(&mut cur, &mut out);
            match c {
                '\'' if prev_digit => out.push("feet".into()),
                '"' if prev_digit => out.push("inches".into()),
                '%' => out.push("percent".into()),
                '°' => out.push("degrees".into()),
                _ => {}
            }
        }
    }
    flush(&mut cur, &mut out);
    out
}

fn is_number(t: &str) -> bool {
    !t.is_empty()
        && t.chars().next().is_some_and(|c| c.is_ascii_digit())
        && t.chars().all(|c| c.is_ascii_digit() || c == '.')
}

/// Tokens of `text` with number words as digits and units in one spelling.
pub fn tokens(text: &str) -> Vec<String> {
    let raw = raw_tokens(&fold(text));
    let mut out: Vec<String> = Vec::with_capacity(raw.len());
    let mut i = 0;
    while i < raw.len() {
        // Number words: "twenty five" → 25, "two hundred fifty" → 250.
        if number_word(&raw[i]).is_some() {
            let mut total: u64 = 0;
            let mut group: u64 = 0;
            let mut j = i;
            while j < raw.len() {
                let w = raw[j].as_str();
                if let Some(n) = number_word(w) {
                    group += n;
                } else if w == "hundred" && group > 0 {
                    group *= 100;
                } else if w == "thousand" && (group > 0 || total > 0) {
                    total += group.max(1) * 1000;
                    group = 0;
                } else {
                    break;
                }
                j += 1;
            }
            out.push((total + group).to_string());
            i = j;
            continue;
        }
        let after_number = out.last().is_some_and(|p| is_number(p));
        let t = &raw[i];
        out.push(unit_for(t, after_number).map_or_else(|| t.clone(), str::to_string));
        i += 1;
    }
    out
}

/// The stem of one token. Numbers stay as they are.
pub fn stem(token: &str) -> String {
    if is_number(token) {
        token.to_string()
    } else {
        stemmer().stem(token).into_owned()
    }
}

/// Stems of the content tokens of `text` (stopwords removed).
pub fn content_stems(text: &str) -> Vec<String> {
    tokens(text)
        .iter()
        .filter(|t| !is_stopword(t))
        .map(|t| stem(t))
        .collect()
}

/// A set of content stems, for coverage and overlap checks.
pub fn stem_set(text: &str) -> BTreeSet<String> {
    content_stems(text).into_iter().collect()
}

/// One concept of a query: a content stem, or any of the alternatives a pack
/// synonym offers for the phrase it is part of (an alternative is satisfied
/// when all of its stems are present).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Concept {
    pub stem: String,
    pub alts: Vec<Vec<String>>,
}

impl Concept {
    pub fn satisfied_by(&self, doc: &BTreeSet<String>) -> bool {
        doc.contains(&self.stem)
            || self
                .alts
                .iter()
                .any(|alt| !alt.is_empty() && alt.iter().all(|s| doc.contains(s)))
    }
}

/// A normalized query.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Normalized {
    /// Normalized tokens joined by spaces.
    pub text: String,
    pub tokens: Vec<String>,
    /// Content concepts (stopwords removed).
    pub concepts: Vec<Concept>,
    /// Number tokens, in order.
    pub numbers: Vec<String>,
    /// Canonical phrases added from pack synonyms and equipment names.
    pub expansions: Vec<String>,
    /// Equipment ids whose name or alias the query mentions.
    pub equip_mentions: Vec<String>,
}

/// Normalize a query against pack synonyms `(phrase, canonical)` (folded) and
/// equipment `(equip_id, name, aliases)`.
pub fn normalize_query(
    query: &str,
    synonyms: &[(String, String)],
    equipment: &[(String, String, Vec<String>)],
) -> Normalized {
    let toks = tokens(query);
    let joined = format!(" {} ", toks.join(" "));
    let mut concepts: Vec<Concept> = toks
        .iter()
        .filter(|t| !is_stopword(t))
        .map(|t| Concept {
            stem: stem(t),
            alts: Vec::new(),
        })
        .collect();
    concepts.dedup_by(|a, b| a.stem == b.stem);
    let mut expansions: Vec<String> = Vec::new();
    for (phrase, canonical) in synonyms {
        let phrase_toks = tokens(phrase);
        if phrase_toks.is_empty() || !joined.contains(&format!(" {} ", phrase_toks.join(" "))) {
            continue;
        }
        let canon_text = tokens(canonical).join(" ");
        if !expansions.contains(&canon_text) {
            expansions.push(canon_text.clone());
        }
        let alt = content_stems(&canon_text);
        for pt in phrase_toks.iter().filter(|t| !is_stopword(t)) {
            let s = stem(pt);
            if let Some(c) = concepts.iter_mut().find(|c| c.stem == s)
                && !c.alts.contains(&alt)
            {
                c.alts.push(alt.clone());
            }
        }
    }
    let mut equip_mentions = Vec::new();
    for (id, name, aliases) in equipment {
        for spelling in std::iter::once(name).chain(aliases.iter()) {
            let st = tokens(spelling);
            if !st.is_empty() && joined.contains(&format!(" {} ", st.join(" "))) {
                if !equip_mentions.contains(id) {
                    equip_mentions.push(id.clone());
                }
                let n = tokens(name).join(" ");
                if spelling != name && !expansions.contains(&n) {
                    expansions.push(n);
                }
                break;
            }
        }
    }
    Normalized {
        text: toks.join(" "),
        numbers: toks.iter().filter(|t| is_number(t)).cloned().collect(),
        tokens: toks,
        concepts,
        expansions,
        equip_mentions,
    }
}

/// An FTS5 MATCH expression: every distinct content token of `parts` OR'ed,
/// each quoted so no user text is FTS syntax. `None` when there is nothing to
/// match.
pub fn fts_query<'a>(parts: impl IntoIterator<Item = &'a str>) -> Option<String> {
    let mut seen = BTreeSet::new();
    let mut terms = Vec::new();
    let mut fallback = Vec::new();
    for part in parts {
        for t in tokens(part) {
            let clean: String = t.chars().filter(|c| *c != '"').collect();
            if clean.is_empty() || !seen.insert(clean.clone()) {
                continue;
            }
            if is_stopword(&clean) {
                fallback.push(format!("\"{clean}\""));
            } else {
                terms.push(format!("\"{clean}\""));
            }
        }
    }
    let chosen = if terms.is_empty() { fallback } else { terms };
    (!chosen.is_empty()).then(|| chosen.join(" OR "))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stopwords_are_sorted_for_binary_search() {
        let mut sorted = STOPWORDS.to_vec();
        sorted.sort();
        assert_eq!(sorted, STOPWORDS);
    }

    #[test]
    fn numbers_and_units() {
        assert_eq!(tokens("Twenty-five ft"), vec!["25", "feet"]);
        assert_eq!(
            tokens("10' from 1,000 lbs"),
            vec!["10", "feet", "from", "1000", "pounds"]
        );
        assert_eq!(tokens("two hundred fifty kV"), vec!["250", "kv"]);
        assert_eq!(
            tokens("50ft boom at 1.5 m"),
            vec!["50", "feet", "boom", "at", "1.5", "meters"]
        );
        assert_eq!(tokens("in the cab"), vec!["in", "the", "cab"]);
        assert_eq!(tokens("6 in"), vec!["6", "inches"]);
        assert_eq!(tokens("five thousand"), vec!["5000"]);
    }

    #[test]
    fn folding() {
        assert_eq!(fold("  Don\u{2019}t\n\tGo  "), "don't go");
        assert_eq!(normalize_ws(" a \n b\t"), "a b");
    }

    #[test]
    fn synonyms_expand_and_satisfy_concepts() {
        let syn = vec![("stick".to_string(), "boom".to_string())];
        let n = normalize_query("how long is the stick", &syn, &[]);
        assert_eq!(n.expansions, vec!["boom".to_string()]);
        let stick = n.concepts.iter().find(|c| c.stem == "stick").unwrap();
        assert!(stick.satisfied_by(&stem_set("the boom length")));
    }

    #[test]
    fn equipment_mentions() {
        let eq = vec![(
            "m-tracked".to_string(),
            "tracked machine".to_string(),
            vec!["crawler".to_string()],
        )];
        let n = normalize_query("on a crawler, what then?", &[], &eq);
        assert_eq!(n.equip_mentions, vec!["m-tracked".to_string()]);
        assert!(n.expansions.contains(&"tracked machine".to_string()));
    }

    #[test]
    fn fts_query_is_quoted_and_safe() {
        assert_eq!(
            fts_query(["what is \"the\" NEAR(x) clearance?"]).unwrap(),
            "\"near\" OR \"x\" OR \"clearance\""
        );
        assert_eq!(fts_query(["the"]).unwrap(), "\"the\"");
        assert!(fts_query(["?!"]).is_none());
    }
}
