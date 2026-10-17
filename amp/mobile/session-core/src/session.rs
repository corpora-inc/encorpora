//! Memory-only native public-client session. Secrets never cross the IPC boundary.
use crate::session_config::{ConfigError, SessionConfig, CALLBACK};
use crate::session_http::SessionHttp;
use openidconnect::{
    core::{
        CoreAuthenticationFlow, CoreClient, CoreJsonWebKeySet, CoreJwsSigningAlgorithm,
        CoreTokenResponse,
    },
    AccessTokenHash, AuthType, AuthUrl, AuthorizationCode, ClientId, CsrfToken, EndpointNotSet,
    EndpointSet, IssuerUrl, Nonce, NonceVerifier, OAuth2TokenResponse, PkceCodeChallenge,
    PkceCodeVerifier, RedirectUrl, RefreshToken, TokenResponse, TokenUrl,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::{Mutex, Semaphore};
use url::Url;

type OidcClient =
    CoreClient<EndpointSet, EndpointNotSet, EndpointNotSet, EndpointNotSet, EndpointSet>;
#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum SessionError {
    Unconfigured,
    InvalidConfiguration,
    Unavailable,
    InvalidCallback,
    AuthorizationDenied,
    VerificationFailed,
    SessionChanged,
    SignInRequired,
    Busy,
    UnsupportedRequest,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicSession {
    pub token: String,
    pub account_id: String,
}
struct Pending {
    client: OidcClient,
    state: CsrfToken,
    nonce: Nonce,
    verifier: PkceCodeVerifier,
    started: Instant,
}
#[derive(Clone)]
struct Session {
    public: PublicSession,
    access: String,
    refresh: Option<RefreshToken>,
    nonce: Nonce,
    expires: Instant,
}
#[derive(Default)]
struct State {
    generation: u64,
    pending: Option<Pending>,
    session: Option<Session>,
    error: Option<&'static str>,
}
pub struct NativeSession {
    config: Result<Option<SessionConfig>, ConfigError>,
    http: Option<SessionHttp>,
    state: Mutex<State>,
    refresh: Mutex<()>,
    permits: Semaphore,
}
#[derive(Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum LearningRequest {
    Family {},
    Learners {},
    Progress {
        learner_id: String,
    },
    Frontier {
        learner_id: String,
    },
    StartingPoint {
        learner_id: String,
    },
    SetStartingPoint {
        learner_id: String,
        body: Value,
    },
    SetBirthYear {
        learner_id: String,
        body: Value,
    },
    Batch {
        learner_id: String,
        body: Value,
    },
    Attempt {
        learner_id: String,
        body: Value,
    },
    Hint {
        learner_id: String,
        body: Value,
    },
    LessonSupport {
        learner_id: String,
        body: Value,
    },
    Books {
        learner_id: String,
        capabilities: Vec<String>,
    },
    OpenBook {
        learner_id: String,
        book_id: String,
        body: Value,
    },
}
#[derive(Serialize)]
pub struct ApiResult {
    pub status: u16,
    pub data: Value,
}
fn uuid(value: &str) -> bool {
    value.len() == 36
        && value.bytes().enumerate().all(|(i, c)| {
            if [8, 13, 18, 23].contains(&i) {
                c == b'-'
            } else {
                c.is_ascii_hexdigit()
            }
        })
}
impl LearningRequest {
    fn route(self, api: &Url) -> Result<(Url, Option<Value>), SessionError> {
        let (path, body, query) = match self {
            Self::Family {} => ("/api/v1/family".into(), None, None),
            Self::Learners {} => ("/api/v1/learners".into(), None, None),
            Self::Progress { learner_id } => (learner_path(&learner_id, "progress")?, None, None),
            Self::Frontier { learner_id } => (learner_path(&learner_id, "frontier")?, None, None),
            Self::StartingPoint { learner_id } => {
                (learner_path(&learner_id, "starting-point")?, None, None)
            }
            Self::SetStartingPoint { learner_id, body } => (
                learner_path(&learner_id, "starting-point")?,
                Some(body),
                None,
            ),
            Self::SetBirthYear { learner_id, body } => {
                (learner_path(&learner_id, "birth-year")?, Some(body), None)
            }
            Self::Batch { learner_id, body } => {
                (learner_path(&learner_id, "batches")?, Some(body), None)
            }
            Self::Attempt { learner_id, body } => {
                (learner_path(&learner_id, "attempts")?, Some(body), None)
            }
            Self::Hint { learner_id, body } => {
                (learner_path(&learner_id, "hints")?, Some(body), None)
            }
            Self::LessonSupport { learner_id, body } => (
                learner_path(&learner_id, "lesson-support")?,
                Some(body),
                None,
            ),
            Self::Books {
                learner_id,
                capabilities,
            } => {
                if capabilities.len() > 16
                    || capabilities.iter().any(|s| {
                        s.len() > 64 || !s.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-')
                    })
                {
                    return Err(SessionError::UnsupportedRequest);
                }
                (
                    learner_path(&learner_id, "books")?,
                    None,
                    Some(capabilities.join(",")),
                )
            }
            Self::OpenBook {
                learner_id,
                book_id,
                body,
            } => {
                if book_id.is_empty()
                    || book_id.len() > 80
                    || !book_id
                        .bytes()
                        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-')
                {
                    return Err(SessionError::UnsupportedRequest);
                }
                (
                    learner_path(&learner_id, &format!("books/{book_id}/open"))?,
                    Some(body),
                    None,
                )
            }
        };
        let mut url = api.clone();
        url.set_path(&path);
        if let Some(query) = query {
            url.query_pairs_mut()
                .append_pair("readerCapabilities", &query);
        }
        Ok((url, body))
    }
}
fn learner_path(id: &str, action: &str) -> Result<String, SessionError> {
    if !uuid(id) {
        return Err(SessionError::UnsupportedRequest);
    }
    Ok(format!("/api/v1/learners/{id}/{action}"))
}
impl NativeSession {
    pub fn new(config: Result<Option<SessionConfig>, ConfigError>) -> Result<Self, SessionError> {
        let http = config
            .as_ref()
            .ok()
            .and_then(Option::as_ref)
            .map(|c| SessionHttp::new(c.token.clone()))
            .transpose()
            .map_err(|_| SessionError::Unavailable)?;
        Ok(Self {
            config,
            http,
            state: Mutex::new(State::default()),
            refresh: Mutex::new(()),
            permits: Semaphore::new(4),
        })
    }
    pub fn configuration(&self) -> &'static str {
        match self.config {
            Ok(Some(_)) => "configured",
            Ok(None) => "unconfigured",
            Err(_) => "invalid",
        }
    }
    fn configured(&self) -> Result<(&SessionConfig, &SessionHttp), SessionError> {
        match (&self.config, &self.http) {
            (Ok(Some(c)), Some(h)) => Ok((c, h)),
            (Err(_), _) => Err(SessionError::InvalidConfiguration),
            _ => Err(SessionError::Unconfigured),
        }
    }
    async fn client(&self) -> Result<OidcClient, SessionError> {
        let (config, http) = self.configured()?;
        let (status, keys) = http
            .json(config.jwks.clone(), None, None)
            .await
            .map_err(|_| SessionError::Unavailable)?;
        if status != 200 {
            return Err(SessionError::Unavailable);
        }
        let keys: CoreJsonWebKeySet =
            serde_json::from_value(keys).map_err(|_| SessionError::VerificationFailed)?;
        Ok(CoreClient::new(
            ClientId::new(config.client_id.clone()),
            IssuerUrl::new(config.issuer.to_string())
                .map_err(|_| SessionError::InvalidConfiguration)?,
            keys,
        )
        .set_auth_uri(
            AuthUrl::new(config.authorization.to_string())
                .map_err(|_| SessionError::InvalidConfiguration)?,
        )
        .set_token_uri(
            TokenUrl::new(config.token.to_string())
                .map_err(|_| SessionError::InvalidConfiguration)?,
        )
        .set_auth_type(AuthType::RequestBody)
        .set_redirect_uri(RedirectUrl::new(CALLBACK.into()).expect("fixed callback")))
    }
    pub async fn current(&self) -> Option<PublicSession> {
        self.state
            .lock()
            .await
            .session
            .as_ref()
            .map(|s| s.public.clone())
    }
    pub async fn publish(&self, emit: impl FnOnce(Option<PublicSession>, Option<&'static str>)) {
        let state = self.state.lock().await;
        emit(
            state.session.as_ref().map(|s| s.public.clone()),
            state.error,
        );
    }
    pub async fn logout(&self) {
        let mut state = self.state.lock().await;
        state.generation += 1;
        state.pending = None;
        state.session = None;
        state.error = None;
    }
    pub async fn begin(&self) -> Result<Url, SessionError> {
        self.configured()?;
        let _permit = self.permits.try_acquire().map_err(|_| SessionError::Busy)?;
        let generation = {
            let mut state = self.state.lock().await;
            state.generation += 1;
            state.pending = None;
            state.session = None;
            state.error = None;
            state.generation
        };
        let client = self.client().await?;
        let (challenge, verifier) = PkceCodeChallenge::new_random_sha256();
        let (url, state, nonce) = client
            .authorize_url(
                CoreAuthenticationFlow::AuthorizationCode,
                CsrfToken::new_random,
                Nonce::new_random,
            )
            .set_pkce_challenge(challenge)
            .add_scopes(
                self.configured()?
                    .0
                    .scopes
                    .iter()
                    .filter(|s| s.as_str() != "openid")
                    .cloned()
                    .map(openidconnect::Scope::new),
            )
            .add_extra_param("resource", self.configured()?.0.resource.clone())
            .url();
        let mut store = self.state.lock().await;
        if store.generation != generation {
            return Err(SessionError::SessionChanged);
        }
        store.pending = Some(Pending {
            client,
            state,
            nonce,
            verifier,
            started: Instant::now(),
        });
        Ok(url)
    }
    pub async fn open_pending(
        &self,
        url: &Url,
        open: impl FnOnce(&str) -> Result<(), SessionError>,
    ) -> Result<(), SessionError> {
        let mut store = self.state.lock().await;
        let returned = url
            .query_pairs()
            .find(|(key, _)| key == "state")
            .map(|(_, value)| CsrfToken::new(value.into_owned()))
            .ok_or(SessionError::SessionChanged)?;
        if store.pending.as_ref().is_none_or(|pending| {
            pending.state != returned || pending.started.elapsed() > Duration::from_secs(300)
        }) {
            return Err(SessionError::SessionChanged);
        }
        if let Err(error) = open(url.as_str()) {
            store.pending = None;
            store.error = Some("The sign-in browser could not be opened. Please try again.");
            return Err(error);
        }
        Ok(())
    }
    pub async fn complete(&self, raw: &str) -> Result<PublicSession, SessionError> {
        let _permit = self.permits.try_acquire().map_err(|_| SessionError::Busy)?;
        if raw.len() > 8192 {
            return Err(SessionError::InvalidCallback);
        }
        let url = Url::parse(raw).map_err(|_| SessionError::InvalidCallback)?;
        let mut base = url.clone();
        base.set_query(None);
        if base.as_str() != CALLBACK || url.fragment().is_some() {
            return Err(SessionError::InvalidCallback);
        }
        let mut fields = std::collections::HashMap::new();
        for (k, v) in url.query_pairs() {
            if ![
                "state",
                "code",
                "error",
                "error_description",
                "iss",
                "session_state",
            ]
            .contains(&k.as_ref())
                || fields.insert(k.into_owned(), v.into_owned()).is_some()
            {
                return Err(SessionError::InvalidCallback);
            }
        }
        let (config, http) = self.configured()?;
        if fields
            .get("iss")
            .is_some_and(|s| s != config.issuer.as_str())
        {
            return Err(SessionError::InvalidCallback);
        }
        let returned = CsrfToken::new(
            fields
                .get("state")
                .ok_or(SessionError::InvalidCallback)?
                .clone(),
        );
        let (generation, pending) = {
            let mut store = self.state.lock().await;
            let pending = store
                .pending
                .as_ref()
                .ok_or(SessionError::InvalidCallback)?;
            if returned != pending.state || pending.started.elapsed() > Duration::from_secs(300) {
                return Err(SessionError::InvalidCallback);
            }
            (
                store.generation,
                store.pending.take().expect("checked pending"),
            )
        };
        let outcome = async {
            // Consume before any token exchange; duplicate callbacks cannot redeem twice.
            if fields.contains_key("error") {
                return Err(SessionError::AuthorizationDenied);
            }
            let code = fields
                .remove("code")
                .filter(|s| !s.is_empty())
                .ok_or(SessionError::InvalidCallback)?;
            let response = pending
                .client
                .exchange_code(AuthorizationCode::new(code))
                .set_pkce_verifier(pending.verifier)
                .request_async(http)
                .await
                .map_err(|_| SessionError::VerificationFailed)?;
            let account = verify(&pending.client, &response, &pending.nonce, false)?;
            self.verify_api_identity(response.access_token().secret(), &account)
                .await?;
            let expires = expiry(&response)?;
            let session = Session {
                public: PublicSession {
                    token: CsrfToken::new_random().secret().clone(),
                    account_id: account,
                },
                access: response.access_token().secret().clone(),
                refresh: response.refresh_token().cloned(),
                nonce: pending.nonce,
                expires,
            };
            Ok::<Session, SessionError>(session)
        }
        .await;
        let mut store = self.state.lock().await;
        if store.generation != generation {
            return Err(SessionError::SessionChanged);
        }
        let session = match outcome {
            Ok(session) => session,
            Err(error) => {
                store.error = Some(if error == SessionError::AuthorizationDenied {
                    "Sign-in was cancelled. You can try again."
                } else {
                    "Sign-in could not be verified. Please try again."
                });
                return Err(error);
            }
        };
        store.error = None;
        store.session = Some(session.clone());
        Ok(session.public)
    }
    async fn verify_api_identity(&self, access: &str, account: &str) -> Result<(), SessionError> {
        let (config, http) = self.configured()?;
        let mut url = config.api.clone();
        url.set_path("/api/v1/session");
        let (status, identity) = http
            .json(url, Some(access), None)
            .await
            .map_err(|_| SessionError::Unavailable)?;
        if status != 200 || identity.get("accountId").and_then(Value::as_str) != Some(account) {
            return Err(SessionError::VerificationFailed);
        }
        Ok(())
    }
    async fn authorized(&self, handle: &str) -> Result<(u64, Session), SessionError> {
        let _refresh = self.refresh.lock().await;
        let (generation, mut session) = {
            let store = self.state.lock().await;
            let s = store
                .session
                .as_ref()
                .filter(|s| s.public.token == handle)
                .ok_or(SessionError::SignInRequired)?;
            (store.generation, s.clone())
        };
        if session.expires.saturating_duration_since(Instant::now()) > Duration::from_secs(30) {
            return Ok((generation, session));
        }
        let Some(refresh) = session.refresh.as_ref() else {
            return Err(SessionError::SignInRequired);
        };
        let (_, http) = self.configured()?;
        let client = self.client().await?;
        let result = client
            .exchange_refresh_token(refresh)
            .request_async(http)
            .await;
        let response = result.map_err(|_| SessionError::SignInRequired)?;
        if response.id_token().is_some()
            && verify(&client, &response, &session.nonce, true)? != session.public.account_id
        {
            return Err(SessionError::VerificationFailed);
        }
        self.verify_api_identity(response.access_token().secret(), &session.public.account_id)
            .await?;
        session.access = response.access_token().secret().clone();
        session.expires = expiry(&response)?;
        if let Some(rotated) = response.refresh_token() {
            session.refresh = Some(rotated.clone());
        }
        let mut store = self.state.lock().await;
        if store.generation != generation
            || store
                .session
                .as_ref()
                .is_none_or(|s| s.public.token != handle)
        {
            return Err(SessionError::SessionChanged);
        }
        store.session = Some(session.clone());
        Ok((generation, session))
    }
    pub async fn request(
        &self,
        handle: &str,
        request: LearningRequest,
    ) -> Result<ApiResult, SessionError> {
        let _permit = self.permits.try_acquire().map_err(|_| SessionError::Busy)?;
        let (config, http) = self.configured()?;
        let (url, body) = request.route(&config.api)?;
        let (generation, session) = self.authorized(handle).await?;
        let (status, data) = http
            .json(url, Some(&session.access), body.as_ref())
            .await
            .map_err(|_| SessionError::Unavailable)?;
        let store = self.state.lock().await;
        if store.generation != generation
            || store
                .session
                .as_ref()
                .is_none_or(|s| s.public.token != handle)
        {
            return Err(SessionError::SessionChanged);
        }
        Ok(ApiResult { status, data })
    }
}
fn expiry(response: &CoreTokenResponse) -> Result<Instant, SessionError> {
    let duration = response
        .expires_in()
        .filter(|d| !d.is_zero() && *d <= Duration::from_secs(86400))
        .ok_or(SessionError::VerificationFailed)?;
    if response.token_type() != &openidconnect::core::CoreTokenType::Bearer {
        return Err(SessionError::VerificationFailed);
    }
    Ok(Instant::now() + duration)
}
fn verify(
    client: &OidcClient,
    response: &CoreTokenResponse,
    nonce: &Nonce,
    refresh: bool,
) -> Result<String, SessionError> {
    let token = response
        .id_token()
        .ok_or(SessionError::VerificationFailed)?;
    let verifier = client.id_token_verifier().set_allowed_algs([
        CoreJwsSigningAlgorithm::RsaSsaPkcs1V15Sha256,
        CoreJwsSigningAlgorithm::EcdsaP256Sha256,
    ]);
    let claims = token
        .claims(&verifier, |received: Option<&Nonce>| {
            if refresh && received.is_none() {
                Ok(())
            } else {
                nonce.verify(received)
            }
        })
        .map_err(|_| SessionError::VerificationFailed)?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| SessionError::VerificationFailed)?
        .as_secs() as i64;
    if claims.issue_time().timestamp() > now + 60
        || claims.expiration().timestamp() <= claims.issue_time().timestamp()
        || claims.subject().as_str().is_empty()
    {
        return Err(SessionError::VerificationFailed);
    }
    if let Some(expected) = claims.access_token_hash() {
        let actual = AccessTokenHash::from_token(
            response.access_token(),
            token
                .signing_alg()
                .map_err(|_| SessionError::VerificationFailed)?,
            token
                .signing_key(&verifier)
                .map_err(|_| SessionError::VerificationFailed)?,
        )
        .map_err(|_| SessionError::VerificationFailed)?;
        if actual != *expected {
            return Err(SessionError::VerificationFailed);
        }
    }
    Ok(format!(
        "{}|{}",
        claims.issuer().as_str(),
        claims.subject().as_str()
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{BufRead, Write};
    use std::sync::Arc;
    #[test]
    fn learning_routes_cannot_select_credentials_or_external_destinations() {
        let api = Url::parse("https://api.example.test").unwrap();
        for id in ["../billing", "a/b", "12345678-1234-1234-1234-12345678901/"] {
            assert!(LearningRequest::Progress {
                learner_id: id.into()
            }
            .route(&api)
            .is_err());
        }
        for value in [
            serde_json::json!({"kind":"billing"}),
            serde_json::json!({"kind":"family","url":"https://other.example.test"}),
            serde_json::json!({"kind":"family","token":"value"}),
        ] {
            assert!(serde_json::from_value::<LearningRequest>(value).is_err());
        }
        let (url, _) = LearningRequest::Progress {
            learner_id: "00000000-0000-0000-0000-000000000001".into(),
        }
        .route(&api)
        .unwrap();
        assert_eq!(url.as_str(),"https://api.example.test/api/v1/learners/00000000-0000-0000-0000-000000000001/progress");
    }

    #[test]
    fn starting_preferences_use_only_owned_learner_route_and_explicit_method() {
        let api = Url::parse("https://api.example.test").unwrap();
        let id = "00000000-0000-0000-0000-000000000001";
        let (read, body) = LearningRequest::StartingPoint {
            learner_id: id.into(),
        }
        .route(&api)
        .unwrap();
        assert_eq!(read.path(), format!("/api/v1/learners/{id}/starting-point"));
        assert!(body.is_none());
        for band in ["K–2", "3–5", "6–8", "9–12"] {
            let body = serde_json::json!({"band":band});
            let (write, payload) = LearningRequest::SetStartingPoint {
                learner_id: id.into(),
                body: body.clone(),
            }
            .route(&api)
            .unwrap();
            assert_eq!(write, read);
            assert_eq!(payload, Some(body));
        }
        assert!(LearningRequest::StartingPoint {
            learner_id: "../other".into()
        }
        .route(&api)
        .is_err());
    }

    #[test]
    fn birth_year_uses_only_the_owned_learner_route() {
        let api = Url::parse("https://api.example.test").unwrap();
        let id = "00000000-0000-0000-0000-000000000001";
        let body = serde_json::json!({"birthYear":2016});
        let (write, payload) = LearningRequest::SetBirthYear {
            learner_id: id.into(),
            body: body.clone(),
        }
        .route(&api)
        .unwrap();
        assert_eq!(write.path(), format!("/api/v1/learners/{id}/birth-year"));
        assert_eq!(payload, Some(body));
        assert!(LearningRequest::SetBirthYear {
            learner_id: "../other".into(),
            body: serde_json::json!({}),
        }
        .route(&api)
        .is_err());
    }

    /// Stdio adapter for the browser/signed-provider integration proof. The production
    /// binary cannot construct this HTTP configuration or launch a fixture server.
    #[test]
    #[ignore = "Driven by verify-native-session.ts with ephemeral signed-token provider"]
    fn signed_provider_fixture() {
        let runtime = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()
            .unwrap();
        let stdin = std::io::stdin();
        let mut lines = stdin.lock().lines();
        let config: SessionConfig = serde_json::from_str(&lines.next().unwrap().unwrap()).unwrap();
        // Narrow fixture exception: all endpoints must be on one loopback authority.
        let origin = config.issuer.origin();
        for url in [
            &config.issuer,
            &config.authorization,
            &config.token,
            &config.jwks,
            &config.api,
        ] {
            assert_eq!(url.scheme(), "http");
            assert_eq!(url.host_str(), Some("127.0.0.1"));
            assert_eq!(url.origin(), origin);
        }
        let service = Arc::new(NativeSession::new(Ok(Some(config))).unwrap());
        println!("AMP_FIXTURE_READY");
        std::io::stdout().flush().unwrap();
        for line in lines {
            let input: Value = serde_json::from_str(&line.unwrap()).unwrap();
            if input["command"] == "exit" {
                break;
            }
            let service = service.clone();
            runtime.spawn(async move {
                let id = input["id"].clone();
                let result: Result<Value, SessionError> = match input["command"].as_str().unwrap() {
                    "begin" => service
                        .begin()
                        .await
                        .map(|url| Value::String(url.to_string())),
                    "complete" => service
                        .complete(input["url"].as_str().unwrap())
                        .await
                        .map(|s| serde_json::to_value(s).unwrap()),
                    "logout" => {
                        service.logout().await;
                        Ok(Value::Null)
                    }
                    "current" => Ok(serde_json::to_value(service.current().await).unwrap()),
                    "request" => service
                        .request(
                            input["handle"].as_str().unwrap(),
                            serde_json::from_value(input["request"].clone()).unwrap(),
                        )
                        .await
                        .map(|r| serde_json::to_value(r).unwrap()),
                    _ => Err(SessionError::UnsupportedRequest),
                };
                let value = match result {
                    Ok(value) => serde_json::json!({"id":id,"ok":value}),
                    Err(error) => serde_json::json!({"id":id,"error":error}),
                };
                let stdout = std::io::stdout();
                let mut out = stdout.lock();
                writeln!(out, "AMP_FIXTURE_RESULT {value}").unwrap();
                out.flush().unwrap();
            });
        }
        runtime.shutdown_timeout(Duration::from_secs(2));
    }
}
