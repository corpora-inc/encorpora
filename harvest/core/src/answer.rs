//! The answer engine: understand → expand → retrieve → select → compose →
//! check. With the model off (this module's deterministic path) an answer is
//! a cache hit (`baked`), the best sections verbatim with citations
//! (`composed`), or a decline with the nearest sections (`declined`).

use crate::check::{self, Check, CheckOptions};
use crate::compose;
use crate::embed::Embedder;
use crate::error::{Error, Result};
use crate::llm::Llm;
use crate::normalize::{self, Concept, Normalized, normalize_ws};
use crate::pack::{CachedAnswer, Pack};
use crate::retrieval::{Hit, Reranker, Retriever, SearchOptions};
use crate::segments::{self, Segment};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::sync::Arc;
use std::time::Instant;

/// Who is asking; picks the explanation level.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Trainee,
    #[default]
    Operator,
    Inspector,
}

impl Role {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Trainee => "trainee",
            Self::Operator => "operator",
            Self::Inspector => "inspector",
        }
    }
    pub fn parse(s: &str) -> Result<Self> {
        match s {
            "trainee" => Ok(Self::Trainee),
            "operator" => Ok(Self::Operator),
            "inspector" => Ok(Self::Inspector),
            _ => Err(Error::Invalid(format!(
                "role {s:?}: expected trainee, operator or inspector"
            ))),
        }
    }
}

/// How an answer was produced.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    Baked,
    Composed,
    Declined,
    /// The model judged the question truly ambiguous; `body` holds one
    /// clarifying question (a text segment) and `nearest` the sections it
    /// might be about.
    Clarify,
}

/// Ask options.
#[derive(Debug, Clone)]
pub struct AskOptions {
    pub role: Role,
    pub equip: Option<String>,
    pub lang: String,
    /// Retrieved chunks reported and considered.
    pub k: usize,
    /// Minimum alias similarity (0..1) for an answer-cache hit.
    pub cache_threshold: f64,
    /// Minimum share of the question's content words a section must cover to
    /// support an answer; below it, decline.
    pub support_threshold: f64,
    /// Sections in a composed answer.
    pub max_sections: usize,
    /// Longest quoted passage per section, in characters.
    pub max_quote_chars: usize,
    /// Nearest sections listed on a decline.
    pub nearest: usize,
    /// The gate to use when the dense half of retrieval ran (the embedder's
    /// cosine scale makes it embedder-specific; a pack states its own in
    /// `pack_meta`, see [`AskOptions::for_pack`]). Without dense vectors the
    /// coverage-only `support_threshold` applies.
    pub dense_gate: Option<DenseGate>,
}

/// Answer gate with dense retrieval: a section needs `support_threshold`
/// coverage, and the best dense cosine among the retrieved chunks must reach
/// `min_dense`, or the engine declines.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct DenseGate {
    pub support_threshold: f64,
    pub min_dense: f64,
}

impl Default for AskOptions {
    fn default() -> Self {
        Self {
            role: Role::Operator,
            equip: None,
            lang: "en".into(),
            k: 10,
            cache_threshold: 0.75,
            support_threshold: 0.5,
            max_sections: 3,
            max_quote_chars: 600,
            nearest: 5,
            dense_gate: None,
        }
    }
}

impl AskOptions {
    /// Defaults with the pack's calibrated dense gate, when it states one:
    /// `pack_meta.gate_dense_support_threshold` and `gate_dense_min`.
    pub fn for_pack(pack: &Pack) -> Self {
        let num = |k: &str| {
            pack.meta(k)
                .and_then(|v| v.parse::<f64>().ok())
                .filter(|v| v.is_finite())
        };
        Self {
            dense_gate: match (num("gate_dense_support_threshold"), num("gate_dense_min")) {
                (Some(support_threshold), Some(min_dense)) => Some(DenseGate {
                    support_threshold,
                    min_dense,
                }),
                _ => None,
            },
            ..Self::default()
        }
    }
}

/// A retrieved chunk as `ask --json` reports it.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Retrieved {
    pub chunk_id: String,
    pub ref_id: String,
    pub lexical: f64,
    pub dense: f64,
    pub score: f64,
}

