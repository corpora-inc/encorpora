//! The course knowledge tree: course → exam → domain, and course → topic →
//! skill, each node with a short summary, what is hard, what people get
//! wrong and what the exam asks, plus links down to lessons, questions,
//! diagrams, films and the rule paragraphs.
//!
//! A pack with a `course_node` table ships the tree its content lane wrote
//! (verified at import; quotes are re-checked verbatim here). A pack without
//! one gets the tree derived from its topics, skills, lessons, questions,
//! diagrams and exam blueprints: the same structure with empty node text, so
//! a host can walk it and a content lane can start from it
//! (`harvest show tree`).
//!
//! Search over the tree is its own index, never mixed into answer
//! retrieval: BM25 over the node text in memory (a course has hundreds of
//! nodes, not thousands), fused by RRF with cosine over `course_node_vec`
//! when the pack baked node vectors for the host's embedder.

use crate::check::quote_in;
use crate::embed::normalize_l2;
use crate::error::Result;
use crate::normalize;
use crate::pack::Pack;
use crate::retrieval::Retriever;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};

/// Links from a node down to what teaches and tests it.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct NodeLinks {
    /// More nodes below this one besides its children (a domain's skills).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub node_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lesson_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub q_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub diagram_ids: Vec<String>,
    /// Films, resolved by the host from its media catalog.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub film_ids: Vec<String>,
}

/// Rule text behind a rule a node states.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NodeQuote {
    pub section_id: String,
    pub quote: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CourseNode {
    pub node_id: String,
    #[serde(default)]
    pub parent_id: Option<String>,
    pub ord: i64,
    /// `course` | `exam` | `domain` | `topic` | `skill`.
    pub level: String,
    pub title: String,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub hard: String,
    #[serde(default)]
    pub mistakes: String,
    #[serde(default)]
    pub exam: String,
    #[serde(default)]
    pub links: NodeLinks,
    #[serde(default)]
    pub section_ids: Vec<String>,
    /// Verbatim in their sections (others are dropped on read).
    #[serde(default)]
    pub quotes: Vec<NodeQuote>,
}

impl CourseNode {
    /// The node's searchable text: title, then every written field.
    pub fn text(&self) -> String {
        [
            self.title.as_str(),
            &self.summary,
            &self.hard,
            &self.mistakes,
            &self.exam,
        ]
        .iter()
        .filter(|s| !s.is_empty())
        .copied()
        .collect::<Vec<_>>()
        .join("\n")
    }

    /// True when the content lane has written any of the node's text.
    pub fn has_text(&self) -> bool {
        !(self.summary.is_empty()
            && self.hard.is_empty()
            && self.mistakes.is_empty()
            && self.exam.is_empty())
    }
}

/// One node found by [`CourseTree::search`].
#[derive(Debug, Clone, Serialize)]
pub struct NodeHit {
    pub node_id: String,
    pub level: String,
    pub title: String,
    pub lexical: f64,
    pub dense: f64,
    pub score: f64,
}

pub struct CourseTree {
    pub nodes: Vec<CourseNode>,
    /// True when the pack had no tree and this one was derived.
    pub derived: bool,
    /// The exam blueprints the tree was built with.
    pub exams: Value,
    by_id: HashMap<String, usize>,
    // BM25 over node text.
    docs: Vec<Vec<String>>,
    df: HashMap<String, usize>,
    avgdl: f64,
}

const PASSED: &str = "prov_id IN (SELECT prov_id FROM provenance WHERE verdict = 'pass')";
const LEVEL_RANK: &[&str] = &["course", "exam", "domain", "topic", "skill"];

