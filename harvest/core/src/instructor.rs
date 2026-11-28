//! Instructor: a conversation that moves through the course knowledge tree.
//!
//! A turn is a list of blocks (CONTRACT "Instructor turns"): prebaked node
//! text shown as written, verbatim rule quotes with their cites, lessons,
//! films, diagrams, an inline or reviewed question, a focus list, a tool, a
//! rules search, and the model's short prose. Each turn ends with follow-ups
//! the learner can tap; a tap that names a tree input is answered from the
//! tree with no model call.
//!
//! The model's job is to understand the learner and choose: which node and
//! which of its texts, which linked block, which rule sentences, which tool.
//! It writes one short `say` that connects the blocks to what was asked. A
//! sentence of `say` that states a requirement or a number stands only when
//! the rule sentences it names support it under the strict checker, or (a
//! number with no rule word) when the turn's prebaked text states it;
//! otherwise it is dropped. Quote text always comes from the pack, never
//! from the model: the model names sentence handles.
//!
//! The host owns the conversation: it sends the history, the node the
//! conversation is at (`at`) and the learner; the core is stateless.

use crate::answer::{Engine, best_passage};
use crate::check::{self, CheckOptions};
use crate::compose::sentences;
use crate::course::{CourseNode, CourseTree, NodeHit};
use crate::error::Result;
use crate::llm::{Llm, LlmRequest, complete_json};
use crate::normalize::{self, normalize_ws};
use crate::retrieval::SearchOptions;
use crate::segments::Segment;
use crate::tools::RangeTable;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;
use std::time::Instant;

/// One message of the conversation, as the host keeps it (plain text).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    /// `learner` or `instructor`.
    pub who: String,
    pub text: String,
}

/// What the host knows about the learner.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Learner {
    #[serde(default)]
    pub role: Option<String>,
    /// Mastery per skill id, 0..1, from the practice engine.
    #[serde(default)]
    pub mastery: BTreeMap<String, f64>,
    #[serde(default)]
    pub exam_id: Option<String>,
    #[serde(default)]
    pub exam_date: Option<String>,
    /// Recent practice answers, newest last.
    #[serde(default)]
    pub recent: Vec<Answered>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Answered {
    pub q_id: String,
    /// The choice index the learner picked.
    pub chosen: usize,
}

/// A tree move a follow-up can name; answered with no model call.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Input {
    /// Show a node: the named texts (all written ones when empty).
    Open {
        node_id: String,
        #[serde(default, skip_serializing_if = "Vec::is_empty")]
        fields: Vec<String>,
    },
    /// The rule paragraphs at a node.
    Rules { node_id: String },
    /// An inline practice question on a skill.
    Practice { skill_id: String },
    /// Where to focus, from mastery and the exam weights.
    Focus,
}

/// What the learner sent: free text (`ask`) or a tree move (`input`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurnRequest {
    #[serde(default)]
    pub history: Vec<Message>,
    #[serde(default)]
    pub learner: Learner,
    /// The node the conversation is at (the previous turn's `at`).
    #[serde(default)]
    pub at: Option<String>,
    #[serde(default)]
    pub ask: Option<String>,
    #[serde(default)]
    pub input: Option<Input>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Crumb {
    pub node_id: String,
    pub level: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NodeText {
    /// `summary` | `hard` | `mistakes` | `exam`.
    pub field: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FocusItem {
    pub node_id: String,
    pub title: String,
    pub domain: String,
    /// The domain's share of the exam.
    pub weight: f64,
    /// `None` when not practised yet.
    pub mastery: Option<f64>,
}

/// One block of a turn (CONTRACT "Instructor turns").
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "t", rename_all = "snake_case")]
pub enum Block {
    /// Prose: the model's, checked; or engine text.
    Text {
        text: String,
    },
    /// Verbatim rule text, copied from the pack and checked.
    Quote {
        section_id: String,
        text: String,
    },
    Cite {
        section_id: String,
    },
    /// Prebaked course-tree text, shown as written.
    Node {
        node_id: String,
        level: String,
        title: String,
        path: Vec<Crumb>,
        texts: Vec<NodeText>,
    },
    /// The exam's domains and weights, rendered from the blueprint.
    Exam {
        exam_id: String,
    },
    Lesson {
        lesson_id: String,
    },
    /// The host fills aspect, duration and poster from its media catalog.
    Film {
        film_id: String,
        node_id: String,
    },
    Diagram {
        diagram_id: String,
    },
    /// Inline practice; with `chosen`, a review of the learner's answer.
    Question {
        q_id: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        chosen: Option<usize>,
    },
    Focus {
        items: Vec<FocusItem>,
    },
    /// `clearance` | `load-chart` | `signals`; the host's tool.
    Tool {
        tool: String,
        #[serde(default, skip_serializing_if = "Value::is_null")]
        input: Value,
    },
    /// The grouped rule results for a query (the host runs the search).
    Search {
        query: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FollowUp {
    pub label: String,
    /// Sends a learner turn with this text.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ask: Option<String>,
    /// Opens a route.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to: Option<String>,
    /// A tree move, answered with no model call.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub input: Option<Input>,
}

impl FollowUp {
    fn input(label: impl Into<String>, input: Input) -> Self {
        Self {
            label: label.into(),
            ask: None,
            to: None,
            input: Some(input),
        }
    }
}

/// For the audit log; never rendered.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Trace {
    #[serde(default)]
    pub intent: Option<String>,
    #[serde(default)]
    pub node_hits: Vec<String>,
    #[serde(default)]
    pub rule_hits: Vec<String>,
    /// `say` sentences removed, with why.
    #[serde(default)]
    pub dropped: Vec<String>,
    #[serde(default)]
    pub model_error: Option<String>,
    #[serde(default)]
    pub elapsed_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Turn {
    /// Always `instructor` from the core.
    pub who: String,
    /// `done` from the core (it emits whole turns).
    pub status: String,
    pub blocks: Vec<Block>,
    pub follow_ups: Vec<FollowUp>,
    pub model: Option<String>,
    /// The node the conversation is at after this turn.
    #[serde(default)]
    pub at: Option<String>,
    #[serde(default)]
    pub trace: Trace,
}

impl Turn {
    /// The turn as plain text, for the host's history.
    pub fn plain(&self) -> String {
        let mut out = Vec::new();
        for b in &self.blocks {
            match b {
                Block::Text { text } => out.push(text.clone()),
                Block::Quote { text, .. } => out.push(format!("\u{201C}{text}\u{201D}")),
                Block::Node { title, texts, .. } => {
                    out.push(title.clone());
                    out.extend(texts.iter().map(|t| t.text.clone()));
                }
                Block::Exam { exam_id } => out.push(format!("[exam {exam_id}]")),
                Block::Lesson { lesson_id } => out.push(format!("[lesson {lesson_id}]")),
                Block::Film { film_id, .. } => out.push(format!("[film {film_id}]")),
                Block::Question { q_id, .. } => out.push(format!("[question {q_id}]")),
                Block::Focus { items } => out.push(format!(
                    "[focus: {}]",
                    items
                        .iter()
                        .map(|i| i.title.as_str())
                        .collect::<Vec<_>>()
                        .join("; ")
                )),
                Block::Tool { tool, .. } => out.push(format!("[tool {tool}]")),
                Block::Search { query } => out.push(format!("[rules search: {query}]")),
                Block::Cite { .. } | Block::Diagram { .. } => {}
            }
        }
        out.join("\n")
    }

    fn new(blocks: Vec<Block>, follow_ups: Vec<FollowUp>, at: Option<String>) -> Self {
        Self {
            who: "instructor".into(),
            status: "done".into(),
            blocks,
            follow_ups,
            model: None,
            at,
            trace: Trace::default(),
        }
    }
}

const FIELDS: &[&str] = &["summary", "hard", "mistakes", "exam"];
const INTENTS: &[&str] = &[
    "node",
    "rule",
    "focus",
    "review",
    "practice",
    "tool",
    "chat",
    "out_of_scope",
    "clarify",
];
const TOOLS: &[&str] = &["clearance", "load-chart", "signals"];

fn field_of<'a>(n: &'a CourseNode, f: &str) -> &'a str {
    match f {
        "summary" => &n.summary,
        "hard" => &n.hard,
        "mistakes" => &n.mistakes,
        "exam" => &n.exam,
        _ => "",
    }
}

