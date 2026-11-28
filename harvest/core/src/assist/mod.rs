//! The on-device model interface (CONTRACT "Model interface"): three
//! closed decisions a model may help with, each returned as a proposal the
//! engine has checked, never an action.
//!
//! - [`symptom_suggest`]: the engine's ranked candidates, then the model
//!   picks one, says none, or asks to clarify between two or three.
//! - [`lesson_prefill`]: the technician's close-out note mapped onto the
//!   job's own causes, actions and parts by label.
//! - [`step_ask`]: a question about the current step answered only with the
//!   pack's own sentences, chosen by handle, under a fixed heading.
//!
//! The prompts and schemas are the measured ones ([`prompts`]); the model
//! writes no text that is shown as the manual's.

pub mod prompts;
pub mod text;

use crate::error::Result;
use crate::llm::{Llm, LlmRequest};
use crate::maint::applic::{Applicability, AttrValues};
use crate::maint::search::{self, SymptomHit};
use crate::maint::view::{self, Citation};
use crate::maint::{NodeKind, Target, Tree};
use crate::pack::Pack;
use crate::records::{JobReport, PartUsed};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::time::Instant;

/// One model exchange, for the audit log and the status.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Exchange {
    pub method: String,
    pub prompt_version: String,
    /// `None` when no model was called.
    pub model: Option<String>,
    /// What the model was offered (candidates, labels, handles).
    pub offered: Value,
    /// The model's raw output, or the error.
    pub raw: Option<String>,
    pub error: Option<String>,
    pub decision: String,
    pub elapsed_ms: u64,
}

/// Call the model once (the measured setting: temperature 0, thinking off,
/// the given budget) and read its JSON. `Err` text when it fails or does
/// not answer with JSON.
fn ask_model(
    llm: &dyn Llm,
    system: &str,
    user: &str,
    schema: (&str, Value),
    max_tokens: u32,
    ex: &mut Exchange,
) -> Option<Value> {
    ex.model = Some(llm.id());
    let req = LlmRequest {
        system: system.to_string(),
        user: user.to_string(),
        schema: (schema.0.to_string(), schema.1),
        max_tokens,
        temperature: 0.0,
    };
    match llm.complete(&req) {
        Ok(raw) => {
            let parsed = crate::llm::parse_json_for::<Value>(&raw, &Value::Null);
            ex.raw = Some(raw);
            match parsed {
                Ok(v) => Some(v),
                Err(e) => {
                    ex.error = Some(e.to_string());
                    None
                }
            }
        }
        Err(e) => {
            ex.error = Some(e.to_string());
            None
        }
    }
}

/// The equipment line the prompts start with: the pack's equipment roots
/// and its first source.
pub fn equipment_label(pack: &Pack) -> Result<String> {
    let roots: Vec<String> = pack
        .equipment()
        .iter()
        .filter(|e| e.parent_id.is_none())
        .map(|e| e.name.clone())
        .collect();
    let label = if roots.is_empty() {
        pack.pack_id().to_string()
    } else {
        roots.join(", ")
    };
    let info = pack.info()?;
    Ok(match info.sources.iter().find(|s| !s.title.is_empty()) {
        Some(s) => format!("{label} ({})", s.title),
        None => label,
    })
}

// ------------------------------------------------------------------- T1

/// A candidate entry, described only by the pack.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct SymptomEntry {
    pub symptom_id: String,
    pub tree_id: String,
    pub title: String,
    /// The tree's symptom statement (its entry node), when it says more
    /// than the title.
    pub statement: Option<String>,
    /// The first open causes in tree order (up to 4).
    pub causes: Vec<String>,
    /// Synonyms (up to 4).
    pub also: Vec<String>,
    /// The search's score for it.
    #[serde(rename = "match")]
    pub match_score: f64,
    pub confidence: search::Confidence,
    /// The tree's applicability for the asset, when it has statements.
    pub applicability: Option<Applicability>,
}

/// What `symptom.suggest` proposes.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SuggestDecision {
    /// The engine's own confident rule: go to this entry.
    Route,
    /// The model picked this entry; the technician confirms.
    Suggest,
    /// Ask which of these two or three it is.
    Clarify,
    /// Show the list.
    List,
}

fn bfs(t: &Tree) -> Vec<String> {
    let mut adj: std::collections::HashMap<&str, Vec<&str>> = Default::default();
    for e in &t.edges {
        adj.entry(e.from_node.as_str())
            .or_default()
            .push(e.to_node.as_str());
    }
    let mut seen: Vec<String> = Vec::new();
    let mut q: std::collections::VecDeque<String> = [t.tree.entry_node.clone()].into();
    while let Some(n) = q.pop_front() {
        if seen.contains(&n) {
            continue;
        }
        if let Some(next) = adj.get(n.as_str()) {
            q.extend(next.iter().map(|s| s.to_string()));
        }
        seen.push(n);
    }
    seen
}

