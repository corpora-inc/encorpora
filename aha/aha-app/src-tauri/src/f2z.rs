//! Public registration is build configuration, never a secret or a webview override.
use serde::Serialize;
use tauri_plugin_f2z::{Builder, MobileRedirects, f2z_sdk::Config};

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
        reason: if client_id().is_some() {
            "Free2Z sign-in is configured. Paid learning awaits deployed metering and verified total-period spending consent."
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
    fn client_registration_never_claims_paid_readiness() {
        let readiness = app_readiness();
        assert_eq!(readiness.free2z_configured, client_id().is_some());
        assert!(!readiness.paid_testing_ready);
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
