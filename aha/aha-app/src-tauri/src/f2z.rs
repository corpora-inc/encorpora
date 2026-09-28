//! Public registration is build configuration, never a secret or a webview override.
use serde::Serialize;
use tauri_plugin_f2z::{Builder, MobileRedirects, f2z_sdk::Config};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Readiness {
    free2z_configured: bool,
    client_id: Option<&'static str>,
    external_checkout_enabled: bool,
    reason: &'static str,
}

#[tauri::command]
pub fn app_readiness() -> Readiness {
    Readiness {
        free2z_configured: client_id().is_some(),
        client_id: client_id(),
        external_checkout_enabled: false,
        reason: if client_id().is_some() {
            "Free2Z sign-in is configured. AI access is checked against your current spending allowance before each lesson."
        } else {
            "Live beta awaits Free2Z client registration, deployed metering, and verified total-period spending consent."
        },
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn client_registration_exposes_only_public_configuration() {
        let readiness = app_readiness();
        assert_eq!(readiness.free2z_configured, client_id().is_some());
        assert_eq!(readiness.client_id, client_id());
        assert_eq!(readiness.client_id, client_id());
        assert!(!readiness.external_checkout_enabled);
    }

    #[test]
    fn sdk_capability_is_local_and_does_not_grant_generic_native_access() {
        let capability: serde_json::Value =
            serde_json::from_str(include_str!("../capabilities/free2z.json")).unwrap();
        assert_eq!(capability["local"], true);
        assert_eq!(capability["windows"], serde_json::json!(["main"]));
        assert!(capability.get("remote").is_none());
        for permission in capability["permissions"].as_array().unwrap() {
            let permission = permission.as_str().unwrap();
            assert!(permission.starts_with("f2z:allow-"));
            assert!(!permission.contains("purchase") && !permission.contains("checkout"));
        }
    }
}

/// Open only the supported parent recovery page; never accept a URL from lesson content.
#[tauri::command]
pub fn open_free2z_account(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url("https://free2z.cash/account/apps", None::<&str>)
        .map_err(|_| {
            "Could not open Free2Z. Visit free2z.cash/account/apps in your browser.".to_owned()
        })
}
