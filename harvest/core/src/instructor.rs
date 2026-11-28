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
    /// The model's plans, as returned (for the audit log and re-checks).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub plans: Vec<Value>,
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
/// What a node shows when no field is named: the overview and the hard part.
const DEFAULT_FIELDS: &[&str] = &["summary", "hard"];
/// Rule quotes a node shows in one turn, the ones not shown before first.
const NODE_QUOTES: usize = 3;
/// The mastery an unpractised skill counts as in the focus list.
const UNPRACTISED: f64 = 0.5;
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
    "forbidden",
    "illegal",
    "banned",
    "not supposed to",
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
            .replace(['\u{2019}', '\u{2018}'], "'")
            .replace(
                [
                    '.', ',', ';', ':', '!', '?', '(', ')', '\u{201C}', '\u{201D}', '"'
                ],
                " "
            )
    );
    if RULE_WORDS.iter().any(|w| s.contains(&format!(" {w} "))) {
        return true;
    }
    // "Assume every line is energized", "lines are presumed energized",
    // "the employer is responsible for ...": duties with no modal.
    let own = [
        " i assume ",
        " i'll assume ",
        " i'd assume ",
        " let's assume ",
        " let me assume ",
        " i'm assuming ",
        " we assume ",
        " you can assume ",
        " you'd assume ",
    ];
    if (s.contains(" assume ") || s.contains(" assumed ")) && !own.iter().any(|w| s.contains(w))
        || [
            " presume ",
            " presumed ",
            " responsible for ",
            " deemed ",
            " treated as ",
            " considered energized ",
        ]
        .iter()
        .any(|w| s.contains(w))
    {
        return true;
    }
    // An instruction about the work ("Keep the boom clear of the line",
    // "Stay out of the swing radius") is a rule told as an order.
    // Softeners before the verb ("please keep", "remember to stay") do not
    // change it; study advice ("keep practicing load charts", "use the
    // clearance tool") is not an order about the work.
    let mut words: Vec<&str> = s.split_whitespace().collect();
    loop {
        let n = match words.as_slice() {
            ["please", ..] | ["just", ..] => 1,
            ["remember", "to", ..] => 2,
            ["be", "sure", "to", ..] | ["make", "sure", "to", ..] | ["make", "sure", "you", ..] => {
                3
            }
            _ => 0,
        };
        if n == 0 {
            break;
        }
        words.drain(..n);
    }
    let study = words
        .iter()
        .any(|w| STUDY_WORDS.iter().any(|x| w.starts_with(x)));
    if !study
        && words.first().is_some_and(|w| IMPERATIVES.contains(w))
        && words
            .iter()
            .any(|w| WORK_WORDS.contains(&w.trim_end_matches('s')))
    {
        return true;
    }
    // "Only a qualified rigger can attach loads."
    if s.contains(" only ")
        && [" can ", " may ", " is allowed ", " are allowed "]
            .iter()
            .any(|w| s.contains(w))
    {
        return true;
    }
    // "You have to read the chart" teaches; "you have to be certified"
    // states a duty: a soft modal counts with a duty word beside it.
    SOFT_MODALS.iter().any(|w| s.contains(&format!(" {w} ")))
        && DUTY_STEMS
            .iter()
            .any(|d| s.split_whitespace().any(|t| t.starts_with(d)))
}

/// Verbs that open an order about the work.
const IMPERATIVES: &[&str] = &[
    "assume",
    "keep",
    "stay",
    "stop",
    "use",
    "make",
    "ensure",
    "never",
    "always",
    "avoid",
    "wear",
    "lower",
    "raise",
    "call",
    "contact",
    "treat",
    "maintain",
    "inspect",
    "verify",
    "secure",
    "set",
    "place",
    "put",
    "follow",
    "get",
    "don't",
    "do",
    "report",
    "tag",
    "lock",
    "block",
    "barricade",
    "wait",
    "remove",
    "position",
    "hold",
    "give",
    "post",
    "mark",
];
/// Words of studying, not of the work.
const STUDY_WORDS: &[&str] = &[
    "practic",
    "study",
    "review",
    "exam",
    "test",
    "chart",
    "question",
    "lesson",
    "quiz",
    "tool",
    "card",
    "topic",
    "skill",
    "flashcard",
    "score",
];
/// Things the work is done with or near (singular; a trailing s is dropped).
const WORK_WORDS: &[&str] = &[
    "line",
    "load",
    "crane",
    "boom",
    "energized",
    "live",
    "spotter",
    "signal",
    "rigging",
    "outrigger",
    "hook",
    "voltage",
    "clearance",
    "worker",
    "people",
    "personnel",
    "operator",
    "power",
    "swing",
    "radiu",
    "sling",
    "mat",
    "ground",
    "jib",
    "rope",
    "block",
    "zone",
    "area",
    "equipment",
    "machine",
];

