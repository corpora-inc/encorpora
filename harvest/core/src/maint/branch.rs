//! Deterministic branching: how a result is recorded at a node, and which
//! edge it takes. The next node is always chosen here, from the recorded
//! result, never by a model.

use super::{FaultEdge, FaultNode};
use crate::error::{Error, Result};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// How a result is recorded at a node (`fault_node.expect`).
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Expect {
    /// Outcome `yes` or `no`; edges labelled Yes and No.
    YesNo,
    /// Outcome `pass` or `fail`; edges labelled Pass and Fail.
    PassFail,
    /// Outcome is one of `options`; one edge labelled with each.
    Choice { options: Vec<String> },
    /// A measured value in `unit`; edges carry numeric conditions that
    /// partition `[min, max]` (the whole line when absent). `labels` are
    /// readings the manual names instead of a number ("NO INDICATION"):
    /// each has one plain branch with that label, chosen by its outcome.
    Value {
        unit: String,
        #[serde(default)]
        min: Option<f64>,
        #[serde(default)]
        max: Option<f64>,
        #[serde(default, skip_serializing_if = "Vec::is_empty")]
        labels: Vec<String>,
    },
    /// Outcome `done`; one edge.
    Ack,
}

impl Expect {
    /// The categorical outcomes this expects (for `value`, its labels).
    pub fn outcomes(&self) -> Vec<String> {
        match self {
            Self::YesNo => vec!["yes".into(), "no".into()],
            Self::PassFail => vec!["pass".into(), "fail".into()],
            Self::Choice { options } => options.iter().map(|o| fold(o)).collect(),
            Self::Value { labels, .. } => labels.iter().map(|o| fold(o)).collect(),
            Self::Ack => vec!["done".into()],
        }
    }
}

/// A numeric comparison operator.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
pub enum CondOp {
    #[serde(rename = "<")]
    Lt,
    #[serde(rename = "<=")]
    Le,
    #[serde(rename = ">")]
    Gt,
    #[serde(rename = ">=")]
    Ge,
    #[serde(rename = "==")]
    Eq,
    /// `min <= v < max` by default; `min_inclusive` / `max_inclusive`
    /// say otherwise (a printed "0.6 TO 1.2" is both inclusive).
    #[serde(rename = "between")]
    Between,
}

/// A numeric predicate over a measured value (`fault_edge.cond`):
/// `{"op":"<","value":11.5}` or `{"op":"between","min":11.5,"max":13}`.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Cond {
    pub op: CondOp,
    #[serde(default)]
    pub value: Option<f64>,
    #[serde(default)]
    pub min: Option<f64>,
    #[serde(default)]
    pub max: Option<f64>,
    /// `between` only: is `min` in the range (default true)?
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_inclusive: Option<bool>,
    /// `between` only: is `max` in the range (default false)?
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_inclusive: Option<bool>,
}

/// A half-open or closed interval; infinite ends are open.
#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct Interval {
    pub lo: f64,
    pub lo_inc: bool,
    pub hi: f64,
    pub hi_inc: bool,
}

impl Interval {
    pub fn contains(&self, v: f64) -> bool {
        let above = if self.lo_inc {
            v >= self.lo
        } else {
            v > self.lo
        };
        let below = if self.hi_inc {
            v <= self.hi
        } else {
            v < self.hi
        };
        above && below
    }
    fn empty(&self) -> bool {
        self.lo > self.hi || (self.lo == self.hi && !(self.lo_inc && self.hi_inc))
    }
}

