//! One error type for the whole engine. Every variant names what failed so the
//! host can log it and show the next step.

/// Engine errors.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("sqlite: {0}")]
    Sql(#[from] rusqlite::Error),
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),
    /// The pack is malformed: missing file, bad manifest, unknown schema.
    #[error("pack: {0}")]
    Pack(String),
    /// The manifest signature is missing, from an untrusted key, or wrong.
    #[error("signature: {0}")]
    Signature(String),
    /// A file or database does not match the hash the signed manifest names.
    #[error("integrity: {0}")]
    Integrity(String),
    /// An install offered a version that is not newer than the installed one.
    #[error("downgrade refused: installed {installed}, offered {offered}")]
    Downgrade { installed: String, offered: String },
    /// An archive entry escapes its directory or exceeds the size limits.
    #[error("archive: {0}")]
    Archive(String),
    #[error("embedder: {0}")]
    Embed(String),
    #[error("llm: {0}")]
    Llm(String),
    #[error("crypto: {0}")]
    Crypto(String),
    #[error("sync: {0}")]
    Sync(String),
    #[error("invalid input: {0}")]
    Invalid(String),
}

/// Engine result.
pub type Result<T> = std::result::Result<T, Error>;
