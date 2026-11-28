//! Embedders: the dense half of retrieval. With none, retrieval is lexical.

use crate::error::Result;
use crate::normalize;
use sha2::{Digest, Sha256};

/// Turns a query into a vector comparable with the pack's `chunk_vec`.
///
/// `id()` must equal the pack's `pack_meta.embedder_id` and `dim()` its
/// `embed_dim`; otherwise the pack's vectors are not used.
pub trait Embedder: Send + Sync {
    fn id(&self) -> &str;
    fn dim(&self) -> usize;
    /// Embed a search query (an embedder may prefix queries differently from
    /// documents; that is its business).
    fn embed_query(&self, text: &str) -> Result<Vec<f32>>;
    /// Embed a document chunk (used by tests and pack tooling).
    fn embed_document(&self, text: &str) -> Result<Vec<f32>> {
        self.embed_query(text)
    }
}

/// Deterministic feature hashing of content stems. Not a semantic model: it
/// exists so the dense path, int8 storage and fusion are testable without
/// weights, and so a pack can carry vectors for any device. `id` is
/// `hashing-v1-<dim>`.
#[derive(Debug, Clone)]
pub struct HashingEmbedder {
    id: String,
    dim: usize,
}

impl HashingEmbedder {
    pub fn new(dim: usize) -> Self {
        Self {
            id: format!("hashing-v1-{dim}"),
            dim,
        }
    }
}

impl Embedder for HashingEmbedder {
    fn id(&self) -> &str {
        &self.id
    }
    fn dim(&self) -> usize {
        self.dim
    }
    fn embed_query(&self, text: &str) -> Result<Vec<f32>> {
        let mut v = vec![0f32; self.dim];
        let stems = normalize::content_stems(text);
        let mut add = |feature: &str, weight: f32| {
            let h = Sha256::digest(feature.as_bytes());
            let idx = u64::from_le_bytes(h[..8].try_into().expect("8 bytes")) as usize % self.dim;
            let sign = if h[8] & 1 == 0 { 1.0 } else { -1.0 };
            v[idx] += sign * weight;
        };
        for s in &stems {
            add(s, 1.0);
        }
        for pair in stems.windows(2) {
            add(&format!("{} {}", pair[0], pair[1]), 0.5);
        }
        normalize_l2(&mut v);
        Ok(v)
    }
}

/// Scale `v` to unit length (no-op for a zero vector).
pub fn normalize_l2(v: &mut [f32]) {
    let n = v.iter().map(|x| x * x).sum::<f32>().sqrt();
    if n > 0.0 {
        v.iter_mut().for_each(|x| *x /= n);
    }
}

/// int8 quantization as packs store it: `scale = max|v| / 127`,
/// `q = round(v / scale)`; `v ≈ q * scale`.
pub fn quantize_i8(v: &[f32]) -> (Vec<i8>, f32) {
    let max = v.iter().fold(0f32, |m, x| m.max(x.abs()));
    if max == 0.0 {
        return (vec![0; v.len()], 0.0);
    }
    let scale = max / 127.0;
    (
        v.iter()
            .map(|x| (x / scale).round().clamp(-127.0, 127.0) as i8)
            .collect(),
        scale,
    )
}

/// The query side of a pack embedded by `llama-server --embedding` (or any
/// OpenAI-compatible `/v1/embeddings` server): the bake's own code path, so
/// query and document vectors come from the same implementation (CLI
/// feature).
///
/// Its id is built like the bake's, `<model_name>@<first 16 hex of the
/// GGUF's SHA-256>[/mrl<dim>]`, with the name and MRL taken from the pack and
/// the hash from the GGUF the server loaded. A different file therefore gets
/// a different id and the dense half is refused.
#[cfg(feature = "net")]
pub struct ServerEmbedder {
    url: String,
    id: String,
    dim: usize,
    /// The pack's vectors are Matryoshka-truncated to `dim`.
    mrl: bool,
    query_template: String,
    agent: ureq::Agent,
}

/// The SHA-256 of the GGUF a local llama-server loaded: its `/props`
/// (`model_path`) or `/v1/models` (the first model's id) names the file,
/// which must be on this machine; it is hashed here.
#[cfg(feature = "net")]
pub fn served_model_sha256(base: &str) -> Result<String> {
    use crate::error::Error;
    let root = base.trim_end_matches('/');
    let root = root.strip_suffix("/v1").unwrap_or(root);
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(std::time::Duration::from_secs(10)))
        .build()
        .into();
    let get = |path: &str| -> Option<serde_json::Value> {
        agent
            .get(&format!("{root}{path}"))
            .call()
            .ok()?
            .body_mut()
            .read_json::<serde_json::Value>()
            .ok()
    };
    let path = get("/props")
        .and_then(|v| v["model_path"].as_str().map(str::to_string))
        .or_else(|| get("/v1/models").and_then(|v| v["data"][0]["id"].as_str().map(str::to_string)))
        .filter(|p| std::path::Path::new(p).is_file())
        .ok_or_else(|| {
            Error::Embed(format!(
                "{base} does not say which GGUF it loaded, or the file is not on this machine: give its SHA-256"
            ))
        })?;
    crate::packs::sha256_file(std::path::Path::new(&path))
}