impl Cond {
    pub(crate) fn interval(&self) -> std::result::Result<Interval, String> {
        let need = |v: Option<f64>, what: &str| {
            v.filter(|x| x.is_finite())
                .ok_or_else(|| format!("{:?} needs a finite {what}", self.op))
        };
        let inf = f64::INFINITY;
        if self.op != CondOp::Between
            && (self.min_inclusive.is_some() || self.max_inclusive.is_some())
        {
            return Err(format!(
                "{:?}: min_inclusive and max_inclusive belong to between",
                self.op
            ));
        }
        Ok(match self.op {
            CondOp::Lt => Interval {
                lo: -inf,
                lo_inc: false,
                hi: need(self.value, "value")?,
                hi_inc: false,
            },
            CondOp::Le => Interval {
                lo: -inf,
                lo_inc: false,
                hi: need(self.value, "value")?,
                hi_inc: true,
            },
            CondOp::Gt => Interval {
                lo: need(self.value, "value")?,
                lo_inc: false,
                hi: inf,
                hi_inc: false,
            },
            CondOp::Ge => Interval {
                lo: need(self.value, "value")?,
                lo_inc: true,
                hi: inf,
                hi_inc: false,
            },
            CondOp::Eq => {
                let v = need(self.value, "value")?;
                Interval {
                    lo: v,
                    lo_inc: true,
                    hi: v,
                    hi_inc: true,
                }
            }
            CondOp::Between => {
                let (lo, hi) = (need(self.min, "min")?, need(self.max, "max")?);
                if lo >= hi {
                    return Err(format!("between needs min < max, got {lo} and {hi}"));
                }
                Interval {
                    lo,
                    lo_inc: self.min_inclusive.unwrap_or(true),
                    hi,
                    hi_inc: self.max_inclusive.unwrap_or(false),
                }
            }
        })
    }
}

/// The domain a value node accepts.
pub(crate) fn domain(min: Option<f64>, max: Option<f64>) -> Interval {
    Interval {
        lo: min.unwrap_or(f64::NEG_INFINITY),
        lo_inc: min.is_some(),
        hi: max.unwrap_or(f64::INFINITY),
        hi_inc: max.is_some(),
    }
}

/// Clip `i` to `d`; `None` when nothing of it is left.
fn clip(i: Interval, d: Interval) -> Option<Interval> {
    let (lo, lo_inc) = if i.lo > d.lo || (i.lo == d.lo && !i.lo_inc) {
        (i.lo, i.lo_inc)
    } else {
        (d.lo, d.lo_inc)
    };
    let (hi, hi_inc) = if i.hi < d.hi || (i.hi == d.hi && !i.hi_inc) {
        (i.hi, i.hi_inc)
    } else {
        (d.hi, d.hi_inc)
    };
    let out = Interval {
        lo,
        lo_inc: lo_inc && lo.is_finite(),
        hi,
        hi_inc: hi_inc && hi.is_finite(),
    };
    (!out.empty()).then_some(out)
}

/// Check that `conds` partition the domain: every value in it is taken by
/// exactly one condition. Returns each problem found.
pub(crate) fn partition_problems(conds: &[(String, Interval)], dom: Interval) -> Vec<String> {
    let mut problems = Vec::new();
    let mut parts: Vec<(String, Interval)> = Vec::new();
    for (label, i) in conds {
        match clip(*i, dom) {
            Some(c) => parts.push((label.clone(), c)),
            None => problems.push(format!("edge {label:?} lies outside the accepted range")),
        }
    }
    parts.sort_by(|a, b| {
        a.1.lo
            .total_cmp(&b.1.lo)
            .then_with(|| b.1.lo_inc.cmp(&a.1.lo_inc))
    });
    // `need`: the next point to cover, and whether that point itself is
    // still uncovered.
    let mut need = (dom.lo, dom.lo_inc);
    for (label, p) in &parts {
        let start_ok = p.lo == need.0 && (p.lo_inc == need.1 || !p.lo.is_finite());
        if !start_ok {
            let before = p.lo < need.0 || (p.lo == need.0 && p.lo_inc && !need.1);
            if before {
                problems.push(format!("edge {label:?} overlaps the edge before it"));
            } else {
                problems.push(format!(
                    "no edge takes values from {}{} up to edge {label:?}",
                    if need.1 { "" } else { "just above " },
                    need.0
                ));
            }
        }
        // Move the cursor only forward: past `hi`, or onto it still open.
        let next = (p.hi, !p.hi_inc);
        if next.0 > need.0 || (next.0 == need.0 && need.1 && !next.1) {
            need = next;
        }
    }
    let end_ok = need.0 == dom.hi && (need.1 == !dom.hi_inc || !dom.hi.is_finite());
    if !end_ok && !parts.is_empty() {
        problems.push(format!("no edge takes values above {}", need.0));
    }
    if parts.is_empty() {
        problems.push("no edge takes any value".into());
    }
    problems
}

