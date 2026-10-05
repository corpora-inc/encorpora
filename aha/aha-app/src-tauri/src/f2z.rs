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

/// The minimum Free2Z scopes AHA uses: the account subject, a refresh token,
/// the balance and AI. The SDK's `Config::new` default also asks for `profile`
/// (name and picture, which AHA never shows) and `purchase:create`, which the
/// consent screen lists as "Start 2Z credit purchases". AHA never creates
/// purchases (its capability excludes them), so it must not ask for either.
pub const SCOPES: &[&str] = &["openid", "offline_access", "balance:read", "ai:invoke"];

fn client_id() -> Option<&'static str> {
    option_env!("AHA_FREE2Z_CLIENT_ID").filter(|value| !value.trim().is_empty())
}
pub fn configure<R: tauri::Runtime>(app: tauri::Builder<R>) -> tauri::Builder<R> {
    let Some(id) = client_id() else { return app };
    app.plugin(
        Builder::new(
            Config::new(id).with_scopes(SCOPES.iter().copied()),
            "https://encorpora.io/aha/purchase-return",
        )
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
    fn sign_in_requests_only_the_scopes_aha_uses() {
        let config = Config::new("test-client").with_scopes(SCOPES.iter().copied());
        assert_eq!(
            config.scopes,
            ["openid", "offline_access", "balance:read", "ai:invoke"]
        );
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

    /// The exact `start_chat` payload the webview sends for a structured batch (written by
    /// src/provider/nativeBoundary.test.ts through the real SDK NativeTransport), read the way the
    /// plugin's `wire::chat_request` reads it: decimal `max_output_tokens`, then the pinned
    /// `ChatRequest` (deny_unknown_fields), then the gateway's own `response_format` limits.
    #[test]
    fn structured_batch_payload_keeps_response_format_through_the_native_chat_request() {
        use tauri_plugin_f2z::f2z_sdk::proto::{ChatRequest, ResponseFormat};
        let mut payload: serde_json::Value =
            serde_json::from_str(include_str!("../fixtures/structured-batch-start-chat.json"))
                .unwrap();
        let schema = payload["response_format"]["json_schema"]["schema"].clone();
        let tokens: u64 = payload["max_output_tokens"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap();
        payload["max_output_tokens"] = serde_json::json!(tokens);
        let request: ChatRequest = serde_json::from_value(payload).unwrap();
        assert_eq!(request.max_output_tokens, Some(2600));
        assert!(request.max_output_tokens_strict);
        let format = request
            .response_format
            .as_ref()
            .expect("response_format survives");
        format.check().unwrap();
        let ResponseFormat::JsonSchema { json_schema } = format else {
            panic!("a json_schema format")
        };
        assert_eq!(json_schema.name, "aha_activity_batch");
        assert_eq!(json_schema.strict, Some(true));
        assert_eq!(json_schema.schema, schema);
        // What the SDK then sends to the gateway still carries it.
        let wire = serde_json::to_value(&request).unwrap();
        assert_eq!(wire["response_format"]["type"], "json_schema");
        assert_eq!(wire["response_format"]["json_schema"]["strict"], true);
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
