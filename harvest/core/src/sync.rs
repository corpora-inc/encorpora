//! Offline-first upload queue: an outbox of records waiting for a link, sent
//! in order when one returns, each marked done only on a matching receipt.
//!
//! An item's `item_id` is its idempotency key, so a batch that is resent
//! after a lost reply is safe. A receipt must name an item of the batch and
//! echo its payload's SHA-256; anything else leaves the item pending and
//! records why. Packs come down the other way, signed ([`crate::packs`]).

use crate::audit::now_rfc3339;
use crate::crypt::{self, RecordKey};
use crate::error::{Error, Result};
use crate::packs::hex_encode;
use rusqlite::{Connection, params};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

const DDL: &str = "
CREATE TABLE IF NOT EXISTS outbox (
  seq            INTEGER PRIMARY KEY,
  item_id        TEXT NOT NULL UNIQUE,
  kind           TEXT NOT NULL,
  payload        TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  attempts       INTEGER NOT NULL DEFAULT 0,
  last_error     TEXT,
  acked_at       TEXT,
  receipt        TEXT,
  -- what the item is about (`<run_id>#<ord>` for a deficiency), so a
  -- correction can supersede it
  ref            TEXT,
  -- 1 when the stored payload no longer matches its hash: kept for
  -- inspection, never sent, never blocks the rest of the queue
  quarantined    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS outbox_pending ON outbox (acked_at, seq);
CREATE INDEX IF NOT EXISTS outbox_ref ON outbox (kind, ref);
";

/// Create the outbox if absent.
pub fn init(conn: &Connection) -> Result<()> {
    conn.execute_batch(DDL)?;
    Ok(())
}

/// One queued item as it goes up.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
pub struct Upload {
    pub item_id: String,
    /// `run` | `deficiency` | `deficiency_cleared` | `miss` | any host kind.
    pub kind: String,
    pub created_at: String,
    /// The payload's exact JSON text. A receiver hashes these bytes.
    pub payload: String,
    /// SHA-256 (hex) of `payload`'s UTF-8 bytes.
    pub payload_sha256: String,
}

impl Upload {
    /// The payload parsed.
    pub fn payload_json(&self) -> Result<serde_json::Value> {
        Ok(serde_json::from_str(&self.payload)?)
    }
}

/// The server's acknowledgement of one item.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, schemars::JsonSchema)]
pub struct Receipt {
    pub item_id: String,
    /// Must equal the item's `payload_sha256`.
    pub payload_sha256: String,
    /// The server's id for the stored item.
    pub server_id: String,
    pub received_at: String,
}

/// Something that can carry a batch up: HTTPS in the app, a directory for a
/// removable drive, a test double.
pub trait Transport {
    /// Store `batch`; return a receipt for each item stored. Items without a
    /// receipt stay queued. An `Err` means nothing is known to be stored.
    fn send(&self, batch: &[Upload]) -> Result<Vec<Receipt>>;
}

/// Longest `kind`: its item id (`<kind>-<32 hex>`) must stay a valid file
/// name for [`DirTransport`].
pub const MAX_KIND: usize = 31;

/// Queue `payload` under `kind` in an unencrypted store; returns its
/// `item_id`.
pub fn enqueue(conn: &Connection, kind: &str, payload: &serde_json::Value) -> Result<String> {
    enqueue_ref(conn, None, kind, None, payload)
}

/// Queue `payload` under `kind`, about `item_ref` (see [`supersede`]),
/// sealed with `key` when the store is encrypted. The hash is always of the
/// clear payload, which is what goes up.
pub fn enqueue_ref(
    conn: &Connection,
    key: Option<&RecordKey>,
    kind: &str,
    item_ref: Option<&str>,
    payload: &serde_json::Value,
) -> Result<String> {
    if !crate::packs::valid_id(kind) || kind.len() > MAX_KIND {
        return Err(Error::Invalid(format!(
            "outbox kind {kind:?}: up to {MAX_KIND} lowercase letters, digits, '.', '_' or '-'"
        )));
    }
    init(conn)?;
    // A keyless write to an encrypted store (or a wrong key) is refused, so
    // clear text never lands next to sealed rows.
    crate::records::check_key(conn, key)?;
    let body = serde_json::to_string(payload)?;
    let sha = hex_encode(&Sha256::digest(body.as_bytes()));
    let item_id = crate::records::new_id(kind, &[kind, &sha]);
    debug_assert!(crate::packs::valid_id(&item_id));
    let stored = crypt::seal_opt(key, &payload_aad(&item_id), &body)?;
    // Sealed rows keep no clear hash (it would let a guess be confirmed
    // offline); the AEAD tag protects them and the hash is computed on open.
    let stored_sha = if key.is_some() {
        SEALED_HASH
    } else {
        sha.as_str()
    };
    conn.execute(
        "INSERT INTO outbox (item_id, kind, payload, payload_sha256, created_at, ref)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![item_id, kind, stored, stored_sha, now_rfc3339(), item_ref],
    )?;
    Ok(item_id)
}

/// Withdraw the still-pending `kind` items about `item_ref`. Returns how
/// many were withdrawn and whether one about it was already sent (so the
/// caller can queue a retraction).
pub fn supersede(conn: &Connection, kind: &str, item_ref: &str) -> Result<(usize, bool)> {
    init(conn)?;
    let withdrawn = conn.execute(
        "DELETE FROM outbox WHERE kind = ?1 AND ref = ?2 AND acked_at IS NULL",
        params![kind, item_ref],
    )?;
    let sent: bool = conn.query_row(
        "SELECT EXISTS (SELECT 1 FROM outbox WHERE kind = ?1 AND ref = ?2 AND acked_at IS NOT NULL)",
        params![kind, item_ref],
        |r| r.get(0),
    )?;
    Ok((withdrawn, sent))
}

/// Pending items, oldest first. A row whose payload no longer matches its
/// hash is quarantined (kept, reported in [`status`], never sent) and the
/// rest of the queue moves on.
pub fn pending(conn: &Connection, limit: usize) -> Result<Vec<Upload>> {
    pending_with(conn, None, limit)
}

/// `payload_sha256` of a sealed row: the AEAD tag is its integrity check.
const SEALED_HASH: &str = "sealed";

fn payload_aad(item_id: &str) -> String {
    format!("outbox.payload:{item_id}")
}

/// [`pending`] for a store encrypted with `key`. The key is checked first:
/// a wrong or missing key is an error, never a quarantine. A row that then
/// fails to open (it was changed or moved) is quarantined like a hash
/// mismatch.
pub fn pending_with(
    conn: &Connection,
    key: Option<&RecordKey>,
    limit: usize,
) -> Result<Vec<Upload>> {
    init(conn)?;
    crate::records::check_key(conn, key)?;
    loop {
        let rows: Vec<(String, String, String, String, String)> = {
            let mut stmt = conn.prepare_cached(
                "SELECT item_id, kind, created_at, payload, payload_sha256 FROM outbox
                 WHERE acked_at IS NULL AND quarantined = 0 ORDER BY seq LIMIT ?1",
            )?;
            stmt.query_map([limit as i64], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?))
            })?
            .collect::<rusqlite::Result<_>>()?
        };
        let mut good = Vec::with_capacity(rows.len());
        let mut bad: Vec<(String, String)> = Vec::new();
        for (item_id, kind, created_at, stored, payload_sha256) in rows {
            if key.is_none() && crypt::is_sealed(&stored) {
                return Err(Error::Crypto(
                    "the records are encrypted; open them with the key".into(),
                ));
            }
            let payload = match crypt::open_opt(key, &payload_aad(&item_id), &stored) {
                Ok(p) => p,
                Err(e) => {
                    bad.push((item_id, e.to_string()));
                    continue;
                }
            };
            let actual = hex_encode(&Sha256::digest(payload.as_bytes()));
            let payload_sha256 = match (key.is_some(), payload_sha256.as_str()) {
                (true, SEALED_HASH) => actual,
                (false, stored) if stored == actual => actual,
                _ => {
                    bad.push((item_id, "payload hash mismatch".into()));
                    continue;
                }
            };
            good.push(Upload {
                item_id,
                kind,
                created_at,
                payload,
                payload_sha256,
            });
        }
        if bad.is_empty() {
            return Ok(good);
        }
        for (id, why) in bad {
            eprintln!("harvest: outbox item {id}: {why}; quarantined");
            conn.execute(
                "UPDATE outbox SET quarantined = 1, last_error = ?2 WHERE item_id = ?1",
                params![id, why],
            )?;
        }
    }
}