impl From<&Hit> for Retrieved {
    fn from(h: &Hit) -> Self {
        Self {
            chunk_id: h.chunk_id.clone(),
            ref_id: h.ref_id.clone(),
            lexical: h.lexical,
            dense: h.dense,
            score: h.score,
        }
    }
}

/// How the deterministic answer gate saw the question: enough to replay the
/// decision offline for any threshold. A section is kept when its coverage
/// reaches `threshold` and is within `window` of the best; the first
/// `max_sections` kept are composed; none kept means decline.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct Support {
    /// Best coverage over the candidates (the value the gate compares).
    pub score: f64,
    pub threshold: f64,
    pub window: f64,
    pub max_sections: usize,
    /// How many retrieved chunks the gate looked at: `candidates` and
    /// `top_dense` come from these (`retrieved` lists the first `k`).
    pub depth: usize,
    /// The question's content concepts (stems), in order.
    pub concepts: Vec<String>,
    /// Retrieved sections in retrieval order, with their coverage.
    pub candidates: Vec<SupportCandidate>,
    /// Best answer-cache similarity, and the threshold a hit needs.
    pub cache_similarity: f64,
    pub cache_threshold: f64,
    /// Best dense cosine among the `depth` chunks (0 without dense).
    pub top_dense: f64,
    /// The dense floor applied, when the dense gate was in force.
    pub min_dense: Option<f64>,
}

/// One section the gate considered.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct SupportCandidate {
    pub section_id: String,
    /// 1-based rank of its first retrieved chunk.
    pub rank: usize,
    /// Best fused retrieval score among its chunks.
    pub retrieval: f64,
    /// Share of `concepts` the section (with its retrieved chunks and the
    /// role's explanation) covers.
    pub coverage: f64,
    /// The concepts it covers.
    pub covered: Vec<String>,
}

/// The gate's relative window: sections more than this below the best are
/// not composed.
pub const SUPPORT_WINDOW: f64 = 0.25;

/// The `ask --json` object of CONTRACT.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AskResponse {
    pub mode: Mode,
    pub answer_id: Option<String>,
    pub body: Vec<Segment>,
    pub citations: Vec<String>,
    pub retrieved: Vec<Retrieved>,
    pub check: Check,
    pub nearest: Vec<String>,
    pub pack_version: String,
    pub model: Option<String>,
    pub elapsed_ms: u64,
    /// The deterministic gate's view of the question (all modes).
    #[serde(default)]
    pub support: Support,
}

/// What the engine considered, for the audit log.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct AskTrace {
    pub normalized: String,
    pub expansions: Vec<String>,
    /// Best answer-cache similarity seen (0 when no alias matched).
    pub cache_similarity: f64,
    /// Best section coverage of the question's concepts.
    pub support: f64,
    /// Why the model path was not used, when a model was configured.
    pub model_error: Option<String>,
}

/// The engine over one pack. `Send + Sync`: share it behind an `Arc`.
pub struct Engine {
    pub pack: Arc<Pack>,
    pub embedder: Option<Arc<dyn Embedder>>,
    pub reranker: Option<Arc<dyn Reranker>>,
    pub llm: Option<Arc<dyn Llm>>,
}

impl Engine {
    pub fn new(pack: Arc<Pack>) -> Self {
        Self {
            pack,
            embedder: None,
            reranker: None,
            llm: None,
        }
    }

    /// Turn the model on: expansion, clarification, selection, composition.
    pub fn with_llm(mut self, llm: Arc<dyn Llm>) -> Self {
        self.llm = Some(llm);
        self
    }

    pub fn with_embedder(mut self, e: Arc<dyn Embedder>) -> Self {
        self.embedder = Some(e);
        self
    }

    pub fn with_reranker(mut self, r: Arc<dyn Reranker>) -> Self {
        self.reranker = Some(r);
        self
    }