impl Pack {
    /// The baked course tree rows (`course_node`), passed rows only, quotes
    /// re-checked verbatim. Empty for a pack without one.
    pub fn course_nodes(&self) -> Result<Vec<CourseNode>> {
        if !self.has_table("course_node")? {
            return Ok(Vec::new());
        }
        type R = (
            String,
            Option<String>,
            i64,
            String,
            String,
            String,
            String,
            String,
            String,
            String,
            String,
            String,
        );
        let rows: Vec<R> = {
            let conn = self.conn();
            let mut stmt = conn.prepare_cached(&format!(
                "SELECT node_id, parent_id, ord, level, title, summary, hard, mistakes, exam,
                        links, section_ids, quotes
                 FROM course_node WHERE {PASSED} ORDER BY node_id"
            ))?;
            stmt.query_map([], |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                    r.get(6)?,
                    r.get(7)?,
                    r.get(8)?,
                    r.get(9)?,
                    r.get(10)?,
                    r.get(11)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?
        };
        let parse = |id: &str, what: &str, s: &str| -> Result<Value> {
            if s.trim().is_empty() {
                return Ok(Value::Null);
            }
            serde_json::from_str(s)
                .map_err(|e| crate::error::Error::Pack(format!("course_node {id}: {what}: {e}")))
        };
        let mut out = Vec::with_capacity(rows.len());
        for (id, parent, ord, level, title, summary, hard, mistakes, exam, links, sids, quotes) in
            rows
        {
            let links: NodeLinks = match parse(&id, "links", &links)? {
                Value::Null => NodeLinks::default(),
                v => serde_json::from_value(v)?,
            };
            let section_ids: Vec<String> = match parse(&id, "section_ids", &sids)? {
                Value::Null => Vec::new(),
                v => serde_json::from_value(v)?,
            };
            let quotes: Vec<NodeQuote> = match parse(&id, "quotes", &quotes)? {
                Value::Null => Vec::new(),
                v => serde_json::from_value(v)?,
            };
            let mut kept = Vec::with_capacity(quotes.len());
            for q in quotes {
                if let Some(sec) = self.section(&q.section_id)?
                    && quote_in(&q.quote, &sec.text)
                {
                    kept.push(q);
                }
            }
            out.push(CourseNode {
                node_id: id,
                parent_id: parent,
                ord,
                level,
                title,
                summary,
                hard,
                mistakes,
                exam,
                links,
                section_ids,
                quotes: kept,
            });
        }
        Ok(out)
    }
}

impl CourseTree {
    /// The pack's tree, or the derived one when it has none. `exams`
    /// overrides the pack's blueprints (a host with a newer blueprint).
    pub fn from_pack(pack: &Pack, exams: Option<Value>) -> Result<Self> {
        let exams = match exams {
            Some(e) => e,
            None => pack.exams()?,
        };
        let baked = pack.course_nodes()?;
        if baked.is_empty() {
            return Self::derive(pack, exams);
        }
        Ok(Self::build(baked, false, exams))
    }