/// What one [`flush`] did.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, JsonSchema)]
pub struct FlushReport {
    pub sent: usize,
    pub acked: usize,
    /// Receipts that named no item of the batch or the wrong hash.
    pub rejected_receipts: usize,
    pub remaining: usize,
    /// The transport's error, when a batch failed.
    pub error: Option<String>,
}

/// Send pending items in batches of `batch_size` until the queue is empty,
/// a batch fails, or a batch is not fully acknowledged.
pub fn flush(
    conn: &Connection,
    transport: &dyn Transport,
    batch_size: usize,
) -> Result<FlushReport> {
    flush_with(conn, None, transport, batch_size)
}

/// [`flush`] for a store encrypted with `key`.
pub fn flush_with(
    conn: &Connection,
    key: Option<&RecordKey>,
    transport: &dyn Transport,
    batch_size: usize,
) -> Result<FlushReport> {
    crate::records::check_key(conn, key)?;
    let batch_size = batch_size.max(1);
    let mut report = FlushReport::default();
    loop {
        let batch = pending_with(conn, key, batch_size)?;
        if batch.is_empty() {
            break;
        }
        report.sent += batch.len();
        let ids: Vec<&str> = batch.iter().map(|u| u.item_id.as_str()).collect();
        let receipts = match transport.send(&batch) {
            Ok(r) => r,
            Err(e) => {
                let msg = e.to_string();
                for id in &ids {
                    conn.execute(
                        "UPDATE outbox SET attempts = attempts + 1, last_error = ?2 WHERE item_id = ?1",
                        params![id, msg],
                    )?;
                }
                report.error = Some(msg);
                break;
            }
        };
        let mut acked_now = 0;
        let tx = conn.unchecked_transaction()?;
        for r in &receipts {
            let Some(item) = batch.iter().find(|u| u.item_id == r.item_id) else {
                report.rejected_receipts += 1;
                continue;
            };
            if !r.payload_sha256.eq_ignore_ascii_case(&item.payload_sha256) {
                report.rejected_receipts += 1;
                tx.execute(
                    "UPDATE outbox SET attempts = attempts + 1, last_error = ?2 WHERE item_id = ?1",
                    params![item.item_id, "receipt hash does not match the payload"],
                )?;
                continue;
            }
            let n = tx.execute(
                "UPDATE outbox SET acked_at = ?2, receipt = ?3, last_error = NULL,
                        attempts = attempts + 1
                 WHERE item_id = ?1 AND acked_at IS NULL",
                params![item.item_id, now_rfc3339(), serde_json::to_string(r)?],
            )?;
            acked_now += n;
        }
        for u in &batch {
            if !receipts.iter().any(|r| r.item_id == u.item_id) {
                tx.execute(
                    "UPDATE outbox SET attempts = attempts + 1, last_error = ?2 WHERE item_id = ?1",
                    params![u.item_id, "no receipt"],
                )?;
            }
        }
        tx.commit()?;
        report.acked += acked_now;
        if acked_now < batch.len() {
            break; // do not spin on items the server will not take
        }
    }
    report.remaining = status(conn)?.pending as usize;
    Ok(report)
}

