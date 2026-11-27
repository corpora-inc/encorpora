#![allow(dead_code)]
use harvest_core::fixture;
use harvest_core::{Engine, HashingEmbedder, Pack};
use std::path::PathBuf;
use std::sync::Arc;

pub struct Built {
    pub _tmp: tempfile::TempDir,
    pub dir: PathBuf,
    pub pack: Arc<Pack>,
}

pub fn pack() -> Built {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("fixture");
    fixture::build(&dir, "2026.1.1-1").unwrap();
    let pack = Arc::new(Pack::open(&dir, &[fixture::trusted_key()]).unwrap());
    Built {
        _tmp: tmp,
        dir,
        pack,
    }
}

pub fn engine(b: &Built) -> Engine {
    Engine::new(b.pack.clone()).with_embedder(Arc::new(HashingEmbedder::new(fixture::EMBED_DIM)))
}
