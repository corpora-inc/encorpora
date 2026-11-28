//! The device's HTTP link to a hub run by `harvest hub` (the routes are in
//! [`crate::api::serve`]):
//!
//! ```text
//! POST /hub/receive                     {device_id, items: [Upload]} → ReceiveReport
//! GET  /hub/bundles?since=<seq>         → [bundle]
//! GET  /hub/pack-offer?pack_id=&have=   → PackOffer | null
//! GET  /hub/pack-file/<pack>/<dir>/<path> → the file
//! ```

use super::ReceiveReport;
use crate::error::{Error, Result};
use crate::sync::{HubLink, PackOffer, Receipt, Upload};
use serde_json::{Value, json};

/// A hub over HTTP.
pub struct HttpHubLink {
    base: String,
    device_id: String,
    agent: ureq::Agent,
}

impl HttpHubLink {
    /// `base` is the hub's root (`http://host:port`).
    pub fn new(base: &str, device_id: &str, timeout: std::time::Duration) -> Self {
        Self {
            base: base.trim_end_matches('/').to_string(),
            device_id: device_id.to_string(),
            agent: ureq::Agent::config_builder()
                .timeout_global(Some(timeout))
                .build()
                .into(),
        }
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
        self.device_id.clone()
    }

    fn send(&self, batch: &[Upload]) -> Result<Vec<Receipt>> {
        let r: ReceiveReport = self
            .agent
            .post(&format!("{}/hub/receive", self.base))
            .send_json(json!({"device_id": self.device_id, "items": batch}))
            .map_err(|e| Error::Sync(format!("hub receive: {e}")))?
            .body_mut()
            .read_json()
            .map_err(|e| Error::Sync(format!("hub receive: {e}")))?;
        Ok(r.receipts)
    }

    fn bundles_since(&self, since: u64) -> Result<Vec<Value>> {
        let v = self.get_json(&format!("/hub/bundles?since={since}"))?;
        serde_json::from_value(v).map_err(|e| Error::Sync(format!("hub bundles: {e}")))
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
}
