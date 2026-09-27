//! Public registration is build configuration, never a secret or a webview override.
use serde::Serialize;
use tauri_plugin_f2z::{f2z_sdk::Config, Builder, MobileRedirects};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Readiness {
    free2z_configured: bool,
    paid_testing_ready: bool,
    external_checkout_enabled: bool,
    reason: &'static str,
}

#[tauri::command]
pub fn app_readiness() -> Readiness {
    Readiness {
        free2z_configured: client_id().is_some(),
        // Live readiness and a verified total-period grant must be established
        // against the registered client. SDK compilation is not this evidence.
        paid_testing_ready: false,
        external_checkout_enabled: false,
        reason: "Live beta awaits Free2Z client registration, deployed metering, and verified total-period spending consent.",
    }
}
fn client_id() -> Option<&'static str> {
    option_env!("AHA_FREE2Z_CLIENT_ID").filter(|value| !value.trim().is_empty())
}
pub fn configure<R: tauri::Runtime>(app: tauri::Builder<R>) -> tauri::Builder<R> {
    let Some(id) = client_id() else { return app };
    app.plugin(
        Builder::new(Config::new(id), "https://encorpora.io/aha/purchase-return")
            .windows(["main".to_owned()])
            .mobile_redirects(MobileRedirects {
                https: None,
                private_scheme: Some("inc.corpora.aha:/oauth/callback".to_owned()),
            })
            .build(),
    )
}
