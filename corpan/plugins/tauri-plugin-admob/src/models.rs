use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InitArgs {
    pub app_id: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdUnitArgs {
    pub ad_unit_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdResult {
    pub shown: bool,
    pub rewarded: bool,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BannerArgs {
    pub ad_unit_id: Option<String>,
    pub position: Option<String>,
    pub size: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BannerResult {
    pub shown: bool,
    pub error: Option<String>,
}