    /// The structure of the course from the pack's rows, node text empty
    /// except topic summaries.
    pub fn derive(pack: &Pack, exams: Value) -> Result<Self> {
        let topics = pack.topics()?;
        let skills = pack.skills()?;
        // Ids and topics only: the tree links lessons, it does not render them.
        let lessons: Vec<(String, String)> = {
            let conn = pack.conn();
            let mut stmt = conn.prepare_cached(&format!(
                "SELECT lesson_id, topic_id FROM lesson WHERE {PASSED} ORDER BY topic_id, ord, lesson_id"
            ))?;
            stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
                .collect::<rusqlite::Result<Vec<_>>>()?
        };
        // `(q_id, skill_id, section_ids)`: the tree links questions, it does
        // not grade them.
        let questions: Vec<(String, String, Vec<String>)> = {
            let conn = pack.conn();
            let mut stmt = conn.prepare_cached(&format!(
                "SELECT q_id, skill_id, section_ids FROM question WHERE {PASSED} ORDER BY q_id"
            ))?;
            stmt.query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?
            .into_iter()
            .map(|(q, sk, sids)| (q, sk, serde_json::from_str(&sids).unwrap_or_default()))
            .collect()
        };
        let diagrams = pack.diagrams()?;
        let mut nodes = Vec::new();
        let node =
            |id: String, parent: Option<String>, ord: i64, level: &str, title: String| CourseNode {
                node_id: id,
                parent_id: parent,
                ord,
                level: level.to_string(),
                title,
                summary: String::new(),
                hard: String::new(),
                mistakes: String::new(),
                exam: String::new(),
                links: NodeLinks::default(),
                section_ids: Vec::new(),
                quotes: Vec::new(),
            };
        nodes.push(node(
            "course".into(),
            None,
            0,
            "course",
            pack.meta("course_title").unwrap_or("Course").to_string(),
        ));
        let known_skill = |id: &str| skills.iter().any(|s| s.skill_id == id);
        for (i, e) in exams.as_array().into_iter().flatten().enumerate() {
            let Some(eid) = e["id"].as_str() else {
                continue;
            };
            let exam_id = format!("exam:{eid}");
            nodes.push(node(
                exam_id.clone(),
                Some("course".into()),
                i as i64 + 1,
                "exam",
                e["title"].as_str().unwrap_or(eid).to_string(),
            ));
            for (j, d) in e["domains"].as_array().into_iter().flatten().enumerate() {
                let Some(did) = d["id"].as_str() else {
                    continue;
                };
                let mut n = node(
                    format!("domain:{did}"),
                    Some(exam_id.clone()),
                    j as i64 + 1,
                    "domain",
                    d["title"].as_str().unwrap_or(did).to_string(),
                );
                n.links.node_ids = d["skillIds"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(Value::as_str)
                    .filter(|s| known_skill(s))
                    .map(|s| format!("skill:{s}"))
                    .collect();
                nodes.push(n);
            }
        }
        let topic_ids: Vec<&str> = topics.iter().map(|t| t.topic_id.as_str()).collect();
        for t in &topics {
            let parent = match &t.parent_id {
                Some(p) if topic_ids.contains(&p.as_str()) => format!("topic:{p}"),
                _ => "course".into(),
            };
            let mut n = node(
                format!("topic:{}", t.topic_id),
                Some(parent),
                100 + t.ord,
                "topic",
                t.title.clone(),
            );
            n.summary = t.summary.clone();
            n.links.lesson_ids = lessons
                .iter()
                .filter(|l| l.1 == t.topic_id)
                .map(|l| l.0.clone())
                .collect();
            nodes.push(n);
        }
        for (k, s) in skills.iter().enumerate() {
            let mut n = node(
                format!("skill:{}", s.skill_id),
                Some(format!("topic:{}", s.topic_id)),
                k as i64 + 1,
                "skill",
                s.title.clone(),
            );
            let mine: Vec<_> = questions.iter().filter(|q| q.1 == s.skill_id).collect();
            n.links.q_ids = mine.iter().map(|q| q.0.clone()).collect();
            // The rule paragraphs its questions cite, most cited first.
            let mut cited: BTreeMap<&str, usize> = BTreeMap::new();
            for q in &mine {
                for sid in &q.2 {
                    *cited.entry(sid.as_str()).or_default() += 1;
                }
            }
            let mut cited: Vec<(&str, usize)> = cited.into_iter().collect();
            cited.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(b.0)));
            n.section_ids = cited.iter().take(6).map(|(s, _)| s.to_string()).collect();
            n.links.diagram_ids = diagrams
                .iter()
                .filter(|d| d.section_ids.iter().any(|x| n.section_ids.contains(x)))
                .map(|d| d.diagram_id.clone())
                .collect();
            nodes.push(n);
        }
        nodes.sort_by(|a, b| a.node_id.cmp(&b.node_id));
        Ok(Self::build(nodes, true, exams))
    }

    fn build(nodes: Vec<CourseNode>, derived: bool, exams: Value) -> Self {
        let by_id = nodes
            .iter()
            .enumerate()
            .map(|(i, n)| (n.node_id.clone(), i))
            .collect();
        let docs: Vec<Vec<String>> = nodes
            .iter()
            .map(|n| {
                // The title counts twice: it names what the node is about.
                let mut d = normalize::content_stems(&n.title);
                d.extend(normalize::content_stems(&n.text()));
                d
            })
            .collect();
        let mut df: HashMap<String, usize> = HashMap::new();
        for d in &docs {
            let mut seen: Vec<&String> = d.iter().collect();
            seen.sort();
            seen.dedup();
            for s in seen {
                *df.entry(s.clone()).or_default() += 1;
            }
        }
        let avgdl = if docs.is_empty() {
            1.0
        } else {
            docs.iter().map(Vec::len).sum::<usize>() as f64 / docs.len() as f64
        };
        Self {
            nodes,
            derived,
            exams,
            by_id,
            docs,
            df,
            avgdl: avgdl.max(1.0),
        }
    }

    pub fn node(&self, id: &str) -> Option<&CourseNode> {
        self.by_id.get(id).map(|&i| &self.nodes[i])
    }

    /// The top of the tree: the `course` node, else the first root.
    pub fn root(&self) -> Option<&CourseNode> {
        self.nodes
            .iter()
            .find(|n| n.level == "course")
            .or_else(|| self.nodes.iter().find(|n| n.parent_id.is_none()))
    }