const SOFT_MODALS: &[&str] = &[
    "have to",
    "has to",
    "need to",
    "needs to",
    "got to",
    "gotta",
    "should",
    "shouldn't",
    "don't",
    "do not",
    "ought to",
    "may",
    "can",
    "is ok to",
    "it's ok to",
    "okay to",
    "never",
    "always",
    "cannot",
    "can't",
    "can not",
];
/// Word starts that make a soft modal a duty.
const DUTY_STEMS: &[&str] = &[
    "certif", "qualif", "inspect", "permit", "requir", "employer", "document", "train", "authoriz",
    "approv", "licens", "wear", "harness", "ride", "swing", "clearanc", "distanc", "signal",
    "spotter", "tag", "lock", "lift", "stand", "hook", "operat", "enter", "climb", "hoist",
    "exceed", "closer", "approach", "travel", "leav", "unattend",
];

/// Content words a node sentence must share with the quote that backs its
/// number (node text is the content lane's verified prose, so it may
/// reword more than the model's line).
const NODE_OVERLAP: f64 = 0.5;

/// Arithmetic, unit conversion or physics: "144 square inches in a square
/// foot", "doubling both sides quarters the pressure", "divide by the area".
fn is_arithmetic(sentence: &str) -> bool {
    const WORDS: &[&str] = &[
        "divide", "divided", "multiply", "multiplied", "times", "equals", "square inch",
        "square foot", "square feet", "per square", "halve", "quarter", "double", "convert",
        "conversion", "sum", "subtract", "minus", "plus", "ratio", "pressure is", "area is",
        "e.g", "for example", "say ",
    ];
    let l = sentence.to_lowercase();
    WORDS.iter().any(|w| l.contains(w)) && !is_rule_claim(sentence)
}

/// A sentence about the exam's format (its share, items, minutes).
fn is_exam_format(sentence: &str) -> bool {
    let l = sentence.to_lowercase();
    (l.contains("exam") || l.contains("domain"))
        && ["percent", "%", "question", "minute", "item"]
            .iter()
            .any(|w| l.contains(w))
}

/// A number that states a requirement: a clearance, a distance, a limit, a
/// capacity, an interval or deadline, a voltage band.
fn is_requirement_number(sentence: &str) -> bool {
    const WORDS: &[&str] = &[
        "clearance", "distance", "limit", "capacity", "rated", "deadline", "working day",
        "interval", "every", "each shift", "monthly", "annual", "level", "within", "no more than",
        "no less than", "kv", "volt", "feet", "foot", "percent", "degree", "proof test",
        "design factor", "safety factor", "minutes", "hours", "days", "months", "years",
    ];
    let l = format!(" {} ", sentence.to_lowercase());
    WORDS.iter().any(|w| l.contains(w))
}

/// True when the learner's words are about traveling (driving the crane,
/// moving it with no load), which has its own clearance table.
fn traveling(text: &str) -> bool {
    normalize::content_stems(text)
        .iter()
        .any(|s| ["travel", "drive", "driven", "drove", "transit"].contains(&s.as_str()))
}

/// True when `sentence` measures something a rule would: a length, weight,
/// voltage, speed, angle, or an interval of days or more (not exam minutes
/// or percentages).
fn has_rule_unit(sentence: &str) -> bool {
    const UNITS: &[&str] = &[
        "feet",
        "inches",
        "pounds",
        "kilograms",
        "meters",
        "millimeters",
        "kv",
        "volts",
        "mph",
        "degrees",
        "tons",
        "day",
        "days",
        "week",
        "weeks",
        "month",
        "months",
        "year",
        "years",
    ];
    normalize::tokens(sentence)
        .iter()
        .any(|t| UNITS.contains(&t.as_str()))
}

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
    search: Option<String>,
}