    pub fn retriever(&self) -> Retriever<'_> {
        Retriever {
            pack: &self.pack,
            embedder: self.embedder.as_deref(),
            reranker: self.reranker.as_deref(),
        }
    }

    /// Answer `question` (with the model when one is configured).
    pub fn ask(&self, question: &str, opts: &AskOptions) -> Result<AskResponse> {
        self.ask_traced(question, opts).map(|(r, _)| r)
    }

    /// Answer and return the trace the audit log records.
    pub fn ask_traced(&self, question: &str, opts: &AskOptions) -> Result<(AskResponse, AskTrace)> {
        let started = Instant::now();
        let retriever = self.retriever();
        let norm = retriever.normalize(question);
        let search = SearchOptions {
            k: opts.k.max(opts.max_sections * 4),
            equip: opts.equip.clone(),
            ..SearchOptions::default()
        };
        let result = retriever.search(question, &search)?;
        let dense_used = matches!(result.dense, crate::retrieval::DenseStatus::Used);
        let hits = result.hits;
        // The dense gate needs the dense half; otherwise coverage alone.
        let gate = opts.dense_gate.filter(|_| dense_used);
        let threshold = gate.map_or(opts.support_threshold, |g| g.support_threshold);
        let top_dense = hits.iter().map(|h| h.dense).fold(0.0, f64::max);
        let mut trace = AskTrace {
            normalized: norm.text.clone(),
            expansions: norm.expansions.clone(),
            ..AskTrace::default()
        };
        let retrieved: Vec<Retrieved> = hits.iter().take(opts.k).map(Retrieved::from).collect();
        let candidates = self.support_candidates(&norm, &hits, opts)?;
        trace.support = candidates.iter().map(|c| c.coverage).fold(0.0, f64::max);

        // Answer cache.
        let (cached, similarity) = self.cache_lookup(&norm, opts)?;
        trace.cache_similarity = similarity;
        let support = Support {
            score: trace.support,
            threshold,
            depth: hits.len(),
            window: SUPPORT_WINDOW,
            max_sections: opts.max_sections,
            concepts: norm.concepts.iter().map(|c| c.stem.clone()).collect(),
            candidates: candidates.clone(),
            cache_similarity: similarity,
            cache_threshold: opts.cache_threshold,
            top_dense,
            min_dense: gate.map(|g| g.min_dense),
        };
        if let Some(answer) = cached {
            let (body, check) = check::check(&self.pack, &answer.body, CheckOptions::STRUCTURAL)?;
            if check.quotes_ok && check.cites_ok && !body.is_empty() {
                return Ok((
                    AskResponse {
                        mode: Mode::Baked,
                        answer_id: Some(answer.answer_id),
                        citations: segments::citations(&body),
                        body,
                        retrieved,
                        check,
                        nearest: Vec::new(),
                        pack_version: self.pack.version().to_string(),
                        model: None,
                        elapsed_ms: started.elapsed().as_millis() as u64,
                        support: support.clone(),
                    },
                    trace,
                ));
            }
        }

        // Model on: expand, select, compose, strict check. Any failure falls
        // back to the deterministic path and is recorded in the trace.
        // The dense gate holds for the model path too: below the floor the
        // pack has nothing close enough to talk about.
        let dense_ok = gate.is_none_or(|g| top_dense >= g.min_dense);
        let model_opts = AskOptions {
            support_threshold: threshold,
            ..opts.clone()
        };
        if let Some(llm) = self.llm.clone().filter(|_| dense_ok) {
            match self.ask_model(llm.as_ref(), question, &norm, &model_opts, &mut trace) {
                Ok(Some(mut resp)) => {
                    resp.elapsed_ms = started.elapsed().as_millis() as u64;
                    resp.support = support.clone();
                    return Ok((resp, trace));
                }
                Ok(None) => {}
                Err(e) => trace.model_error = Some(e.to_string()),
            }
        }

        // Compose from the best-supported sections, or decline.
        let best = trace.support;
        let chosen: Vec<&SupportCandidate> = candidates
            .iter()
            .filter(|c| dense_ok && c.coverage >= threshold && c.coverage >= best - SUPPORT_WINDOW)
            .take(opts.max_sections)
            .collect();
        if chosen.is_empty() {
            let nearest = nearest_sections(&hits, opts.nearest);
            return Ok((
                AskResponse {
                    mode: Mode::Declined,
                    answer_id: None,
                    body: Vec::new(),
                    citations: Vec::new(),
                    retrieved,
                    check: Check {
                        quotes_ok: true,
                        cites_ok: true,
                        dropped: 0,
                    },
                    nearest,
                    pack_version: self.pack.version().to_string(),
                    model: None,
                    elapsed_ms: started.elapsed().as_millis() as u64,
                    support,
                },
                trace,
            ));
        }
        let mut body = Vec::new();
        for c in chosen {
            body.extend(self.compose_section(&c.section_id, &norm, opts)?);
        }
        let (body, check) = check::check(&self.pack, &body, CheckOptions::STRUCTURAL)?;
        Ok((
            AskResponse {
                mode: Mode::Composed,
                answer_id: None,
                citations: segments::citations(&body),
                body,
                retrieved,
                check,
                nearest: Vec::new(),
                pack_version: self.pack.version().to_string(),
                model: None,
                elapsed_ms: started.elapsed().as_millis() as u64,
                support,
            },
            trace,
        ))
    }

    /// The model path. `Ok(None)`: nothing the model wrote survived the
    /// checker, or nothing relevant was retrieved; use the deterministic path.
    fn ask_model(
        &self,
        llm: &dyn Llm,
        question: &str,
        norm: &Normalized,
        opts: &AskOptions,
        trace: &mut AskTrace,
    ) -> Result<Option<AskResponse>> {
        let context = self.context_line(opts);
        let expansion = compose::expand(llm, question, &context)?;
        for q in &expansion.queries {
            if !trace.expansions.contains(q) {
                trace.expansions.push(q.clone());
            }
        }
        let search = SearchOptions {
            k: opts.k.max(20),
            equip: opts.equip.clone(),
            ..SearchOptions::default()
        };
        let hits = self
            .retriever()
            .search_many(question, &expansion.queries, &search)?
            .hits;
        let retrieved: Vec<Retrieved> = hits.iter().take(opts.k).map(Retrieved::from).collect();
        let base = |mode, body: Vec<Segment>, check, nearest| AskResponse {
            mode,
            answer_id: None,
            citations: segments::citations(&body),
            body,
            retrieved: retrieved.clone(),
            check,
            nearest,
            pack_version: self.pack.version().to_string(),
            model: Some(llm.id()),
            elapsed_ms: 0,
            support: Support::default(),
        };
        // The long tail: the model may use sections with partial lexical
        // support; the strict checker decides what survives.
        let supported = self.supported_sections(norm, &hits, opts)?;
        // Clarify only when the pack holds something relevant but nothing
        // answers the question as asked (an answerable or off-topic question
        // gets its answer or its decline), and only with one short question
        // that states no number and no negation: the checker has no source
        // to hold a question to.
        let answerable = supported
            .iter()
            .any(|(_, cov)| *cov >= opts.support_threshold);
        let relevant = supported
            .iter()
            .any(|(_, cov)| *cov >= opts.support_threshold / 2.0);
        if expansion.ambiguous
            && relevant
            && !answerable
            && let Some(q) = expansion.clarify.as_deref().map(str::trim)
            && is_plain_question(q)
        {
            return Ok(Some(base(
                Mode::Clarify,
                vec![Segment::text(q)],
                Check {
                    quotes_ok: true,
                    cites_ok: true,
                    dropped: 0,
                },
                nearest_sections(&hits, opts.nearest),
            )));
        }
        let candidates: Vec<String> = supported
            .into_iter()
            .filter(|(_, cov)| *cov >= opts.support_threshold / 2.0)
            .map(|(id, _)| id)
            .take(8)
            .collect();
        if candidates.is_empty() {
            return Ok(None);
        }
        let chosen = if candidates.len() > opts.max_sections + 1 {
            let offered = compose::passages(&self.pack, &candidates, 500)?;
            let picked = compose::select(llm, question, &offered, opts.max_sections + 1)?;
            if picked.is_empty() {
                candidates
            } else {
                picked
            }
        } else {
            candidates
        };
        let passages = compose::passages(&self.pack, &chosen, 1500)?;
        let body = compose::compose(llm, question, opts.role.as_str(), &context, &passages)?;
        let (body, check) = check::check(&self.pack, &body, CheckOptions::STRICT)?;
        // Bare citations are not an answer: keep the model's body only with
        // a verbatim quote, or a surviving sentence and its cite.
        let has_quote = body.iter().any(|s| matches!(s, Segment::Quote { .. }));
        let has_text = body.iter().any(|s| matches!(s, Segment::Text { .. }));
        let has_cite = body.iter().any(|s| matches!(s, Segment::Cite { .. }));
        if !(has_quote || (has_text && has_cite)) {
            trace.model_error = Some(format!(
                "model answer had no supported segment ({} dropped)",
                check.dropped
            ));
            return Ok(None);
        }
        Ok(Some(base(Mode::Composed, body, check, Vec::new())))
    }

    /// One line of context for the model: role and equipment.
    fn context_line(&self, opts: &AskOptions) -> String {
        let equip = opts.equip.as_deref().and_then(|id| {
            self.pack
                .equipment()
                .iter()
                .find(|e| e.equip_id == id)
                .map(|e| e.name.clone())
        });
        match equip {
            Some(name) => format!("The user is a {} working with: {name}.", opts.role.as_str()),
            None => format!("The user is a {}.", opts.role.as_str()),
        }
    }

    /// The best answer-cache row for the question, and the best similarity
    /// seen. A row is a hit when its similarity reaches the threshold and it
    /// applies to the user's equipment.
    pub fn cache_lookup(
        &self,
        norm: &Normalized,
        opts: &AskOptions,
    ) -> Result<(Option<CachedAnswer>, f64)> {
        let Some(m) = normalize::fts_query(
            std::iter::once(norm.text.as_str()).chain(norm.expansions.iter().map(String::as_str)),
        ) else {
            return Ok((None, 0.0));
        };
        let rows: Vec<(String, String)> = {
            let conn = self.pack.conn();
            let mut stmt = conn.prepare_cached(
                "SELECT a.alias, a.answer_id FROM alias_fts
                 JOIN answer_alias a ON a.rowid = alias_fts.rowid
                 WHERE alias_fts MATCH ?1 AND a.lang = ?2 ORDER BY bm25(alias_fts) LIMIT 64",
            )?;
            stmt.query_map(params![m, opts.lang], |r| Ok((r.get(0)?, r.get(1)?)))?
                .collect::<rusqlite::Result<Vec<_>>>()?
        };
        let user_equip = opts.equip.as_deref().map(|e| self.pack.equip_lineage(e));
        let mut best_sim = 0.0f64;
        let mut best: Option<(f64, u8, CachedAnswer)> = None;
        for (alias, answer_id) in rows {
            let sim = similarity(norm, &alias);
            best_sim = best_sim.max(sim);
            if sim < opts.cache_threshold {
                continue;
            }
            let Some(answer) = self.pack.answer(&answer_id)? else {
                continue;
            };
            if let (Some(user), Some(equip)) = (&user_equip, opts.equip.as_deref()) {
                let applies = self.pack.applies_to("answer", &answer_id)?;
                if !applies.is_empty()
                    && !applies
                        .iter()
                        .any(|a| user.contains(a) || self.pack.equip_is_within(a, equip))
                {
                    continue;
                }
            }
            // Prefer the asker's level, then level-neutral rows.
            let level_rank = match answer.level.as_deref() {
                Some(l) if l == opts.role.as_str() => 2,
                None => 1,
                _ => 0,
            };
            let better = match &best {
                None => true,
                Some((s, r, _)) => sim > *s + 1e-9 || ((sim - *s).abs() <= 1e-9 && level_rank > *r),
            };
            if better {
                best = Some((sim, level_rank, answer));
            }
        }
        Ok((best.map(|b| b.2), best_sim))
    }

    /// Sections behind the hits, in rank order, with the share of the
    /// question's concepts each covers.
    fn supported_sections(
        &self,
        norm: &Normalized,
        hits: &[Hit],
        opts: &AskOptions,
    ) -> Result<Vec<(String, f64)>> {
        Ok(self
            .support_candidates(norm, hits, opts)?
            .into_iter()
            .map(|c| (c.section_id, c.coverage))
            .collect())
    }

    /// Every retrieved section with its coverage of the question's concepts.
    fn support_candidates(
        &self,
        norm: &Normalized,
        hits: &[Hit],
        opts: &AskOptions,
    ) -> Result<Vec<SupportCandidate>> {
        let mut out = Vec::new();
        // (section, its retrieved chunk texts, first rank, best score)
        let mut hit_text: Vec<(String, Vec<String>, usize, f64)> = Vec::new();
        for (i, h) in hits.iter().enumerate() {
            if let Some(s) = &h.section_id {
                match hit_text.iter_mut().find(|(id, ..)| id == s) {
                    Some((_, t, _, best)) => {
                        t.push(h.text.clone());
                        *best = best.max(h.score);
                    }
                    None => hit_text.push((s.clone(), vec![h.text.clone()], i + 1, h.score)),
                }
            }
        }
        for (section_id, chunks, rank, retrieval) in hit_text {
            let Some(sec) = self.pack.section(&section_id)? else {
                continue;
            };
            // Support is local: the best single passage of the section (the
            // size of the quote an answer would show), one retrieved chunk,
            // or the role's explanation, each with the heading. Not the union
            // of everything the section says: a long section (a definitions
            // list, a broad summary) mentions nearly any word, so the union
            // let it support nearly any question.
            let heading = sec.heading.as_deref().unwrap_or("");
            let mut units: Vec<String> = vec![best_passage(
                &sec.text,
                &norm.concepts,
                opts.max_quote_chars,
            )];
            units.extend(chunks);
            if let Some(e) = self
                .pack
                .explanation(&section_id, opts.role.as_str(), &opts.lang)?
            {
                units.push(best_passage(&e, &norm.concepts, opts.max_quote_chars));
            }
            let best = units
                .iter()
                .map(|u| normalize::stem_set(&format!("{heading} {u}")))
                .map(|stems| (coverage(&norm.concepts, &stems), stems))
                .fold(
                    (0.0f64, BTreeSet::new()),
                    |a, b| if b.0 > a.0 { b } else { a },
                );
            out.push(SupportCandidate {
                coverage: best.0,
                covered: norm
                    .concepts
                    .iter()
                    .filter(|c| c.satisfied_by(&best.1))
                    .map(|c| c.stem.clone())
                    .collect(),
                section_id,
                rank,
                retrieval,
            });
        }
        Ok(out)
    }

    /// One section as a cited, verbatim block.
    fn compose_section(
        &self,
        section_id: &str,
        norm: &Normalized,
        opts: &AskOptions,
    ) -> Result<Vec<Segment>> {
        let Some(sec) = self.pack.section(section_id)? else {
            return Ok(Vec::new());
        };
        let mut out = Vec::new();
        out.push(Segment::text(match &sec.heading {
            Some(h) => format!("{} {}", sec.citation, h),
            None => sec.citation.clone(),
        }));
        if let Some(e) = self
            .pack
            .explanation(section_id, opts.role.as_str(), &opts.lang)?
        {
            out.push(Segment::text(e));
        }
        let passage = best_passage(&sec.text, &norm.concepts, opts.max_quote_chars);
        out.push(Segment::quote(section_id, passage.clone()));
        // Verbatim mode: limits and the like are quoted, never left out of a
        // trimmed passage.
        let passage_norm = normalize_ws(&passage);
        for f in self.pack.facts_for_section(section_id)? {
            if f.is_verbatim()
                && !passage_norm.contains(&normalize_ws(&f.quote))
                && coverage(
                    &norm.concepts,
                    &normalize::stem_set(&format!("{} {}", f.statement, f.quote)),
                ) > 0.0
            {
                out.push(Segment::quote(section_id, f.quote.clone()));
            }
        }
        out.push(Segment::cite(section_id));
        Ok(out)
    }
}