fn crumb(n: &CourseNode) -> Crumb {
    Crumb {
        node_id: n.node_id.clone(),
        level: n.level.clone(),
        title: n.title.clone(),
    }
}

fn skill_id(n: &CourseNode) -> &str {
    n.node_id.trim_start_matches("skill:")
}

/// Words that make a sentence a statement of what a rule requires.
const RULE_WORDS: &[&str] = &[
    "must",
    "shall",
    "required",
    "requires",
    "require",
    "prohibited",
    "prohibits",
    "mandatory",
    "not permitted",
    "not allowed",
    "may not",
    "is permitted",
    "are permitted",
    "is allowed",
    "are allowed",
    "at least",
    "no closer",
    "minimum",
    "maximum",
];

/// True when `sentence` states what a rule requires.
pub fn is_rule_claim(sentence: &str) -> bool {
    let s = format!(
        " {} ",
        sentence
            .to_lowercase()
            .replace(['.', ',', ';', ':', '!', '?', '(', ')'], " ")
    );
    if RULE_WORDS.iter().any(|w| s.contains(&format!(" {w} "))) {
        return true;
    }
    // "You have to read the chart" teaches; "you have to be certified"
    // states a duty: a soft modal counts with a duty word beside it.
    SOFT_MODALS.iter().any(|w| s.contains(&format!(" {w} ")))
        && DUTY_STEMS
            .iter()
            .any(|d| s.split_whitespace().any(|t| t.starts_with(d)))
}

const SOFT_MODALS: &[&str] = &[
    "have to", "has to", "need to", "needs to", "got to", "gotta",
];
/// Word starts that make a soft modal a duty.
const DUTY_STEMS: &[&str] = &[
    "certif", "qualif", "inspect", "permit", "osha", "rule", "law", "legal", "regulat", "requir",
    "employer", "document", "train", "authoriz", "approv", "licens",
];

fn numbers(text: &str) -> Vec<String> {
    normalize::tokens(text)
        .into_iter()
        .filter(|t| t.chars().next().is_some_and(|c| c.is_ascii_digit()))
        .collect()
}

/// A rule passage shown to the model, addressable as `r<n>.<s>`.
struct Passage {
    section_id: String,
    sentences: Vec<String>,
}

#[derive(Deserialize, Default)]
struct Plan {
    #[serde(default)]
    intent: String,
    #[serde(default)]
    node_id: Option<String>,
    #[serde(default)]
    fields: Vec<String>,
    #[serde(default)]
    show: Vec<String>,
    #[serde(default)]
    evidence: Vec<String>,
    #[serde(default)]
    say: String,
    #[serde(default)]
    tool: Option<String>,
    #[serde(default)]
    kv: Option<f64>,
    #[serde(default)]
    traveling: Option<bool>,
    #[serde(default)]
    search: Option<String>,
}

fn plan_schema() -> Value {
    let n = |t: &str| json!({"type": [t, "null"]});
    json!({
        "type": "object",
        "properties": {
            "intent": {"type": "string", "enum": INTENTS},
            "node_id": n("string"),
            "fields": {"type": "array", "items": {"type": "string", "enum": FIELDS}},
            "show": {"type": "array", "items": {"type": "string"}},
            "evidence": {"type": "array", "items": {"type": "string"}},
            "say": {"type": "string"},
            "tool": {"type": ["string", "null"], "enum": [TOOLS[0], TOOLS[1], TOOLS[2], null]},
            "kv": n("number"),
            "traveling": n("boolean"),
            "search": n("string")
        },
        "required": ["intent", "node_id", "fields", "show", "evidence", "say", "tool", "kv", "traveling", "search"],
        "additionalProperties": false
    })
}