/// Queue counts.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, JsonSchema)]
pub struct OutboxStatus {
    pub pending: u64,
    pub acked: u64,
    /// Pending items that have failed at least once.
    pub failing: u64,
    /// Items whose stored payload no longer matches its hash; never sent.
    pub quarantined: u64,
    /// Pending items per kind.
    pub pending_by_kind: BTreeMap<String, u64>,
    pub last_error: Option<String>,
}

pub fn status(conn: &Connection) -> Result<OutboxStatus> {
    init(conn)?;
    let mut s = OutboxStatus::default();
    let mut stmt = conn.prepare(
        "SELECT kind, acked_at IS NOT NULL, attempts, last_error, quarantined FROM outbox
         ORDER BY seq",
    )?;
    let mut rows = stmt.query([])?;
    while let Some(r) = rows.next()? {
        let kind: String = r.get(0)?;
        let acked: bool = r.get(1)?;
        let attempts: i64 = r.get(2)?;
        let err: Option<String> = r.get(3)?;
        let quarantined: bool = r.get(4)?;
        if acked {
            s.acked += 1;
        } else if quarantined {
            s.quarantined += 1;
            s.last_error = err;
        } else {
            s.pending += 1;
            *s.pending_by_kind.entry(kind).or_insert(0) += 1;
            if attempts > 0 {
                s.failing += 1;
            }
            if err.is_some() {
                s.last_error = err;
            }
        }
    }
    Ok(s)
}

