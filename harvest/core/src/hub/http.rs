//! The device's HTTP link to a hub run by `harvest hub` (the routes are in
//! [`crate::api::serve`]):
//!
//! ```text
//! POST /hub/receive                     Delivery (signed by the device) → ReceiveReport
//! POST /hub/hello                       Hello (signed by the device) → HelloReply
//! GET  /hub/fleet                       → the signed fleet summary | null
//! GET  /hub/attachment?sha256=&total=   → {held}
//! POST /hub/attachment                  AttachmentChunk (signed) → {held}
//! GET  /hub/bundles?since=<seq>         → [bundle]
//! GET  /hub/pack-offer?pack_id=&have=   → PackOffer | null
//! GET  /hub/pack-file/<pack>/<dir>/<path> → the file
//! ```

use crate::error::{Error, Result};
use crate::sync::{DeviceKey, HelloReply, HubLink, LinkClass, PackOffer, Upload};
use serde_json::Value;

/// A hub over HTTP.
pub struct HttpHubLink {
    base: String,
    key: DeviceKey,
    agent: ureq::Agent,
    link: LinkClass,
}

/// Which certificates a device trusts for the hub (rustls; never
/// OpenSSL).
#[derive(Debug, Clone, Default)]
pub enum HubRoots {
    /// Mozilla's roots, built in (works everywhere, no platform setup).
    #[default]
    Mozilla,
    /// The platform's trust store (feature `platform-roots`; on Android the
    /// host must initialize the platform verifier first).
    Platform,
    /// Only these PEM certificates (the hub's own CA): a pin.
    Pem(Vec<u8>),
}

/// How a device reaches its hub.
#[derive(Debug, Clone, Default)]
pub struct HubTls {
    pub roots: HubRoots,
    /// Allow plain `http://` to a host other than this machine
    /// (development only; loopback is always allowed).
    pub allow_insecure_http: bool,
}

/// Is `base` an `http://` URL to this machine?
fn loopback_http(base: &str) -> bool {
    let Some(rest) = base.strip_prefix("http://") else {
        return false;
    };
    let authority = rest.split(['/', '?', '#']).next().unwrap_or("");
    let authority = authority.rsplit('@').next().unwrap_or("");
    let host = if let Some(v6) = authority.strip_prefix('[') {
        v6.split(']').next().unwrap_or("")
    } else {
        authority.split(':').next().unwrap_or("")
    };
    host.eq_ignore_ascii_case("localhost")
        || host
            .parse::<std::net::IpAddr>()
            .is_ok_and(|ip| ip.is_loopback())
}

impl HttpHubLink {
    /// `base` is the hub's root: `https://host[:port]`, or `http://` to
    /// this machine. Mozilla's roots.
    pub fn new(base: &str, key: DeviceKey, timeout: std::time::Duration) -> Result<Self> {
        Self::with_tls(base, key, timeout, &HubTls::default())
    }

    /// As [`Self::new`], trusting `tls.roots`; plain HTTP elsewhere than
    /// loopback only with `tls.allow_insecure_http`.
    pub fn with_tls(
        base: &str,
        key: DeviceKey,
        timeout: std::time::Duration,
        tls: &HubTls,
    ) -> Result<Self> {
        let base = base.trim_end_matches('/').to_string();
        if base.starts_with("http://") {
            if !loopback_http(&base) && !tls.allow_insecure_http {
                return Err(Error::Invalid(format!(
                    "hub {base}: plain HTTP is allowed only to this machine; use https://"
                )));
            }
        } else if !base.starts_with("https://") {
            return Err(Error::Invalid(format!("hub {base}: not an http(s) URL")));
        }
        use ureq::tls::{Certificate, RootCerts, TlsConfig};
        let roots = match &tls.roots {
            HubRoots::Mozilla => RootCerts::WebPki,
            HubRoots::Platform => {
                #[cfg(feature = "platform-roots")]
                {
                    RootCerts::PlatformVerifier
                }
                #[cfg(not(feature = "platform-roots"))]
                {
                    return Err(Error::Invalid(
                        "the platform trust store needs harvest-core's `platform-roots` feature"
                            .into(),
                    ));
                }
            }
            HubRoots::Pem(pem) => {
                let certs: Vec<Certificate<'static>> = ureq::tls::parse_pem(pem)
                    .filter_map(|item| match item {
                        Ok(ureq::tls::PemItem::Certificate(c)) => Some(Ok(c)),
                        Ok(_) => None,
                        Err(e) => Some(Err(e)),
                    })
                    .collect::<std::result::Result<_, _>>()
                    .map_err(|e| Error::Invalid(format!("hub certificate: {e}")))?;
                if certs.is_empty() {
                    return Err(Error::Invalid(
                        "hub certificate: no certificate in the PEM".into(),
                    ));
                }
                RootCerts::new_with_certs(&certs)
            }
        };
        Ok(Self {
            base,
            key,
            link: LinkClass::Normal,
            agent: ureq::Agent::config_builder()
                .timeout_global(Some(timeout))
                // A redirect could lead off the checked URL (to plain HTTP).
                .max_redirects(0)
                .tls_config(TlsConfig::builder().root_certs(roots).build())
                .build()
                .into(),
        })
    }

    /// The link class to tell the hub (the host knows its link).
    pub fn with_link(mut self, link: LinkClass) -> Self {
        self.link = link;
        self
    }

    fn get_json(&self, path: &str) -> Result<Value> {
        self.agent
            .get(&format!("{}{path}", self.base))
            .call()
            .map_err(|e| Error::Sync(format!("hub {path}: {e}")))?
            .body_mut()
            .read_json()
            .map_err(|e| Error::Sync(format!("hub {path}: {e}")))
    }
}