pub struct Instructor {
    pub engine: Arc<Engine>,
    pub llm: Option<Arc<dyn Llm>>,
    pub tree: CourseTree,
    /// The course's name in the prompt.
    pub course_title: String,
}

impl Instructor {
    pub fn new(engine: Arc<Engine>, llm: Option<Arc<dyn Llm>>, tree: CourseTree) -> Self {
        let course_title = tree
            .root()
            .map(|n| n.title.clone())
            .unwrap_or_else(|| "the course".into());
        Self {
            engine,
            llm,
            tree,
            course_title,
        }
    }

    fn exam(&self, learner: &Learner) -> Option<&Value> {
        let exams = self.tree.exams.as_array()?;
        learner
            .exam_id
            .as_deref()
            .and_then(|id| exams.iter().find(|e| e["id"].as_str() == Some(id)))
            .or_else(|| exams.first())
    }

    /// The opening turn: the pack's `instructor_welcome` (blocks checked as
    /// any turn's), else the course and exam overview from the tree.
    pub fn welcome(&self, learner: &Learner) -> Result<Turn> {
        if let Some(raw) = self.engine.pack.meta("instructor_welcome") {
            let mut t: Turn = serde_json::from_str(raw).map_err(|e| {
                crate::error::Error::Pack(format!("pack_meta.instructor_welcome: {e}"))
            })?;
            t.blocks = self.checked(t.blocks, &mut t.trace);
            t.who = "instructor".into();
            t.status = "done".into();
            if t.at.is_none() {
                t.at = self.tree.root().map(|r| r.node_id.clone());
            }
            return Ok(t);
        }
        let mut blocks = Vec::new();
        let mut follow = Vec::new();
        if let Some(root) = self.tree.root()
            && root.has_text()
        {
            blocks.push(self.node_block(root, &[]));
        }
        if let Some(e) = self.exam(learner) {
            let id = e["id"].as_str().unwrap_or_default();
            blocks.push(Block::Exam {
                exam_id: id.to_string(),
            });
            let eid = format!("exam:{id}");
            if let Some(n) = self.tree.node(&eid)
                && n.has_text()
            {
                blocks.push(self.node_block(n, &[]));
            }
            for d in self.tree.children(&eid) {
                follow.push(FollowUp::input(
                    d.title.clone(),
                    Input::Open {
                        node_id: d.node_id.clone(),
                        fields: Vec::new(),
                    },
                ));
            }
        }
        if let Some(root) = self.tree.root()
            && !root.hard.is_empty()
        {
            follow.insert(
                0,
                FollowUp::input(
                    "What's hardest?",
                    Input::Open {
                        node_id: root.node_id.clone(),
                        fields: vec!["hard".into()],
                    },
                ),
            );
        }
        if !learner.mastery.is_empty() {
            follow.push(FollowUp::input("What should I focus on?", Input::Focus));
        }
        Ok(Turn::new(
            blocks,
            follow,
            self.tree.root().map(|n| n.node_id.clone()),
        ))
    }

    /// Re-check blocks that came from outside the engine: quotes verbatim,
    /// cites and links to rows that exist.
    fn checked(&self, blocks: Vec<Block>, trace: &mut Trace) -> Vec<Block> {
        let pack = &self.engine.pack;
        blocks
            .into_iter()
            .filter(|b| {
                let ok = match b {
                    Block::Quote { section_id, text } => pack
                        .section(section_id)
                        .ok()
                        .flatten()
                        .is_some_and(|s| check::quote_in(text, &s.text)),
                    Block::Cite { section_id } => pack.section_exists(section_id).unwrap_or(false),
                    Block::Lesson { lesson_id } => pack.lesson(lesson_id).ok().flatten().is_some(),
                    Block::Diagram { diagram_id } => {
                        pack.diagram(diagram_id).ok().flatten().is_some()
                    }
                    Block::Question { q_id, .. } => pack.question(q_id).ok().flatten().is_some(),
                    Block::Node { node_id, .. } => self.tree.node(node_id).is_some(),
                    _ => true,
                };
                if !ok {
                    trace.dropped.push(format!("welcome block: {b:?}"));
                }
                ok
            })
            .collect()
    }

    /// One turn.
    pub fn turn(&self, req: &TurnRequest) -> Result<Turn> {
        let started = Instant::now();
        let mut t = match (&req.input, &req.ask) {
            (Some(Input::Open { node_id, fields }), _) => self.open(node_id, fields, &req.learner),
            (Some(Input::Rules { node_id }), _) => self.rules_at(node_id),
            (Some(Input::Practice { skill_id }), _) => self.practice(skill_id, &req.learner),
            (Some(Input::Focus), _) => self.focus(&req.learner),
            (None, Some(text)) => self.say(req, text)?,
            (None, None) => self.welcome(&req.learner)?,
        };
        t.trace.elapsed_ms = started.elapsed().as_millis() as u64;
        Ok(t)
    }

    fn node_block(&self, n: &CourseNode, fields: &[String]) -> Block {
        let want: Vec<&str> = if fields.is_empty() {
            FIELDS.to_vec()
        } else {
            fields.iter().map(String::as_str).collect()
        };
        let mut texts: Vec<NodeText> = want
            .iter()
            .filter(|f| !field_of(n, f).is_empty())
            .map(|f| NodeText {
                field: f.to_string(),
                text: field_of(n, f).to_string(),
            })
            .collect();
        if texts.is_empty() && !n.summary.is_empty() {
            texts.push(NodeText {
                field: "summary".into(),
                text: n.summary.clone(),
            });
        }
        Block::Node {
            node_id: n.node_id.clone(),
            level: n.level.clone(),
            title: n.title.clone(),
            path: self
                .tree
                .path(&n.node_id)
                .iter()
                .map(|p| crumb(p))
                .collect(),
            texts,
        }
    }

