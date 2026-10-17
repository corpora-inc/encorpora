//! Public, fixed-origin reads only. This module has no credential or session setter.
use reqwest::{redirect::Policy, Client, Url};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;
use tokio::sync::Semaphore;

const MAX_RESPONSE: usize = 2 * 1024 * 1024;

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PublicResource {
    Health,
    Catalog,
}
impl PublicResource {
    fn path(self) -> &'static str {
        match self {
            Self::Health => "/api/v1/health",
            Self::Catalog => "/api/v1/catalog",
        }
    }
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum TransportError {
    Unconfigured,
    InvalidConfiguration,
    Busy,
    Unavailable,
    RedirectRejected,
    HttpStatus,
    InvalidResponse,
    ResponseTooLarge,
}

pub struct PublicTransport {
    origin: Result<Option<Url>, TransportError>,
    client: Client,
    permits: Semaphore,
}

fn configured_origin(raw: Option<&str>) -> Result<Option<Url>, TransportError> {
    let Some(raw) = raw else { return Ok(None) };
    let url = Url::parse(raw).map_err(|_| TransportError::InvalidConfiguration)?;
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || url.path() != "/"
        || url.port_or_known_default() != Some(443)
        || !matches!(url.host(), Some(url::Host::Domain(host)) if host.contains('.') && host != "localhost" && !host.ends_with(".localhost"))
    {
        return Err(TransportError::InvalidConfiguration);
    }
    Ok(Some(url))
}

impl PublicTransport {
    pub fn new(origin: Option<&str>) -> Result<Self, reqwest::Error> {
        Ok(Self {
            origin: configured_origin(origin),
            client: Client::builder()
                .redirect(Policy::none())
                .no_proxy()
                .connect_timeout(Duration::from_secs(4))
                .timeout(Duration::from_secs(8))
                .build()?,
            permits: Semaphore::new(4),
        })
    }