fn same_title(a: &str, b: &str) -> bool {
    let f = |s: &str| s.trim().trim_end_matches('.').to_lowercase();
    f(a) == f(b)
}

/// Describe a hit as the measured candidates were: title, the tree's
/// symptom statement, the first open causes, synonyms, the match.
pub fn describe(pack: &Pack, hit: &SymptomHit) -> Result<SymptomEntry> {
    let sym = &hit.symptom;
    let mut statement = None;
    let mut causes = Vec::new();
    if let Some(t) = pack.fault_tree(&sym.tree_id)? {
        if let Some(entry) = t.node(&t.tree.entry_node)
            && entry.kind == NodeKind::Symptom
            && !same_title(&entry.text, &sym.title)
        {
            statement = Some(entry.text.clone());
        }
        let of = view::open_facet(pack);
        for nid in bfs(&t) {
            let texts: Vec<String> = t
                .facets_of(&nid)
                .into_iter()
                .filter(|f| f.facet == of)
                .map(|f| f.text.clone())
                .collect();
            if !texts.is_empty() {
                causes = texts.into_iter().take(4).collect();
                break;
            }
        }
    }
    Ok(SymptomEntry {
        symptom_id: sym.symptom_id.clone(),
        tree_id: sym.tree_id.clone(),
        title: sym.title.clone(),
        statement,
        causes,
        also: sym.synonyms.iter().take(4).cloned().collect(),
        match_score: hit.score,
        confidence: hit.confidence,
        applicability: sym.applicability.clone(),
    })
}

/// The T1 user message (`render(…, scores=True)`).
pub fn t1_render(text: &str, equipment: &str, cands: &[SymptomEntry]) -> String {
    let mut lines = Vec::new();
    for (i, c) in cands.iter().enumerate() {
        let mut s = format!("{}. {}", i + 1, c.title);
        s.push_str(&format!(" [search match {:.2}]", c.match_score));
        if let Some(st) = &c.statement {
            s.push_str(&format!(" — {st}"));
        }
        if !c.causes.is_empty() {
            s.push_str(&format!(" (causes: {})", c.causes.join("; ")));
        }
        if !c.also.is_empty() {
            s.push_str(&format!(" (also said as: {})", c.also.join("; ")));
        }
        lines.push(s);
    }
    format!(
        "Equipment: {equipment}\nTechnician: \"{text}\"\n\n{}Candidates:\n{}\n\nDecision as JSON.",
        prompts::T1_SCORES_HEAD,
        lines.join("\n")
    )
}

/// A T1 decision read from the model's JSON (`parse`).
#[derive(Debug, Clone, PartialEq)]
pub enum T1Parsed {
    Pick(usize),
    None,
    Clarify(Vec<usize>),
    Error,
}

fn int(v: &Value) -> Option<i64> {
    (v.is_i64() || v.is_u64()).then(|| v.as_i64()).flatten()
}

pub fn t1_parse(out: &Value, k: usize) -> T1Parsed {
    let mut out = out;
    while out.is_object() && out.get("answer").is_some() && out.get("decision").is_none() {
        out = &out["answer"];
    }
    if !out.is_object() {
        return T1Parsed::Error;
    }
    let in_range = |x: i64| x >= 1 && (x as usize) <= k;
    match out.get("decision").and_then(Value::as_str) {
        Some("pick") => match out.get("candidate").and_then(int) {
            Some(c) if in_range(c) => T1Parsed::Pick(c as usize),
            _ => T1Parsed::Error,
        },
        Some("none") => T1Parsed::None,
        Some("clarify") => {
            let mut b: Vec<usize> = out
                .get("between")
                .and_then(Value::as_array)
                .map(|a| {
                    a.iter()
                        .filter_map(int)
                        .filter(|x| in_range(*x))
                        .map(|x| x as usize)
                        .collect()
                })
                .unwrap_or_default();
            b.sort();
            b.dedup();
            match b.len() {
                0 => T1Parsed::Error,
                1 => T1Parsed::Pick(b[0]),
                _ => T1Parsed::Clarify(b.into_iter().take(3).collect()),
            }
        }
        _ => T1Parsed::Error,
    }
}

/// The T1 outcome.
#[derive(Debug, Clone)]
pub struct SymptomSuggestion {
    pub decision: SuggestDecision,
    pub entries: Vec<SymptomEntry>,
    pub exchange: Exchange,
}

