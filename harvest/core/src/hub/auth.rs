//! Who is acting at the hub. Devices prove themselves by signing every
//! delivery with their enrolled key ([`crate::sync::Delivery`]); people
//! (reviewers, publishers, administrators) are identified by the
//! transport through an [`Identify`] implementation:
//!
//! - [`TokenFile`], for development: named local reviewers with bearer
//!   tokens from a file.
//! - [`TrustedProxy`], for a deployment behind an authenticating reverse
//!   proxy (a smart-card or single-sign-on gateway terminates the user's
//!   certificate and sets a header): the identity header is believed only
//!   on requests from the configured proxy addresses, and refused from
//!   anywhere else.
//!
//! Roles: `reviewer` (approve, edit, reject), `publisher` (publish
//! bundles), `admin` (enroll and revoke devices). Every hub action records
//! the principal's name.

use crate::error::{Error, Result};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::net::IpAddr;
use std::path::Path;

/// What a person may do at the hub.
#[derive(
    Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq, PartialOrd, Ord,
)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Reviewer,
    Publisher,
    Admin,
}

/// An identified person.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Principal {
    pub name: String,
    pub roles: Vec<Role>,
    /// How they were identified: `token`, `proxy` or `local` (in process).
    pub via: String,
}

impl Principal {
    /// An in-process principal (tests, simulation, a one-box setup).
    pub fn local(name: &str, roles: &[Role]) -> Self {
        Self {
            name: name.to_string(),
            roles: roles.to_vec(),
            via: "local".into(),
        }
    }
    pub fn has(&self, role: Role) -> bool {
        self.roles.contains(&role)
    }
}

/// What the transport knows about a request.
#[derive(Debug, Clone, Default)]
pub struct RequestMeta {
    pub remote: Option<IpAddr>,
    /// Header names lowercased.
    pub headers: Vec<(String, String)>,
}

impl RequestMeta {
    pub fn header(&self, name: &str) -> Option<&str> {
        let name = name.to_ascii_lowercase();
        self.headers
            .iter()
            .find(|(k, _)| *k == name)
            .map(|(_, v)| v.as_str())
    }
}

/// Identifies the person behind a request. `Ok(None)`: no credentials
/// were offered (only methods that need no one may run).
pub trait Identify: Send + Sync {
    fn identify(&self, req: &RequestMeta) -> Result<Option<Principal>>;
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct TokenEntry {
    name: String,
    /// The bearer token, or its SHA-256 (hex) in `token_sha256`.
    #[serde(default)]
    token: Option<String>,
    #[serde(default)]
    token_sha256: Option<String>,
    roles: Vec<Role>,
}

/// Development identities: `[{"name", "token" | "token_sha256", "roles"}]`,
/// presented as `Authorization: Bearer <token>`.
pub struct TokenFile {
    entries: Vec<(String, [u8; 32], Vec<Role>)>,
}

fn sha(s: &str) -> [u8; 32] {
    use sha2::Digest;
    sha2::Sha256::digest(s.as_bytes()).into()
}

impl TokenFile {
    pub fn load(path: &Path) -> Result<Self> {
        let text = std::fs::read_to_string(path)
            .map_err(|e| Error::Invalid(format!("{}: {e}", path.display())))?;
        Self::parse(&text)
    }

