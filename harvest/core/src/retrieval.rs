//! Hybrid retrieval: FTS5 BM25 over `chunk_fts`, dense cosine over int8
//! `chunk_vec` when an embedder matching the pack is present, reciprocal-rank
//! fusion, equipment-variant filtering and boosting, and an optional reranker.

use crate::embed::{Embedder, normalize_l2};
use crate::error::Result;
use crate::normalize::{self, Normalized};
use crate::pack::Pack;
use rusqlite::params;
use serde::Serialize;
use std::collections::HashMap;

/// Re-scores fused candidates (for example a cross-encoder). Returns one score
/// per candidate, higher is better; the engine sorts by it.
pub trait Reranker: Send + Sync {
    fn id(&self) -> &str;
    fn rerank(&self, query: &str, candidates: &[Hit]) -> Result<Vec<f64>>;
}

/// Retrieval options.
#[derive(Debug, Clone)]
pub struct SearchOptions {
    /// Results returned.
    pub k: usize,
    /// Candidates taken from each lexical and dense list before fusion.
    pub depth: usize,
    /// The RRF constant.
    pub rrf_k: f64,
    /// The user's equipment variant. Chunks that apply only to other
    /// equipment are dropped; chunks that apply to it are boosted.
    pub equip: Option<String>,
    /// Multiplier for chunks that apply to the user's equipment.
    pub equip_boost: f64,
}

impl Default for SearchOptions {
    fn default() -> Self {
        Self {
            k: 10,
            depth: 50,
            rrf_k: 60.0,
            equip: None,
            equip_boost: 1.25,
        }
    }
}

/// One retrieved chunk. `lexical` is the BM25 score (higher is better, 0 when
/// the lexical list missed it), `dense` the cosine (0 when not compared),
/// `score` the fused (or reranked) score the list is sorted by.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Hit {
    pub chunk_id: String,
    pub ref_kind: String,
    pub ref_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub section_id: Option<String>,
    pub lexical: f64,
    pub dense: f64,
    pub score: f64,
    #[serde(skip)]
    pub text: String,
}

/// Why the dense half did or did not run.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DenseStatus {
    /// Vectors compared.
    Used,
    /// No embedder supplied: lexical only.
    NoEmbedder,
    /// The embedder's id/dim differ from the pack's `embedder_id`/`embed_dim`.
    /// Dense retrieval is refused rather than comparing incompatible vectors.
    Mismatch {
        embedder: String,
        pack: Option<String>,
    },
    /// The pack carries no vectors.
    NoVectors,
}

/// A search result.
#[derive(Debug, Clone, Serialize)]
pub struct SearchResult {
    pub query: String,
    pub normalized: String,
    pub expansions: Vec<String>,
    /// Query words the pack does not hold as typed, and what they were read as.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub readings: Vec<crate::lexicon::Reading>,
    pub hits: Vec<Hit>,
    pub dense: DenseStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reranker: Option<String>,
}

/// Retrieval over one pack.
pub struct Retriever<'a> {
    pub pack: &'a Pack,
    pub embedder: Option<&'a dyn Embedder>,
    pub reranker: Option<&'a dyn Reranker>,
}

impl<'a> Retriever<'a> {
    pub fn new(pack: &'a Pack) -> Self {
        Self {
            pack,
            embedder: None,
            reranker: None,
        }
    }