/// `symptom.suggest` over a search already run (k ≥ 12, the defaults).
pub fn symptom_suggest(
    pack: &Pack,
    text: &str,
    hits: &[SymptomHit],
    llm: Option<&dyn Llm>,
) -> Result<SymptomSuggestion> {
    let t0 = Instant::now();
    let mut ex = Exchange {
        method: "symptom.suggest".into(),
        prompt_version: prompts::T1_VERSION.into(),
        ..Default::default()
    };
    let cands: Vec<SymptomEntry> = hits
        .iter()
        .take(prompts::T1_K)
        .map(|h| describe(pack, h))
        .collect::<Result<_>>()?;
    ex.offered = json!(cands.iter().map(|c| &c.symptom_id).collect::<Vec<_>>());
    let done = |decision: SuggestDecision, entries: Vec<SymptomEntry>, mut ex: Exchange| {
        ex.decision = format!("{decision:?}").to_lowercase();
        ex.elapsed_ms = t0.elapsed().as_millis() as u64;
        Ok(SymptomSuggestion {
            decision,
            entries,
            exchange: ex,
        })
    };
    // The engine decides first: a confident top hit routes, no hits lists.
    match cands.first() {
        None => return done(SuggestDecision::List, cands, ex),
        Some(top) if top.confidence == search::Confidence::Confident => {
            let top = top.clone();
            return done(SuggestDecision::Route, vec![top], ex);
        }
        _ => {}
    }
    let Some(llm) = llm else {
        return done(SuggestDecision::List, cands, ex);
    };
    let user = t1_render(text, &equipment_label(pack)?, &cands);
    let out = ask_model(
        llm,
        &prompts::t1_system(),
        &user,
        ("decision", prompts::t1_schema(prompts::T1_K)),
        prompts::T1_MAX_TOKENS,
        &mut ex,
    );
    let parsed = out.map_or(T1Parsed::Error, |v| t1_parse(&v, cands.len()));
    match parsed {
        T1Parsed::Pick(i) => {
            let e = cands[i - 1].clone();
            done(SuggestDecision::Suggest, vec![e], ex)
        }
        T1Parsed::Clarify(b) => {
            let es = b.iter().map(|i| cands[i - 1].clone()).collect();
            done(SuggestDecision::Clarify, es, ex)
        }
        T1Parsed::None => done(SuggestDecision::List, cands, ex),
        T1Parsed::Error => {
            if ex.error.is_none() {
                ex.error =
                    Some("the model's answer is not a decision over these candidates".into());
            }
            done(SuggestDecision::List, cands, ex)
        }
    }
}

// ------------------------------------------------------------------- T2

/// The job's own context (`t2.context`).
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct PrefillContext {
    pub tree_title: Option<String>,
    /// `(text, result)` of each step recorded.
    pub steps: Vec<(Option<String>, Option<String>)>,
    pub last: Option<String>,
    pub causes: Vec<String>,
    /// `(text, reached)`, reached ones first.
    pub actions: Vec<(String, bool)>,
    pub parts: Vec<PartUsed>,
}

/// Python's `str(float)`: an integral value keeps `.0`.
fn py_float(v: f64) -> String {
    if v.fract() == 0.0 && v.is_finite() && v.abs() < 1e16 {
        format!("{v:.1}")
    } else {
        format!("{v}")
    }
}

/// Build the context from the job's report and the views of the nodes it
/// reached (path then current), at any level.
pub fn prefill_context(
    pack: &Pack,
    report: &JobReport,
    views: &[view::NodeView],
) -> Result<PrefillContext> {
    let mut ctx = PrefillContext {
        tree_title: report.tree_title.clone(),
        ..Default::default()
    };
    let Some(t) = pack.fault_tree(&report.tree_id)? else {
        return Ok(ctx);
    };
    let of = view::open_facet(pack);
    let order: Vec<&str> = t.nodes.iter().map(|n| n.node_id.as_str()).collect();
    let mut facets: Vec<&crate::maint::Facet> = t.facets.iter().collect();
    facets.sort_by_key(|f| {
        (
            order.iter().position(|n| *n == f.node_id).unwrap_or(0),
            f.ord,
        )
    });
    for f in facets {
        if f.facet == of && !ctx.causes.contains(&f.text) {
            ctx.causes.push(f.text.clone());
        }
    }
    let is_act = |id: &str| {
        t.node(id)
            .is_some_and(|n| matches!(n.kind, NodeKind::Action | NodeKind::Escalate))
    };
    let reached: Vec<&str> = views.iter().map(|v| v.node.node_id.as_str()).collect();
    let acts_reached: Vec<&str> = reached.iter().copied().filter(|n| is_act(n)).collect();
    for n in &acts_reached {
        if let Some(node) = t.node(n) {
            ctx.actions.push((node.text.clone(), true));
        }
    }
    for n in &order {
        if is_act(n) && !acts_reached.contains(n) {
            ctx.actions
                .push((t.node(n).map(|x| x.text.clone()).unwrap_or_default(), false));
        }
    }
    let mut add = |reqs: &[crate::maint::Requirement]| {
        for r in reqs {
            if (r.kind == "part" || r.kind == "consumable")
                && !ctx
                    .parts
                    .iter()
                    .any(|p| p.text == r.text && p.ident == r.ident)
            {
                ctx.parts.push(PartUsed {
                    text: r.text.clone(),
                    ident: r.ident.clone(),
                    qty: r.qty.clone(),
                });
            }
        }
    };
    for v in views {
        add(&v.setup);
        add(&v.requirements);
        if let Some(tp) = &v.test_procedure {
            add(&tp.requirements);
        }
        if let Some(Target::Procedure { id }) = &v.node.target
            && let Some(task) = view::task_view(pack, id, None, &AttrValues::new())?
        {
            add(&task.requirements);
        }
    }
    for s in &report.steps {
        if s.step.superseded_at.is_some() {
            continue;
        }
        let mut res = if s.step.label.is_empty() {
            s.step.outcome.clone()
        } else {
            Some(s.step.label.clone())
        };
        if let Some(v) = s.step.value {
            res = Some(
                format!(
                    "{} {}",
                    py_float(v),
                    s.step.unit.clone().unwrap_or_default()
                )
                .trim()
                .to_string(),
            );
        }
        ctx.steps.push((s.text.clone(), res));
    }
    ctx.last = views.last().map(|v| v.node.text.clone());
    Ok(ctx)
}

