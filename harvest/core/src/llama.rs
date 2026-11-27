//! A llama.cpp embedder (cargo feature `llama`), same `llama-cpp-2` pin as
//! the app's LLM plugin.
//!
//! Its id follows the pipeline's convention, `<model_name>@<first 16 hex of
//! the GGUF's SHA-256>[/mrl<dim>]`, so a pack baked with the same file matches
//! and any other file is refused. `for_pack` reads the query template and the
//! MRL dimension from the pack.
//!
//! llama.cpp's backend is initialized once per process here. A host that
//! already owns a backend (the app's LLM plugin) should implement
//! [`Embedder`] over that runtime instead of using this type.

use crate::embed::{Embedder, normalize_l2};
use crate::error::{Error, Result};
use crate::pack::Pack;
use crate::packs::sha256_file;
use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::{AddBos, LlamaModel};
use std::num::NonZeroU32;
use std::path::Path;
use std::sync::{Mutex, OnceLock};

fn backend() -> Result<&'static LlamaBackend> {
    static B: OnceLock<std::result::Result<LlamaBackend, String>> = OnceLock::new();
    B.get_or_init(|| {
        let mut b = LlamaBackend::init().map_err(|e| e.to_string())?;
        b.void_logs();
        Ok(b)
    })
    .as_ref()
    .map_err(|e| Error::Embed(format!("llama backend: {e}")))
}

/// A GGUF embedding model run in-process.
pub struct LlamaEmbedder {
    id: String,
    dim: usize,
    query_template: String,
    n_ctx: u32,
    model: LlamaModel,
    lock: Mutex<()>,
}

impl LlamaEmbedder {
    /// Load `path`. `mrl` truncates to that many leading dimensions
    /// (Matryoshka) before normalizing. `query_template` contains `{query}`.
    pub fn load(
        path: &Path,
        model_name: &str,
        mrl: Option<usize>,
        query_template: &str,
    ) -> Result<Self> {
        let sha = sha256_file(path)?;
        let backend = backend()?;
        let model = LlamaModel::load_from_file(backend, path, &LlamaModelParams::default())
            .map_err(|e| Error::Embed(format!("load {}: {e}", path.display())))?;
        let native = usize::try_from(model.n_embd()).unwrap_or(0);
        let dim = mrl.unwrap_or(native).min(native);
        if dim == 0 {
            return Err(Error::Embed("model reports no embedding dimension".into()));
        }
        let mut id = format!("{model_name}@{}", &sha[..16]);
        if let Some(m) = mrl {
            id.push_str(&format!("/mrl{m}"));
        }
        Ok(Self {
            id,
            dim,
            query_template: query_template.to_string(),
            n_ctx: 512,
            model,
            lock: Mutex::new(()),
        })
    }

    /// Load `path` configured as `pack` expects: model name and MRL from its
    /// `embedder_id`, the query template from `embed_query_template`. The id
    /// still comes from the file's hash, so a different file does not match.
    pub fn for_pack(path: &Path, pack: &Pack) -> Result<Self> {
        let pack_id = pack
            .meta("embedder_id")
            .ok_or_else(|| Error::Embed("pack has no embedder_id".into()))?;
        let (name, rest) = pack_id
            .split_once('@')
            .ok_or_else(|| Error::Embed(format!("embedder_id {pack_id:?} is not name@hash")))?;
        let mrl = rest
            .split_once("/mrl")
            .and_then(|(_, d)| d.parse::<usize>().ok());
        let template = pack.meta("embed_query_template").unwrap_or("{query}");
        Self::load(path, name, mrl, template)
    }
}

impl Embedder for LlamaEmbedder {
    fn id(&self) -> &str {
        &self.id
    }
    fn dim(&self) -> usize {
        self.dim
    }
    fn embed_query(&self, text: &str) -> Result<Vec<f32>> {
        let prompt = self.query_template.replace("{query}", text);
        self.embed_text(&prompt)
    }
    fn embed_document(&self, text: &str) -> Result<Vec<f32>> {
        self.embed_text(text)
    }
}

impl LlamaEmbedder {
    fn embed_text(&self, text: &str) -> Result<Vec<f32>> {
        let _guard = self.lock.lock().unwrap_or_else(|p| p.into_inner());
        let backend = backend()?;
        let mut tokens = self
            .model
            .str_to_token(text, AddBos::Always)
            .map_err(|e| Error::Embed(format!("tokenize: {e}")))?;
        tokens.truncate(self.n_ctx as usize);
        if tokens.is_empty() {
            return Err(Error::Embed("empty input".into()));
        }
        let params = LlamaContextParams::default()
            .with_embeddings(true)
            .with_n_ctx(NonZeroU32::new(self.n_ctx))
            .with_n_batch(self.n_ctx)
            .with_n_ubatch(self.n_ctx);
        let mut ctx = self
            .model
            .new_context(backend, params)
            .map_err(|e| Error::Embed(format!("context: {e}")))?;
        let mut batch = LlamaBatch::new(tokens.len(), 1);
        batch
            .add_sequence(&tokens, 0, false)
            .map_err(|e| Error::Embed(format!("batch: {e}")))?;
        ctx.decode(&mut batch)
            .map_err(|e| Error::Embed(format!("decode: {e}")))?;
        let full = ctx
            .embeddings_seq_ith(0)
            .map_err(|e| Error::Embed(format!("embeddings: {e}")))?;
        let mut v = full[..self.dim.min(full.len())].to_vec();
        normalize_l2(&mut v);
        Ok(v)
    }
}