/// Writes each item as `<item_id>.json` into a directory (a removable drive
/// or a shared folder) and acknowledges only what is on the medium: each
/// file is written to a temp name, flushed to disk, renamed, and the
/// directory flushed, before its receipt is issued. Rewriting an item is
/// harmless.
pub struct DirTransport {
    pub dir: PathBuf,
}

impl DirTransport {
    pub fn new(dir: &Path) -> Self {
        Self {
            dir: dir.to_path_buf(),
        }
    }
}

impl Transport for DirTransport {
    fn send(&self, batch: &[Upload]) -> Result<Vec<Receipt>> {
        std::fs::create_dir_all(&self.dir)?;
        let mut out = Vec::with_capacity(batch.len());
        for u in batch {
            if !crate::packs::valid_id(&u.item_id) {
                return Err(Error::Sync(format!("unsafe item id {:?}", u.item_id)));
            }
            let name = format!("{}.json", u.item_id);
            let tmp = self.dir.join(format!(".{name}.tmp"));
            {
                use std::io::Write;
                let mut f = std::fs::File::create(&tmp)?;
                f.write_all(&serde_json::to_vec_pretty(u)?)?;
                f.sync_all()?;
            }
            std::fs::rename(&tmp, self.dir.join(&name))?;
            sync_dir(&self.dir)?;
            out.push(Receipt {
                item_id: u.item_id.clone(),
                payload_sha256: u.payload_sha256.clone(),
                server_id: format!("file:{name}"),
                received_at: now_rfc3339(),
            });
        }
        Ok(out)
    }
}

/// Flush a directory's entries (the rename) to disk. Windows has no
/// directory handle to flush; NTFS journals the rename.
fn sync_dir(dir: &Path) -> Result<()> {
    #[cfg(unix)]
    std::fs::File::open(dir)?.sync_all()?;
    #[cfg(not(unix))]
    let _ = dir;
    Ok(())
}

/// A device's link to its hub: uploads, field-note bundles and pack
/// updates. The app implements it over HTTPS; a simulation over a
/// simulated link; tests over an in-process hub.
pub trait HubLink {
    /// The device's id as the hub knows it.
    fn device_id(&self) -> String;
    /// Store `batch`; receipts as for [`Transport::send`].
    fn send(&self, batch: &[Upload]) -> Result<Vec<Receipt>>;
    /// Signed field-note bundles with `seq` above `since`, in order.
    fn bundles_since(&self, since: u64) -> Result<Vec<serde_json::Value>>;
    /// The pack the hub offers for `pack_id` to a device holding `have`.
    fn pack_offer(&self, pack_id: &str, have: Option<&str>) -> Result<Option<PackOffer>>;
    /// One file of an offer (`manifest.json` or a listed path).
    fn fetch(&self, offer: &PackOffer, path: &str) -> Result<Vec<u8>>;
    /// The hub's signed fleet summary (`harvest-fleet/1`), when it has one.
    fn fleet(&self) -> Result<Option<serde_json::Value>>;
    /// The small signed hello that opens every upload: the hub answers
    /// whether it accepts this device before any payload is sent.
    fn hello(&self) -> Result<HelloReply>;
    /// The link the device is on now (the hub's attachment policy depends
    /// on it); `normal` unless the host knows better.
    fn link_class(&self) -> LinkClass {
        LinkClass::Normal
    }
    /// The device's public key (base64), for an administrator to enroll.
    fn public_key(&self) -> String;
    /// How much of an attachment variant the hub already holds (resume
    /// point; `total` when it holds it all, from any device).
    fn attachment_offset(&self, sha256: &str, total: u64) -> Result<u64>;
    /// Sign and send one chunk of an attachment variant; returns how much
    /// of it the hub now holds.
    fn put_chunk(
        &self,
        sha256: &str,
        variant: &str,
        total: u64,
        offset: u64,
        data: &[u8],
    ) -> Result<u64>;
}

