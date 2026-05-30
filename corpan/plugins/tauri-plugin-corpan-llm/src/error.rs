use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("model not loaded")]
    ModelNotLoaded,
    #[error("model already loading")]
    AlreadyLoading,
    #[error("model not found at path: {0}")]
    ModelNotFound(String),
    #[error("insufficient memory to load model")]
    InsufficientMemory,
    #[error("invalid session id: {0}")]
    InvalidSession(String),
    #[error("generation already in progress")]
    GenerationInProgress,
    #[error("llama.cpp error: {0}")]
    LlamaCpp(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("sqlite error: {0}")]
    Sqlite(String),
    #[error("internal: {0}")]
    Internal(String),
}

impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        #[derive(Serialize)]
        struct ErrorPayload<'a> {
            code: &'a str,
            message: String,
        }
        let code = match self {
            Error::ModelNotLoaded => "MODEL_NOT_LOADED",
            Error::AlreadyLoading => "ALREADY_LOADING",
            Error::ModelNotFound(_) => "MODEL_NOT_FOUND",
            Error::InsufficientMemory => "INSUFFICIENT_MEMORY",
            Error::InvalidSession(_) => "INVALID_SESSION",
            Error::GenerationInProgress => "GENERATION_IN_PROGRESS",
            Error::LlamaCpp(_) => "LLAMA_CPP_ERROR",
            Error::Io(_) => "IO_ERROR",
            Error::Sqlite(_) => "SQLITE_ERROR",
            Error::Internal(_) => "INTERNAL_ERROR",
        };
        ErrorPayload {
            code,
            message: self.to_string(),
        }
        .serialize(serializer)
    }
}

pub type Result<T> = std::result::Result<T, Error>;
