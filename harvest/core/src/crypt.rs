//! Encryption at rest for the device records database.
//!
//! The host keeps a 32-byte key in the platform keystore (iOS Keychain,
//! Android Keystore, Windows DPAPI, macOS Keychain) and passes it to
//! [`crate::records::Records::open_with_key`]. What people type or capture
//! (step values, notes, photo references, structured notes, outbox payloads,
//! audit entries) is sealed with XChaCha20-Poly1305 under a fresh random
//! nonce; ids, statuses and timestamps stay clear so the store can be queried.
//! Each value is bound to its table, column and row, so a sealed value moved
//! to another row or column fails to open. The pack itself is public content
//! and stays as shipped.

use crate::error::{Error, Result};
use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as B64;
use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};

/// Prefix of a sealed value: `enc1:` + base64(nonce ‖ ciphertext ‖ tag).
const PREFIX: &str = "enc1:";
const NONCE: usize = 24;

/// A records key. Never logged, never serialized.
#[derive(Clone)]
pub struct RecordKey(XChaCha20Poly1305);

impl std::fmt::Debug for RecordKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("RecordKey(..)")
    }
}

impl RecordKey {
    pub fn from_bytes(bytes: &[u8; 32]) -> Self {
        Self(XChaCha20Poly1305::new(bytes.into()))
    }

    /// A new random key, for the host to store in its keystore.
    pub fn generate() -> Result<[u8; 32]> {
        let mut k = [0u8; 32];
        getrandom::getrandom(&mut k).map_err(|e| Error::Crypto(format!("random: {e}")))?;
        Ok(k)
    }

    /// Seal `plain`, bound to `aad` (table, column and row).
    pub fn seal(&self, aad: &str, plain: &str) -> Result<String> {
        let mut nonce = [0u8; NONCE];
        getrandom::getrandom(&mut nonce).map_err(|e| Error::Crypto(format!("random: {e}")))?;
        let ct = self
            .0
            .encrypt(
                &XNonce::from(nonce),
                Payload {
                    msg: plain.as_bytes(),
                    aad: aad.as_bytes(),
                },
            )
            .map_err(|_| Error::Crypto("seal failed".into()))?;
        let mut out = Vec::with_capacity(NONCE + ct.len());
        out.extend_from_slice(&nonce);
        out.extend_from_slice(&ct);
        Ok(format!("{PREFIX}{}", B64.encode(out)))
    }

    /// Open a value sealed under the same `aad`.
    pub fn open(&self, aad: &str, sealed: &str) -> Result<String> {
        let body = sealed
            .strip_prefix(PREFIX)
            .ok_or_else(|| Error::Crypto(format!("{aad}: value is not sealed")))?;
        let raw = B64
            .decode(body)
            .map_err(|_| Error::Crypto(format!("{aad}: sealed value is not base64")))?;
        if raw.len() < NONCE + 16 {
            return Err(Error::Crypto(format!("{aad}: sealed value is truncated")));
        }
        let (nonce, ct) = raw.split_at(NONCE);
        let nonce =
            <&XNonce>::try_from(nonce).map_err(|_| Error::Crypto(format!("{aad}: bad nonce")))?;
        let plain = self
            .0
            .decrypt(
                nonce,
                Payload {
                    msg: ct,
                    aad: aad.as_bytes(),
                },
            )
            .map_err(|_| {
                Error::Crypto(format!(
                    "{aad}: cannot open (wrong key, or the value was moved or changed)"
                ))
            })?;
        String::from_utf8(plain).map_err(|_| Error::Crypto(format!("{aad}: not UTF-8")))
    }
}

/// True for a value written by [`RecordKey::seal`].
pub fn is_sealed(v: &str) -> bool {
    v.starts_with(PREFIX)
}

/// Seal with `key`, or pass through when the store is unencrypted.
pub(crate) fn seal_opt(key: Option<&RecordKey>, aad: &str, v: &str) -> Result<String> {
    match key {
        Some(k) => k.seal(aad, v),
        None => Ok(v.to_string()),
    }
}

/// Open with `key`, or pass through when the store is unencrypted. A sealed
/// value without a key, or a clear value with one, is an error: never a
/// silent fallback.
pub(crate) fn open_opt(key: Option<&RecordKey>, aad: &str, v: &str) -> Result<String> {
    match (key, is_sealed(v)) {
        (Some(k), true) => k.open(aad, v),
        (None, false) => Ok(v.to_string()),
        (None, true) => Err(Error::Crypto(format!(
            "{aad}: the records are encrypted; open them with the key"
        ))),
        (Some(_), false) => Err(Error::Crypto(format!(
            "{aad}: clear value in an encrypted store"
        ))),
    }
}
