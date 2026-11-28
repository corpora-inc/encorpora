//! Applicability as conditions over attributes (CONTRACT "Applicability").
//!
//! A pack declares its attributes (`pack_meta.attributes`) and scopes any
//! item with statements in `applic`: the printed text ("POST SB 24-012",
//! "firmware 2.4 and later") and a small boolean condition over attribute
//! tests. An asset carries attribute values. Evaluation has three
//! outcomes: applies, does not apply, and unknown (the asset lacks an
//! attribute the condition needs). An unknown item is never hidden and never
//! shown as plain content: views flag it with the printed statement and the
//! attributes to ask for.
//!
//! The shape is S1000D's: an attribute is an ACT property (product
//! attribute) or a PCT/CCT condition (modification state, service bulletin);
//! a test is an `<assert>`; `all`/`any`/`not` are `<evaluate andOr>` and
//! negation.

use crate::error::{Error, Result};
use crate::pack::Pack;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

/// How an attribute's values compare.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AttrType {
    /// Case and spacing folded equality, set membership.
    Text,
    Number,
    /// Dotted, numerically by part (`2.10` after `2.9`).
    Version,
    /// A prefix and digits (`P40D-1234`): ranges apply within one prefix.
    Serial,
}

/// Where an attribute's value comes from.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AttrSource {
    /// The data plate (resolved by `equip_ident`).
    Plate,
    /// Read from the vehicle (a decoder: firmware, board).
    Vehicle,
    /// Typed in by the technician (a modification state).
    Manual,
}

/// A declared attribute (`pack_meta.attributes`).
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct AttrDef {
    pub id: String,
    /// As the manual prints it.
    pub label: String,
    #[serde(rename = "type")]
    pub kind: AttrType,
    pub source: AttrSource,
}

/// A test on one attribute.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AttrOp {
    Eq,
    Ne,
    In,
    NotIn,
    Lt,
    Le,
    Gt,
    Ge,
    Range,
}

/// `{"attr","op","value"|"values"|"min"/"max"}`.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct AttrTest {
    pub attr: String,
    pub op: AttrOp,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schemars(with = "Option<serde_json::Value>")]
    pub value: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schemars(with = "Option<Vec<serde_json::Value>>")]
    pub values: Option<Vec<serde_json::Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schemars(with = "Option<serde_json::Value>")]
    pub min: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schemars(with = "Option<serde_json::Value>")]
    pub max: Option<serde_json::Value>,
    /// `range`: is `min` in it (default true)?
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_inclusive: Option<bool>,
    /// `range`: is `max` in it (default true)?
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_inclusive: Option<bool>,
}

/// A condition: `{"all":[…]}`, `{"any":[…]}`, `{"not":…}` or a test.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(untagged)]
pub enum ApplicCond {
    All { all: Vec<ApplicCond> },
    Any { any: Vec<ApplicCond> },
    Not { not: Box<ApplicCond> },
    Test(AttrTest),
}

/// The three outcomes.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Tri {
    Applies,
    DoesNotApply,
    Unknown,
}

impl Tri {
    fn and(self, o: Tri) -> Tri {
        match (self, o) {
            (Tri::DoesNotApply, _) | (_, Tri::DoesNotApply) => Tri::DoesNotApply,
            (Tri::Unknown, _) | (_, Tri::Unknown) => Tri::Unknown,
            _ => Tri::Applies,
        }
    }
    fn or(self, o: Tri) -> Tri {
        match (self, o) {
            (Tri::Applies, _) | (_, Tri::Applies) => Tri::Applies,
            (Tri::Unknown, _) | (_, Tri::Unknown) => Tri::Unknown,
            _ => Tri::DoesNotApply,
        }
    }
    fn not(self) -> Tri {
        match self {
            Tri::Applies => Tri::DoesNotApply,
            Tri::DoesNotApply => Tri::Applies,
            Tri::Unknown => Tri::Unknown,
        }
    }
}

/// An asset's attribute values (`attr id → value as text`).
pub type AttrValues = BTreeMap<String, String>;

/// One printed statement and how it evaluated.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Statement {
    /// Verbatim, as printed.
    pub text: String,
    pub section_id: String,
    pub status: Tri,
}

/// How an item's applicability came out (present only when it has
/// statements).
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Applicability {
    pub status: Tri,
    pub statements: Vec<Statement>,
    /// Attributes the asset lacks (ask for these, then read again).
    pub missing: Vec<String>,
    /// For `unknown`: "applicability not determined: <statements>".
    pub message: Option<String>,
}