/// `render_context`.
pub fn t2_render(ctx: &PrefillContext, equipment: &str) -> String {
    let mut lines = vec![
        format!("Equipment: {equipment}"),
        format!(
            "Troubleshooting: {}",
            ctx.tree_title.as_deref().unwrap_or("None")
        ),
        "Steps recorded:".to_string(),
    ];
    for (i, (text, res)) in ctx.steps.iter().enumerate() {
        lines.push(format!(
            "  {}. {} -> {}",
            i + 1,
            text.as_deref().unwrap_or("None"),
            res.as_deref().unwrap_or("None")
        ));
    }
    if let Some(l) = &ctx.last {
        lines.push(format!("Ended at: {l}"));
    }
    lines.push(if ctx.causes.is_empty() {
        "Causes listed by the manual: (none)".into()
    } else {
        "Causes listed by the manual:".into()
    });
    lines.extend(
        ctx.causes
            .iter()
            .enumerate()
            .map(|(i, c)| format!("  C{}. {c}", i + 1)),
    );
    lines.push("Actions in this troubleshooting (reached ones first):".into());
    lines.extend(
        ctx.actions
            .iter()
            .enumerate()
            .map(|(i, (a, r))| format!("  A{}. {a}{}", i + 1, if *r { " [reached]" } else { "" })),
    );
    lines.push(if ctx.parts.is_empty() {
        "Parts and consumables the manual lists for this job: (none)".into()
    } else {
        "Parts and consumables the manual lists for this job:".into()
    });
    lines.extend(ctx.parts.iter().enumerate().map(|(i, p)| {
        format!(
            "  P{}. {}{}",
            i + 1,
            p.text,
            p.ident
                .as_ref()
                .filter(|x| !x.is_empty())
                .map(|x| format!(" ({x})"))
                .unwrap_or_default()
        )
    }));
    lines.join("\n")
}

/// Where a proposed value came from.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Source {
    Job,
    Model,
    Unknown,
}

/// One proposed text field.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct ProposedText {
    pub value: Option<String>,
    pub source: Source,
    /// The model's label (`C2`, `A1`, `other`, `unknown`).
    pub label: Option<String>,
}

