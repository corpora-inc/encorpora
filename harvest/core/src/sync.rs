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
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
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
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
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
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
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
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
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