    fn quote_cite(&self, section_id: &str, quote: &str) -> Option<[Block; 2]> {
        let sec = self.engine.pack.section(section_id).ok()??;
        check::quote_in(quote, &sec.text).then(|| {
            [
                Block::Quote {
                    section_id: section_id.to_string(),
                    text: quote.to_string(),
                },
                Block::Cite {
                    section_id: section_id.to_string(),
                },
            ]
        })
    }

    /// The node's rule quotes, each with its cite.
    fn node_quotes(&self, n: &CourseNode) -> Vec<Block> {
        n.quotes
            .iter()
            .filter_map(|q| self.quote_cite(&q.section_id, &q.quote))
            .flatten()
            .collect()
    }

    /// A practice question on a skill: the first the learner has not just answered.
    fn question_for(&self, n: &CourseNode, learner: &Learner) -> Option<Block> {
        let recent: BTreeSet<&str> = learner.recent.iter().map(|a| a.q_id.as_str()).collect();
        n.links
            .q_ids
            .iter()
            .find(|q| !recent.contains(q.as_str()))
            .or(n.links.q_ids.first())
            .map(|q| Block::Question {
                q_id: q.clone(),
                chosen: None,
            })
    }

    /// Films, diagrams and lessons linked from a node (all of them, or the
    /// ids in `only`; `practice` there means an inline question).
    fn linked(&self, n: &CourseNode, only: Option<&[String]>, learner: &Learner) -> Vec<Block> {
        let pick = |id: &str| only.is_none_or(|o| o.iter().any(|x| x == id));
        let mut out = Vec::new();
        for f in &n.links.film_ids {
            if pick(f) {
                out.push(Block::Film {
                    film_id: f.clone(),
                    node_id: n.node_id.clone(),
                });
            }
        }
        for d in n.links.diagram_ids.iter().take(2) {
            if pick(d) {
                out.push(Block::Diagram {
                    diagram_id: d.clone(),
                });
            }
        }
        let lessons = if only.is_some() { 4 } else { 1 };
        for l in n.links.lesson_ids.iter().filter(|l| pick(l)).take(lessons) {
            out.push(Block::Lesson {
                lesson_id: l.clone(),
            });
        }
        if only.is_some_and(|o| o.iter().any(|x| x == "practice"))
            && let Some(q) = self.question_for(n, learner)
        {
            out.push(q);
        }
        out
    }

    /// Follow-ups after showing node `n` with `shown` texts.
    fn next_steps(&self, n: &CourseNode, shown: &[String]) -> Vec<FollowUp> {
        let mut out = Vec::new();
        let labels = [
            ("hard", "What's hard here?"),
            ("mistakes", "What do people get wrong?"),
            ("exam", "What does the exam ask?"),
        ];
        for (f, label) in labels {
            if !field_of(n, f).is_empty() && !shown.iter().any(|s| s == f) {
                out.push(FollowUp::input(
                    label,
                    Input::Open {
                        node_id: n.node_id.clone(),
                        fields: vec![f.into()],
                    },
                ));
            }
        }
        for c in self.tree.children(&n.node_id).into_iter().take(4) {
            out.push(FollowUp::input(
                c.title.clone(),
                Input::Open {
                    node_id: c.node_id.clone(),
                    fields: Vec::new(),
                },
            ));
        }
        if !n.section_ids.is_empty() || !n.quotes.is_empty() {
            out.push(FollowUp::input(
                "Show me the rule",
                Input::Rules {
                    node_id: n.node_id.clone(),
                },
            ));
        }
        if n.level == "skill" && !n.links.q_ids.is_empty() {
            out.push(FollowUp::input(
                "Practice this",
                Input::Practice {
                    skill_id: skill_id(n).to_string(),
                },
            ));
        }
        if let Some(p) = n.parent_id.as_deref().and_then(|p| self.tree.node(p)) {
            out.push(FollowUp::input(
                format!("Back to {}", p.title),
                Input::Open {
                    node_id: p.node_id.clone(),
                    fields: Vec::new(),
                },
            ));
        }
        out
    }

    fn open(&self, node_id: &str, fields: &[String], learner: &Learner) -> Turn {
        let Some(n) = self.tree.node(node_id) else {
            return self.lost(node_id);
        };
        let nb = self.node_block(n, fields);
        let shown: Vec<String> = match &nb {
            Block::Node { texts, .. } => texts.iter().map(|t| t.field.clone()).collect(),
            _ => Vec::new(),
        };
        let mut blocks = vec![nb];
        blocks.extend(self.node_quotes(n));
        if fields.is_empty() {
            blocks.extend(self.linked(n, None, learner));
        }
        Turn::new(
            blocks,
            self.next_steps(n, &shown),
            Some(node_id.to_string()),
        )
    }

    fn lost(&self, node_id: &str) -> Turn {
        let root = self.tree.root();
        Turn::new(
            vec![Block::Text {
                text: format!("That part of the course ({node_id}) is not in this pack."),
            }],
            root.map(|r| self.next_steps(r, &[])).unwrap_or_default(),
            root.map(|r| r.node_id.clone()),
        )
    }

    fn rules_at(&self, node_id: &str) -> Turn {
        let Some(n) = self.tree.node(node_id) else {
            return self.lost(node_id);
        };
        let norm = self.engine.retriever().normalize(&n.title);
        let mut blocks: Vec<Block> = self.node_quotes(n);
        for sid in n.section_ids.iter().take(3) {
            if let Ok(Some(sec)) = self.engine.pack.section(sid) {
                let passage = best_passage(&sec.text, &norm.concepts, 600);
                let dup = blocks
                    .iter()
                    .any(|b| matches!(b, Block::Quote { text, .. } if text == &passage));
                if !passage.is_empty()
                    && !dup
                    && let Some(qc) = self.quote_cite(sid, &passage)
                {
                    blocks.extend(qc);
                }
            }
        }
        let all: Vec<String> = FIELDS.iter().map(|s| s.to_string()).collect();
        let follow = self
            .next_steps(n, &all)
            .into_iter()
            .filter(|f| !matches!(f.input, Some(Input::Rules { .. })))
            .collect();
        Turn::new(blocks, follow, Some(node_id.to_string()))
    }