fn q(s: &str) -> String {
    s.bytes()
        .map(|b| {
            if b.is_ascii_alphanumeric() || b"-._~".contains(&b) {
                (b as char).to_string()
            } else {
                format!("%{b:02X}")
            }
        })
        .collect()
}

impl HubLink for HttpHubLink {
    fn device_id(&self) -> String {
        self.key.device_id()
    }

    fn send(&self, batch: &[Upload]) -> Result<crate::sync::ReceiptSet> {
        let mut v: Value = self
            .agent
            .post(&format!("{}/hub/receive", self.base))
            .send_json(self.key.deliver(batch)?)
            .map_err(|e| Error::Sync(format!("hub receive: {e}")))?
            .body_mut()
            .read_json()
            .map_err(|e| Error::Sync(format!("hub receive: {e}")))?;
        match v.get_mut("signed").map(Value::take) {
            Some(s) if !s.is_null() => crate::sync::reply_from_json(s),
            _ => Err(Error::Signature("the hub's receipts are unsigned".into())),
        }
    }

    fn bundles_since(&self, since: u64) -> Result<Vec<Value>> {
        // Page by page, each response bounded.
        const PAGE: usize = 50;
        let mut out: Vec<Value> = Vec::new();
        let mut after = since;
        for _ in 0..10_000 {
            let v = self.get_json(&format!("/hub/bundles?since={after}&limit={PAGE}"))?;
            let page: Vec<Value> =
                serde_json::from_value(v).map_err(|e| Error::Sync(format!("hub bundles: {e}")))?;
            let n = page.len();
            let last = page
                .last()
                .and_then(|b| b.get("seq"))
                .and_then(Value::as_u64);
            out.extend(page);
            match last {
                Some(s) if n == PAGE && s > after => after = s,
                _ => break,
            }
        }
        Ok(out)
    }

    fn pack_offer(&self, pack_id: &str, have: Option<&str>) -> Result<Option<PackOffer>> {
        let mut path = format!("/hub/pack-offer?pack_id={}", q(pack_id));
        if let Some(h) = have {
            path.push_str(&format!("&have={}", q(h)));
        }
        let v = self.get_json(&path)?;
        serde_json::from_value(v).map_err(|e| Error::Sync(format!("hub pack offer: {e}")))
    }

    fn fetch(&self, offer: &PackOffer, path: &str) -> Result<Vec<u8>> {
        let url = format!(
            "{}/hub/pack-file/{}/{}/{}",
            self.base,
            q(&offer.pack_id),
            q(&offer.dir),
            path.split('/').map(q).collect::<Vec<_>>().join("/")
        );
        self.agent
            .get(&url)
            .call()
            .map_err(|e| Error::Sync(format!("hub file {path}: {e}")))?
            .body_mut()
            .with_config()
            .limit(4 << 30)
            .read_to_vec()
            .map_err(|e| Error::Sync(format!("hub file {path}: {e}")))
    }

    fn fleet(&self) -> Result<Option<Value>> {
        let v = self.get_json("/hub/fleet")?;
        Ok((!v.is_null()).then_some(v))
    }

    fn hello(&self) -> Result<(crate::sync::Hello, HelloReply)> {
        let h = self.key.hello(self.link)?;
        let v: Value = self
            .agent
            .post(&format!("{}/hub/hello", self.base))
            .send_json(&h)
            .map_err(|e| Error::Sync(format!("hub hello: {e}")))?
            .body_mut()
            .read_json()
            .map_err(|e| Error::Sync(format!("hub hello: {e}")))?;
        Ok((h, crate::sync::reply_from_json(v)?))
    }

    fn public_key(&self) -> String {
        self.key.public_base64()
    }

    fn link_class(&self) -> LinkClass {
        self.link
    }

    fn attachment_offset(&self, sha256: &str, total: u64) -> Result<crate::sync::Held> {
        let v = self.get_json(&format!(
            "/hub/attachment?sha256={}&total={total}&device_id={}",
            q(sha256),
            q(&self.key.device_id())
        ))?;
        crate::sync::reply_from_json(v)
    }

    fn put_chunk(
        &self,
        sha256: &str,
        variant: &str,
        total: u64,
        offset: u64,
        data: &[u8],
    ) -> Result<crate::sync::Held> {
        let v: Value = self
            .agent
            .post(&format!("{}/hub/attachment", self.base))
            .send_json(self.key.chunk(sha256, variant, total, offset, data)?)
            .map_err(|e| Error::Sync(format!("hub attachment: {e}")))?
            .body_mut()
            .read_json()
            .map_err(|e| Error::Sync(format!("hub attachment: {e}")))?;
        crate::sync::reply_from_json(v)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_http_only_to_this_machine() {
        let k = || DeviceKey::from_seed(&[1; 32]);
        let t = std::time::Duration::from_secs(1);
        for ok in [
            "http://127.0.0.1:4318",
            "http://localhost/",
            "http://[::1]:80",
        ] {
            assert!(HttpHubLink::new(ok, k(), t).is_ok(), "{ok}");
        }
        for bad in [
            "http://hub.example",
            "http://10.0.0.5:4318",
            "http://127.0.0.1.example",
            "ftp://x",
        ] {
            assert!(HttpHubLink::new(bad, k(), t).is_err(), "{bad}");
        }
        assert!(HttpHubLink::new("https://hub.example", k(), t).is_ok());
        let dev = HubTls {
            allow_insecure_http: true,
            ..Default::default()
        };
        assert!(HttpHubLink::with_tls("http://10.0.0.5:4318", k(), t, &dev).is_ok());
        let pin = HubTls {
            roots: HubRoots::Pem(b"not a certificate".to_vec()),
            ..Default::default()
        };
        assert!(HttpHubLink::with_tls("https://hub.example", k(), t, &pin).is_err());
    }
}
