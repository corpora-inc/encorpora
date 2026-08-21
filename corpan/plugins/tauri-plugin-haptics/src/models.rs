use serde::{Deserialize, Serialize};

/// Arguments for the `impact` command.
///
/// `style` is one of: "selection", "light", "medium", "heavy", "success",
/// "warning", "error".
///
/// Unknown values are treated as "medium" by the native side — deliberately, so
/// a pack cannot make the app fail by asking for a feel it does not have. The
/// cost is that a typo is silent, so callers pin their style set with a test.
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImpactArgs {
    pub style: String,
}
