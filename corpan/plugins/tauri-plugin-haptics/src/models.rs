use serde::{Deserialize, Serialize};

/// Arguments for the `impact` command.
///
/// `style` is one of: "light", "medium", "heavy", "success", "warning".
/// Unknown values are treated as "medium" by the native side.
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImpactArgs {
    pub style: String,
}
