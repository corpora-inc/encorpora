//! A two-part code read off a display and typed by hand: a main code and a
//! sub code (`E21-3`, `21.3`, `21 / 03`, `e21 3`). Normalized to the
//! uppercase letter prefix, the main number and the sub number without
//! leading zeros, joined by `-` (`E21-3`); a code with no sub stays
//! one part (`E21`).

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// A parsed display code.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
pub struct DisplayCode {
    /// Letters before the main number (`E`), uppercase; may be empty.
    pub prefix: String,
    pub main: u32,
    pub sub: Option<u32>,
}

impl DisplayCode {
    pub fn normalized(&self) -> String {
        match self.sub {
            Some(s) => format!("{}{}-{s}", self.prefix, self.main),
            None => format!("{}{}", self.prefix, self.main),
        }
    }
}

/// Parse what was typed.
pub fn parse(input: &str) -> Result<DisplayCode, String> {
    let t = input.trim();
    if t.is_empty() {
        return Err("no code".into());
    }
    let prefix: String = t.chars().take_while(|c| c.is_ascii_alphabetic()).collect();
    if prefix.len() > 4 {
        return Err(format!(
            "{input:?}: a code starts with at most four letters"
        ));
    }
    let rest = &t[prefix.len()..];
    let mut nums = rest
        .split(|c: char| c == '-' || c == '.' || c == '/' || c == ':' || c.is_whitespace())
        .filter(|p| !p.is_empty());
    let num = |p: Option<&str>| -> Result<Option<u32>, String> {
        match p {
            None => Ok(None),
            Some(p) if p.chars().all(|c| c.is_ascii_digit()) && p.len() <= 6 => {
                Ok(Some(p.parse().expect("digits")))
            }
            Some(p) => Err(format!("{input:?}: {p:?} is not a number")),
        }
    };
    let main = num(nums.next())?.ok_or_else(|| format!("{input:?}: no main code number"))?;
    let sub = num(nums.next())?;
    if nums.next().is_some() {
        return Err(format!("{input:?}: a display code has at most two parts"));
    }
    Ok(DisplayCode {
        prefix: prefix.to_ascii_uppercase(),
        main,
        sub,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn forms() {
        for (typed, want) in [
            ("E21-3", "E21-3"),
            ("e21 3", "E21-3"),
            ("21.03", "21-3"),
            (" 21 / 3 ", "21-3"),
            ("E21", "E21"),
            ("E021-003", "E21-3"),
        ] {
            assert_eq!(parse(typed).unwrap().normalized(), want, "{typed}");
        }
        for bad in ["", "E", "E21-3-4", "21-x", "ABCDE1"] {
            assert!(parse(bad).is_err(), "{bad}");
        }
    }
}