impl Applicability {
    /// Combine two (both must apply).
    pub fn and(a: Option<Applicability>, b: Option<Applicability>) -> Option<Applicability> {
        match (a, b) {
            (None, x) | (x, None) => x,
            (Some(mut a), Some(b)) => {
                a.status = a.status.and(b.status);
                a.statements.extend(b.statements);
                let mut m: BTreeSet<String> = a.missing.into_iter().collect();
                m.extend(b.missing);
                a.missing = m.into_iter().collect();
                a.message = message(a.status, &a.statements);
                Some(a)
            }
        }
    }

    /// True unless it does not apply.
    pub fn shown(a: &Option<Applicability>) -> bool {
        a.as_ref().is_none_or(|a| a.status != Tri::DoesNotApply)
    }
}

fn message(status: Tri, st: &[Statement]) -> Option<String> {
    (status == Tri::Unknown).then(|| {
        format!(
            "applicability not determined: {}",
            st.iter()
                .filter(|s| s.status == Tri::Unknown)
                .map(|s| s.text.as_str())
                .collect::<Vec<_>>()
                .join("; ")
        )
    })
}

fn fold(s: &str) -> String {
    s.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn as_text(v: &serde_json::Value) -> Option<String> {
    match v {
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        serde_json::Value::Bool(b) => Some(b.to_string()),
        _ => None,
    }
}

/// A comparable form of a value of `kind`; `None` when it does not parse.
#[derive(Debug, Clone, PartialEq)]
enum Key {
    Text(String),
    Num(f64),
    Version(Vec<VPart>),
    Serial(String, u128),
}

#[derive(Debug, Clone, PartialEq, PartialOrd)]
enum VPart {
    N(u64),
    S(String),
}

fn key(kind: AttrType, raw: &str) -> Option<Key> {
    let t = raw.trim();
    if t.is_empty() {
        return None;
    }
    match kind {
        AttrType::Text => Some(Key::Text(fold(t))),
        AttrType::Number => t
            .parse::<f64>()
            .ok()
            .filter(|v| v.is_finite())
            .map(Key::Num),
        AttrType::Version => {
            let t = t.trim_start_matches(['v', 'V']);
            let parts: Vec<VPart> = t
                .split(['.', '-', '_'])
                .map(|p| match p.parse::<u64>() {
                    Ok(n) => VPart::N(n),
                    Err(_) => VPart::S(p.to_lowercase()),
                })
                .collect();
            (!parts.is_empty()).then_some(Key::Version(parts))
        }
        AttrType::Serial => {
            let digits: String = t.chars().rev().take_while(|c| c.is_ascii_digit()).collect();
            if digits.is_empty() {
                return None;
            }
            let n: String = digits.chars().rev().collect();
            let prefix = t[..t.len() - n.len()].to_uppercase();
            n.parse::<u128>().ok().map(|n| Key::Serial(prefix, n))
        }
    }
}

/// Order two keys of one kind; `None` when they do not compare (serials of
/// different prefixes, texts).
fn cmp(a: &Key, b: &Key) -> Option<std::cmp::Ordering> {
    match (a, b) {
        (Key::Num(x), Key::Num(y)) => x.partial_cmp(y),
        (Key::Version(x), Key::Version(y)) => {
            let n = x.len().max(y.len());
            for i in 0..n {
                let p = x.get(i).cloned().unwrap_or(VPart::N(0));
                let q = y.get(i).cloned().unwrap_or(VPart::N(0));
                let o = match (&p, &q) {
                    (VPart::N(a), VPart::N(b)) => a.cmp(b),
                    (VPart::S(a), VPart::S(b)) => a.cmp(b),
                    // A number part sorts after a text part (2.4 > 2.4-rc).
                    (VPart::N(_), VPart::S(_)) => std::cmp::Ordering::Greater,
                    (VPart::S(_), VPart::N(_)) => std::cmp::Ordering::Less,
                };
                if o != std::cmp::Ordering::Equal {
                    return Some(o);
                }
            }
            Some(std::cmp::Ordering::Equal)
        }
        (Key::Serial(p, x), Key::Serial(q, y)) => (p == q).then(|| x.cmp(y)),
        (Key::Text(x), Key::Text(y)) => (x == y).then_some(std::cmp::Ordering::Equal),
        _ => None,
    }
}

fn test(
    t: &AttrTest,
    defs: &[AttrDef],
    values: &AttrValues,
    missing: &mut BTreeSet<String>,
) -> Tri {
    let Some(def) = defs.iter().find(|d| d.id == t.attr) else {
        return Tri::Unknown; // validation refuses this
    };
    let Some(have) = values.get(&t.attr).and_then(|v| key(def.kind, v)) else {
        missing.insert(t.attr.clone());
        return Tri::Unknown;
    };
    let k = |v: &Option<serde_json::Value>| {
        v.as_ref().and_then(as_text).and_then(|s| key(def.kind, &s))
    };
    let yes = |b: bool| if b { Tri::Applies } else { Tri::DoesNotApply };
    use std::cmp::Ordering::*;
    match t.op {
        AttrOp::Eq | AttrOp::Ne => {
            let Some(want) = k(&t.value) else {
                return Tri::Unknown;
            };
            let eq = cmp(&have, &want) == Some(Equal);
            yes(if t.op == AttrOp::Eq { eq } else { !eq })
        }
        AttrOp::In | AttrOp::NotIn => {
            let set: Vec<Key> = t
                .values
                .iter()
                .flatten()
                .filter_map(|v| as_text(v).and_then(|s| key(def.kind, &s)))
                .collect();
            let inside = set.iter().any(|w| cmp(&have, w) == Some(Equal));
            yes(if t.op == AttrOp::In { inside } else { !inside })
        }
        AttrOp::Lt | AttrOp::Le | AttrOp::Gt | AttrOp::Ge => {
            let Some(want) = k(&t.value) else {
                return Tri::Unknown;
            };
            match cmp(&have, &want) {
                None => Tri::DoesNotApply, // another serial prefix
                Some(o) => yes(match t.op {
                    AttrOp::Lt => o == Less,
                    AttrOp::Le => o != Greater,
                    AttrOp::Gt => o == Greater,
                    _ => o != Less,
                }),
            }
        }
        AttrOp::Range => {
            let lo = match k(&t.min) {
                None if t.min.is_some() => return Tri::Unknown,
                None => true,
                Some(m) => match cmp(&have, &m) {
                    None => return Tri::DoesNotApply,
                    Some(o) => o == Greater || (o == Equal && t.min_inclusive.unwrap_or(true)),
                },
            };
            let hi = match k(&t.max) {
                None if t.max.is_some() => return Tri::Unknown,
                None => true,
                Some(m) => match cmp(&have, &m) {
                    None => return Tri::DoesNotApply,
                    Some(o) => o == Less || (o == Equal && t.max_inclusive.unwrap_or(true)),
                },
            };
            yes(lo && hi)
        }
    }
}

/// Evaluate `c` for an asset with `values`; adds the attributes it lacks.
pub fn eval(
    c: &ApplicCond,
    defs: &[AttrDef],
    values: &AttrValues,
    missing: &mut BTreeSet<String>,
) -> Tri {
    match c {
        ApplicCond::All { all } => all.iter().fold(Tri::Applies, |acc, c| {
            acc.and(eval(c, defs, values, missing))
        }),
        ApplicCond::Any { any } => any.iter().fold(Tri::DoesNotApply, |acc, c| {
            acc.or(eval(c, defs, values, missing))
        }),
        ApplicCond::Not { not } => eval(not, defs, values, missing).not(),
        ApplicCond::Test(t) => test(t, defs, values, missing),
    }
}

/// Problems with a condition against the declared attributes (for
/// validation): unknown attributes, operators the type does not have,
/// values that do not parse as the type.
pub fn problems(c: &ApplicCond, defs: &[AttrDef]) -> Vec<String> {
    let mut out = Vec::new();
    fn walk(c: &ApplicCond, defs: &[AttrDef], out: &mut Vec<String>) {
        match c {
            ApplicCond::All { all } if all.is_empty() => out.push("an empty `all`".into()),
            ApplicCond::Any { any } if any.is_empty() => out.push("an empty `any`".into()),
            ApplicCond::All { all } => all.iter().for_each(|c| walk(c, defs, out)),
            ApplicCond::Any { any } => any.iter().for_each(|c| walk(c, defs, out)),
            ApplicCond::Not { not } => walk(not, defs, out),
            ApplicCond::Test(t) => {
                let Some(d) = defs.iter().find(|d| d.id == t.attr) else {
                    out.push(format!("attribute {:?} is not declared", t.attr));
                    return;
                };
                let ok = |v: &Option<serde_json::Value>| {
                    v.as_ref()
                        .and_then(as_text)
                        .and_then(|s| key(d.kind, &s))
                        .is_some()
                };
                let ordered = d.kind != AttrType::Text;
                let fine = match t.op {
                    AttrOp::Eq | AttrOp::Ne => ok(&t.value),
                    AttrOp::In | AttrOp::NotIn => t.values.as_ref().is_some_and(|vs| {
                        !vs.is_empty() && vs.iter().all(|v| ok(&Some(v.clone())))
                    }),
                    AttrOp::Lt | AttrOp::Le | AttrOp::Gt | AttrOp::Ge => ordered && ok(&t.value),
                    AttrOp::Range => {
                        ordered
                            && (t.min.is_some() || t.max.is_some())
                            && (t.min.is_none() || ok(&t.min))
                            && (t.max.is_none() || ok(&t.max))
                    }
                };
                if !fine {
                    out.push(format!(
                        "attribute {:?} ({:?}): {:?} needs values of that type",
                        t.attr, d.kind, t.op
                    ));
                }
                if t.op != AttrOp::Range && (t.min_inclusive.is_some() || t.max_inclusive.is_some())
                {
                    out.push(format!(
                        "attribute {:?}: inclusive bounds belong to `range`",
                        t.attr
                    ));
                }
            }
        }
    }
    walk(c, defs, &mut out);
    out
}

/// One `applic` row.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct ApplicRow {
    pub ref_kind: String,
    pub ref_id: String,
    pub ord: i64,
    pub cond: ApplicCond,
    pub statement: String,
    pub source_section_id: String,
}