/// Why the hub refuses a device.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Refusal {
    /// The hub does not know this device's key.
    Unenrolled,
    /// An administrator revoked it.
    Revoked,
    /// The signature does not verify against the enrolled key.
    Signature,
}

impl Refusal {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Unenrolled => "unenrolled",
            Self::Revoked => "revoked",
            Self::Signature => "signature",
        }
    }
}

/// A device's hello (`harvest-hello/1`), signed like a delivery.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Hello {
    pub device_id: String,
    pub signed_at: String,
    /// The link the device is on now, as the host knows it.
    #[serde(default)]
    pub link: LinkClass,
    pub signature: String,
}

/// How good the device's current link is (the host decides: a satellite
/// or radio link is `low`).
#[derive(
    Debug, Clone, Copy, Default, Serialize, Deserialize, JsonSchema, PartialEq, Eq, PartialOrd, Ord,
)]
#[serde(rename_all = "snake_case")]
pub enum LinkClass {
    Low,
    #[default]
    Normal,
}

/// What attachments travel on a link (the hub's policy per link class).
#[derive(
    Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq, PartialOrd, Ord,
)]
#[serde(rename_all = "snake_case")]
pub enum AttachmentMode {
    /// Only the references (they travel with the records); the files wait.
    Refs,
    /// The downscaled copy when the host made one, else the file.
    Downscaled,
    Full,
}

/// One chunk of an attachment upload, signed by the device over the
/// content's hash, the variant, the offset and the chunk's hash.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct AttachmentChunk {
    pub device_id: String,
    /// The SHA-256 of the file this variant is (content addressed).
    pub sha256: String,
    /// `full` or `small`.
    pub variant: String,
    /// The size of the whole variant.
    pub total: u64,
    pub offset: u64,
    /// The chunk, base64.
    pub data: String,
    pub signed_at: String,
    pub signature: String,
}

impl AttachmentChunk {
    fn message(&self) -> Result<Vec<u8>> {
        use base64::Engine as _;
        let raw = base64::engine::general_purpose::STANDARD
            .decode(self.data.as_bytes())
            .map_err(|_| Error::Invalid("attachment chunk is not base64".into()))?;
        crate::canon::to_vec(&serde_json::json!({
            "format": "harvest-attachment/1",
            "device_id": self.device_id,
            "sha256": self.sha256,
            "variant": self.variant,
            "total": self.total,
            "offset": self.offset,
            "chunk_sha256": hex_encode(&Sha256::digest(&raw)),
            "signed_at": self.signed_at,
        }))
    }

    /// Check the signature against the device's public key.
    pub fn verify(&self, public: &[u8; 32]) -> Result<()> {
        verify_sig(public, &self.device_id, &self.signature, &self.message()?)
    }
}

impl Hello {
    fn message(&self) -> Result<Vec<u8>> {
        crate::canon::to_vec(&serde_json::json!({
            "format": "harvest-hello/1",
            "device_id": self.device_id,
            "signed_at": self.signed_at,
            "link": self.link,
        }))
    }

    /// Check the signature against the device's public key.
    pub fn verify(&self, public: &[u8; 32]) -> Result<()> {
        verify_sig(public, &self.device_id, &self.signature, &self.message()?)
    }
}

/// The hub's answer to a hello.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct HelloReply {
    pub accepted: bool,
    pub refused: Option<Refusal>,
    /// How often a device fetches a changed fleet summary (a hub setting
    /// the device learns here).
    pub fleet_every_hours: f64,
    pub hub_time: String,
    /// What attachments may travel on the link the device named.
    #[serde(default = "default_mode")]
    pub attachments: AttachmentMode,
    /// The attachment chunk size, bytes.
    #[serde(default = "default_chunk")]
    pub chunk_bytes: u64,
    /// The hub's bundle stream: a device pulls by this stream's seq.
    #[serde(default)]
    pub stream: Option<String>,
}