    fn practice(&self, skill: &str, learner: &Learner) -> Turn {
        let nid = format!("skill:{skill}");
        let Some(n) = self.tree.node(&nid) else {
            return self.lost(&nid);
        };
        let blocks = self.question_for(n, learner).into_iter().collect();
        let mut follow: Vec<FollowUp> = self
            .next_steps(n, &[])
            .into_iter()
            .filter(|f| !matches!(f.input, Some(Input::Practice { .. })))
            .collect();
        follow.insert(
            0,
            FollowUp {
                label: "More practice".into(),
                ask: None,
                to: Some(format!("/practice/skill/{skill}")),
                input: None,
            },
        );
        Turn::new(blocks, follow, Some(nid))
    }

    /// The skills worth the most exam points the learner has not mastered:
    /// domain weight × (1 − mastery), unpractised skills at mastery 0.3.
    fn focus_items(&self, learner: &Learner, k: usize) -> Vec<FocusItem> {
        let Some(e) = self.exam(learner) else {
            return Vec::new();
        };
        let mut items: Vec<(f64, FocusItem)> = Vec::new();
        let mut seen = BTreeSet::new();
        for d in e["domains"].as_array().into_iter().flatten() {
            let weight = d["weight"].as_f64().unwrap_or(0.0);
            let did = format!("domain:{}", d["id"].as_str().unwrap_or_default());
            let skills = self.tree.children(&did);
            let n_skills = skills.len().max(1) as f64;
            for s in skills {
                if s.level != "skill" || !seen.insert(s.node_id.clone()) {
                    continue;
                }
                let m = learner.mastery.get(skill_id(s)).copied();
                let score = weight / n_skills.sqrt() * (1.0 - m.unwrap_or(0.3));
                items.push((
                    score,
                    FocusItem {
                        node_id: s.node_id.clone(),
                        title: s.title.clone(),
                        domain: d["title"].as_str().unwrap_or_default().to_string(),
                        weight,
                        mastery: m,
                    },
                ));
            }
        }
        items.sort_by(|a, b| {
            b.0.total_cmp(&a.0)
                .then_with(|| a.1.node_id.cmp(&b.1.node_id))
        });
        items.into_iter().take(k).map(|(_, i)| i).collect()
    }

    fn focus(&self, learner: &Learner) -> Turn {
        let items = self.focus_items(learner, 5);
        let follow = items
            .iter()
            .take(3)
            .map(|i| {
                FollowUp::input(
                    i.title.clone(),
                    Input::Open {
                        node_id: i.node_id.clone(),
                        fields: Vec::new(),
                    },
                )
            })
            .collect();
        Turn::new(vec![Block::Focus { items }], follow, None)
    }

    fn system(&self) -> String {
        format!(
            "You are the instructor in an offline course app: {title}. The app shows prebaked \
             course text, rule quotes, lessons, films and practice; you understand what the \
             learner wants, pick what to show, and add a short, warm line that connects it to \
             their words. Learners write messy, misspelled, slangy messages; work out the meaning.\n\
             Reply with JSON:\n\
             - intent: node (show a course node), rule (answer what a rule requires from the rule \
             passages), focus (study priorities from their mastery), review (explain their last \
             practice answer), practice (an inline practice question on a skill node), tool (a \
             calculator: clearance needs kv), chat (greeting, thanks, nerves), out_of_scope (not \
             in this course: other countries, other machines, legal advice or fines, the text of \
             private standards), clarify (ask one short question).\n\
             - node_id: the best node from `nodes` (or the current node), else null.\n\
             - fields: which node texts to show: summary, hard, mistakes, exam. Empty = all.\n\
             - show: ids from the node's links to show (a film, lesson, diagram, or \"practice\").\n\
             - evidence: handles of rule sentences (like \"r1.2\") that state the rule you talk \
             about. Use them for any requirement, distance, limit or interval.\n\
             - say: 1 to 3 short sentences, plain words. Never state a rule, number or \
             requirement unless its sentence is in evidence; the app drops any that is not. If \
             nothing fits, say so honestly and point to what the course covers.\n\
             - tool, kv, traveling: for intent tool.\n\
             - search: a better search for the rules index if `rules` miss, else null.",
            title = self.course_title,
        )
    }

    fn say(&self, req: &TurnRequest, text: &str) -> Result<Turn> {
        let r = self.engine.retriever();
        let mut trace = Trace::default();
        let at = req.at.as_deref().and_then(|a| self.tree.node(a));
        let node_hits = self.tree.search(&r, text, 5)?;
        trace.node_hits = node_hits.iter().map(|h| h.node_id.clone()).collect();
        let mut passages: Vec<Passage> = Vec::new();
        self.add_rules(text, &mut passages, &mut trace)?;
        let review = self.review(&req.learner);
        if let Some((_, sids, _)) = &review {
            for sid in sids.iter().take(2) {
                self.add_section(sid, text, &mut passages)?;
            }
        }
        let Some(llm) = &self.llm else {
            return Ok(self.model_off(text, &node_hits, trace));
        };

        let mut plan = Plan::default();
        for step in 0..2 {
            let user = self.prompt(
                req,
                text,
                at,
                &node_hits,
                &passages,
                review.as_ref().map(|r| &r.2),
            );
            let req_llm = LlmRequest {
                system: self.system(),
                user,
                schema: ("instructor_turn".into(), plan_schema()),
                max_tokens: 500,
                temperature: 0.2,
            };
            match complete_json::<Plan>(llm.as_ref(), &req_llm) {
                Ok(p) => plan = p,
                Err(e) => {
                    trace.model_error = Some(e.to_string());
                    let mut t = self.model_off(text, &node_hits, trace);
                    t.model = Some(llm.id());
                    return Ok(t);
                }
            }
            match plan.search.as_deref().map(str::trim) {
                Some(q) if step == 0 && !q.is_empty() && plan.evidence.is_empty() => {
                    self.add_rules(q, &mut passages, &mut trace)?;
                }
                _ => break,
            }
        }
        trace.intent = Some(plan.intent.clone());
        let mut t = self.build(req, text, plan, &passages, review, trace);
        t.model = Some(llm.id());
        Ok(t)
    }

