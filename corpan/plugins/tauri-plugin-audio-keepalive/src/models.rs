use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartKeepAliveArgs {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub book_title: Option<String>,
    pub position_ms: Option<f64>,
    pub duration_ms: Option<f64>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NowPlayingArgs {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub position_ms: Option<f64>,
    pub duration_ms: Option<f64>,
    pub book_title: Option<String>,
    pub is_playing: Option<bool>,
}