fn default_mode() -> AttachmentMode {
    AttachmentMode::Full
}
fn default_chunk() -> u64 {
    DEFAULT_CHUNK_BYTES
}

/// Default attachment chunk size.
pub const DEFAULT_CHUNK_BYTES: u64 = 64 * 1024;

fn verify_sig(public: &[u8; 32], device_id: &str, signature: &str, message: &[u8]) -> Result<()> {
    use base64::Engine as _;
    use ed25519_dalek::Verifier;
    if device_id_for(public) != device_id {
        return Err(Error::Signature("the message names another device".into()));
    }
    let key = ed25519_dalek::VerifyingKey::from_bytes(public)
        .map_err(|e| Error::Signature(format!("device key: {e}")))?;
    let raw = base64::engine::general_purpose::STANDARD
        .decode(signature.trim())
        .map_err(|_| Error::Signature("signature is not base64".into()))?;
    let arr: [u8; 64] = raw
        .try_into()
        .map_err(|_| Error::Signature("signature must be 64 bytes".into()))?;
    key.verify(message, &ed25519_dalek::Signature::from_bytes(&arr))
        .map_err(|_| Error::Signature("signature does not verify".into()))
}

/// A device's signing key: generated on the device, its private half kept
/// where the host keeps the records key (the platform keystore). The hub
/// knows the device by the public half (enrollment).
pub struct DeviceKey(ed25519_dalek::SigningKey);

impl DeviceKey {
    /// A new key from the OS random source.
    pub fn generate() -> Result<Self> {
        let mut seed = [0u8; 32];
        getrandom::getrandom(&mut seed).map_err(|e| Error::Crypto(format!("random: {e}")))?;
        Ok(Self(ed25519_dalek::SigningKey::from_bytes(&seed)))
    }
    /// From the 32-byte seed the keystore holds.
    pub fn from_seed(seed: &[u8; 32]) -> Self {
        Self(ed25519_dalek::SigningKey::from_bytes(seed))
    }
    pub fn seed(&self) -> [u8; 32] {
        self.0.to_bytes()
    }
    /// The public key as base64 (what an administrator enrolls).
    pub fn public_base64(&self) -> String {
        use base64::Engine as _;
        base64::engine::general_purpose::STANDARD.encode(self.0.verifying_key().as_bytes())
    }
    /// `dev-<key id>`: the device id the hub records on every item.
    pub fn device_id(&self) -> String {
        device_id_for(self.0.verifying_key().as_bytes())
    }
    /// Sign a hello.
    pub fn hello(&self, link: LinkClass) -> Result<Hello> {
        let mut h = Hello {
            device_id: self.device_id(),
            signed_at: now_rfc3339(),
            link,
            signature: String::new(),
        };
        use base64::Engine as _;
        use ed25519_dalek::Signer;
        h.signature =
            base64::engine::general_purpose::STANDARD.encode(self.0.sign(&h.message()?).to_bytes());
        Ok(h)
    }

    /// Sign one chunk of an attachment upload.
    pub fn chunk(
        &self,
        sha256: &str,
        variant: &str,
        total: u64,
        offset: u64,
        data: &[u8],
    ) -> Result<AttachmentChunk> {
        use base64::Engine as _;
        use ed25519_dalek::Signer;
        let mut c = AttachmentChunk {
            device_id: self.device_id(),
            sha256: sha256.to_string(),
            variant: variant.to_string(),
            total,
            offset,
            data: base64::engine::general_purpose::STANDARD.encode(data),
            signed_at: now_rfc3339(),
            signature: String::new(),
        };
        c.signature =
            base64::engine::general_purpose::STANDARD.encode(self.0.sign(&c.message()?).to_bytes());
        Ok(c)
    }

    /// Sign a delivery of `items`.
    pub fn deliver(&self, items: &[Upload]) -> Result<Delivery> {
        let mut d = Delivery {
            device_id: self.device_id(),
            signed_at: now_rfc3339(),
            items: items.to_vec(),
            signature: String::new(),
        };
        use ed25519_dalek::Signer;
        let sig = self.0.sign(&d.message()?);
        use base64::Engine as _;
        d.signature = base64::engine::general_purpose::STANDARD.encode(sig.to_bytes());
        Ok(d)
    }
}

