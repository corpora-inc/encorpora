//! The two secrets a device holds: the records key (encrypts records at rest)
//! and the device key (signs every upload to the hub). Each is 32 random bytes,
//! made on first use and never leaves the device.
//!
//! On macOS they live in the login keychain (generic passwords, service
//! `inc.corpora.maint`). Elsewhere, and in tests, a file store under a folder.
//! Windows will use the Credential Manager; that store is not written yet.

use base64::Engine as _;
use std::path::{Path, PathBuf};

const SERVICE: &str = "inc.corpora.maint";
const RECORDS: &str = "records-key";
const DEVICE: &str = "device-key";

pub enum Store {
    #[cfg(target_os = "macos")]
    Keychain,
    /// Files under a folder (tests; platforms without a keychain store yet).
    Files(PathBuf),
}

impl Store {
    /// The platform's store: the keychain on macOS, files in `data/secrets` elsewhere.
    pub fn platform(data: &Path) -> Self {
        #[cfg(target_os = "macos")]
        {
            let _ = data;
            Self::Keychain
        }
        #[cfg(not(target_os = "macos"))]
        {
            Self::Files(data.join("secrets"))
        }
    }

    pub fn records_key(&self) -> Result<[u8; 32], String> {
        self.get_or_make(RECORDS)
    }

    pub fn device_seed(&self) -> Result<[u8; 32], String> {
        self.get_or_make(DEVICE)
    }

    fn get_or_make(&self, account: &str) -> Result<[u8; 32], String> {
        if let Some(v) = self.get(account)? {
            return Ok(v);
        }
        let mut fresh = [0u8; 32];
        getrandom::getrandom(&mut fresh).map_err(|e| format!("random: {e}"))?;
        self.set(account, &fresh)?;
        Ok(fresh)
    }

    fn get(&self, account: &str) -> Result<Option<[u8; 32]>, String> {
        let text = match self {
            #[cfg(target_os = "macos")]
            Self::Keychain => {
                match security_framework::passwords::get_generic_password(SERVICE, account) {
                    Ok(bytes) => String::from_utf8(bytes).map_err(|e| e.to_string())?,
                    Err(e) if e.code() == -25300 => return Ok(None), // errSecItemNotFound
                    Err(e) => return Err(format!("keychain {account}: {e}")),
                }
            }
            Self::Files(dir) => match std::fs::read_to_string(dir.join(account)) {
                Ok(t) => t,
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
                Err(e) => return Err(format!("{account}: {e}")),
            },
        };
        let raw = base64::engine::general_purpose::STANDARD
            .decode(text.trim())
            .map_err(|_| format!("{account}: not base64"))?;
        raw.try_into()
            .map(Some)
            .map_err(|_| format!("{account}: not 32 bytes"))
    }

    fn set(&self, account: &str, value: &[u8; 32]) -> Result<(), String> {
        let text = base64::engine::general_purpose::STANDARD.encode(value);
        match self {
            #[cfg(target_os = "macos")]
            Self::Keychain => security_framework::passwords::set_generic_password(
                SERVICE,
                account,
                text.as_bytes(),
            )
            .map_err(|e| format!("keychain {account}: {e}")),
            Self::Files(dir) => {
                std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
                std::fs::write(dir.join(account), text).map_err(|e| e.to_string())
            }
        }
    }
}