    pub fn parse(text: &str) -> Result<Self> {
        let raw: Vec<TokenEntry> = serde_json::from_str(text)
            .map_err(|e| Error::Invalid(format!("reviewer tokens: {e}")))?;
        let mut entries = Vec::new();
        for e in raw {
            let h = match (&e.token, &e.token_sha256) {
                (Some(t), None) if t.len() >= 16 => sha(t),
                (None, Some(h)) => {
                    let b = crate::packs::hex_decode(h.trim())?;
                    b.try_into().map_err(|_| {
                        Error::Invalid(format!("{}: token_sha256 is not 32 bytes", e.name))
                    })?
                }
                _ => {
                    return Err(Error::Invalid(format!(
                        "{}: give a token of at least 16 characters or its token_sha256",
                        e.name
                    )));
                }
            };
            if e.name.trim().is_empty() {
                return Err(Error::Invalid("a reviewer needs a name".into()));
            }
            entries.push((e.name, h, e.roles));
        }
        Ok(Self { entries })
    }
}

/// Equal without an early exit on the first differing byte.
fn same(a: &[u8; 32], b: &[u8; 32]) -> bool {
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

impl Identify for TokenFile {
    fn identify(&self, req: &RequestMeta) -> Result<Option<Principal>> {
        let Some(auth) = req.header("authorization") else {
            return Ok(None);
        };
        let token = auth
            .strip_prefix("Bearer ")
            .ok_or_else(|| Error::Signature("authorization is not a bearer token".into()))?;
        let h = sha(token.trim());
        self.entries
            .iter()
            .find(|(_, t, _)| same(t, &h))
            .map(|(name, _, roles)| {
                Some(Principal {
                    name: name.clone(),
                    roles: roles.clone(),
                    via: "token".into(),
                })
            })
            .ok_or_else(|| Error::Signature("unknown token".into()))
    }
}

/// Identity from an authenticating reverse proxy: `header` (for example
/// `X-Remote-User`) names the user, believed only on requests from
/// `proxies`; `roles` maps user names to roles.
pub struct TrustedProxy {
    pub proxies: Vec<IpAddr>,
    pub header: String,
    pub roles: BTreeMap<String, Vec<Role>>,
}

impl TrustedProxy {
    /// `roles_file`: `{"user name": ["reviewer", …]}`.
    pub fn load(proxies: Vec<IpAddr>, header: &str, roles_file: &Path) -> Result<Self> {
        let text = std::fs::read_to_string(roles_file)
            .map_err(|e| Error::Invalid(format!("{}: {e}", roles_file.display())))?;
        let roles =
            serde_json::from_str(&text).map_err(|e| Error::Invalid(format!("roles: {e}")))?;
        if proxies.is_empty() {
            return Err(Error::Invalid(
                "a trusted proxy needs at least one address".into(),
            ));
        }
        Ok(Self {
            proxies,
            header: header.to_string(),
            roles,
        })
    }
}

impl Identify for TrustedProxy {
    fn identify(&self, req: &RequestMeta) -> Result<Option<Principal>> {
        let from_proxy = req.remote.is_some_and(|r| self.proxies.contains(&r));
        let name = req
            .header(&self.header)
            .map(str::trim)
            .filter(|n| !n.is_empty());
        match (from_proxy, name) {
            (false, Some(_)) => Err(Error::Signature(format!(
                "{} is accepted only from the trusted proxy",
                self.header
            ))),
            (false, None) => Err(Error::Signature(
                "requests must come through the trusted proxy".into(),
            )),
            (true, None) => Ok(None),
            (true, Some(n)) => Ok(Some(Principal {
                name: n.to_string(),
                roles: self.roles.get(n).cloned().unwrap_or_default(),
                via: "proxy".into(),
            })),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn meta(remote: &str, headers: &[(&str, &str)]) -> RequestMeta {
        RequestMeta {
            remote: Some(remote.parse().unwrap()),
            headers: headers
                .iter()
                .map(|(k, v)| (k.to_ascii_lowercase(), v.to_string()))
                .collect(),
        }
    }

    #[test]
    fn tokens() {
        let t = TokenFile::parse(
            r#"[{"name": "Reviewer A", "token": "a-long-dev-token-0001", "roles": ["reviewer"]}]"#,
        )
        .unwrap();
        let p = t
            .identify(&meta(
                "127.0.0.1",
                &[("Authorization", "Bearer a-long-dev-token-0001")],
            ))
            .unwrap()
            .unwrap();
        assert_eq!(p.name, "Reviewer A");
        assert!(p.has(Role::Reviewer) && !p.has(Role::Admin));
        assert!(
            t.identify(&meta(
                "127.0.0.1",
                &[("Authorization", "Bearer wrong-token-0000000")]
            ))
            .is_err()
        );
        assert!(t.identify(&meta("127.0.0.1", &[])).unwrap().is_none());
        assert!(TokenFile::parse(r#"[{"name": "x", "token": "short", "roles": []}]"#).is_err());
    }

    #[test]
    fn proxy_header_only_from_the_proxy() {
        let p = TrustedProxy {
            proxies: vec!["10.0.0.5".parse().unwrap()],
            header: "X-Remote-User".into(),
            roles: [("j.doe".to_string(), vec![Role::Publisher])].into(),
        };
        let ok = p
            .identify(&meta("10.0.0.5", &[("X-Remote-User", "j.doe")]))
            .unwrap()
            .unwrap();
        assert_eq!((ok.name.as_str(), ok.via.as_str()), ("j.doe", "proxy"));
        assert!(ok.has(Role::Publisher));
        // The same header from anywhere else is refused.
        assert!(
            p.identify(&meta("10.0.0.9", &[("X-Remote-User", "j.doe")]))
                .is_err()
        );
        assert!(p.identify(&meta("10.0.0.9", &[])).is_err());
        // A known proxy with an unknown user: identified, no roles.
        let nobody = p
            .identify(&meta("10.0.0.5", &[("X-Remote-User", "x")]))
            .unwrap()
            .unwrap();
        assert!(nobody.roles.is_empty());
    }
}