    /// The learner's last practice answer: the block, its rule sections, and
    /// what the model sees.
    fn review(&self, learner: &Learner) -> Option<(Block, Vec<String>, Value)> {
        let a = learner.recent.last()?;
        let q = match self.engine.pack.question(&a.q_id) {
            Ok(Some(q)) => q,
            Ok(None) => return None,
            Err(e) => {
                eprintln!("harvest: instructor: question {}: {e}", a.q_id);
                return None;
            }
        };
        let seen = json!({
            "question": q.stem,
            "chose": q.choices.get(a.chosen),
            "correct": q.answer.parse::<usize>().ok().and_then(|i| q.choices.get(i)),
            "why_theirs_is_wrong_or_right": q.rationales.get(a.chosen),
            "why_correct": q.answer.parse::<usize>().ok().and_then(|i| q.rationales.get(i)),
        });
        Some((
            Block::Question {
                q_id: q.q_id,
                chosen: Some(a.chosen),
            },
            q.section_ids,
            seen,
        ))
    }

    fn add_rules(&self, query: &str, passages: &mut Vec<Passage>, trace: &mut Trace) -> Result<()> {
        let hits = self
            .engine
            .retriever()
            .search(
                query,
                &SearchOptions {
                    k: 10,
                    ..SearchOptions::default()
                },
            )?
            .hits;
        let mut added = 0;
        for h in hits {
            if added >= 4 {
                break;
            }
            let Some(sid) = h.section_id else { continue };
            if self.add_section(&sid, query, passages)? {
                trace.rule_hits.push(sid);
                added += 1;
            }
        }
        Ok(())
    }

    fn add_section(&self, sid: &str, query: &str, passages: &mut Vec<Passage>) -> Result<bool> {
        if passages.iter().any(|p| p.section_id == sid) {
            return Ok(false);
        }
        let Some(sec) = self.engine.pack.section(sid)? else {
            return Ok(false);
        };
        let norm = self.engine.retriever().normalize(query);
        let ss = sentences(&best_passage(&sec.text, &norm.concepts, 600));
        if ss.is_empty() {
            return Ok(false);
        }
        passages.push(Passage {
            section_id: sid.to_string(),
            sentences: ss,
        });
        Ok(true)
    }

    fn prompt(
        &self,
        req: &TurnRequest,
        text: &str,
        at: Option<&CourseNode>,
        node_hits: &[NodeHit],
        passages: &[Passage],
        review: Option<&Value>,
    ) -> String {
        let brief = |n: &CourseNode| {
            let path: Vec<String> = self
                .tree
                .path(&n.node_id)
                .iter()
                .map(|p| p.title.clone())
                .collect();
            let mut links: Vec<String> = n.links.film_ids.clone();
            links.extend(n.links.lesson_ids.iter().take(3).cloned());
            links.extend(n.links.diagram_ids.iter().take(2).cloned());
            if !n.links.q_ids.is_empty() {
                links.push("practice".into());
            }
            json!({
                "node_id": n.node_id,
                "level": n.level,
                "path": path.join(" > "),
                "summary": n.summary.chars().take(220).collect::<String>(),
                "written": FIELDS.iter().filter(|f| !field_of(n, f).is_empty()).collect::<Vec<_>>(),
                "links": links,
            })
        };
        let mut nodes: Vec<Value> = Vec::new();
        if let Some(a) = at {
            let kids: Vec<Value> = self
                .tree
                .children(&a.node_id)
                .iter()
                .take(8)
                .map(|c| json!({"node_id": c.node_id, "title": c.title}))
                .collect();
            nodes.push(json!({"current": brief(a), "children": kids}));
        }
        for h in node_hits {
            if let Some(n) = self.tree.node(&h.node_id)
                && at.is_none_or(|a| a.node_id != n.node_id)
            {
                nodes.push(brief(n));
            }
        }
        let rules: Vec<Value> = passages
            .iter()
            .enumerate()
            .map(|(i, p)| {
                let cite = self
                    .engine
                    .pack
                    .section(&p.section_id)
                    .ok()
                    .flatten()
                    .map(|s| s.citation)
                    .unwrap_or_default();
                let ss: Vec<Value> = p
                    .sentences
                    .iter()
                    .enumerate()
                    .map(|(j, s)| json!({"h": format!("r{}.{}", i + 1, j + 1), "text": s}))
                    .collect();
                json!({"citation": cite, "sentences": ss})
            })
            .collect();
        let history: Vec<Value> = req
            .history
            .iter()
            .rev()
            .take(6)
            .rev()
            .map(|m| json!({"who": m.who, "text": m.text.chars().take(500).collect::<String>()}))
            .collect();
        let mut learner = json!({
            "role": req.learner.role,
            "exam_date": req.learner.exam_date,
            "skills_practised": req.learner.mastery.len(),
        });
        if !req.learner.mastery.is_empty() {
            learner["focus"] = json!(
                self.focus_items(&req.learner, 5)
                    .iter()
                    .map(|i| json!({"node_id": i.node_id, "title": i.title, "mastery": i.mastery}))
                    .collect::<Vec<_>>()
            );
        }
        if let Some(r) = review {
            learner["last_answer"] = r.clone();
        }
        json!({
            "exam": self.exam(&req.learner).map(exam_brief),
            "learner": learner,
            "conversation": history,
            "message": text,
            "nodes": nodes,
            "rules": rules,
        })
        .to_string()
    }

