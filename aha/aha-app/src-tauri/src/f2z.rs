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

/// Resolved by `build.rs` from `AHA_FREE2Z_CLIENT_ID` or the release-written config file, because
/// the env var alone never reaches the iOS compile inside Xcode. Empty means unconfigured.
fn client_id() -> Option<&'static str> {
    Some(env!("AHA_FREE2Z_CLIENT_ID_RESOLVED")).filter(|value| !value.is_empty())
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
#[allow(dead_code)] // RESOLVED_VAR is only for build.rs.
#[path = "../build_support/client_id.rs"]
mod build_client_id;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_resolves_client_id_from_env_or_release_file() {
        use super::build_client_id::resolve;
        let id = "iVhrb5JkopnFs1sPAyhYGX6UdiHjI03Enpj9Qymg";
        assert_eq!(resolve(None, None), Ok(None));
        assert_eq!(resolve(Some("  "), Some("\n")), Ok(None));
        assert_eq!(resolve(Some(id), None), Ok(Some(id.to_owned())));
        // Xcode strips the env on iOS: the release-written file alone must configure the build.
        assert_eq!(
            resolve(None, Some(&format!("{id}\n"))),
            Ok(Some(id.to_owned()))
        );
        assert_eq!(resolve(Some(id), Some(id)), Ok(Some(id.to_owned())));
        assert!(resolve(Some(id), Some("someOtherClientId123")).is_err());
        for bad in [
            "short",
            "has space inside id",
            "quote\"breaks\"rust",
            &"x".repeat(129),
        ] {
            assert!(resolve(Some(bad), None).is_err(), "{bad}");
            assert!(resolve(None, Some(bad)).is_err(), "{bad}");
        }
    }

    #[test]
    fn client_registration_exposes_only_public_configuration() {
        let readiness = app_readiness();
        assert_eq!(readiness.free2z_configured, client_id().is_some());
        assert_eq!(readiness.client_id, client_id());
        assert_eq!(readiness.client_id, client_id());
        assert!(!readiness.external_checkout_enabled);
    }

    #[test]
    fn account_pages_are_fixed_free2z_urls_never_a_checkout() {
        assert_eq!(FREE2Z_ORIGIN, "https://free2z.cash");
        assert_eq!(
            account_url(AccountPage::Apps, Some("aha-test-client")),
            "https://free2z.cash/account/apps?client_id=aha-test-client"
        );
        assert_eq!(
            account_url(AccountPage::Apps, None),
            "https://free2z.cash/account/apps"
        );
        assert_eq!(
            account_url(AccountPage::Delete, Some("any")),
            "https://free2z.cash/account/delete"
        );
        for page in [AccountPage::Apps, AccountPage::Delete] {
            let url = account_url(page, client_id());
            for banned in ["buy", "purchase", "checkout", "top-up", "topup", "pricing"] {
                assert!(!url.contains(banned), "{url}");
            }
        }
        // The webview names a page; anything else is refused at deserialization.
        let page: AccountPage = serde_json::from_str("\"delete\"").unwrap();
        assert_eq!(page, AccountPage::Delete);
        assert!(serde_json::from_str::<AccountPage>("\"https://evil.test\"").is_err());
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
        assert_eq!(serde_json::to_value(&json_schema.schema).unwrap(), schema);
        // What the SDK then sends to the gateway still carries it.
        let wire = serde_json::to_value(&request).unwrap();
        assert_eq!(wire["response_format"]["type"], "json_schema");
        assert_eq!(wire["response_format"]["json_schema"]["strict"], true);
    }

    /// zuu#1132/#1143: the schema's member order is the order OpenAI emits the reply's keys in.
    /// The webview's exact bytes (the fixture) cross IPC as a `serde_json::Value` (sorted unless
    /// `preserve_order` is unified in, which tauri-plugin-f2z d63959f9 declares), then become the
    /// pinned `ChatRequest` (`OrderedJson` schema), then the body the SDK sends. Every member must
    /// come out in the order the app wrote it.
    #[test]
    fn structured_batch_schema_member_order_survives_ipc_and_the_native_chat_request() {
        use tauri_plugin_f2z::f2z_sdk::proto::ChatRequest;
        let text = include_str!("../fixtures/structured-batch-start-chat.json");
        let between = |s: &str, start: &str, end: &str| {
            let from = s.find(start).expect("start marker") + start.len();
            let to = from + s[from..].find(end).expect("end marker");
            s[from..to].to_owned()
        };
        let written = between(text, "\"schema\":", ",\"strict\":true}");
        // The app's order is not alphabetical, so a sorting layer cannot pass by accident.
        assert!(written.starts_with(r#"{"type":"object","properties":{"rationale":"#));
        let mut ipc: serde_json::Value = serde_json::from_str(text).unwrap();
        let mut sorted = ipc.clone();
        for payload in [&mut ipc, &mut sorted] {
            let tokens: u64 = payload["max_output_tokens"]
                .as_str()
                .unwrap()
                .parse()
                .unwrap();
            payload["max_output_tokens"] = serde_json::json!(tokens);
        }
        let sent = |payload: serde_json::Value| {
            let request: ChatRequest = serde_json::from_value(payload).unwrap();
            let body = serde_json::to_string(&request).unwrap();
            between(&body, "\"schema\":", ",\"strict\":true}")
        };
        assert_eq!(
            sent(ipc),
            written,
            "schema member order changed on the native path"
        );
        // Negative control: the `Value` a build without `preserve_order` would hand the plugin.
        sorted.sort_all_objects();
        assert_ne!(sent(sorted), written);
    }
}

/// The Free2Z web origin, where account pages live: the SDK's production issuer.
const FREE2Z_ORIGIN: &str = tauri_plugin_f2z::f2z_sdk::DEFAULT_ISSUER;

/// The Free2Z account pages AHA may open. The webview names one of these; it never supplies a URL.
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AccountPage {
    /// Account management for this app (its grant and budget), opened on AHA's own entry.
    Apps,
    /// Free2Z's account deletion page (App Store 5.1.1(v), Play account deletion).
    Delete,
}

/// The page's URL on the Free2Z origin. Account management, never a checkout: no purchase path is built here.
fn account_url(page: AccountPage, client_id: Option<&str>) -> String {
    match (page, client_id) {
        // The id is build-validated to ASCII letters, digits, '-', '_' and '.', so it needs no encoding.
        (AccountPage::Apps, Some(id)) => format!("{FREE2Z_ORIGIN}/account/apps?client_id={id}"),
        (AccountPage::Apps, None) => format!("{FREE2Z_ORIGIN}/account/apps"),
        (AccountPage::Delete, _) => format!("{FREE2Z_ORIGIN}/account/delete"),
    }
}

/// Opens a Free2Z account page in the system browser (never a webview). An older frontend that sends no page gets
/// account management.
#[tauri::command]
pub fn open_free2z_account(app: tauri::AppHandle, page: Option<AccountPage>) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let url = account_url(page.unwrap_or(AccountPage::Apps), client_id());
    app.opener()
        .open_url(&url, None::<&str>)
        .map_err(|_| "Could not open Free2Z. Visit free2z.cash in your browser.".to_owned())
}