/// Share of `concepts` satisfied by `doc`.
pub fn coverage(concepts: &[Concept], doc: &BTreeSet<String>) -> f64 {
    if concepts.is_empty() {
        return 0.0;
    }
    concepts.iter().filter(|c| c.satisfied_by(doc)).count() as f64 / concepts.len() as f64
}

/// Similarity of a normalized question and an alias: a Dice coefficient over
/// content concepts, halved when their numbers differ (a question about a
/// different value is a different question).
pub fn similarity(norm: &Normalized, alias: &str) -> f64 {
    let alias_stems = normalize::stem_set(alias);
    if norm.concepts.is_empty() || alias_stems.is_empty() {
        return 0.0;
    }
    let matched = norm
        .concepts
        .iter()
        .filter(|c| c.satisfied_by(&alias_stems))
        .count() as f64;
    let dice = 2.0 * matched / (norm.concepts.len() as f64 + alias_stems.len() as f64);
    let q_numbers: BTreeSet<&String> = norm.numbers.iter().collect();
    let alias_tokens = normalize::tokens(alias);
    let a_numbers: BTreeSet<&String> = alias_tokens
        .iter()
        .filter(|t| t.chars().next().is_some_and(|c| c.is_ascii_digit()))
        .collect();
    if q_numbers != a_numbers {
        dice * 0.5
    } else {
        dice.min(1.0)
    }
}