    /// No model: the best tree node when the words match one, else a rules search.
    fn model_off(&self, text: &str, node_hits: &[NodeHit], trace: Trace) -> Turn {
        let mut t = match node_hits.first() {
            Some(h) if h.lexical > 0.0 => self.open(&h.node_id, &[], &Learner::default()),
            _ => Turn::new(
                vec![Block::Search {
                    query: text.to_string(),
                }],
                self.tree
                    .root()
                    .map(|r| self.next_steps(r, &[]))
                    .unwrap_or_default(),
                None,
            ),
        };
        t.trace = trace;
        t
    }

    fn build(
        &self,
        req: &TurnRequest,
        text: &str,
        plan: Plan,
        passages: &[Passage],
        review: Option<(Block, Vec<String>, Value)>,
        mut trace: Trace,
    ) -> Turn {
        let node = plan
            .node_id
            .as_deref()
            .and_then(|id| self.tree.node(id))
            .or_else(|| match plan.intent.as_str() {
                "node" | "practice" => req.at.as_deref().and_then(|a| self.tree.node(a)),
                _ => None,
            });
        let mut blocks: Vec<Block> = Vec::new();
        let mut at = req.at.clone();
        let mut follow = Vec::new();
        // What `say` may take numbers from without a rule: the blueprint and
        // the prebaked text shown in this turn.
        let mut context = self
            .exam(&req.learner)
            .map(|e| {
                // Weights as the percentages people say.
                let pct: Vec<String> = e["domains"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(|d| d["weight"].as_f64())
                    .map(|w| format!("{}", (w * 100.0).round()))
                    .collect();
                // Counts people say: domains in the exam, exams and topics.
                let n_domains = e["domains"].as_array().map_or(0, Vec::len);
                let n_exams = self.tree.exams.as_array().map_or(0, Vec::len);
                let n_topics = self
                    .tree
                    .nodes
                    .iter()
                    .filter(|n| n.level == "topic")
                    .count();
                format!("{e} {} {n_domains} {n_exams} {n_topics}", pct.join(" "))
            })
            .unwrap_or_default();

        match plan.intent.as_str() {
            "node" | "practice" if node.is_some() => {
                let n = node.unwrap();
                let fields: Vec<String> = plan
                    .fields
                    .iter()
                    .filter(|f| FIELDS.contains(&f.as_str()))
                    .cloned()
                    .collect();
                let nb = self.node_block(n, &fields);
                let shown: Vec<String> = match &nb {
                    Block::Node { texts, .. } => texts.iter().map(|t| t.field.clone()).collect(),
                    _ => Vec::new(),
                };
                context.push_str(&n.text());
                blocks.push(nb);
                blocks.extend(self.node_quotes(n));
                let mut only = plan.show.clone();
                if plan.intent == "practice" && !only.iter().any(|s| s == "practice") {
                    only.push("practice".into());
                }
                blocks.extend(self.linked(
                    n,
                    if only.is_empty() { None } else { Some(&only) },
                    &req.learner,
                ));
                follow = self.next_steps(n, &shown);
                at = Some(n.node_id.clone());
            }
            "focus" => {
                let t = self.focus(&req.learner);
                for b in &t.blocks {
                    if let Block::Focus { items } = b {
                        context.push_str(&serde_json::to_string(items).unwrap_or_default());
                    }
                }
                blocks.extend(t.blocks);
                follow = t.follow_ups;
            }
            "review" if review.is_some() => {
                let (b, _, seen) = review.unwrap();
                context.push_str(&seen.to_string());
                blocks.push(b);
            }
            "tool" => {
                blocks.extend(self.tool_blocks(plan.tool.as_deref(), plan.kv, plan.traveling))
            }
            _ => {}
        }

        // A range table among the rules and a value in its unit in the
        // learner's words: the row for that value leads (like the answer
        // engine's table tool), instead of the whole table.
        let table = matches!(plan.intent.as_str(), "rule" | "tool")
            .then(|| self.table_rows(text, passages))
            .flatten();
        let skip: Option<String> = table.as_ref().map(|(sid, _)| sid.clone());
        // Rule sentences the model named: copied from the pack, runs merged.
        let (mut rule_blocks, mut sources) =
            self.evidence_blocks(&plan.evidence, passages, skip.as_deref());
        if let Some((_, segs)) = table {
            let mut tb = Vec::new();
            for s in segs {
                match s {
                    Segment::Text { text } => tb.push(Block::Text { text }),
                    Segment::Quote { section_id, text } => {
                        sources.push(Segment::quote(section_id.clone(), text.clone()));
                        tb.push(Block::Quote { section_id, text })
                    }
                    Segment::Cite { section_id } => {
                        sources.push(Segment::cite(section_id.clone()));
                        tb.push(Block::Cite { section_id })
                    }
                    Segment::Diagram { diagram_id } => tb.push(Block::Diagram { diagram_id }),
                }
            }
            tb.append(&mut rule_blocks);
            rule_blocks = tb;
        }
        let said = self.check_say(&plan.say, &sources, &context, &mut trace);
        let has_rules = !rule_blocks.is_empty();
        if let Some(s) = said {
            blocks.insert(0, Block::Text { text: s });
        }
        blocks.extend(rule_blocks);
        if plan.intent == "rule" && !has_rules {
            // Unsure: show what the rules search finds rather than guess.
            blocks.push(Block::Search {
                query: plan
                    .search
                    .clone()
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or_else(|| text.to_string()),
            });
        }
        if follow.is_empty()
            && let Some(b) = at
                .as_deref()
                .and_then(|a| self.tree.node(a))
                .or_else(|| self.tree.root())
        {
            follow = self.next_steps(b, &[]);
        }
        follow.truncate(6);
        let mut t = Turn::new(blocks, follow, at);
        t.trace = trace;
        t
    }

    /// The first range table among the passages with a value from `text`
    /// in its unit: its section and the checked answer segments.
    fn table_rows(&self, text: &str, passages: &[Passage]) -> Option<(String, Vec<Segment>)> {
        for p in passages {
            let Ok(Some(sec)) = self.engine.pack.section(&p.section_id) else {
                continue;
            };
            if sec.kind != "table" {
                continue;
            }
            let Some(t) = RangeTable::parse(&sec) else {
                continue;
            };
            let Some(&x) = t.values_in(text).first() else {
                continue;
            };
            let caption = sec.heading.clone().unwrap_or_else(|| sec.citation.clone());
            let segs = t.answer(x, &caption)?;
            let (segs, _) =
                check::check(&self.engine.pack, &segs, CheckOptions::STRUCTURAL).ok()?;
            return Some((p.section_id.clone(), segs));
        }
        None
    }

    fn evidence_blocks(
        &self,
        evidence: &[String],
        passages: &[Passage],
        skip: Option<&str>,
    ) -> (Vec<Block>, Vec<Segment>) {
        let mut by_p: BTreeMap<usize, Vec<usize>> = BTreeMap::new();
        for h in evidence {
            let h = h.trim().trim_start_matches(['r', 'p']);
            let Some((p, s)) = h.split_once('.') else {
                continue;
            };
            if let (Ok(p), Ok(s)) = (p.parse::<usize>(), s.parse::<usize>())
                && p >= 1
                && s >= 1
                && p <= passages.len()
                && s <= passages[p - 1].sentences.len()
            {
                by_p.entry(p - 1).or_default().push(s - 1);
            }
        }
        let mut blocks = Vec::new();
        let mut sources = Vec::new();
        for (p, mut idx) in by_p {
            idx.sort_unstable();
            idx.dedup();
            let ss = &passages[p].sentences;
            let sid = &passages[p].section_id;
            if skip == Some(sid.as_str()) {
                continue;
            }
            let mut k = 0;
            let mut any = false;
            while k < idx.len() {
                let mut end = k;
                while end + 1 < idx.len() && idx[end + 1] == idx[end] + 1 {
                    end += 1;
                }
                let quote = ss[idx[k]..=idx[end]].join(" ");
                if let Some([q, _]) = self.quote_cite(sid, &quote) {
                    sources.push(Segment::quote(sid.clone(), quote));
                    blocks.push(q);
                    any = true;
                }
                k = end + 1;
            }
            if any {
                blocks.push(Block::Cite {
                    section_id: sid.clone(),
                });
                sources.push(Segment::cite(sid.clone()));
            }
        }
        (blocks, sources)
    }

    /// The sentences of `say` that hold, joined; `None` when none do.
    fn check_say(
        &self,
        say: &str,
        sources: &[Segment],
        context: &str,
        trace: &mut Trace,
    ) -> Option<String> {
        let ctx: BTreeSet<String> = numbers(context).into_iter().collect();
        let mut kept: Vec<String> = Vec::new();
        for s in sentences(&normalize_ws(say)) {
            if !is_rule_claim(&s) && numbers(&s).iter().all(|n| ctx.contains(n)) {
                kept.push(s);
                continue;
            }
            if sources.is_empty() {
                trace.dropped.push(format!("no rule named: {s}"));
                continue;
            }
            let mut segs = vec![Segment::text(s.clone())];
            segs.extend(sources.iter().cloned());
            match check::check(&self.engine.pack, &segs, CheckOptions::STRICT) {
                Ok((out, _))
                    if out
                        .iter()
                        .any(|x| matches!(x, Segment::Text { text } if text == &s)) =>
                {
                    kept.push(s)
                }
                Ok(_) => trace.dropped.push(format!("not in the quoted rules: {s}")),
                Err(e) => trace.dropped.push(format!("check failed ({e}): {s}")),
            }
        }
        (!kept.is_empty()).then(|| kept.join(" "))
    }

    /// A tool block; for `clearance` with a voltage, the table row it finds
    /// as checked text, quotes and cite.
    fn tool_blocks(
        &self,
        tool: Option<&str>,
        kv: Option<f64>,
        traveling: Option<bool>,
    ) -> Vec<Block> {
        let Some(tool) = tool.filter(|t| TOOLS.contains(t)) else {
            return Vec::new();
        };
        if tool != "clearance" {
            return vec![Block::Tool {
                tool: tool.to_string(),
                input: Value::Null,
            }];
        }
        let traveling = traveling.unwrap_or(false);
        let mut out = vec![Block::Tool {
            tool: "clearance".into(),
            input: json!({"kv": kv, "traveling": traveling}),
        }];
        let Some(kv) = kv else { return out };
        let Ok(sections) = self.engine.pack.sections() else {
            return out;
        };
        for sec in sections.iter().filter(|s| s.kind == "table") {
            let Some(t) = RangeTable::parse(sec) else {
                continue;
            };
            let heading = sec.heading.clone().unwrap_or_default().to_lowercase();
            if t.unit != "kv" || heading.contains("travel") != traveling {
                continue;
            }
            let caption = if traveling {
                "the minimum clearance while traveling with no load is"
            } else {
                "the minimum clearance is"
            };
            if let Some(body) = t.answer(kv, caption)
                && let Ok((body, _)) =
                    check::check(&self.engine.pack, &body, CheckOptions::STRUCTURAL)
            {
                out.extend(body.into_iter().map(|s| match s {
                    Segment::Text { text } => Block::Text { text },
                    Segment::Quote { section_id, text } => Block::Quote { section_id, text },
                    Segment::Cite { section_id } => Block::Cite { section_id },
                    Segment::Diagram { diagram_id } => Block::Diagram { diagram_id },
                }));
                break;
            }
        }
        out
    }
}

fn exam_brief(e: &Value) -> Value {
    let domains: Vec<Value> = e["domains"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|d| json!({"title": d["title"], "weight": d["weight"], "count": d["count"]}))
        .collect();
    json!({"title": e["title"], "minutes": e["minutes"], "domains": domains})
}
