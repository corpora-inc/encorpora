//! Attachments (photos and other files) as their own lane on the link.
//!
//! A record carries an attachment by reference (its SHA-256); the bytes
//! live in `records.db`, chunked and sealed at rest like other records. They
//! move only after the records, lessons and bundles have: content
//! addressed (the hub keeps one copy per hash, from any device), in signed
//! chunks, resumable from what the hub already holds. The hub's policy per
//! link class (learned at the hello) says what may move: references only,
//! the downscaled copy the host made, or the full file. A file that went
//! as references or downscaled is sent in full when a better link allows.
//! The sender stops between chunks whenever the host says so (new records
//! to send, the link window closing), so attachment traffic never holds
//! up a record.

use super::Records;
use crate::audit::now_rfc3339;
use crate::crypt;
use crate::error::{Error, Result};
use crate::packs::hex_encode;
use crate::records::PhotoRef;
use crate::sync::{AttachmentMode, HubLink};
use rusqlite::params;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub(crate) const DDL: &str = "
CREATE TABLE IF NOT EXISTS attachment (
  sha256       TEXT PRIMARY KEY,
  media_type   TEXT NOT NULL,
  bytes        INTEGER NOT NULL,
  small_sha256 TEXT,
  small_bytes  INTEGER,
  created_at   TEXT NOT NULL,
  -- what the hub holds: none | small | full
  sent         TEXT NOT NULL DEFAULT 'none' CHECK (sent IN ('none', 'small', 'full'))
);
CREATE TABLE IF NOT EXISTS attachment_chunk (
  sha256  TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('full', 'small')),
  ord     INTEGER NOT NULL,
  data    TEXT NOT NULL,                  -- base64, sealed
  PRIMARY KEY (sha256, variant, ord)
);
";

/// Bytes per stored chunk.
const STORE_CHUNK: usize = 64 * 1024;

/// An attachment on the device.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Attachment {
    pub sha256: String,
    pub media_type: String,
    pub bytes: u64,
    /// The downscaled copy the host made, when it made one.
    pub small_sha256: Option<String>,
    pub small_bytes: Option<u64>,
    pub created_at: String,
    /// What the hub holds: `none`, `small` or `full`.
    pub sent: String,
}

/// What one pass of the attachment lane did.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct AttachReport {
    pub mode: Option<AttachmentMode>,
    pub chunks: u64,
    pub bytes: u64,
    /// Variants the hub now holds in full (sent now or found there).
    pub completed: u64,
    /// Bytes not resent because the hub already held them.
    pub resumed_bytes: u64,
    /// Stopped early because the host asked (records waiting, window closing).
    pub yielded: bool,
    /// Bytes still to send under the current policy.
    pub backlog_bytes: u64,
    pub error: Option<String>,
}

fn sha_hex(b: &[u8]) -> String {
    hex_encode(&Sha256::digest(b))
}

impl Records {
    /// Keep an attachment (and the host's downscaled copy, if any). Returns
    /// the reference a record carries.
    pub fn add_attachment(
        &self,
        bytes: &[u8],
        media_type: &str,
        small: Option<&[u8]>,
    ) -> Result<PhotoRef> {
        if bytes.is_empty() {
            return Err(Error::Invalid("an attachment needs bytes".into()));
        }
        let sha = sha_hex(bytes);
        let small_sha = small.map(sha_hex);
        let tx = self.write_tx()?;
        let exists: bool = tx.query_row(
            "SELECT EXISTS (SELECT 1 FROM attachment WHERE sha256 = ?1)",
            [&sha],
            |r| r.get(0),
        )?;
        if !exists {
            tx.execute(
                "INSERT INTO attachment (sha256, media_type, bytes, small_sha256, small_bytes, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![sha, media_type, bytes.len() as i64, small_sha, small.map(|s| s.len() as i64), now_rfc3339()],
            )?;
            let store = |variant: &str, data: &[u8]| -> Result<()> {
                use base64::Engine as _;
                for (ord, c) in data.chunks(STORE_CHUNK).enumerate() {
                    let b64 = base64::engine::general_purpose::STANDARD.encode(c);
                    let aad = format!("attachment_chunk:{sha}|{variant}|{ord}");
                    tx.execute(
                        "INSERT INTO attachment_chunk (sha256, variant, ord, data) VALUES (?1, ?2, ?3, ?4)",
                        params![sha, variant, ord as i64, crypt::seal_opt(self.key(), &aad, &b64)?],
                    )?;
                }
                Ok(())
            };
            store("full", bytes)?;
            if let Some(s) = small {
                store("small", s)?;
            }
        }
        tx.commit()?;
        Ok(PhotoRef {
            path: format!("attachment:{sha}"),
            sha256: sha,
        })
    }

    /// Every attachment, oldest first.
    pub fn attachments(&self) -> Result<Vec<Attachment>> {
        Ok(self
            .conn
            .prepare(
                "SELECT sha256, media_type, bytes, small_sha256, small_bytes, created_at, sent FROM attachment
                 ORDER BY created_at, sha256",
            )?
            .query_map([], |r| {
                Ok(Attachment {
                    sha256: r.get(0)?,
                    media_type: r.get(1)?,
                    bytes: r.get::<_, i64>(2)? as u64,
                    small_sha256: r.get(3)?,
                    small_bytes: r.get::<_, Option<i64>>(4)?.map(|b| b as u64),
                    created_at: r.get(5)?,
                    sent: r.get(6)?,
                })
            })?
            .collect::<rusqlite::Result<_>>()?)
    }