    pub fn configuration(&self) -> &'static str {
        match self.origin {
            Ok(Some(_)) => "configured",
            Ok(None) => "unconfigured",
            Err(_) => "invalid",
        }
    }

    pub async fn read(&self, resource: PublicResource) -> Result<Value, TransportError> {
        let origin = match &self.origin {
            Ok(Some(origin)) => origin,
            Ok(None) => return Err(TransportError::Unconfigured),
            Err(_) => return Err(TransportError::InvalidConfiguration),
        };
        let _permit = self
            .permits
            .try_acquire()
            .map_err(|_| TransportError::Busy)?;
        let mut url = origin.clone();
        url.set_path(resource.path());
        let mut response = self
            .client
            .get(url)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|_| TransportError::Unavailable)?;
        if response.status().is_redirection() {
            return Err(TransportError::RedirectRejected);
        }
        if !response.status().is_success() {
            return Err(TransportError::HttpStatus);
        }
        let content_type = response
            .headers()
            .get("content-type")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.split(';').next());
        if content_type != Some("application/json") {
            return Err(TransportError::InvalidResponse);
        }
        if response
            .content_length()
            .is_some_and(|size| size > MAX_RESPONSE as u64)
        {
            return Err(TransportError::ResponseTooLarge);
        }
        let mut body = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| TransportError::Unavailable)?
        {
            if chunk.len() > MAX_RESPONSE - body.len() {
                return Err(TransportError::ResponseTooLarge);
            }
            body.extend_from_slice(&chunk);
        }
        serde_json::from_slice(&body).map_err(|_| TransportError::InvalidResponse)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;

    #[test]
    fn deployment_origin_has_no_ambient_authority_or_path() {
        assert!(matches!(configured_origin(None), Ok(None)));
        assert!(configured_origin(Some("https://api.example.test")).is_ok());
        for raw in [
            "",
            "http://api.example.test",
            "https://api.example.test/v1",
            "https://api.example.test/?x=1",
            "https://user:secret@api.example.test",
            "https://api.example.test/#x",
            "https://api.example.test:444",
            "https://127.0.0.1",
            "https://[::1]",
            "https://localhost",
            "https://api.localhost",
        ] {
            assert_eq!(
                configured_origin(Some(raw)),
                Err(TransportError::InvalidConfiguration),
                "{raw}"
            );
        }
    }

    #[test]
    fn callers_cannot_supply_an_api_path_or_private_resource() {
        for raw in [
            r#""/api/v1/learners""#,
            r#""https://other.example.test""#,
            r#""family""#,
            r#"{"resource":"health","url":"https://other.example.test"}"#,
        ] {
            assert!(serde_json::from_str::<PublicResource>(raw).is_err());
        }
        assert!(serde_json::from_str::<PublicResource>(r#""catalog""#).is_ok());
    }

    fn fixture(response: String) -> (PublicTransport, std::thread::JoinHandle<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let handle = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(2)))
                .unwrap();
            let mut request = Vec::new();
            while !request.ends_with(b"\r\n\r\n") {
                let mut chunk = [0; 1024];
                let len = stream.read(&mut chunk).unwrap();
                assert!(len > 0 && request.len() + len <= 8192);
                request.extend_from_slice(&chunk[..len]);
            }
            let _ = stream.write_all(response.as_bytes());
            String::from_utf8(request).unwrap()
        });
        let mut transport = PublicTransport::new(None).unwrap();
        // Loopback exists solely in this unit-test fixture, never deployment parsing.
        transport.origin = Ok(Some(Url::parse(&format!("http://{address}")).unwrap()));
        (transport, handle)
    }

    #[tokio::test]
    async fn fixed_read_sends_no_credentials_and_preserves_json() {
        let body = r#"{"status":"ok"}"#;
        let (transport, server) = fixture(format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()));
        assert_eq!(
            transport.read(PublicResource::Health).await.unwrap()["status"],
            "ok"
        );
        let request = server.join().unwrap().to_lowercase();
        assert!(request.starts_with("get /api/v1/health http/1.1"));
        assert!(!request.contains("authorization:"));
        assert!(!request.contains("cookie:"));
    }

    #[tokio::test]
    async fn denies_redirects_bad_types_and_large_chunked_bodies() {
        for (response, expected) in [
            ("HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1:1/private\r\nContent-Length: 0\r\n\r\n".to_owned(), TransportError::RedirectRejected),
            ("HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 2\r\n\r\n{}".to_owned(), TransportError::InvalidResponse),
            (format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n", MAX_RESPONSE + 1), TransportError::ResponseTooLarge),
            (format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n{:x}\r\n{}\r\n0\r\n\r\n", MAX_RESPONSE + 1, "x".repeat(MAX_RESPONSE + 1)), TransportError::ResponseTooLarge),
            ("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 1\r\n\r\nx".to_owned(), TransportError::InvalidResponse),
        ] {
            let (transport, server) = fixture(response);
            assert_eq!(transport.read(PublicResource::Catalog).await, Err(expected));
            server.join().unwrap();
        }
    }

    #[tokio::test]
    async fn a_server_that_never_sends_headers_cannot_hold_a_request_forever() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let (release, held) = std::sync::mpsc::channel();
        let server = std::thread::spawn(move || {
            let (_stream, _) = listener.accept().unwrap();
            let _ = held.recv_timeout(Duration::from_secs(12));
        });
        let mut transport = PublicTransport::new(None).unwrap();
        transport.origin = Ok(Some(Url::parse(&format!("http://{address}")).unwrap()));
        let result = tokio::time::timeout(
            Duration::from_secs(10),
            transport.read(PublicResource::Health),
        )
        .await;
        release.send(()).unwrap();
        assert_eq!(result.unwrap(), Err(TransportError::Unavailable));
        assert_eq!(transport.permits.available_permits(), 4);
        server.join().unwrap();
    }

    #[tokio::test]
    async fn disabled_and_busy_fail_without_network() {
        let mut transport = PublicTransport::new(None).unwrap();
        assert_eq!(
            transport.read(PublicResource::Health).await,
            Err(TransportError::Unconfigured)
        );
        transport.origin = configured_origin(Some("https://api.example.test"));
        let _all = transport.permits.acquire_many(4).await.unwrap();
        assert_eq!(
            transport.read(PublicResource::Health).await,
            Err(TransportError::Busy)
        );
    }
}
