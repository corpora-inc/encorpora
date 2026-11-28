//! Identify the exact variant from what is observed on the machine: a data
//! plate (model, serial), a firmware string, a parameter set, free text.
//! Rules come from `equip_ident`; the most specific variant whose rules the
//! observation meets wins, and a variant whose own rules the observation
//! contradicts is rejected.

use super::Pack;
use crate::error::Result;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// What the technician or the machine reports.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Plate {
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub serial: Option<String>,
    #[serde(default)]
    pub firmware: Option<String>,
    #[serde(default)]
    pub params: BTreeMap<String, String>,
    /// Free text (a data plate read aloud or by a camera).
    #[serde(default)]
    pub text: Option<String>,
}

/// One rule that matched.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct IdentMatch {
    pub kind: String,
    pub pattern: String,
    pub observed: String,
}

/// A variant the observation points at.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Candidate {
    pub equip_id: String,
    pub name: String,
    pub matched: Vec<IdentMatch>,
    /// Rules of this variant the observation contradicts (a rejected one).
    pub contradicted: Vec<IdentMatch>,
}

/// The outcome.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Resolved {
    /// The most specific variant, or the deepest common ancestor when the
    /// evidence points at more than one; `None` when nothing matched.
    pub equip_id: Option<String>,
    pub name: Option<String>,
    /// True when more than one unrelated variant fits.
    pub ambiguous: bool,
    /// Variants that fit, most specific first.
    pub candidates: Vec<Candidate>,
    /// Variants a rule matched but another of its rules contradicted.
    pub rejected: Vec<Candidate>,
    /// Attributes of `equip_id`, inherited from its ancestors.
    pub attrs: BTreeMap<String, String>,
}

fn fold(s: &str) -> String {
    super::branch::fold(s)
}

