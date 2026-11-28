//! Sentence splitting as the evaluation measured it (`text.sentences`,
//! `text.norm_sentence`).

/// Sentences of a manual text. Whitespace is collapsed first (PDF text
/// breaks mid-sentence); a split falls after `.`, `!`, `?` or `:` and
/// whitespace, before an uppercase letter, a digit, `(`, a quote or `“`; a
/// list marker at a sentence's start is removed; a piece shorter than four
/// characters or without a letter is dropped.
pub fn sentences(text: &str) -> Vec<String> {
    let flat = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let chars: Vec<char> = flat.chars().collect();
    let mut pieces: Vec<String> = Vec::new();
    let mut start = 0;
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == ' ' && i > 0 && ".!?:".contains(chars[i - 1]) {
            // `flat` has single spaces; the next char decides.
            if let Some(&n) = chars.get(i + 1)
                && (n.is_ascii_uppercase() || n.is_ascii_digit() || "(\"'“".contains(n))
            {
                pieces.push(chars[start..i].iter().collect());
                start = i + 1;
            }
        }
        i += 1;
    }
    pieces.push(chars[start..].iter().collect());
    pieces
        .into_iter()
        .map(|s| strip_list_mark(s.trim()).to_string())
        .filter(|s| s.chars().count() >= 4 && s.chars().any(|c| c.is_ascii_alphabetic()))
        .collect()
}

/// `^(?:\(?\d{1,2}[.)]|\(?[a-z][.)]|[-*•])\s+`
fn strip_list_mark(s: &str) -> &str {
    let b: Vec<char> = s.chars().collect();
    let mut i = 0;
    let marker_end = if !b.is_empty() && "-*•".contains(b[0]) {
        Some(1)
    } else {
        if b.first() == Some(&'(') {
            i = 1;
        }
        let digits = b[i..].iter().take_while(|c| c.is_ascii_digit()).count();
        if (1..=2).contains(&digits) && b.get(i + digits).is_some_and(|c| *c == '.' || *c == ')') {
            Some(i + digits + 1)
        } else if b.get(i).is_some_and(|c| c.is_ascii_lowercase())
            && b.get(i + 1).is_some_and(|c| *c == '.' || *c == ')')
        {
            Some(i + 2)
        } else {
            None
        }
    };
    let Some(end) = marker_end else {
        return s;
    };
    let ws = b[end..].iter().take_while(|c| c.is_whitespace()).count();
    if ws == 0 {
        return s;
    }
    let byte: usize = b[..end + ws].iter().map(|c| c.len_utf8()).sum();
    &s[byte..]
}

/// Lowercase letters and digits, one space between runs.
pub fn norm_sentence(s: &str) -> String {
    let mut out: Vec<String> = Vec::new();
    let mut cur = String::new();
    for c in s.to_lowercase().chars() {
        if c.is_ascii_lowercase() || c.is_ascii_digit() {
            cur.push(c);
        } else if !cur.is_empty() {
            out.push(std::mem::take(&mut cur));
        }
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out.join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_like_the_harness() {
        assert_eq!(
            sentences(
                "Stop the pump.  Remove the key.\nCheck: 12 V or more. a) open the cover. e.g. this"
            ),
            vec![
                "Stop the pump.",
                "Remove the key.",
                "Check:",
                "12 V or more. a) open the cover. e.g. this"
            ]
        );
        assert_eq!(
            sentences("1. Set the meter. 2. Read it."),
            vec!["Set the meter.", "Read it."]
        );
        assert_eq!(sentences("(a) Loosen the nut."), vec!["Loosen the nut."]);
        assert!(sentences("1. ").is_empty());
        assert_eq!(norm_sentence("Stop: the PUMP, now!"), "stop the pump now");
    }
}
