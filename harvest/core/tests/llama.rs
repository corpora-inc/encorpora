//! In-process llama.cpp embedder. Runs only with `--features llama` and
//! `HARVEST_TEST_EMBED_GGUF=<path to a small GGUF embedding model>`; CI runs
//! neither, so it stays offline and model-free.
#![cfg(feature = "llama")]

use harvest_core::embed::Embedder;
use harvest_core::llama::LlamaEmbedder;
use std::path::PathBuf;

fn model() -> Option<PathBuf> {
    std::env::var_os("HARVEST_TEST_EMBED_GGUF").map(PathBuf::from)
}

fn cos(a: &[f32], b: &[f32]) -> f32 {
    a.iter().zip(b).map(|(x, y)| x * y).sum()
}

#[test]
fn embeds_and_ranks_by_meaning() {
    let Some(path) = model() else {
        eprintln!("HARVEST_TEST_EMBED_GGUF not set; skipping");
        return;
    };
    let e = LlamaEmbedder::load(&path, "test-model", None, "{query}").unwrap();
    assert!(e.id().starts_with("test-model@") && e.id().len() == "test-model@".len() + 16);
    let t = std::time::Instant::now();
    let q = e
        .embed_query("how far must I stay from power lines")
        .unwrap();
    let ms = t.elapsed().as_millis();
    assert_eq!(q.len(), e.dim());
    let near = e
        .embed_document("Minimum clearance distance from energized overhead electrical lines")
        .unwrap();
    let far = e
        .embed_document("A recipe for baking sourdough bread at home")
        .unwrap();
    println!(
        "dim {} query {ms} ms, near {:.3}, far {:.3}",
        e.dim(),
        cos(&q, &near),
        cos(&q, &far)
    );
    assert!(cos(&q, &near) > cos(&q, &far));

    // MRL truncation changes the id and the dimension.
    let m = LlamaEmbedder::load(&path, "test-model", Some(128), "{query}").unwrap();
    assert_eq!(m.dim(), 128);
    assert!(m.id().ends_with("/mrl128"));
    let v = m.embed_query("x").unwrap();
    assert!((v.iter().map(|x| x * x).sum::<f32>() - 1.0).abs() < 1e-4);
}
