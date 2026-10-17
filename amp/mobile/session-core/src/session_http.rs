//! Bounded HTTP adapter for the maintained OIDC client. Endpoint trust is explicit.
use openidconnect::{HttpRequest, HttpResponse};
use reqwest::{redirect::Policy, Client};
use std::{fmt, time::Duration};
use url::Url;

pub const MAX_JSON: usize = 2 * 1024 * 1024;
#[derive(Debug)]
pub struct NetworkError;
impl fmt::Display for NetworkError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Native connection failed")
    }
}
impl std::error::Error for NetworkError {}

#[derive(Clone)]
pub struct SessionHttp {
    client: Client,
    token: Url,
}
impl SessionHttp {
    pub fn new(token: Url) -> Result<Self, NetworkError> {
        Ok(Self {
            token,
            client: Client::builder()
                .redirect(Policy::none())
                .no_proxy()
                .connect_timeout(Duration::from_secs(4))
                .timeout(Duration::from_secs(10))
                .build()
                .map_err(|_| NetworkError)?,
        })
    }
    pub async fn oidc(&self, request: HttpRequest) -> Result<HttpResponse, NetworkError> {
        // This adapter is used only for code/refresh exchange, never discovery/userinfo.
        if *request.uri() != self.token.as_str()
            || request.method() != "POST"
            || request.body().len() > 16 * 1024
        {
            return Err(NetworkError);
        }
        let response = self
            .client
            .post(self.token.clone())
            .headers(request.headers().clone())
            .body(request.body().clone())
            .send()
            .await
            .map_err(|_| NetworkError)?;
        let status = response.status();
        let headers = response.headers().clone();
        let bytes = bounded(response).await?;
        let mut result = openidconnect::http::Response::builder()
            .status(status)
            .body(bytes)
            .map_err(|_| NetworkError)?;
        *result.headers_mut() = headers;
        Ok(result)
    }
    pub async fn json(
        &self,
        url: Url,
        bearer: Option<&str>,
        body: Option<&serde_json::Value>,
    ) -> Result<(u16, serde_json::Value), NetworkError> {
        let mut request = if let Some(body) = body {
            let data = serde_json::to_vec(body).map_err(|_| NetworkError)?;
            if data.len() > 16 * 1024 {
                return Err(NetworkError);
            }
            self.client
                .post(url)
                .header("Content-Type", "application/json")
                .body(data)
        } else {
            self.client.get(url)
        };
        request = request.header("Accept", "application/json");
        if let Some(token) = bearer {
            request = request.bearer_auth(token);
        }
        let response = request.send().await.map_err(|_| NetworkError)?;
        let status = response.status().as_u16();
        let bytes = bounded(response).await?;
        let value = serde_json::from_slice(&bytes).map_err(|_| NetworkError)?;
        Ok((status, value))
    }
}
async fn bounded(mut response: reqwest::Response) -> Result<Vec<u8>, NetworkError> {
    if response.status().is_redirection()
        || response
            .content_length()
            .is_some_and(|n| n > MAX_JSON as u64)
        || response
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.split(';').next())
            != Some("application/json")
    {
        return Err(NetworkError);
    }
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| NetworkError)? {
        if chunk.len() > MAX_JSON - body.len() {
            return Err(NetworkError);
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
}

impl<'a> openidconnect::AsyncHttpClient<'a> for SessionHttp {
    type Error = NetworkError;
    type Future = std::pin::Pin<
        Box<dyn std::future::Future<Output = Result<HttpResponse, NetworkError>> + Send + 'a>,
    >;
    fn call(&'a self, request: HttpRequest) -> Self::Future {
        Box::pin(self.oidc(request))
    }
}