/// Model numbers compare without case, spaces or dashes.
fn model_key(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

/// `(prefix, trailing number)`.
fn split_serial(s: &str) -> (String, Option<u128>) {
    let s = fold(s);
    let digits = s.chars().rev().take_while(|c| c.is_ascii_digit()).count();
    let (p, n) = s.split_at(s.len() - digits);
    (p.to_string(), n.parse().ok())
}

fn serial_in(pattern: &str, serial: &str) -> bool {
    let Some((lo, hi)) = pattern.split_once("..") else {
        return fold(pattern) == fold(serial);
    };
    let (lp, ln) = split_serial(lo);
    let (hp, hn) = split_serial(hi);
    let (sp, sn) = split_serial(serial);
    match (ln, hn, sn) {
        (Some(l), Some(h), Some(n)) => lp == hp && sp == lp && l <= n && n <= h,
        _ => {
            let s = fold(serial);
            fold(lo) <= s && s <= fold(hi)
        }
    }
}

/// Does rule (`kind`, `pattern`) match the plate? `Some(observed)` with
/// the observed text when it does, `None` when the plate has nothing of
/// that kind, `Some(Err(observed))` when it has and the rule fails.
fn test(kind: &str, pattern: &str, plate: &Plate) -> Option<std::result::Result<String, String>> {
    let res = |ok: bool, obs: String| Some(if ok { Ok(obs) } else { Err(obs) });
    match kind {
        "model" => plate
            .model
            .as_ref()
            .and_then(|m| res(model_key(m) == model_key(pattern), m.clone())),
        "serial_range" => plate
            .serial
            .as_ref()
            .and_then(|s| res(serial_in(pattern, s), s.clone())),
        "firmware" => plate
            .firmware
            .as_ref()
            .and_then(|f| res(glob(&fold(pattern), &fold(f)), f.clone())),
        "param" => {
            let (k, v) = pattern.split_once('=')?;
            let got = plate
                .params
                .iter()
                .find(|(pk, _)| fold(pk) == fold(k))
                .map(|(_, pv)| pv)?;
            res(glob(&fold(v), &fold(got)), format!("{k}={got}"))
        }
        "text" => plate.text.as_ref().and_then(|t| {
            res(
                !pattern.trim().is_empty() && fold(t).contains(&fold(pattern)),
                t.clone(),
            )
        }),
        _ => None,
    }
}

fn glob(p: &str, s: &str) -> bool {
    super::search::pattern_matches(&format!("glob:{p}"), s)
        .ok()
        .flatten()
        .is_some()
}

/// Resolve `plate` to the most specific variant.
pub fn resolve(pack: &Pack, plate: &Plate) -> Result<Resolved> {
    let rules = pack.equip_idents()?;
    let mut by_equip: BTreeMap<String, Candidate> = BTreeMap::new();
    let name = |id: &str| {
        pack.equipment()
            .iter()
            .find(|e| e.equip_id == id)
            .map(|e| e.name.clone())
            .unwrap_or_else(|| id.to_string())
    };
    // Per variant and kind: did any of its own rules of that kind match?
    let mut kinds: BTreeMap<(String, String), (bool, Vec<IdentMatch>)> = BTreeMap::new();
    for r in &rules {
        let Some(t) = test(&r.kind, &r.pattern, plate) else {
            continue;
        };
        let entry = kinds
            .entry((r.equip_id.clone(), r.kind.clone()))
            .or_insert((false, Vec::new()));
        let c = by_equip
            .entry(r.equip_id.clone())
            .or_insert_with(|| Candidate {
                equip_id: r.equip_id.clone(),
                name: name(&r.equip_id),
                matched: Vec::new(),
                contradicted: Vec::new(),
            });
        match t {
            Ok(observed) => {
                entry.0 = true;
                c.matched.push(IdentMatch {
                    kind: r.kind.clone(),
                    pattern: r.pattern.clone(),
                    observed,
                });
            }
            Err(observed) => entry.1.push(IdentMatch {
                kind: r.kind.clone(),
                pattern: r.pattern.clone(),
                observed,
            }),
        }
    }
    for ((equip, _), (any, failed)) in kinds {
        if !any && let Some(c) = by_equip.get_mut(&equip) {
            c.contradicted.extend(failed);
        }
    }
    let (fit, mut rejected): (Vec<Candidate>, Vec<Candidate>) = by_equip
        .into_values()
        .filter(|c| !c.matched.is_empty() || !c.contradicted.is_empty())
        .partition(|c| c.contradicted.is_empty() && !c.matched.is_empty());
    rejected.retain(|c| !c.matched.is_empty());
    // A rejected variant also rules out its descendants that only inherit.
    let fit: Vec<Candidate> = fit
        .into_iter()
        .filter(|c| {
            !rejected
                .iter()
                .any(|r| r.equip_id != c.equip_id && pack.equip_is_within(&c.equip_id, &r.equip_id))
        })
        .collect();
    // Keep the most specific: drop a candidate that is an ancestor of another.
    let mut most: Vec<Candidate> = fit
        .iter()
        .filter(|c| {
            !fit.iter()
                .any(|o| o.equip_id != c.equip_id && pack.equip_is_within(&o.equip_id, &c.equip_id))
        })
        .cloned()
        .collect();
    most.sort_by(|a, b| {
        pack.equip_lineage(&b.equip_id)
            .len()
            .cmp(&pack.equip_lineage(&a.equip_id).len())
            .then_with(|| b.matched.len().cmp(&a.matched.len()))
            .then_with(|| a.equip_id.cmp(&b.equip_id))
    });
    let (equip_id, ambiguous) = match most.as_slice() {
        [] => (None, false),
        [one] => (Some(one.equip_id.clone()), false),
        many => {
            // The deepest ancestor every candidate shares.
            let first = pack.equip_lineage(&many[0].equip_id);
            let common = first
                .into_iter()
                .find(|a| many.iter().all(|c| pack.equip_is_within(&c.equip_id, a)));
            (common, true)
        }
    };
    let attrs = match &equip_id {
        Some(e) => pack.equip_attrs(e)?,
        None => BTreeMap::new(),
    };
    Ok(Resolved {
        name: equip_id.as_deref().map(name),
        equip_id,
        ambiguous,
        candidates: most,
        rejected,
        attrs,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serials() {
        assert!(serial_in("P40D-1000..P40D-4999", "p40d-2310"));
        assert!(!serial_in("P40D-1000..P40D-4999", "P40D-5000"));
        assert!(!serial_in("P40D-1000..P40D-4999", "P40E-2310"));
        assert!(serial_in("P40D-1000", "P40D-1000"));
    }
}
