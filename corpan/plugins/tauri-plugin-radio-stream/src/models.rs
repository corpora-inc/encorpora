use serde::{Deserialize, Serialize};

/// Arguments for `play(url, meta)`. `meta` populates the lock-screen card and
/// the in-app player UX before the first ICY metadata arrives.
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayArgs {
    pub url: String,
    pub station_name: Option<String>,
    pub country: Option<String>,
    pub language: Option<String>,
    pub favicon_url: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetVolumeArgs {
    pub volume: f32,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterListenerArgs {
    pub event: String,
    pub handler: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveListenerArgs {
    pub event: String,
    pub channel_id: Option<u64>,
}
