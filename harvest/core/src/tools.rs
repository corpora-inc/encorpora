//! Deterministic tools over the pack's own tables.
//!
//! A *range table* is a table section whose rows map a numeric band of one
//! quantity to a value: a header line `Quantity (…, unit, …) | Result (unit)`
//! and rows such as `up to 50 | 10`, `over 50 to 200 | 15`, `over 1,000 | …`
//! ("over" excludes its number, "to" and "up to" include theirs). When a
//! question states a number in the table's unit, the row is looked up, not
//! guessed: the answer states the value and quotes the header and the row
//! verbatim (and the table's note, when the number sits on a band's edge).

use crate::normalize;
use crate::pack::Section;
use crate::segments::Segment;

/// One band of a range table.
#[derive(Debug, Clone, PartialEq)]
pub struct Band {
    /// Exclusive lower bound (`over x`), if any.
    pub over: Option<f64>,
    /// Inclusive upper bound (`to y`, `up to y`), if any.
    pub to: Option<f64>,
    /// The result cell, verbatim.
    pub value: String,
    /// The whole row line, verbatim.
    pub line: String,
}

impl Band {
    pub fn contains(&self, x: f64) -> bool {
        self.over.is_none_or(|o| x > o) && self.to.is_none_or(|t| x <= t)
    }
}

/// A parsed range table.
#[derive(Debug, Clone, PartialEq)]
pub struct RangeTable {
    pub section_id: String,
    /// The header line, verbatim.
    pub header: String,
    /// The canonical unit of the banded quantity (`kv`, `feet`, …).
    pub unit: String,
    /// The result's unit word from the header (`feet`), if stated.
    pub result_unit: Option<String>,
    pub bands: Vec<Band>,
    /// A line starting with `Note`, verbatim.
    pub note: Option<String>,
}

fn number(s: &str) -> Option<f64> {
    let t = s.trim().trim_end_matches(['.', ',']).replace(',', "");
    let t = if t.starts_with('.') {
        format!("0{t}")
    } else {
        t
    };
    t.parse::<f64>().ok()
}

/// Parse `up to x`, `over x to y`, `over x`.
fn band(cell: &str) -> Option<(Option<f64>, Option<f64>)> {
    let c = cell.trim().to_ascii_lowercase();
    if let Some(rest) = c.strip_prefix("up to ") {
        return Some((None, Some(number(rest)?)));
    }
    let rest = c.strip_prefix("over ")?;
    match rest.split_once(" to ") {
        Some((a, b)) => Some((Some(number(a)?), Some(number(b)?))),
        None => Some((Some(number(rest)?), None)),
    }
}

/// The first canonical unit among the words of `cell`.
fn unit_of(cell: &str) -> Option<String> {
    normalize::tokens(cell)
        .into_iter()
        .find(|t| normalize::is_unit(t))
}

impl RangeTable {
    /// Parse a table section, or `None` when it is not a range table.
    pub fn parse(section: &Section) -> Option<Self> {
        let lines: Vec<&str> = section.text.lines().map(str::trim).collect();
        let mut header = None;
        let mut bands = Vec::new();
        let mut note = None;
        for line in &lines {
            if line.to_ascii_lowercase().starts_with("note") {
                note = Some(line.to_string());
                continue;
            }
            let Some((a, b)) = line.split_once(" | ") else {
                continue;
            };
            match band(a) {
                Some((over, to)) if header.is_some() => bands.push(Band {
                    over,
                    to,
                    value: b.trim().to_string(),
                    line: line.to_string(),
                }),
                Some(_) => return None, // rows before a header: not a table we read
                None if header.is_none() && bands.is_empty() => header = Some((*line, a, b)),
                None => {}
            }
        }
        let (header, x, y) = header?;
        if bands.len() < 2 {
            return None;
        }
        Some(Self {
            section_id: section.section_id.clone(),
            header: header.to_string(),
            unit: unit_of(x)?,
            result_unit: unit_of(y),
            bands,
            note,
        })
    }

    /// The numbers the question states in this table's unit.
    pub fn values_in(&self, question: &str) -> Vec<f64> {
        let toks = normalize::tokens(question);
        toks.windows(2)
            .filter(|w| w[1] == self.unit)
            .filter_map(|w| number(&w[0]))
            .collect()
    }

    /// The answer for `x`: a lead stating the band's value, the header and
    /// row quoted, the note when `x` is a band's bound, and the cite.
    pub fn answer(&self, x: f64, caption: &str) -> Option<Vec<Segment>> {
        let b = self.bands.iter().find(|b| b.contains(x))?;
        let shown = if x.fract() == 0.0 {
            format!("{x:.0}")
        } else {
            format!("{x}")
        };
        let unit = match self.unit.as_str() {
            "kv" => "kV".to_string(),
            u => u.to_string(),
        };
        let value = match (&self.result_unit, number(&b.value)) {
            (Some(u), Some(_)) => format!("{} {u}", b.value),
            _ => b.value.clone(),
        };
        let mut out = vec![
            Segment::text(format!("For {shown} {unit}, {caption}: {value}.")),
            Segment::quote(&self.section_id, &self.header),
            Segment::quote(&self.section_id, &b.line),
        ];
        let on_edge = b.to == Some(x) || b.over == Some(x);
        if let (true, Some(n)) = (on_edge, &self.note) {
            out.push(Segment::quote(&self.section_id, n));
        }
        out.push(Segment::cite(&self.section_id));
        Some(out)
    }
}
