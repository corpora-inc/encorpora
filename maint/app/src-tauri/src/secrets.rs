//! The engine's key store: the records key (records at rest) and the device
//! key (the device's identity at the hub). The engine makes each once, the
//! first time, and asks for it by name (`shell::RECORDS_KEY`, `shell::DEVICE_KEY`).
//!
//! On macOS they live in the login keychain (generic passwords, service
//! `inc.corpora.maint`). Elsewhere, and in tests, files under a folder.
//! Windows will use the Credential Manager; that store is not written yet.

use base64::Engine as _;
use harvest_core::shell::KeyStore;
use std::path::{Path, PathBuf};

#[cfg(any(target_os = "macos", target_os = "ios"))]
const SERVICE: &str = "inc.corpora.maint";

pub enum Store {
    #[cfg(any(target_os = "macos", target_os = "ios"))]
    Keychain,
    /// Files under a folder (tests; platforms without a keychain store yet).
    Files(PathBuf),
}

impl Store {
    /// The platform's store: the keychain on macOS, files in `data/secrets` elsewhere.
    pub fn platform(data: &Path) -> Self {
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        {
            let _ = data;
            Self::Keychain
        }
        #[cfg(not(any(target_os = "macos", target_os = "ios")))]
        {
            Self::Files(data.join("secrets"))
        }
    }
}

fn err(msg: String) -> harvest_core::Error {
    harvest_core::Error::Invalid(msg)
}

impl KeyStore for Store {
    fn load(&self, name: &str) -> harvest_core::Result<Option<Vec<u8>>> {
        let text = match self {
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            Self::Keychain => {
                match security_framework::passwords::get_generic_password(SERVICE, name) {
                    Ok(bytes) => String::from_utf8(bytes)
                        .map_err(|e| err(format!("keychain {name}: {e}")))?,
                    Err(e) if e.code() == -25300 => return Ok(None), // errSecItemNotFound
                    Err(e) => return Err(err(format!("keychain {name}: {e}"))),
                }
            }
            Self::Files(dir) => match std::fs::read_to_string(dir.join(name)) {
                Ok(t) => t,
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
                Err(e) => return Err(err(format!("{name}: {e}"))),
            },
        };
        base64::engine::general_purpose::STANDARD
            .decode(text.trim())
            .map(Some)
            .map_err(|_| err(format!("{name}: not base64")))
    }

    fn store(&self, name: &str, secret: &[u8]) -> harvest_core::Result<()> {
        let text = base64::engine::general_purpose::STANDARD.encode(secret);
        match self {
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            Self::Keychain => {
                security_framework::passwords::set_generic_password(SERVICE, name, text.as_bytes())
                    .map_err(|e| err(format!("keychain {name}: {e}")))
            }
            Self::Files(dir) => {
                std::fs::create_dir_all(dir).map_err(|e| err(e.to_string()))?;
                std::fs::write(dir.join(name), text).map_err(|e| err(e.to_string()))
            }
        }
    }
}
