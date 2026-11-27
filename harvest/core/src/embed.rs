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