#[cfg(feature = "net")]
impl ServerEmbedder {
    /// `base` is the server root (`http://host:port`, with or without
    /// `/v1`); `gguf_sha256` is the full hex SHA-256 of the file it serves.
    pub fn for_pack(
        base: &str,
        pack: &crate::pack::Pack,
        gguf_sha256: &str,
        timeout: std::time::Duration,
    ) -> Result<Self> {
        use crate::error::Error;
        let sha = gguf_sha256.trim().to_ascii_lowercase();
        if sha.len() != 64 || !sha.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err(Error::Embed(
                "the GGUF SHA-256 must be 64 hex characters".into(),
            ));
        }
        let pack_id = pack
            .meta("embedder_id")
            .ok_or_else(|| Error::Embed("pack has no embedder_id".into()))?;
        let (name, rest) = pack_id
            .split_once('@')
            .ok_or_else(|| Error::Embed(format!("embedder_id {pack_id:?} is not name@hash")))?;
        let mrl = rest
            .split_once("/mrl")
            .and_then(|(_, d)| d.parse::<usize>().ok());
        let dim = pack
            .meta("embed_dim")
            .and_then(|d| d.parse::<usize>().ok())
            .ok_or_else(|| Error::Embed("pack has no embed_dim".into()))?;
        if mrl.is_some_and(|m| m != dim) {
            return Err(Error::Embed(format!(
                "embedder_id says /mrl{} but embed_dim is {dim}",
                mrl.unwrap_or_default()
            )));
        }
        let mut id = format!("{name}@{}", &sha[..16]);
        if let Some(m) = mrl {
            id.push_str(&format!("/mrl{m}"));
        }
        let root = base.trim_end_matches('/');
        let root = root.strip_suffix("/v1").unwrap_or(root);
        Ok(Self {
            url: format!("{root}/v1/embeddings"),
            id,
            dim,
            mrl: mrl.is_some(),
            query_template: pack
                .meta("embed_query_template")
                .unwrap_or("{query}")
                .to_string(),
            agent: ureq::Agent::config_builder()
                .timeout_global(Some(timeout))
                .build()
                .into(),
        })
    }

    fn embed(&self, text: &str) -> Result<Vec<f32>> {
        use crate::error::Error;
        let v: serde_json::Value = self
            .agent
            .post(&self.url)
            .send_json(serde_json::json!({"input": [text], "model": "embed"}))
            .map_err(|e| Error::Embed(format!("{}: {e}", self.url)))?
            .body_mut()
            .read_json()
            .map_err(|e| Error::Embed(format!("{}: {e}", self.url)))?;
        let raw = v["data"][0]["embedding"]
            .as_array()
            .ok_or_else(|| Error::Embed("response has no embedding".into()))?;
        let mut out: Vec<f32> = raw
            .iter()
            .map(|x| x.as_f64().map(|f| f as f32))
            .collect::<Option<_>>()
            .ok_or_else(|| Error::Embed("embedding is not numeric".into()))?;
        // Truncate only where the pack says its vectors were (Matryoshka);
        // any other size difference means a different model.
        let fits = if self.mrl {
            out.len() >= self.dim
        } else {
            out.len() == self.dim
        };
        if !fits {
            return Err(Error::Embed(format!(
                "server returned {} dimensions, the pack has {}{}",
                out.len(),
                self.dim,
                if self.mrl { "" } else { " (no MRL)" }
            )));
        }
        out.truncate(self.dim);
        normalize_l2(&mut out);
        Ok(out)
    }
}

#[cfg(feature = "net")]
impl Embedder for ServerEmbedder {
    fn id(&self) -> &str {
        &self.id
    }
    fn dim(&self) -> usize {
        self.dim
    }
    fn embed_query(&self, text: &str) -> Result<Vec<f32>> {
        self.embed(&self.query_template.replace("{query}", text))
    }
    fn embed_document(&self, text: &str) -> Result<Vec<f32>> {
        self.embed(text)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hashing_embedder_is_deterministic_and_unit_length() {
        let e = HashingEmbedder::new(64);
        let a = e.embed_query("Clearance from energized lines").unwrap();
        assert_eq!(a, e.embed_query("clearance  from energized line").unwrap());
        let n: f32 = a.iter().map(|x| x * x).sum();
        assert!((n - 1.0).abs() < 1e-5);
    }

    #[test]
    fn quantization_round_trips_within_a_step() {
        let v = vec![0.5f32, -0.25, 0.0, 0.125];
        let (q, s) = quantize_i8(&v);
        for (orig, q) in v.iter().zip(q) {
            assert!((orig - q as f32 * s).abs() <= s / 2.0 + 1e-6);
        }
        assert_eq!(quantize_i8(&[0.0, 0.0]).1, 0.0);
    }
}
