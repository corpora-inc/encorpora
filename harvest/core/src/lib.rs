//! harvest-core: the on-device engine for verified knowledge packs.
//!
//! See `README.md` for the API the host calls and `harvest/CONTRACT.md` for
//! the pack schema and the JSON this crate emits. Everything here is
//! corpus-agnostic.

pub mod answer;
pub mod audit;
pub mod canon;
pub mod check;
pub mod compose;
pub mod crypt;
pub mod delta;
pub mod embed;
pub mod error;
pub mod grade;
#[cfg(feature = "llama")]
pub mod llama;
pub mod llm;
pub mod normalize;
pub mod notes;
pub mod pack;
pub mod packs;
pub mod records;
pub mod retrieval;
pub mod segments;
pub mod sync;

#[doc(hidden)]
pub mod fixture;

pub use answer::{AskOptions, AskResponse, Engine, Mode, Role};
pub use check::{Check, CheckOptions};
pub use embed::{Embedder, HashingEmbedder};
pub use error::{Error, Result};
pub use llm::{Llm, LlmRequest};
pub use pack::{Pack, Verify};
pub use packs::TrustedKey;
pub use retrieval::{Hit, Reranker, Retriever, SearchOptions, SearchResult};
pub use segments::Segment;