    /// Normalize `query` with this pack's synonyms and equipment.
    pub fn normalize(&self, query: &str) -> Normalized {
        let equipment: Vec<(String, String, Vec<String>)> = self
            .pack
            .equipment()
            .iter()
            .map(|e| (e.equip_id.clone(), e.name.clone(), e.aliases.clone()))
            .collect();
        let mut norm = normalize::normalize_query(query, self.pack.synonyms(), &equipment);
        // A word read as another (a typo, a British spelling, a run-together
        // or hyphenated word) is covered wherever its reading is.
        match self.pack.lexicon() {
            Ok(lex) => {
                for r in lex.read(query) {
                    let alt: Vec<String> = r
                        .as_words
                        .iter()
                        .flat_map(|w| normalize::content_stems(w))
                        .collect();
                    for part in normalize::content_stems(&r.word.replace('-', " ")) {
                        if let Some(c) = norm.concepts.iter_mut().find(|c| c.stem == part)
                            && !c.alts.contains(&alt)
                        {
                            c.alts.push(alt.clone());
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("harvest-core: lexicon unavailable, query words read as typed: {e}")
            }
        }
        norm
    }

    /// Search one query (plus its pack-synonym expansions).
    pub fn search(&self, query: &str, opts: &SearchOptions) -> Result<SearchResult> {
        self.search_many(query, &[], opts)
    }

    /// Search `query` together with extra query variants (for example from a
    /// model's query expansion); every list is fused with RRF.
    pub fn search_many(
        &self,
        query: &str,
        variants: &[String],
        opts: &SearchOptions,
    ) -> Result<SearchResult> {
        let norm = self.normalize(query);
        let mut lists: Vec<Vec<(String, f64)>> = Vec::new();
        let mut lexical: HashMap<String, f64> = HashMap::new();
        let mut dense: HashMap<String, f64> = HashMap::new();

        // Lexical: the query with its synonym expansions, and each variant.
        // Words the index does not hold as typed are searched as they were read:
        // a spelling variant, the halves of a run-together word, a typo's
        // nearest word, or a hyphenated word joined.
        let readings = self.pack.lexicon()?.read(query);
        let read_as: Vec<String> = readings.iter().map(|r| r.as_words.join(" ")).collect();
        let mut lexical_queries: Vec<Vec<&str>> = vec![
            std::iter::once(norm.text.as_str())
                .chain(norm.expansions.iter().map(String::as_str))
                .chain(read_as.iter().map(String::as_str))
                .collect(),
        ];
        for v in variants {
            lexical_queries.push(vec![v.as_str()]);
        }
        for parts in &lexical_queries {
            if let Some(m) = normalize::fts_query(parts.iter().copied()) {
                let list = self.lexical(&m, opts.depth)?;
                for (id, s) in &list {
                    let e = lexical.entry(id.clone()).or_insert(0.0);
                    *e = e.max(*s);
                }
                lists.push(list);
            }
        }

        // Dense: refuse on any id/dim mismatch.
        let dense_status = match self.embedder {
            None => DenseStatus::NoEmbedder,
            Some(e) => match self.pack.vectors(e.id(), e.dim())? {
                Some(index) => {
                    let texts = std::iter::once(query).chain(variants.iter().map(String::as_str));
                    for text in texts {
                        let mut q = e.embed_query(text)?;
                        if q.len() != index.dim {
                            break;
                        }
                        normalize_l2(&mut q);
                        let list = dense_top(index, &q, opts.depth);
                        for (id, s) in &list {
                            let d = dense.entry(id.clone()).or_insert(f64::MIN);
                            *d = d.max(*s);
                        }
                        lists.push(list);
                    }
                    DenseStatus::Used
                }
                None if self.pack.meta("embedder_id") == Some(e.id()) => DenseStatus::NoVectors,
                None => DenseStatus::Mismatch {
                    embedder: format!("{}@{}", e.id(), e.dim()),
                    pack: self
                        .pack
                        .meta("embedder_id")
                        .map(|id| format!("{id}@{}", self.pack.meta("embed_dim").unwrap_or("?"))),
                },
            },
        };

        // Reciprocal-rank fusion.
        let mut fused: HashMap<String, f64> = HashMap::new();
        for list in &lists {
            for (rank, (id, _)) in list.iter().enumerate() {
                *fused.entry(id.clone()).or_insert(0.0) += 1.0 / (opts.rrf_k + rank as f64 + 1.0);
            }
        }
        let mut ranked: Vec<(String, f64)> = fused.into_iter().collect();
        ranked.sort_by(|a, b| b.1.total_cmp(&a.1).then_with(|| a.0.cmp(&b.0)));

        // Variant awareness, then materialize.
        let user_equip = opts.equip.as_deref().map(|e| self.pack.equip_lineage(e));
        let mut hits = Vec::new();
        for (chunk_id, mut score) in ranked {
            if hits.len() >= opts.depth.max(opts.k) {
                break;
            }
            let Some(chunk) = self.pack.chunk(&chunk_id)? else {
                continue;
            };
            let section_id = self.pack.chunk_section(&chunk.ref_kind, &chunk.ref_id)?;
            if let (Some(user), Some(equip)) = (&user_equip, opts.equip.as_deref()) {
                let applies =
                    self.applies(&chunk.ref_kind, &chunk.ref_id, section_id.as_deref())?;
                if !applies.is_empty() {
                    if applies.iter().any(|a| user.contains(a)) {
                        score *= opts.equip_boost;
                    } else if !applies.iter().any(|a| self.pack.equip_is_within(a, equip)) {
                        // Applies only to other equipment.
                        continue;
                    }
                }
            }
            hits.push(Hit {
                lexical: lexical.get(&chunk_id).copied().unwrap_or(0.0),
                dense: dense
                    .get(&chunk_id)
                    .copied()
                    .filter(|d| *d > f64::MIN)
                    .unwrap_or(0.0),
                chunk_id,
                ref_kind: chunk.ref_kind,
                ref_id: chunk.ref_id,
                section_id,
                score,
                text: chunk.text,
            });
        }
        hits.sort_by(|a, b| {
            b.score
                .total_cmp(&a.score)
                .then_with(|| a.chunk_id.cmp(&b.chunk_id))
        });

        let mut reranker_id = None;
        if let Some(r) = self.reranker
            && !hits.is_empty()
        {
            let scores = r.rerank(query, &hits)?;
            if scores.len() == hits.len() {
                for (h, s) in hits.iter_mut().zip(scores) {
                    h.score = s;
                }
                hits.sort_by(|a, b| {
                    b.score
                        .total_cmp(&a.score)
                        .then_with(|| a.chunk_id.cmp(&b.chunk_id))
                });
                reranker_id = Some(r.id().to_string());
            }
        }
        hits.truncate(opts.k);
        Ok(SearchResult {
            query: query.to_string(),
            normalized: norm.text,
            expansions: norm.expansions,
            readings,
            hits,
            dense: dense_status,
            reranker: reranker_id,
        })
    }

    /// Equipment the chunk's row applies to: its own `applies_to` rows, else
    /// those of its section or the nearest ancestor section that has any.
    fn applies(&self, ref_kind: &str, ref_id: &str, section: Option<&str>) -> Result<Vec<String>> {
        let own = self.pack.applies_to(ref_kind, ref_id)?;
        if !own.is_empty() {
            return Ok(own);
        }
        if let Some(s) = section {
            for anc in self.pack.section_lineage(s)? {
                let rows = self.pack.applies_to("section", &anc)?;
                if !rows.is_empty() {
                    return Ok(rows);
                }
            }
        }
        Ok(Vec::new())
    }

    /// BM25 over `chunk_fts`; score is `-bm25` (higher is better).
    fn lexical(&self, match_expr: &str, depth: usize) -> Result<Vec<(String, f64)>> {
        let conn = self.pack.conn();
        let mut stmt = conn.prepare_cached(
            "SELECT c.chunk_id, bm25(chunk_fts) AS s
             FROM chunk_fts JOIN chunk c ON c.rowid = chunk_fts.rowid
             WHERE chunk_fts MATCH ?1 ORDER BY s LIMIT ?2",
        )?;
        let rows = stmt
            .query_map(params![match_expr, depth as i64], |r| {
                Ok((r.get::<_, String>(0)?, -r.get::<_, f64>(1)?))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    }
}

/// Brute-force cosine over the int8 index; top `depth` by similarity.
fn dense_top(index: &crate::pack::VecIndex, q: &[f32], depth: usize) -> Vec<(String, f64)> {
    let mut scored: Vec<(usize, f32)> = index
        .factor
        .iter()
        .enumerate()
        .filter(|(_, f)| **f > 0.0)
        .map(|(i, f)| {
            let row = &index.data[i * index.dim..(i + 1) * index.dim];
            let dot: f32 = row.iter().zip(q).map(|(&a, &b)| a as f32 * b).sum();
            (i, dot * f)
        })
        .collect();
    let depth = depth.min(scored.len());
    if depth == 0 {
        return Vec::new();
    }
    scored.select_nth_unstable_by(depth - 1, |a, b| b.1.total_cmp(&a.1));
    scored.truncate(depth);
    scored.sort_by(|a, b| b.1.total_cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
    scored
        .into_iter()
        .map(|(i, s)| (index.ids[i].clone(), s as f64))
        .collect()
}