/// The plan's schema; `intents` are the ones this turn can serve (no
/// `review` without an answer to review), so a small model cannot pick one
/// the engine has nothing for.
fn plan_schema(intents: &[&str]) -> Value {
    let n = |t: &str| json!({"type": [t, "null"]});
    json!({
        "type": "object",
        "properties": {
            "intent": {"type": "string", "enum": intents},
            "node_id": n("string"),
            "fields": {"type": "array", "items": {"type": "string", "enum": FIELDS}},
            "show": {"type": "array", "items": {"type": "string"}},
            "evidence": {"type": "array", "items": {"type": "string"}},
            "say": {"type": "string"},
            "tool": {"type": ["string", "null"], "enum": [TOOLS[0], TOOLS[1], TOOLS[2], null]},
            "search": n("string")
        },
        "required": ["intent", "node_id", "fields", "show", "evidence", "say", "tool", "search"],
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

    /// Re-check a turn that came from outside the engine (the baked
    /// welcome) as the engine's own: quotes verbatim, a cite only after a
    /// kept quote of its section or for a real section, links to rows that
    /// shipped, node blocks rebuilt from the tree, prose through the same
    /// sentence check as the model's (it has no rule sentences named).
    fn checked(&self, blocks: Vec<Block>, trace: &mut Trace) -> Vec<Block> {
        let pack = &self.engine.pack;
        let context = self.exam_numbers();
        let mut out: Vec<Block> = Vec::new();
        for b in blocks {
            let kept = match b {
                Block::Quote {
                    ref section_id,
                    ref text,
                } => pack
                    .section(section_id)
                    .ok()
                    .flatten()
                    .is_some_and(|s| check::quote_in(text, &s.text))
                    .then_some(b.clone()),
                Block::Cite { ref section_id } => {
                    let after_quote = matches!(out.last(), Some(Block::Quote { section_id: q, .. }) if q == section_id);
                    (after_quote && pack.section_exists(section_id).unwrap_or(false))
                        .then_some(b.clone())
                }
                Block::Text { ref text } => self
                    .check_say(text, "", &context, trace)
                    .map(|t| Block::Text { text: t }),
                Block::Node {
                    ref node_id,
                    ref texts,
                    ..
                } => self.tree.node(node_id).map(|n| {
                    let fields: Vec<String> = texts.iter().map(|t| t.field.clone()).collect();
                    self.node_block(n, &fields)
                }),
                Block::Lesson { ref lesson_id } => pack
                    .lesson(lesson_id)
                    .ok()
                    .flatten()
                    .is_some()
                    .then_some(b.clone()),
                Block::Diagram { ref diagram_id } => pack
                    .diagram(diagram_id)
                    .ok()
                    .flatten()
                    .is_some()
                    .then_some(b.clone()),
                Block::Question { ref q_id, .. } => pack
                    .question(q_id)
                    .ok()
                    .flatten()
                    .is_some()
                    .then_some(b.clone()),
                Block::Focus { .. } => None, // the learner's own, never baked
                _ => Some(b.clone()),
            };
            match kept {
                Some(k) => out.push(k),
                None => trace.dropped.push(format!("welcome block: {b:?}")),
            }
        }
        out
    }

    /// One turn.
    pub fn turn(&self, req: &TurnRequest) -> Result<Turn> {
        let started = Instant::now();
        let mut t = match (&req.input, &req.ask) {
            (Some(Input::Open { node_id, fields }), _) => {
                self.open(node_id, fields, &req.learner, &req.history)
            }
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
        self.node_block_after(n, fields, &[])
    }

    /// The node's texts: the named fields, else the overview (summary and
    /// what is hard; what people get wrong and what the exam asks are a tap
    /// away). Texts the conversation already showed (in `history`) are not
    /// shown again; when that leaves nothing, the next unshown field is.
    fn node_block_after(&self, n: &CourseNode, fields: &[String], history: &[Message]) -> Block {
        // A text counts as shown when the conversation carries it whole (a
        // short text could sit inside something unrelated).
        let seen = |f: &str| {
            let t = field_of(n, f);
            t.len() >= 40
                && history
                    .iter()
                    .any(|m| m.who == "instructor" && m.text.contains(t))
        };
        let mut want: Vec<&str> = if fields.is_empty() {
            DEFAULT_FIELDS.to_vec()
        } else {
            fields.iter().map(String::as_str).collect()
        };
        want.retain(|f| !field_of(n, f).is_empty() && !seen(f));
        if want.is_empty() {
            want = FIELDS
                .iter()
                .copied()
                .filter(|f| !field_of(n, f).is_empty() && !seen(f))
                .take(1)
                .collect();
        }
        // Everything shown already: the learner asked again for the named
        // fields, so show them; with none named, the overview.
        if want.is_empty() {
            let again: Vec<&str> = if fields.is_empty() {
                DEFAULT_FIELDS.to_vec()
            } else {
                fields.iter().map(String::as_str).collect()
            };
            want = again
                .into_iter()
                .filter(|f| !field_of(n, f).is_empty())
                .collect();
        }
        let texts: Vec<NodeText> = want
            .iter()
            .map(|f| NodeText {
                field: f.to_string(),
                text: field_of(n, f).to_string(),
            })
            .collect();
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
    /// At most [`NODE_QUOTES`] of the node's rule quotes, the ones the
    /// conversation has not shown yet first.
    /// The numbers the exam blueprints state, as people say them: the JSON
    /// (counts, minutes, ids) and each weight as a percentage, plus the
    /// number of domains, exams and topics.
    fn exam_numbers(&self) -> String {
        let mut out = self.tree.exams.to_string();
        for e in self.tree.exams.as_array().into_iter().flatten() {
            let domains = e["domains"].as_array().map_or(0, Vec::len);
            out.push_str(&format!(" {domains}"));
            for d in e["domains"].as_array().into_iter().flatten() {
                if let Some(w) = d["weight"].as_f64() {
                    out.push_str(&format!(" {}", (w * 100.0).round()));
                }
            }
        }
        let exams = self.tree.exams.as_array().map_or(0, Vec::len);
        let topics = self.tree.nodes.iter().filter(|n| n.level == "topic").count();
        out.push_str(&format!(" {exams} {topics}"));
        out
    }

    /// A node's texts and rule quotes for one turn, held to the founder's
    /// rule: a number that states a requirement (a distance, a percent of
    /// capacity, a deadline, an interval) stands only with a quote in the
    /// turn that states it; the quote is pulled from the node's quotes or
    /// its rule sections when it is not among the ones shown, else the
    /// sentence is left out. Exam-format numbers come only from the exam
    /// blueprint. Arithmetic, unit conversions and physics need no quote,
    /// and `mistakes` (misconceptions, wrong numbers on purpose) is exempt.
    fn node_turn(
        &self,
        n: &CourseNode,
        fields: &[String],
        history: &[Message],
        trace: &mut Trace,
    ) -> (Block, Vec<Block>) {
        let mut nb = self.node_block_after(n, fields, history);
        let shown = |q: &str| {
            history
                .iter()
                .any(|m| m.who == "instructor" && m.text.contains(q))
        };
        let mut pool: Vec<(String, String)> = n
            .quotes
            .iter()
            .filter(|q| self.quote_cite(&q.section_id, &q.quote).is_some())
            .map(|q| (q.section_id.clone(), q.quote.clone()))
            .collect();
        pool.sort_by_key(|(_, q)| shown(q));
        let mut runs: Vec<(String, String)> = pool.iter().take(NODE_QUOTES).cloned().collect();
        // Rule sentences of the node's sections, for a requirement no node
        // quote states.
        for sid in n.section_ids.iter().take(6) {
            if let Ok(Some(sec)) = self.engine.pack.section(sid) {
                let lines: Vec<String> = if sec.kind == "table" {
                    sec.text.lines().map(normalize_ws).filter(|l| !l.is_empty()).collect()
                } else {
                    sentences(&normalize_ws(&sec.text))
                };
                pool.extend(lines.into_iter().take(40).map(|l| (sid.clone(), l)));
            }
        }
        let exam = self.exam_numbers();
        let exam_nums: BTreeSet<String> = numbers(&exam).into_iter().collect();
        if let Block::Node { texts, .. } = &mut nb {
            for t in texts.iter_mut() {
                if t.field == "mistakes" {
                    continue;
                }
                let mut kept = Vec::new();
                for sent in sentences(&normalize_ws(&t.text)) {
                    // Only figures written as digits: "one skill at a time" and
                    // "two-block" state no requirement.
                    let nums = numbers(&sent);
                    if !sent.chars().any(|c| c.is_ascii_digit()) || is_arithmetic(&sent) {
                        kept.push(sent);
                        continue;
                    }
                    if is_exam_format(&sent) {
                        if nums.iter().all(|x| exam_nums.contains(x)) {
                            kept.push(sent);
                        } else {
                            trace.dropped.push(format!("node {}: exam number not in the blueprint: {sent}", n.node_id));
                        }
                        continue;
                    }
                    if !(is_rule_claim(&sent) || is_requirement_number(&sent)) {
                        kept.push(sent);
                        continue;
                    }
                    let holds = |rs: &[(String, String)]| {
                        check::holds(&sent, &self.support_text(rs), NODE_OVERLAP)
                    };
                    if holds(&runs) {
                        kept.push(sent);
                        continue;
                    }
                    let found = pool.iter().find(|c| !runs.contains(c) && holds(std::slice::from_ref(c)));
                    match found {
                        Some(c) if runs.len() < NODE_QUOTES + 3 => {
                            runs.push(c.clone());
                            kept.push(sent);
                        }
                        _ => trace.dropped.push(format!("node {}: no quote states: {sent}", n.node_id)),
                    }
                }
                t.text = kept.join(" ");
            }
            texts.retain(|t| !t.text.trim().is_empty());
        }
        (nb, Self::run_blocks(&self.with_lead_ins(runs)))
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
        // At the top, the next steps are the exam's domains.
        if n.level == "course"
            && let Some(e) = self.exam(&Learner::default())
        {
            let eid = format!("exam:{}", e["id"].as_str().unwrap_or_default());
            for d in self.tree.children(&eid) {
                out.push(FollowUp::input(
                    d.title.clone(),
                    Input::Open {
                        node_id: d.node_id.clone(),
                        fields: Vec::new(),
                    },
                ));
            }
            if !out.is_empty() {
                return out;
            }
        }
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

    fn open(
        &self,
        node_id: &str,
        fields: &[String],
        learner: &Learner,
        history: &[Message],
    ) -> Turn {
        let Some(n) = self.tree.node(node_id) else {
            return self.lost(node_id);
        };
        let mut trace = Trace::default();
        let (nb, quotes) = self.node_turn(n, fields, history, &mut trace);
        let shown: Vec<String> = match &nb {
            Block::Node { texts, .. } => texts.iter().map(|t| t.field.clone()).collect(),
            _ => Vec::new(),
        };
        let mut blocks = vec![nb];
        blocks.extend(quotes);
        if fields.is_empty() {
            blocks.extend(self.linked(n, None, learner));
        }
        let mut t = Turn::new(
            blocks,
            self.next_steps(n, &shown),
            Some(node_id.to_string()),
        );
        t.trace = trace;
        t
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
        let mut runs: Vec<(String, String)> = n
            .quotes
            .iter()
            .filter(|q| self.quote_cite(&q.section_id, &q.quote).is_some())
            .map(|q| (q.section_id.clone(), q.quote.clone()))
            .collect();
        for sid in n.section_ids.iter().take(3) {
            if let Ok(Some(sec)) = self.engine.pack.section(sid) {
                let passage = best_passage(&sec.text, &norm.concepts, 600);
                if !passage.is_empty()
                    && !runs.iter().any(|(_, t)| t == &passage)
                    && self.quote_cite(sid, &passage).is_some()
                {
                    runs.push((sid.clone(), passage));
                }
            }
        }
        let blocks = Self::run_blocks(&self.with_lead_ins(runs));
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
    /// domain weight × (1 − mastery). An unpractised skill counts as 0.5, so
    /// a skill the learner has shown to be weak comes before an unknown one.
    fn focus_items(&self, learner: &Learner, k: usize) -> Vec<FocusItem> {
        let Some(e) = self.exam(learner) else {
            return Vec::new();
        };
        // A skill several domains test counts in each of them (its share of
        // each domain added up); it is listed under the domain it counts
        // most in.
        let mut by_skill: BTreeMap<String, (f64, f64, String, f64)> = BTreeMap::new();
        for d in e["domains"].as_array().into_iter().flatten() {
            let weight = d["weight"].as_f64().unwrap_or(0.0);
            let did = format!("domain:{}", d["id"].as_str().unwrap_or_default());
            let skills: Vec<&CourseNode> = self
                .tree
                .children(&did)
                .into_iter()
                .filter(|s| s.level == "skill")
                .collect();
            let share = weight / (skills.len().max(1) as f64).sqrt();
            let title = d["title"].as_str().unwrap_or_default().to_string();
            for s in skills {
                let e =
                    by_skill
                        .entry(s.node_id.clone())
                        .or_insert((0.0, 0.0, title.clone(), weight));
                e.0 += share;
                if share > e.1 {
                    *e = (e.0, share, title.clone(), weight);
                }
            }
        }
        let mut items: Vec<(f64, FocusItem)> = by_skill
            .into_iter()
            .filter_map(|(id, (sum, _, domain, weight))| {
                let s = self.tree.node(&id)?;
                let m = learner.mastery.get(skill_id(s)).copied();
                Some((
                    sum * (1.0 - m.unwrap_or(UNPRACTISED)),
                    FocusItem {
                        node_id: id,
                        title: s.title.clone(),
                        domain,
                        weight,
                        mastery: m,
                    },
                ))
            })
            .collect();
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
             passages), focus (what to study, where they stand, how to prepare for the exam: the \
             app shows their weakest skills weighted by the exam), review (explain their last \
             practice answer, learner.last_answer), practice (an inline practice question on a skill node), tool (a \
             calculator: clearance for a voltage, load-chart, signals), chat (greeting, thanks, nerves), out_of_scope (not \
             in this course: other countries, other machines, legal advice or fines, the text of \
             private standards), clarify (ask one short question).\n\
             - node_id: the best node from `nodes` (or the current node), else null.\n\
             - fields: which node texts to show: summary, hard, mistakes, exam. Empty = all.\n\
             - show: ids from the node's links to show (a film, lesson, diagram, or \"practice\").\n\
             - evidence: the 1 to 3 rule sentences (handles like \"r1.2\") that state the rule \
             you talk about; the app quotes exactly these. Leave it empty when you state no rule.\n\
             - say: 1 to 3 short sentences, plain words. The app places the blocks; do not write \
             \"below\" or \"quoted here\". Never state a rule, number or \
             requirement unless its sentence is in evidence; the app drops any that is not. If \
             nothing fits, say so honestly and point to what the course covers. For \
             out_of_scope, say plainly that this course does not cover it, then name what it does \
             cover.\n\
             - tool: for intent tool (the app reads the voltage from the learner's words).\n\
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

        let intents: Vec<&str> = INTENTS
            .iter()
            .copied()
            .filter(|i| *i != "review" || review.is_some())
            .collect();
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
                schema: ("instructor_turn".into(), plan_schema(&intents)),
                max_tokens: 500,
                temperature: 0.2,
            };
            match complete_json::<Value>(llm.as_ref(), &req_llm)
                .and_then(|v| Ok((serde_json::from_value::<Plan>(v.clone())?, v)))
            {
                Ok((p, raw)) => {
                    plan = p;
                    trace.plans.push(raw);
                }
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
        let mut t = self.build(req, text, plan, &passages, review.clone(), trace.clone());
        // One repair: the model sees what was removed and why, and rewrites
        // its line (dropped sentences leave the rest dangling).
        if !t.trace.dropped.is_empty() {
            let mut user: Value = serde_json::from_str(&self.prompt(
                req,
                text,
                at,
                &node_hits,
                &passages,
                review.as_ref().map(|r| &r.2),
            ))?;
            user["previous_reply"] = trace.plans.last().cloned().unwrap_or(Value::Null);
            user["removed"] = json!(t.trace.dropped);
            user["note"] = json!(
                "The app removed these sentences: no rule sentence in `rules` states them. \
                 Write the reply again so it reads well without them: drop them or say them \
                 without a rule or number, or name the rule sentences that state them in evidence."
            );
            let req_llm = LlmRequest {
                system: self.system(),
                user: user.to_string(),
                schema: ("instructor_turn".into(), plan_schema(&intents)),
                max_tokens: 500,
                temperature: 0.2,
            };
            if let Ok((p, raw)) = complete_json::<Value>(llm.as_ref(), &req_llm)
                .and_then(|v| Ok((serde_json::from_value::<Plan>(v.clone())?, v)))
            {
                let mut tr = trace.clone();
                tr.plans.push(raw);
                tr.intent = Some(p.intent.clone());
                let first = t.trace.dropped.clone();
                let t2 = self.build(req, text, p, &passages, review, tr);
                if t2.trace.dropped.len() <= first.len() {
                    t = t2;
                    let repaired: Vec<String> = first
                        .into_iter()
                        .map(|d| format!("repaired: {d}"))
                        .collect();
                    t.trace.dropped.splice(0..0, repaired);
                }
            }
        }
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
        // A table's rows are its sentences, so a turn can quote one row.
        let ss: Vec<String> = if sec.kind == "table" {
            sec.text
                .lines()
                .map(normalize_ws)
                .filter(|l| !l.is_empty())
                .take(24)
                .collect()
        } else {
            sentences(&best_passage(&sec.text, &norm.concepts, 600))
        };
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
            Some(h) if h.lexical > 0.0 => self.open(&h.node_id, &[], &Learner::default(), &[]),
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
        mut plan: Plan,
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

        // Nothing to review means the learner asks where they stand: focus.
        if plan.intent == "review" && review.is_none() {
            plan.intent = "focus".into();
        }
        match plan.intent.as_str() {
            "node" | "practice" if node.is_some() => {
                let n = node.unwrap();
                let fields: Vec<String> = plan
                    .fields
                    .iter()
                    .filter(|f| FIELDS.contains(&f.as_str()))
                    .cloned()
                    .collect();
                let (nb, node_quotes) = self.node_turn(n, &fields, &req.history, &mut trace);
                let shown: Vec<String> = match &nb {
                    Block::Node { texts, .. } => texts.iter().map(|t| t.field.clone()).collect(),
                    _ => Vec::new(),
                };
                context.push_str(&n.text());
                blocks.push(nb);
                blocks.extend(node_quotes);
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
            "tool" => blocks.extend(self.tool_blocks(plan.tool.as_deref(), text)),
            _ => {}
        }

        // A range table among the rules and a value in its unit in the
        // learner's words: the row for that value leads (like the answer
        // engine's table tool), instead of the whole table.
        let table = (!matches!(plan.intent.as_str(), "out_of_scope" | "chat"))
            .then(|| self.table_rows(text, passages))
            .flatten();
        let skip: Option<String> = table.as_ref().map(|(sid, _)| sid.clone());
        // Rule sentences the model named: copied from the pack, runs merged.
        let mut runs = self.evidence_runs(&plan.evidence, passages, skip.as_deref());
        if matches!(plan.intent.as_str(), "rule" | "tool" | "review") {
            runs.truncate(4);
        } else {
            // Elsewhere a quote earns its place by backing a claim in `say`.
            let claims: Vec<String> = sentences(&normalize_ws(&plan.say))
                .into_iter()
                .filter(|s| is_rule_claim(s) || !numbers(s).is_empty())
                .collect();
            runs.retain(|r| {
                let support = self.support_text(std::slice::from_ref(r));
                claims
                    .iter()
                    .any(|c| check::holds(c, &support, CheckOptions::STRICT.min_overlap))
            });
        }
        let runs = self.with_lead_ins(runs);
        let mut table_runs: Vec<(String, String)> = Vec::new();
        let mut rule_blocks: Vec<Block> = Vec::new();
        if let Some((_, segs)) = table {
            for s in segs {
                match s {
                    Segment::Text { text } => rule_blocks.push(Block::Text { text }),
                    Segment::Quote { section_id, text } => {
                        table_runs.push((section_id.clone(), text.clone()));
                        rule_blocks.push(Block::Quote { section_id, text })
                    }
                    Segment::Cite { section_id } => rule_blocks.push(Block::Cite { section_id }),
                    Segment::Diagram { diagram_id } => {
                        rule_blocks.push(Block::Diagram { diagram_id })
                    }
                    // A range-table answer has no lesson checks.
                    Segment::Check { .. } => {}
                }
            }
        }
        rule_blocks.extend(Self::run_blocks(&runs));
        table_runs.extend(runs);
        let support = self.support_text(&table_runs);
        let said = self.check_say(&plan.say, &support, &context, &mut trace);
        let has_rules = !rule_blocks.is_empty();
        // The engine's own answer (a table row) leads; the model's line
        // follows it, then the rule text.
        let lead = match rule_blocks.first() {
            Some(Block::Text { .. }) => Some(rule_blocks.remove(0)),
            _ => None,
        };
        blocks.extend(rule_blocks);
        let said = said.and_then(|s| self.undangle(&s, &blocks, &mut trace));
        if let Some(s) = said {
            blocks.insert(0, Block::Text { text: s });
        }
        if let Some(l) = lead {
            blocks.insert(0, l);
        }
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
        // Next steps from the part of the course the learner's words found,
        // else from where the conversation is, else the top.
        if follow.is_empty()
            && let Some(b) = trace
                .node_hits
                .first()
                .and_then(|h| self.tree.node(h))
                .or_else(|| at.as_deref().and_then(|a| self.tree.node(a)))
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
        // The traveling table when the words are about traveling, else the others first.
        let moving = traveling(text);
        let mut order: Vec<&Passage> = passages.iter().collect();
        order.sort_by_key(|p| {
            let travel_table = self
                .engine
                .pack
                .section(&p.section_id)
                .ok()
                .flatten()
                .and_then(|s| s.heading)
                .is_some_and(|h| h.to_lowercase().contains("travel"));
            travel_table != moving
        });
        for p in order {
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

    /// The rule sentences the model named, as runs of adjacent sentences
    /// `(section_id, text)` copied from the pack and checked verbatim.
    fn evidence_runs(
        &self,
        evidence: &[String],
        passages: &[Passage],
        skip: Option<&str>,
    ) -> Vec<(String, String)> {
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
        let mut runs = Vec::new();
        for (p, mut idx) in by_p {
            idx.sort_unstable();
            idx.dedup();
            let ss = &passages[p].sentences;
            let sid = &passages[p].section_id;
            if skip == Some(sid.as_str()) {
                continue;
            }
            let mut k = 0;
            while k < idx.len() {
                let mut end = k;
                while end + 1 < idx.len() && idx[end + 1] == idx[end] + 1 {
                    end += 1;
                }
                // Table rows keep their line breaks (one claim, one row).
                let quote = ss[idx[k]..=idx[end]].join("\n");
                if self.quote_cite(sid, &quote).is_some() {
                    runs.push((sid.clone(), quote));
                }
                k = end + 1;
            }
        }
        runs
    }

    /// The model's line without sentences that point at something the turn
    /// does not show ("the rule quoted below" with no quote, "the lesson
    /// below" with no lesson card).
    fn undangle(&self, text: &str, blocks: &[Block], trace: &mut Trace) -> Option<String> {
        let has = |f: &dyn Fn(&Block) -> bool| blocks.iter().any(f);
        let quote = has(&|b| matches!(b, Block::Quote { .. }));
        let lesson = has(&|b| matches!(b, Block::Lesson { .. }));
        let question = has(&|b| matches!(b, Block::Question { .. }));
        let film = has(&|b| matches!(b, Block::Film { .. }));
        let diagram = has(&|b| matches!(b, Block::Diagram { .. }));
        let any = has(&|b| !matches!(b, Block::Text { .. }));
        let mut kept = Vec::new();
        for sent in sentences(text) {
            let l = format!(
                " {} ",
                sent.to_lowercase().replace(['.', ',', ':', '!', '?'], " ")
            );
            let points = [
                " below ",
                " above ",
                " quoted ",
                " shown here ",
                " here's the ",
                " see the ",
            ]
            .iter()
            .any(|w| l.contains(w));
            let names = |ws: &[&str]| ws.iter().any(|w| l.contains(&format!(" {w}")));
            let ok = !points
                || if names(&[
                    "rule",
                    "quote",
                    "text",
                    "section",
                    "passage",
                    "table",
                    "paragraph",
                ]) {
                    quote
                } else if names(&["lesson"]) {
                    lesson
                } else if names(&["question", "practice", "quiz"]) {
                    question
                } else if names(&["video", "film"]) {
                    film
                } else if names(&["diagram", "picture", "figure", "drawing"]) {
                    diagram
                } else {
                    any
                };
            if ok {
                kept.push(sent);
            } else {
                trace
                    .dropped
                    .push(format!("points at nothing shown: {sent}"));
            }
        }
        (!kept.is_empty()).then(|| kept.join(" "))
    }

    /// `runs` with the sentence that introduces each list item's list (and its
    /// parent list) quoted before it, once.
    fn with_lead_ins(&self, runs: Vec<(String, String)>) -> Vec<(String, String)> {
        // Everything these runs show already, so an intro another run quotes
        // (a parent named after its item) is not quoted twice.
        let all: String = runs
            .iter()
            .map(|(_, t)| t.as_str())
            .collect::<Vec<_>>()
            .join("\n");
        let mut out: Vec<(String, String)> = Vec::new();
        for r in runs {
            let shown: String = out
                .iter()
                .map(|(_, t)| t.as_str())
                .chain([all.as_str()])
                .collect::<Vec<_>>()
                .join("\n");
            if let Ok(intros) = self.engine.pack.list_lead_ins(&r.0, &shown) {
                for i in intros {
                    if !out.contains(&i) && self.quote_cite(&i.0, &i.1).is_some() {
                        out.push(i);
                    }
                }
            }
            if !out.contains(&r) {
                out.push(r);
            }
        }
        out
    }

    /// Quote blocks for `runs`, each section's cite after its last quote.
    fn run_blocks(runs: &[(String, String)]) -> Vec<Block> {
        let mut out = Vec::new();
        for (i, (sid, text)) in runs.iter().enumerate() {
            out.push(Block::Quote {
                section_id: sid.clone(),
                text: text.clone(),
            });
            if runs.get(i + 1).is_none_or(|(next, _)| next != sid) {
                out.push(Block::Cite {
                    section_id: sid.clone(),
                });
            }
        }
        out
    }

    /// What a claim may lean on: the quoted runs, each with its section's
    /// heading (shown with the cite), one per line.
    fn support_text(&self, runs: &[(String, String)]) -> String {
        runs.iter()
            .map(|(sid, text)| {
                let heading = self
                    .engine
                    .pack
                    .section(sid)
                    .ok()
                    .flatten()
                    .and_then(|s| s.heading)
                    .unwrap_or_default();
                format!("{heading}\n{text}")
            })
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// The sentences of `say` that hold, joined; `None` when none do.
    fn check_say(
        &self,
        say: &str,
        quoted: &str,
        context: &str,
        trace: &mut Trace,
    ) -> Option<String> {
        let ctx: BTreeSet<String> = numbers(context).into_iter().collect();
        let mut kept: Vec<String> = Vec::new();
        for s in sentences(&normalize_ws(say)) {
            let nums = numbers(&s);
            // A number with a measuring unit (feet, kV, pounds…) is a rule's
            // number whatever else the turn shows.
            let measured = !nums.is_empty() && has_rule_unit(&s);
            if !is_rule_claim(&s) && !measured && nums.iter().all(|n| ctx.contains(n)) {
                kept.push(s);
                continue;
            }
            if quoted.is_empty() {
                trace.dropped.push(format!("no rule named: {s}"));
            } else if check::holds(&s, quoted, CheckOptions::STRICT.min_overlap) {
                kept.push(s);
            } else {
                trace.dropped.push(format!("not in the quoted rules: {s}"));
            }
        }
        (!kept.is_empty()).then(|| kept.join(" "))
    }

    /// The tool block. Its numbers come from the learner's words, never the
    /// model's: `clearance` carries the voltage only when the learner said
    /// it, and the table row itself is shown by [`Self::table_rows`] from
    /// the same words.
    fn tool_blocks(&self, tool: Option<&str>, text: &str) -> Vec<Block> {
        let Some(tool) = tool.filter(|t| TOOLS.contains(t)) else {
            return Vec::new();
        };
        if tool != "clearance" {
            return vec![Block::Tool {
                tool: tool.to_string(),
                input: Value::Null,
            }];
        }
        let toks = normalize::tokens(text);
        let kv = toks
            .windows(2)
            .find(|w| w[1] == "kv")
            .and_then(|w| w[0].parse::<f64>().ok());
        vec![Block::Tool {
            tool: "clearance".into(),
            input: json!({"kv": kv, "traveling": traveling(text)}),
        }]
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