/// The item kinds an `applic` row may scope.
pub const APPLIC_REF_KINDS: &[&str] = &[
    "section",
    "proc_step",
    "procedure",
    "fault_tree",
    "fault_node",
    "ref_row",
    "ref_cell",
    "question",
];

impl Pack {
    /// The declared attributes (`pack_meta.attributes`; none when absent).
    pub fn attribute_defs(&self) -> Result<Vec<AttrDef>> {
        match self.meta("attributes") {
            None => Ok(Vec::new()),
            Some(raw) => serde_json::from_str(raw)
                .map_err(|e| Error::Pack(format!("pack_meta.attributes: {e}"))),
        }
    }

    /// Every `applic` row (validation), or those of one item.
    pub fn applic_rows(&self, item: Option<(&str, &str)>) -> Result<Vec<ApplicRow>> {
        if !self.has_table("applic")? {
            return Ok(Vec::new());
        }
        let conn = self.conn();
        let (sql, args): (String, Vec<String>) = match item {
            Some((k, id)) => (
                format!(
                    "SELECT ref_kind, ref_id, ord, cond, statement, source_section_id FROM applic
                     WHERE ref_kind = ?1 AND ref_id = ?2 AND {} ORDER BY ord",
                    super::PASSED
                ),
                vec![k.to_string(), id.to_string()],
            ),
            None => (
                format!(
                    "SELECT ref_kind, ref_id, ord, cond, statement, source_section_id FROM applic
                     WHERE {} ORDER BY ref_kind, ref_id, ord",
                    super::PASSED
                ),
                vec![],
            ),
        };
        let mut stmt = conn.prepare_cached(&sql)?;
        let rows = stmt
            .query_map(rusqlite::params_from_iter(args.iter()), |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, i64>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, String>(4)?,
                    r.get::<_, String>(5)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        rows.into_iter()
            .map(
                |(ref_kind, ref_id, ord, cond, statement, source_section_id)| {
                    Ok(ApplicRow {
                        cond: serde_json::from_str(&cond).map_err(|e| {
                            Error::Pack(format!("applic {ref_kind} {ref_id} #{ord}: {e}"))
                        })?,
                        ref_kind,
                        ref_id,
                        ord,
                        statement,
                        source_section_id,
                    })
                },
            )
            .collect()
    }

    /// How one item's statements evaluate for `values`; `None` when it has
    /// none. A section with none inherits its nearest ancestor's.
    pub fn applicability(
        &self,
        ref_kind: &str,
        ref_id: &str,
        values: &AttrValues,
    ) -> Result<Option<Applicability>> {
        let rows = if ref_kind == "section" {
            let mut found = Vec::new();
            for anc in self.section_lineage(ref_id)? {
                let r = self.applic_rows(Some(("section", &anc)))?;
                if !r.is_empty() {
                    found = r;
                    break;
                }
            }
            found
        } else {
            self.applic_rows(Some((ref_kind, ref_id)))?
        };
        if rows.is_empty() {
            return Ok(None);
        }
        let defs = self.attribute_defs()?;
        let mut missing = BTreeSet::new();
        let mut status = Tri::Applies;
        let mut statements = Vec::new();
        for r in rows {
            let s = eval(&r.cond, &defs, values, &mut missing);
            status = status.and(s);
            statements.push(Statement {
                text: r.statement,
                section_id: r.source_section_id,
                status: s,
            });
        }
        Ok(Some(Applicability {
            message: message(status, &statements),
            status,
            statements,
            missing: missing.into_iter().collect(),
        }))
    }

    /// An item's applicability and its section's, combined.
    pub fn applicability_with_section(
        &self,
        ref_kind: &str,
        ref_id: &str,
        section_id: Option<&str>,
        values: &AttrValues,
    ) -> Result<Option<Applicability>> {
        let own = self.applicability(ref_kind, ref_id, values)?;
        let sec = match section_id {
            Some(s) => self.applicability("section", s, values)?,
            None => None,
        };
        Ok(Applicability::and(own, sec))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn defs() -> Vec<AttrDef> {
        serde_json::from_value(json!([
            {"id": "sb_24_012", "label": "SB 24-012", "type": "text", "source": "manual"},
            {"id": "firmware", "label": "Firmware", "type": "version", "source": "vehicle"},
            {"id": "serial", "label": "Serial No.", "type": "serial", "source": "plate"},
            {"id": "year", "label": "Model year", "type": "number", "source": "plate"}
        ]))
        .unwrap()
    }

    fn c(v: serde_json::Value) -> ApplicCond {
        serde_json::from_value(v).unwrap()
    }

    fn ev(cond: &ApplicCond, vals: &[(&str, &str)]) -> (Tri, Vec<String>) {
        let values: AttrValues = vals
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();
        let mut m = BTreeSet::new();
        let t = eval(cond, &defs(), &values, &mut m);
        (t, m.into_iter().collect())
    }

    #[test]
    fn three_valued_over_typed_attributes() {
        let fw = c(json!({"attr": "firmware", "op": "ge", "value": "2.4"}));
        assert_eq!(ev(&fw, &[("firmware", "2.10.1")]).0, Tri::Applies);
        assert_eq!(ev(&fw, &[("firmware", "2.3.9")]).0, Tri::DoesNotApply);
        assert_eq!(ev(&fw, &[]), (Tri::Unknown, vec!["firmware".to_string()]));
        let sn =
            c(json!({"attr": "serial", "op": "range", "min": "P40D-1000", "max": "P40D-4999"}));
        assert_eq!(ev(&sn, &[("serial", "p40d-4999")]).0, Tri::Applies);
        assert_eq!(ev(&sn, &[("serial", "P40D-5000")]).0, Tri::DoesNotApply);
        assert_eq!(
            ev(&sn, &[("serial", "P40E-2000")]).0,
            Tri::DoesNotApply,
            "another prefix"
        );
        let open = c(
            json!({"attr": "year", "op": "range", "min": 2020, "max": 2024, "max_inclusive": false}),
        );
        assert_eq!(ev(&open, &[("year", "2024")]).0, Tri::DoesNotApply);
        assert_eq!(ev(&open, &[("year", "2020")]).0, Tri::Applies);
        let post = c(json!({"all": [
            {"attr": "sb_24_012", "op": "eq", "value": "Incorporated"},
            {"not": {"attr": "firmware", "op": "lt", "value": "2.4"}}
        ]}));
        assert_eq!(
            ev(&post, &[("sb_24_012", "incorporated"), ("firmware", "2.4")]).0,
            Tri::Applies
        );
        // Kleene: a false part decides even with another part unknown.
        assert_eq!(
            ev(&post, &[("sb_24_012", "Not incorporated")]).0,
            Tri::DoesNotApply
        );
        assert_eq!(
            ev(&post, &[("firmware", "3.0")]),
            (Tri::Unknown, vec!["sb_24_012".to_string()])
        );
        let any = c(
            json!({"any": [{"attr": "year", "op": "in", "values": [2019, 2020]}, {"attr": "firmware", "op": "eq", "value": "1.0"}]}),
        );
        assert_eq!(
            ev(&any, &[("year", "2020")]).0,
            Tri::Applies,
            "a true part decides"
        );
    }

    #[test]
    fn conditions_are_checked_against_the_declared_attributes() {
        assert!(
            problems(
                &c(json!({"attr": "firmware", "op": "ge", "value": "2.4"})),
                &defs()
            )
            .is_empty()
        );
        assert!(
            !problems(
                &c(json!({"attr": "colour", "op": "eq", "value": "red"})),
                &defs()
            )
            .is_empty()
        );
        assert!(
            !problems(
                &c(json!({"attr": "sb_24_012", "op": "lt", "value": "x"})),
                &defs()
            )
            .is_empty()
        );
        assert!(
            !problems(
                &c(json!({"attr": "year", "op": "eq", "value": "soon"})),
                &defs()
            )
            .is_empty()
        );
        assert!(!problems(&c(json!({"all": []})), &defs()).is_empty());
    }
}