    /// What is directly below `id`: its children, then the nodes it links,
    /// each once, in order.
    pub fn children(&self, id: &str) -> Vec<&CourseNode> {
        let mut kids: Vec<&CourseNode> = self
            .nodes
            .iter()
            .filter(|n| n.parent_id.as_deref() == Some(id))
            .collect();
        kids.sort_by(|a, b| {
            rank(&a.level)
                .cmp(&rank(&b.level))
                .then(a.ord.cmp(&b.ord))
                .then_with(|| a.node_id.cmp(&b.node_id))
        });
        if let Some(n) = self.node(id) {
            for l in &n.links.node_ids {
                if let Some(c) = self.node(l)
                    && !kids.iter().any(|k| k.node_id == c.node_id)
                {
                    kids.push(c);
                }
            }
        }
        kids
    }

    /// From the root down to `id`.
    pub fn path(&self, id: &str) -> Vec<&CourseNode> {
        let mut out = Vec::new();
        let mut cur = self.node(id);
        while let Some(n) = cur {
            if out.iter().any(|o: &&CourseNode| o.node_id == n.node_id) {
                break; // a cycle in authored parents
            }
            out.push(n);
            cur = n.parent_id.as_deref().and_then(|p| self.node(p));
        }
        out.reverse();
        out
    }

    /// The nodes that best match `query`, best first.
    pub fn search(&self, retriever: &Retriever, query: &str, k: usize) -> Result<Vec<NodeHit>> {
        let norm = retriever.normalize(query);
        let mut q: Vec<String> = normalize::content_stems(&norm.text);
        for e in &norm.expansions {
            q.extend(normalize::content_stems(e));
        }
        q.sort();
        q.dedup();
        let n = self.docs.len() as f64;
        let mut lexical: Vec<(usize, f64)> = self
            .docs
            .iter()
            .enumerate()
            .map(|(i, d)| {
                let dl = d.len() as f64;
                let s: f64 = q
                    .iter()
                    .map(|t| {
                        let tf = d.iter().filter(|x| *x == t).count() as f64;
                        if tf == 0.0 {
                            return 0.0;
                        }
                        let df = *self.df.get(t).unwrap_or(&0) as f64;
                        let idf = ((n - df + 0.5) / (df + 0.5) + 1.0).ln();
                        idf * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * dl / self.avgdl))
                    })
                    .sum();
                (i, s)
            })
            .filter(|(_, s)| *s > 0.0)
            .collect();
        lexical.sort_by(|a, b| b.1.total_cmp(&a.1).then(a.0.cmp(&b.0)));

        let mut dense: Vec<(usize, f64)> = Vec::new();
        if let Some(e) = retriever.embedder
            && let Some(index) = retriever.pack.node_vectors(e.id(), e.dim())?
        {
            let mut v = e.embed_query(query)?;
            if v.len() == index.dim {
                normalize_l2(&mut v);
                for (row, id) in index.ids.iter().enumerate() {
                    let Some(&i) = self.by_id.get(id) else {
                        continue;
                    };
                    let f = index.factor[row];
                    if f <= 0.0 {
                        continue;
                    }
                    let r = &index.data[row * index.dim..(row + 1) * index.dim];
                    let dot: f32 = r.iter().zip(&v).map(|(&a, &b)| a as f32 * b).sum();
                    dense.push((i, (dot * f) as f64));
                }
                dense.sort_by(|a, b| b.1.total_cmp(&a.1).then(a.0.cmp(&b.0)));
            }
        }

        let mut fused: HashMap<usize, (f64, f64, f64)> = HashMap::new();
        for (rank, (i, s)) in lexical.iter().take(50).enumerate() {
            let e = fused.entry(*i).or_default();
            e.0 += 1.0 / (60.0 + rank as f64 + 1.0);
            e.1 = *s;
        }
        for (rank, (i, s)) in dense.iter().take(50).enumerate() {
            let e = fused.entry(*i).or_default();
            e.0 += 1.0 / (60.0 + rank as f64 + 1.0);
            e.2 = *s;
        }
        let mut hits: Vec<NodeHit> = fused
            .into_iter()
            .map(|(i, (score, lexical, dense))| NodeHit {
                node_id: self.nodes[i].node_id.clone(),
                level: self.nodes[i].level.clone(),
                title: self.nodes[i].title.clone(),
                lexical,
                dense,
                score,
            })
            .collect();
        hits.sort_by(|a, b| {
            b.score
                .total_cmp(&a.score)
                .then_with(|| a.node_id.cmp(&b.node_id))
        });
        hits.truncate(k);
        Ok(hits)
    }
}

fn rank(level: &str) -> usize {
    LEVEL_RANK
        .iter()
        .position(|l| *l == level)
        .unwrap_or(LEVEL_RANK.len())
}