    /// An attachment's bytes (a variant), opened.
    pub fn attachment_bytes(&self, sha256: &str, variant: &str) -> Result<Vec<u8>> {
        use base64::Engine as _;
        let rows: Vec<(i64, String)> = self
            .conn
            .prepare("SELECT ord, data FROM attachment_chunk WHERE sha256 = ?1 AND variant = ?2 ORDER BY ord")?
            .query_map(params![sha256, variant], |r| Ok((r.get(0)?, r.get(1)?)))?
            .collect::<rusqlite::Result<_>>()?;
        let mut out = Vec::new();
        for (ord, data) in rows {
            let aad = format!("attachment_chunk:{sha256}|{variant}|{ord}");
            let b64 = crypt::open_opt(self.key(), &aad, &data)?;
            out.extend(
                base64::engine::general_purpose::STANDARD
                    .decode(b64.as_bytes())
                    .map_err(|_| {
                        Error::Crypto(format!("attachment {sha256}: a stored chunk is damaged"))
                    })?,
            );
        }
        Ok(out)
    }

    /// What still has to move under `mode`: `(sha, variant, variant sha, size)`.
    fn attachment_work(
        &self,
        mode: AttachmentMode,
    ) -> Result<Vec<(String, &'static str, String, u64)>> {
        let mut out = Vec::new();
        for a in self.attachments()? {
            match (mode, a.sent.as_str()) {
                (AttachmentMode::Refs, _) | (_, "full") => {}
                (AttachmentMode::Downscaled, "small") => {}
                (AttachmentMode::Downscaled, _) => match (&a.small_sha256, a.small_bytes) {
                    (Some(s), Some(n)) => out.push((a.sha256.clone(), "small", s.clone(), n)),
                    _ => out.push((a.sha256.clone(), "full", a.sha256.clone(), a.bytes)),
                },
                (AttachmentMode::Full, _) => {
                    out.push((a.sha256.clone(), "full", a.sha256.clone(), a.bytes))
                }
            }
        }
        Ok(out)
    }

    /// Bytes waiting under `mode`.
    pub fn attachment_backlog(&self, mode: AttachmentMode) -> Result<u64> {
        Ok(self.attachment_work(mode)?.iter().map(|w| w.3).sum())
    }

    /// Run the attachment lane through `link` under the policy learned at
    /// the last hello. `stop` is asked before every chunk; returning true
    /// ends the pass (records are waiting, the window is closing). Nothing
    /// moves while records are queued or the hub refuses this device.
    pub fn send_attachments(
        &self,
        link: &dyn HubLink,
        stop: &dyn Fn() -> bool,
    ) -> Result<AttachReport> {
        let mut report = AttachReport::default();
        if self.attachment_backlog(AttachmentMode::Full)? == 0 {
            return Ok(report);
        }
        if self.outbox_status()?.pending > 0 || stop() {
            report.yielded = true;
            return Ok(report);
        }
        // Ask first: the policy depends on the link the device is on now.
        let mut gate = super::maint::HubGate::load(&self.conn)?;
        let reply = match link.hello() {
            Ok(r) => r,
            Err(e) => {
                report.error = Some(e.to_string());
                return Ok(report);
            }
        };
        gate.learn(&reply);
        gate.save(&self.conn)?;
        let mode = reply.attachments;
        report.mode = Some(mode);
        if !reply.accepted {
            report.error = Some("the hub refuses this device".into());
            return Ok(report);
        }
        let chunk = gate
            .chunk_bytes
            .unwrap_or(crate::sync::DEFAULT_CHUNK_BYTES)
            .max(1);
        'items: for (sha, variant, vsha, total) in self.attachment_work(mode)? {
            if self.outbox_status()?.pending > 0 || stop() {
                report.yielded = true;
                break;
            }
            let mut offset = match link.attachment_offset(&vsha, total) {
                Ok(o) => o.min(total),
                Err(e) => {
                    report.error = Some(e.to_string());
                    break;
                }
            };
            if offset > 0 {
                report.resumed_bytes += offset;
            }
            if offset < total {
                let data = self.attachment_bytes(&sha, variant)?;
                if data.len() as u64 != total || sha_hex(&data) != vsha {
                    return Err(Error::Crypto(format!(
                        "attachment {sha}: stored bytes do not match their hash"
                    )));
                }
                while offset < total {
                    if self.outbox_status()?.pending > 0 || stop() {
                        report.yielded = true;
                        break 'items;
                    }
                    let end = (offset + chunk).min(total);
                    let piece = &data[offset as usize..end as usize];
                    match link.put_chunk(&vsha, variant, total, offset, piece) {
                        Ok(held) => {
                            report.chunks += 1;
                            report.bytes += piece.len() as u64;
                            // The hub says what it holds; resume from there.
                            offset = held.min(total);
                        }
                        Err(e) => {
                            report.error = Some(e.to_string());
                            break 'items;
                        }
                    }
                }
            }
            report.completed += 1;
            let sent = if variant == "full" { "full" } else { "small" };
            self.conn.execute(
                "UPDATE attachment SET sent = ?2 WHERE sha256 = ?1 AND (sent = 'none' OR ?2 = 'full')",
                params![sha, sent],
            )?;
        }
        report.backlog_bytes = self.attachment_backlog(mode)?;
        Ok(report)
    }
}

impl Records {
    /// One attachment by hash.
    pub fn attachment(&self, sha256: &str) -> Result<Option<Attachment>> {
        Ok(self.attachments()?.into_iter().find(|a| a.sha256 == sha256))
    }
}