/// The device id for a public key.
pub fn device_id_for(public: &[u8; 32]) -> String {
    format!("dev-{}", crate::packs::key_id_for(public))
}

/// One upload batch as a device sends it: signed by the device's key over
/// its id, the time and every item's id, kind and payload hash.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Delivery {
    pub device_id: String,
    pub signed_at: String,
    pub items: Vec<Upload>,
    /// base64 ed25519 signature over [`Delivery::message`].
    pub signature: String,
}

impl Delivery {
    /// The signed bytes: canonical JSON of the id, the time and each
    /// item's id, kind and payload hash (the hub checks every payload
    /// against its hash).
    pub fn message(&self) -> Result<Vec<u8>> {
        let items: Vec<serde_json::Value> = self
            .items
            .iter()
            .map(|u| serde_json::json!({"item_id": u.item_id, "kind": u.kind, "payload_sha256": u.payload_sha256}))
            .collect();
        crate::canon::to_vec(&serde_json::json!({
            "format": "harvest-delivery/1",
            "device_id": self.device_id,
            "signed_at": self.signed_at,
            "items": items,
        }))
    }

    /// Check the signature against the device's public key.
    pub fn verify(&self, public: &[u8; 32]) -> Result<()> {
        verify_sig(public, &self.device_id, &self.signature, &self.message()?)
    }
}

/// A pack the hub offers: the full pack, or a delta from the device's
/// version.
#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema, PartialEq)]
pub struct PackOffer {
    pub pack_id: String,
    pub version: String,
    /// `full` | `delta`.
    pub kind: String,
    pub base_version: Option<String>,
    /// The hub's name for the offered directory.
    pub dir: String,
    /// The files to fetch besides `manifest.json`.
    pub files: Vec<crate::packs::FileEntry>,
    pub bytes: u64,
}

/// [`HubLink`] as an upload [`Transport`].
pub struct LinkTransport<'a>(pub &'a dyn HubLink);

impl Transport for LinkTransport<'_> {
    fn send(&self, batch: &[Upload]) -> Result<Vec<Receipt>> {
        self.0.send(batch)
    }
}

/// Download an offer through `link` into a staging directory under
/// `root`, check every file against the offer, and install it (full or
/// delta; verified, atomic, no downgrade).
pub fn install_offer(
    root: &Path,
    link: &dyn HubLink,
    offer: &PackOffer,
    keys: &[crate::packs::TrustedKey],
) -> Result<crate::packs::Installed> {
    if !crate::packs::valid_id(&offer.pack_id) || !crate::packs::valid_version(&offer.version) {
        return Err(Error::Sync(format!(
            "bad offer {} {}",
            offer.pack_id, offer.version
        )));
    }
    let staging = root
        .join(&offer.pack_id)
        .join(format!(".download-{}", offer.version));
    if staging.exists() {
        std::fs::remove_dir_all(&staging)?;
    }
    std::fs::create_dir_all(&staging)?;
    let result = (|| {
        let manifest = link.fetch(offer, crate::packs::MANIFEST)?;
        std::fs::write(staging.join(crate::packs::MANIFEST), manifest)?;
        for f in &offer.files {
            let rel = crate::packs::safe_relative(&f.path)?;
            let bytes = link.fetch(offer, &f.path)?;
            if bytes.len() as u64 != f.bytes
                || !hex_encode(&Sha256::digest(&bytes)).eq_ignore_ascii_case(&f.sha256)
            {
                return Err(Error::Integrity(format!(
                    "{}: not what the offer lists",
                    f.path
                )));
            }
            let to = staging.join(rel);
            if let Some(p) = to.parent() {
                std::fs::create_dir_all(p)?;
            }
            std::fs::write(to, bytes)?;
        }
        if offer.kind == "delta" {
            crate::delta::install_delta(root, &staging, keys)
        } else {
            crate::packs::install_dir(root, &staging, keys)
        }
    })();
    let _ = std::fs::remove_dir_all(&staging);
    result
}