impl ProposedText {
    fn unknown() -> Self {
        Self {
            value: None,
            source: Source::Unknown,
            label: None,
        }
    }
    fn job(v: Option<String>) -> Self {
        match v {
            Some(v) => Self {
                value: Some(v),
                source: Source::Job,
                label: None,
            },
            None => Self::unknown(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct ProposedParts {
    pub value: Vec<PartUsed>,
    pub source: Source,
    pub labels: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct ProposedMinutes {
    pub value: Option<u32>,
    pub source: Source,
}

/// A `LessonInput`-shaped proposal, field by field.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct LessonProposal {
    pub job_id: ProposedText,
    pub asset_id: ProposedText,
    pub equip_id: ProposedText,
    pub tree_id: ProposedText,
    pub symptom_id: ProposedText,
    pub cause: ProposedText,
    pub action: ProposedText,
    pub parts: ProposedParts,
    pub minutes: ProposedMinutes,
    pub note: ProposedText,
}

/// The fields the model may prefill (by device class).
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct PrefillPolicy {
    /// From `cause`, `action`, `parts`, `minutes`, `note`.
    pub fields: Vec<String>,
}

impl Default for PrefillPolicy {
    fn default() -> Self {
        Self {
            fields: vec!["minutes".into(), "parts".into()],
        }
    }
}

/// The fields a policy may name.
pub const PREFILL_FIELDS: [&str; 5] = ["cause", "action", "parts", "minutes", "note"];

impl PrefillPolicy {
    fn allows(&self, f: &str) -> bool {
        self.fields.iter().any(|x| x == f)
    }

    /// Refuse a field that is not one of [`PREFILL_FIELDS`].
    pub fn check(&self) -> Result<()> {
        for f in &self.fields {
            if !PREFILL_FIELDS.contains(&f.as_str()) {
                return Err(crate::error::Error::Invalid(format!(
                    "prefill field {f:?}: one of {}",
                    PREFILL_FIELDS.join(", ")
                )));
            }
        }
        Ok(())
    }

    /// The fields both policies allow (a call may narrow the host's, never
    /// widen it).
    pub fn narrowed(&self, by: &PrefillPolicy) -> PrefillPolicy {
        PrefillPolicy {
            fields: self
                .fields
                .iter()
                .filter(|f| by.allows(f))
                .cloned()
                .collect(),
        }
    }
}

/// The T2 outcome.
#[derive(Debug, Clone)]
pub struct Prefill {
    pub proposal: LessonProposal,
    pub exchange: Exchange,
}

fn choice(v: &Value, text: &Value, prefix: char, listed: &[String]) -> ProposedText {
    let Some(s) = v.as_str() else {
        return ProposedText::unknown();
    };
    if let Some(n) = s.strip_prefix(prefix).and_then(|d| d.parse::<usize>().ok()) {
        return match listed.get(n.wrapping_sub(1)) {
            Some(t) if n >= 1 => ProposedText {
                value: Some(t.clone()),
                source: Source::Model,
                label: Some(s.to_string()),
            },
            // A label the context does not have.
            _ => ProposedText::unknown(),
        };
    }
    match s {
        "other" => match text.as_str().map(str::trim).filter(|t| !t.is_empty()) {
            Some(t) => ProposedText {
                value: Some(t.chars().take(100).collect()),
                source: Source::Model,
                label: Some("other".into()),
            },
            None => ProposedText::unknown(),
        },
        "unknown" => ProposedText {
            value: None,
            source: Source::Unknown,
            label: Some("unknown".into()),
        },
        _ => ProposedText::unknown(),
    }
}

/// `lesson.prefill` over a job's context.
pub fn lesson_prefill(
    pack: &Pack,
    report: &JobReport,
    ctx: &PrefillContext,
    text: &str,
    policy: &PrefillPolicy,
    llm: Option<&dyn Llm>,
) -> Result<Prefill> {
    let t0 = Instant::now();
    let mut ex = Exchange {
        method: "lesson.prefill".into(),
        prompt_version: prompts::T2_VERSION.into(),
        offered: json!({"causes": ctx.causes.len(), "actions": ctx.actions.len(), "parts": ctx.parts.len()}),
        ..Default::default()
    };
    let mut p = LessonProposal {
        job_id: ProposedText::job(Some(report.job_id.clone())),
        asset_id: ProposedText::job(report.asset_id.clone()),
        equip_id: ProposedText::job(report.equip_id.clone()),
        tree_id: ProposedText::job(Some(report.tree_id.clone())),
        symptom_id: ProposedText::job(report.symptom_id.clone()),
        cause: ProposedText::unknown(),
        action: ProposedText::unknown(),
        parts: ProposedParts {
            value: Vec::new(),
            source: Source::Unknown,
            labels: Vec::new(),
        },
        minutes: ProposedMinutes {
            value: None,
            source: Source::Unknown,
        },
        note: ProposedText::unknown(),
    };
    let out = match llm {
        Some(llm) => {
            let user = format!(
                "{}\n\nTechnician's note: \"{text}\"\n\nRecord as JSON.",
                t2_render(ctx, &equipment_label(pack)?)
            );
            ask_model(
                llm,
                prompts::T2_SYSTEM,
                &user,
                (
                    "record",
                    prompts::t2_schema(ctx.causes.len(), ctx.actions.len(), ctx.parts.len()),
                ),
                prompts::T2_MAX_TOKENS,
                &mut ex,
            )
        }
        None => None,
    };
    match out.as_ref().filter(|v| v.is_object()) {
        Some(v) => {
            if policy.allows("cause") {
                p.cause = choice(&v["cause"], &v["cause_text"], 'C', &ctx.causes);
            }
            if policy.allows("action") {
                let acts: Vec<String> = ctx.actions.iter().map(|a| a.0.clone()).collect();
                p.action = choice(&v["action"], &v["action_text"], 'A', &acts);
            }
            if policy.allows("parts")
                && let Some(arr) = v["parts"].as_array()
            {
                let others: Vec<String> = v["parts_other"]
                    .as_array()
                    .map(|a| {
                        a.iter()
                            .filter_map(Value::as_str)
                            .map(str::trim)
                            .filter(|t| !t.is_empty())
                            .map(|t| t.chars().take(60).collect())
                            .take(3)
                            .collect()
                    })
                    .unwrap_or_default();
                let mut used = 0usize;
                let mut ok = true;
                for x in arr {
                    match x.as_str() {
                        Some("other") => {
                            if let Some(name) = others.get(used) {
                                p.parts.value.push(PartUsed {
                                    text: name.clone(),
                                    ident: None,
                                    qty: None,
                                });
                                p.parts.labels.push("other".into());
                            }
                            used += 1;
                        }
                        Some(l) => match l
                            .strip_prefix('P')
                            .and_then(|d| d.parse::<usize>().ok())
                            .filter(|n| *n >= 1)
                            .and_then(|n| ctx.parts.get(n - 1))
                        {
                            Some(part) => {
                                p.parts.value.push(PartUsed {
                                    qty: None,
                                    ..part.clone()
                                });
                                p.parts.labels.push(l.to_string());
                            }
                            None => ok = false,
                        },
                        None => ok = false,
                    }
                }
                if ok {
                    p.parts.source = Source::Model;
                } else {
                    p.parts = ProposedParts {
                        value: Vec::new(),
                        source: Source::Unknown,
                        labels: Vec::new(),
                    };
                }
            }
            if policy.allows("minutes")
                && let Some(m) = int(&v["minutes"]).filter(|m| (0..=100_000).contains(m))
            {
                p.minutes = ProposedMinutes {
                    value: Some(m as u32),
                    source: Source::Model,
                };
            }
            if policy.allows("note")
                && let Some(n) = v["note"].as_str().map(str::trim).filter(|n| !n.is_empty())
            {
                p.note = ProposedText {
                    value: Some(n.chars().take(200).collect()),
                    source: Source::Model,
                    label: None,
                };
            }
            ex.decision = "proposal".into();
        }
        None => {
            if llm.is_some() && ex.error.is_none() {
                ex.error = Some("the model's answer is not a record".into());
            }
            ex.decision = "unknown".into();
        }
    }
    ex.elapsed_ms = t0.elapsed().as_millis() as u64;
    Ok(Prefill {
        proposal: p,
        exchange: ex,
    })
}

// ------------------------------------------------------------------- T3

/// A passage block: its label, the pack's text, and its citation.
#[derive(Debug, Clone)]
pub struct Block {
    pub label: String,
    pub text: String,
    pub citation: Option<Citation>,
}

/// One sentence offered, with its handle.
#[derive(Debug, Clone, PartialEq)]
pub struct Handle {
    pub h: String,
    pub label: String,
    pub text: String,
    pub citation: Option<Citation>,
}

/// The step's own blocks (`step_passages`).
pub fn step_blocks(pack: &Pack, v: &view::NodeView) -> Result<Vec<Block>> {
    let cite = |s: &str| view::citation(pack, s).ok();
    let mut out = vec![Block {
        label: "Current step".into(),
        text: v.node.text.clone(),
        citation: Some(v.citation.clone()),
    }];
    let guard = |g: &view::Guard| Block {
        label: g
            .heading
            .clone()
            .unwrap_or_else(|| g.kind.clone())
            .to_uppercase(),
        text: g.text.clone(),
        citation: Some(g.citation.clone()),
    };
    out.extend(v.guards.iter().map(guard));
    for fg in &v.facets {
        for t in &fg.texts {
            out.push(Block {
                label: fg.label.clone().unwrap_or_else(|| fg.facet.clone()),
                text: t.text.clone(),
                citation: cite(&t.section_id),
            });
        }
    }
    if let Some(tp) = &v.test_procedure {
        out.extend(tp.guards.iter().map(guard));
        for s in &tp.steps {
            out.push(Block {
                label: format!(
                    "{}, step {}",
                    if tp.title.is_empty() {
                        "Test procedure"
                    } else {
                        &tp.title
                    },
                    s.ord
                ),
                text: s.text.clone(),
                citation: s.citation.clone(),
            });
            out.extend(s.guards.iter().map(guard));
        }
    }
    // A requirement is offered only when its text is verbatim in a section
    // that cites it.
    for r in v
        .requirements
        .iter()
        .chain(v.setup.iter())
        .filter(|r| r.verbatim && r.section_id.is_some())
    {
        out.push(Block {
            label: format!("Needs ({})", r.kind),
            text: format!(
                "{}{}",
                r.text,
                r.ident
                    .as_ref()
                    .filter(|x| !x.is_empty())
                    .map(|x| format!(" ({x})"))
                    .unwrap_or_default()
            ),
            citation: r.section_id.as_deref().and_then(cite),
        });
    }
    if let Some(r) = &v.reference {
        out.push(Block {
            label: "Reference".into(),
            text: r.clone(),
            citation: Some(v.citation.clone()),
        });
    }
    Ok(out)
}

/// Sentences with handles S1…S48 (`build_pool`).
pub fn build_pool(blocks: &[Block]) -> Vec<Handle> {
    let mut pool = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for b in blocks {
        // Nothing is shown without its citation.
        if b.citation.is_none() {
            eprintln!(
                "harvest: step.ask: passage {:?} has no citation; not offered",
                b.label
            );
            continue;
        }
        for s in text::sentences(&b.text) {
            let n = text::norm_sentence(&s);
            if n.is_empty() || !seen.insert(n) {
                continue;
            }
            pool.push(Handle {
                h: format!("S{}", pool.len() + 1),
                label: b.label.clone(),
                text: s,
                citation: b.citation.clone(),
            });
            if pool.len() >= prompts::T3_MAX_SENTENCES {
                return pool;
            }
        }
    }
    pool
}

/// The T3 user message (`render(…, templates=True)`).
pub fn t3_render(question: &str, equipment: &str, v: &view::NodeView, pool: &[Handle]) -> String {
    let mut lines = vec![
        format!("Equipment: {equipment}"),
        format!("Troubleshooting: {}", v.tree.title),
        format!("Current step: {}", v.node.text),
        format!("Question: \"{question}\""),
        String::new(),
        "Manual sentences:".into(),
    ];
    let mut last: Option<&str> = None;
    for p in pool {
        if last != Some(p.label.as_str()) {
            lines.push(format!("[{}]", p.label));
            last = Some(p.label.as_str());
        }
        lines.push(format!("{}: {}", p.h, p.text));
    }
    lines.push(format!(
        "\nHeadings: {}",
        prompts::T3_TEMPLATES
            .iter()
            .map(|t| if t.is_empty() { "(none)" } else { t })
            .collect::<Vec<_>>()
            .join(" | ")
    ));
    lines.push("\nAnswer as JSON.".into());
    lines.join("\n")
}

/// A sentence shown: the pack's own text and its citation.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct ShownSentence {
    pub text: String,
    pub citation: Option<Citation>,
}

/// What `step.ask` shows.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AskDecision {
    Answer,
    Decline,
}

/// The T3 outcome.
#[derive(Debug, Clone)]
pub struct StepAnswer {
    pub decision: AskDecision,
    /// One of the fixed headings (empty for none).
    pub heading: String,
    pub sentences: Vec<ShownSentence>,
    /// On decline: the nearest passages.
    pub nearest: Vec<ShownSentence>,
    pub exchange: Exchange,
}

/// `step.ask` over the step's blocks and the search's blocks.
pub fn step_ask(
    pack: &Pack,
    v: &view::NodeView,
    search_blocks: &[Block],
    question: &str,
    llm: Option<&dyn Llm>,
) -> Result<StepAnswer> {
    let t0 = Instant::now();
    let mut blocks = step_blocks(pack, v)?;
    blocks.extend(search_blocks.iter().cloned());
    let pool = build_pool(&blocks);
    let mut ex = Exchange {
        method: "step.ask".into(),
        prompt_version: prompts::T3_VERSION.into(),
        offered: json!(
            pool.iter()
                .map(|p| json!({"h": p.h, "text": p.text}))
                .collect::<Vec<_>>()
        ),
        ..Default::default()
    };
    let nearest: Vec<ShownSentence> = if search_blocks.is_empty() {
        vec![ShownSentence {
            text: v.node.text.clone(),
            citation: Some(v.citation.clone()),
        }]
    } else {
        search_blocks
            .iter()
            .take(3)
            .map(|b| ShownSentence {
                text: b.text.clone(),
                citation: b.citation.clone(),
            })
            .collect()
    };
    let out = match (llm, pool.is_empty()) {
        (Some(llm), false) => ask_model(
            llm,
            &prompts::t3_system(),
            &t3_render(question, &equipment_label(pack)?, v, &pool),
            ("answer", prompts::t3_schema(pool.len())),
            prompts::T3_MAX_TOKENS,
            &mut ex,
        ),
        _ => None,
    };
    let mut out_v = out.as_ref();
    while let Some(o) = out_v {
        if o.get("answer").is_some() && o.get("kind").is_none() {
            out_v = o.get("answer");
        } else {
            break;
        }
    }
    let mut picked: Vec<&Handle> = Vec::new();
    let mut heading = String::new();
    if let Some(o) = out_v
        && o.get("kind").and_then(Value::as_str) == Some("answer")
    {
        let mut seen = std::collections::HashSet::new();
        for h in o
            .get("sentences")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            if let Some(h) = h.as_str()
                && seen.insert(h.to_string())
                && let Some(p) = pool.iter().find(|p| p.h == h)
            {
                picked.push(p);
            }
        }
        picked.truncate(4);
        // Only a fixed heading is ever shown.
        if let Some(c) = o.get("connector").and_then(Value::as_str)
            && prompts::T3_TEMPLATES.contains(&c.trim())
        {
            heading = c.trim().to_string();
        }
    }
    let decision = if picked.is_empty() {
        AskDecision::Decline
    } else {
        AskDecision::Answer
    };
    ex.decision = format!("{decision:?}").to_lowercase();
    if llm.is_some() && decision == AskDecision::Decline && ex.error.is_none() {
        let declined = out_v.and_then(|o| o.get("kind")).and_then(Value::as_str) == Some("decline");
        if !declined {
            ex.error = Some("the model chose no sentence that exists".into());
        }
    }
    ex.elapsed_ms = t0.elapsed().as_millis() as u64;
    Ok(StepAnswer {
        decision,
        heading: if decision == AskDecision::Answer {
            heading
        } else {
            String::new()
        },
        sentences: picked
            .into_iter()
            .map(|p| ShownSentence {
                text: p.text.clone(),
                citation: p.citation.clone(),
            })
            .collect(),
        nearest: if decision == AskDecision::Decline {
            nearest
        } else {
            Vec::new()
        },
        exchange: ex,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn t1_parse_is_the_measured_parse() {
        let p = |v: Value| t1_parse(&v, 5);
        assert_eq!(
            p(json!({"decision": "pick", "candidate": 3})),
            T1Parsed::Pick(3)
        );
        assert_eq!(
            p(json!({"decision": "pick", "candidate": 6})),
            T1Parsed::Error,
            "out of range"
        );
        assert_eq!(
            p(json!({"decision": "pick", "candidate": 2.0})),
            T1Parsed::Error,
            "not an integer"
        );
        assert_eq!(p(json!({"decision": "none"})), T1Parsed::None);
        assert_eq!(
            p(json!({"decision": "clarify", "between": [4, 2, 9, 2]})),
            T1Parsed::Clarify(vec![2, 4])
        );
        assert_eq!(
            p(json!({"decision": "clarify", "between": [4, 9]})),
            T1Parsed::Pick(4),
            "one left: a pick"
        );
        assert_eq!(p(json!({"answer": {"decision": "none"}})), T1Parsed::None);
        assert_eq!(p(json!(["pick"])), T1Parsed::Error);
        assert_eq!(p(json!({"decision": "maybe"})), T1Parsed::Error);
    }

    #[test]
    fn renders_like_the_harness() {
        let e = SymptomEntry {
            symptom_id: "s".into(),
            tree_id: "t".into(),
            title: "Pump overheats".into(),
            statement: Some("The lamp is on.".into()),
            causes: vec!["Strainer blocked.".into(), "Belt loose.".into()],
            also: vec!["running hot".into()],
            match_score: 0.6449,
            confidence: search::Confidence::Closest,
            applicability: None,
        };
        let mut bare = e.clone();
        bare.statement = None;
        bare.causes.clear();
        bare.also.clear();
        assert_eq!(
            t1_render("it runs hot", "Model 40 (Manual)", &[e, bare]),
            "Equipment: Model 40 (Manual)\nTechnician: \"it runs hot\"\n\n\
             Each candidate shows the search's match strength (0 to 1; above about 0.7 is a strong match, below 0.55 weak). A weak top match often means the right entry is not listed.\n\
             Candidates:\n\
             1. Pump overheats [search match 0.64] — The lamp is on. (causes: Strainer blocked.; Belt loose.) (also said as: running hot)\n\
             2. Pump overheats [search match 0.64]\n\nDecision as JSON."
        );
        let ctx = PrefillContext {
            tree_title: Some("No crank".into()),
            steps: vec![(Some("Battery voltage?".into()), Some("12.8 V".into()))],
            last: Some("Replace relay K1.".into()),
            causes: vec![],
            actions: vec![
                ("Replace relay K1.".into(), true),
                ("Charge the battery.".into(), false),
            ],
            parts: vec![PartUsed {
                text: "Relay".into(),
                ident: Some("P40-7".into()),
                qty: None,
            }],
        };
        assert_eq!(
            t2_render(&ctx, "Model 40"),
            "Equipment: Model 40\nTroubleshooting: No crank\nSteps recorded:\n  1. Battery voltage? -> 12.8 V\n\
             Ended at: Replace relay K1.\nCauses listed by the manual: (none)\n\
             Actions in this troubleshooting (reached ones first):\n  A1. Replace relay K1. [reached]\n  A2. Charge the battery.\n\
             Parts and consumables the manual lists for this job:\n  P1. Relay (P40-7)"
        );
    }

    #[test]
    fn floats_print_like_the_harness() {
        assert_eq!(py_float(12.0), "12.0");
        assert_eq!(py_float(12.25), "12.25");
    }
}