/// What the technician recorded at a node.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct RecordedResult {
    /// `yes` | `no` | `pass` | `fail` | a choice option | `done`.
    #[serde(default)]
    pub outcome: Option<String>,
    /// A measured value (for `value` nodes).
    #[serde(default)]
    pub value: Option<f64>,
    #[serde(default)]
    pub unit: Option<String>,
}

/// Case-folded, trimmed, inner whitespace collapsed.
pub(crate) fn fold(s: &str) -> String {
    s.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

/// Validate `result` against `node.expect` and choose the one edge it
/// takes. A node with no edges records nothing (the path ends there).
pub fn choose<'a>(
    node: &FaultNode,
    edges: &[&'a FaultEdge],
    result: &RecordedResult,
) -> Result<&'a FaultEdge> {
    let Some(expect) = &node.expect else {
        return Err(Error::Invalid(format!(
            "node {} records no result; the path ends here",
            node.node_id
        )));
    };
    if edges.is_empty() {
        return Err(Error::Invalid(format!(
            "node {} has no branches; the path ends here",
            node.node_id
        )));
    }
    let taken: Vec<&FaultEdge> = match expect {
        Expect::Value { unit, labels, .. } if result.outcome.is_some() => {
            // A named reading instead of a number.
            if result.value.is_some() || result.unit.is_some() {
                return Err(Error::Invalid(format!(
                    "node {}: give a value in {unit} or a named reading, not both",
                    node.node_id
                )));
            }
            let outcome = result.outcome.as_deref().map(fold).unwrap_or_default();
            if !labels.iter().any(|l| fold(l) == outcome) {
                return Err(Error::Invalid(format!(
                    "node {} expects a measured value in {unit}{}; got {:?}",
                    node.node_id,
                    if labels.is_empty() {
                        String::new()
                    } else {
                        format!(" or one of: {}", labels.join(", "))
                    },
                    result.outcome
                )));
            }
            edges
                .iter()
                .filter(|e| e.cond.is_none() && fold(&e.label) == outcome)
                .copied()
                .collect()
        }
        Expect::Value { unit, min, max, .. } => {
            let v = result.value.filter(|v| v.is_finite()).ok_or_else(|| {
                Error::Invalid(format!(
                    "node {} expects a measured value in {unit}",
                    node.node_id
                ))
            })?;
            match result.unit.as_deref() {
                Some(u) if fold(u) == fold(unit) => {}
                other => {
                    return Err(Error::Invalid(format!(
                        "node {} expects the value in {unit}, got {other:?} (no conversion is made)",
                        node.node_id
                    )));
                }
            }
            if !domain(*min, *max).contains(v) {
                return Err(Error::Invalid(format!(
                    "{v} {unit} is outside the range node {} accepts ({:?} to {:?})",
                    node.node_id, min, max
                )));
            }
            let mut out = Vec::new();
            for e in edges {
                // Labelled readings are chosen by outcome, never by a number.
                let Some(c) = e.cond.as_ref() else { continue };
                let i = c
                    .interval()
                    .map_err(|m| Error::Pack(format!("edge {}#{}: {m}", e.from_node, e.ord)))?;
                if i.contains(v) {
                    out.push(*e);
                }
            }
            out
        }
        _ => {
            if result.value.is_some() || result.unit.is_some() {
                return Err(Error::Invalid(format!(
                    "node {} expects an outcome ({}), not a value",
                    node.node_id,
                    expect.outcomes().join(", ")
                )));
            }
            let outcome = result.outcome.as_deref().map(fold).unwrap_or_default();
            if !expect.outcomes().contains(&outcome) {
                return Err(Error::Invalid(format!(
                    "node {} expects one of: {}; got {:?}",
                    node.node_id,
                    expect.outcomes().join(", "),
                    result.outcome
                )));
            }
            match expect {
                Expect::Ack => edges.to_vec(),
                _ => edges
                    .iter()
                    .filter(|e| e.cond.is_none() && fold(&e.label) == outcome)
                    .copied()
                    .collect(),
            }
        }
    };
    match taken.as_slice() {
        [one] => Ok(one),
        [] => Err(Error::Pack(format!(
            "node {}: no branch takes this result (the tree fails validation)",
            node.node_id
        ))),
        _ => Err(Error::Pack(format!(
            "node {}: more than one branch takes this result (the tree fails validation)",
            node.node_id
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn iv(op: CondOp, value: Option<f64>, min: Option<f64>, max: Option<f64>) -> Interval {
        Cond {
            op,
            value,
            min,
            max,
            min_inclusive: None,
            max_inclusive: None,
        }
        .interval()
        .unwrap()
    }

    fn meter_all() -> Interval {
        domain(Some(0.0), None)
    }

    #[test]
    fn partitions() {
        let lt = iv(CondOp::Lt, Some(11.5), None, None);
        let ge = iv(CondOp::Ge, Some(11.5), None, None);
        let le = iv(CondOp::Le, Some(11.5), None, None);
        let gt13 = iv(CondOp::Gt, Some(13.0), None, None);
        let mid = iv(CondOp::Between, None, Some(11.5), Some(13.0));
        let ge13 = iv(CondOp::Ge, Some(13.0), None, None);
        let all = domain(None, None);
        let l = |s: &str, i| (s.to_string(), i);
        assert!(partition_problems(&[l("a", lt), l("b", ge)], all).is_empty());
        // Overlap at 11.5.
        assert!(!partition_problems(&[l("a", le), l("b", ge)], all).is_empty());
        // Gap at exactly 11.5.
        assert!(!partition_problems(&[l("a", lt), l("b", gt13)], all).is_empty());
        assert!(partition_problems(&[l("a", lt), l("m", mid), l("c", ge13)], all).is_empty());
        // An overlap is reported once, not followed by a false gap.
        let wide = iv(CondOp::Between, None, Some(0.0), Some(100.0));
        let inner = iv(CondOp::Between, None, Some(10.0), Some(20.0));
        let top = iv(CondOp::Ge, Some(100.0), None, None);
        let p = partition_problems(&[l("w", wide), l("i", inner), l("t", top)], meter_all());
        assert_eq!(p.len(), 1, "{p:?}");
        assert!(p[0].contains("overlaps"));
        // Gap at 13 (between is half-open).
        assert!(!partition_problems(&[l("a", lt), l("m", mid), l("c", gt13)], all).is_empty());
        // A bounded domain needs only cover itself.
        let meter = domain(Some(0.0), Some(30.0));
        assert!(partition_problems(&[l("a", lt), l("b", ge)], meter).is_empty());
        assert!(!partition_problems(&[l("a", lt)], meter).is_empty());
    }

    fn between(min: f64, max: f64, min_inc: bool, max_inc: bool) -> Interval {
        Cond {
            op: CondOp::Between,
            value: None,
            min: Some(min),
            max: Some(max),
            min_inclusive: Some(min_inc),
            max_inclusive: Some(max_inc),
        }
        .interval()
        .unwrap()
    }

    #[test]
    fn closed_ranges_meet_open_neighbours() {
        let l = |s: &str, i| (s.to_string(), i);
        let all = domain(None, None);
        // "LESS THAN 0.6", "0.6 TO 1.2", "MORE THAN 1.2".
        let less = iv(CondOp::Lt, Some(0.6), None, None);
        let to = between(0.6, 1.2, true, true);
        let more = iv(CondOp::Gt, Some(1.2), None, None);
        assert!(partition_problems(&[l("lt", less), l("to", to), l("gt", more)], all).is_empty());
        assert!(to.contains(0.6) && to.contains(1.2) && !more.contains(1.2));
        // "MORE THAN OR EQUAL TO 1.2" beside a closed range: overlap at 1.2.
        let ge = iv(CondOp::Ge, Some(1.2), None, None);
        let p = partition_problems(&[l("lt", less), l("to", to), l("ge", ge)], all);
        assert!(p.len() == 1 && p[0].contains("overlaps"), "{p:?}");
        // An open range between open neighbours leaves 0.6 and 1.2 uncovered.
        let open = between(0.6, 1.2, false, false);
        let p = partition_problems(&[l("lt", less), l("o", open), l("gt", more)], all);
        assert_eq!(p.len(), 2, "{p:?}");
        // Bounds flags belong to between only.
        assert!(
            Cond {
                op: CondOp::Lt,
                value: Some(1.0),
                min: None,
                max: None,
                min_inclusive: Some(true),
                max_inclusive: None
            }
            .interval()
            .is_err()
        );
    }
}