/// The contiguous run of sentences of `text` (whitespace-normalized) that
/// covers the most concepts within `max_chars`; the whole text when short.
/// Always an exact substring of `normalize_ws(text)`.
pub fn best_passage(text: &str, concepts: &[Concept], max_chars: usize) -> String {
    let t = normalize_ws(text);
    if t.chars().count() <= max_chars {
        return t;
    }
    // Sentence boundaries: after ". ", "; ", ": " (byte offsets of starts).
    let bytes = t.as_bytes();
    let mut starts = vec![0usize];
    for i in 1..bytes.len() {
        if bytes[i - 1] == b' ' && i >= 2 && matches!(bytes[i - 2], b'.' | b';' | b':') {
            starts.push(i);
        }
    }
    let ends: Vec<usize> = starts
        .iter()
        .skip(1)
        .map(|s| s - 1)
        .chain(std::iter::once(t.len()))
        .collect();
    let mut best = (0.0f64, 0usize, 0usize);
    for a in 0..starts.len() {
        for b in a..starts.len() {
            let span = &t[starts[a]..ends[b]];
            if span.chars().count() > max_chars && b > a {
                break;
            }
            let score = coverage(concepts, &normalize::stem_set(span));
            if score > best.0 + 1e-9 {
                best = (score, a, b);
            }
        }
    }
    let (_, a, b) = best;
    let span = &t[starts[a]..ends[b]];
    if span.chars().count() <= max_chars {
        span.to_string()
    } else {
        // One sentence longer than the limit: cut at a word boundary.
        let mut cut = span
            .char_indices()
            .nth(max_chars)
            .map_or(span.len(), |(i, _)| i);
        if let Some(sp) = span[..cut].rfind(' ') {
            cut = sp;
        }
        span[..cut].to_string()
    }
}

/// Distinct sections of the hits, in rank order.
pub fn nearest_sections(hits: &[Hit], n: usize) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for h in hits {
        if let Some(s) = &h.section_id
            && !out.contains(s)
        {
            out.push(s.clone());
            if out.len() >= n {
                break;
            }
        }
    }
    out
}

/// A clarifying question the app may show as written: one short question,
/// no digits or number words, no negation.
fn is_plain_question(q: &str) -> bool {
    let n = q.chars().count();
    (8..=160).contains(&n)
        && q.ends_with('?')
        && q.matches('?').count() == 1
        && !normalize::tokens(q)
            .iter()
            .any(|t| t.chars().next().is_some_and(|c| c.is_ascii_digit()))
        && !check::negated(q)
}
