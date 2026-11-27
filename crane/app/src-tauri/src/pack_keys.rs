//! Public keys that verify crane knowledge packs (ed25519, base64 of the raw
//! 32-byte key, the format `harvest_core::TrustedKey::parse` and
//! `harvest-bake verify --pubkey` read).
//!
//! - **Production** (`keys/pack-production.pub`): signs every pack a release
//!   ships. Its private half is the `CRANE_PACK_SIGNING_KEY` Actions secret;
//!   `scripts/check-pack-key.sh` proves the secret and each built pack match
//!   this file. Rotation: `crane/app/RELEASE_SETUP.md`, "Pack signing key".
//! - **Lab** (`keys/pack-lab.pub`): the evaluation lab's key. Trusted only in
//!   debug and test builds, so lab-built packs can be tried on a device;
//!   a release build never accepts a pack it signed.

/// The production pack key.
pub const PRODUCTION: &str = include_str!("../keys/pack-production.pub");
/// The lab key (dev and test builds only).
pub const LAB: &str = include_str!("../keys/pack-lab.pub");

/// The keys this build accepts a pack from.
pub fn trusted() -> Vec<&'static str> {
    let mut keys = vec![PRODUCTION.trim()];
    if cfg!(debug_assertions) {
        keys.push(LAB.trim());
    }
    keys
}

/// The keys a release build accepts: production only. Kept separate from
/// [`trusted`] so tests can assert it in a debug test binary.
pub fn release_trusted() -> Vec<&'static str> {
    vec![PRODUCTION.trim()]
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine as _;

    fn raw(key: &str) -> Vec<u8> {
        base64::engine::general_purpose::STANDARD
            .decode(key.trim())
            .expect("base64")
    }

    #[test]
    fn keys_are_raw_ed25519_public_keys() {
        assert_eq!(raw(PRODUCTION).len(), 32);
        assert_eq!(raw(LAB).len(), 32);
        assert_ne!(raw(PRODUCTION), raw(LAB));
    }

    #[test]
    fn release_builds_trust_only_production() {
        assert_eq!(release_trusted(), vec![PRODUCTION.trim()]);
        assert!(!release_trusted().contains(&LAB.trim()));
        assert_eq!(trusted()[0], PRODUCTION.trim());
        assert_eq!(trusted().contains(&LAB.trim()), cfg!(debug_assertions));
    }
}
