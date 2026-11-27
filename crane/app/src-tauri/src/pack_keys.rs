//! Public keys that verify crane knowledge packs (ed25519, base64 of the raw
//! 32-byte key, the format `harvest_core::TrustedKey::parse` and
//! `harvest-bake verify --pubkey` read).
//!
//! - **Production** (`keys/pack-production.pub`): signs the packs a release
//!   ships (once the harvest-core swap opens packs with [`trusted`]). Its private half is the `CRANE_PACK_SIGNING_KEY` Actions secret;
//!   `scripts/check-pack-key.sh` proves the secret and each built pack match
//!   this file. Rotation: `crane/app/RELEASE_SETUP.md`, "Pack signing key".
//! - **Lab** (`keys/pack-lab.pub`): the evaluation lab's key. Trusted only in
//!   debug and test builds, so lab-built packs can be tried on a device;
//!   a release build never accepts a pack it signed.

/// The production pack key.
pub const PRODUCTION: &str = include_str!("../keys/pack-production.pub");
/// The lab key (dev and test builds only).
pub const LAB: &str = include_str!("../keys/pack-lab.pub");

/// The keys a release build accepts. During a rotation this also holds the
/// next key (RELEASE_SETUP.md, "Rotation"); never the lab key.
pub fn release_trusted() -> Vec<&'static str> {
    vec![PRODUCTION.trim()]
}

/// The keys this build accepts a pack from: the release set, plus the lab key
/// in debug and test builds only. Built on [`release_trusted`], so the
/// release behaviour is the code the tests exercise.
pub fn trusted() -> Vec<&'static str> {
    let mut keys = release_trusted();
    if cfg!(debug_assertions) {
        keys.push(LAB.trim());
    }
    keys
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
    fn release_builds_never_trust_the_lab_key() {
        assert!(release_trusted().contains(&PRODUCTION.trim()));
        assert!(!release_trusted().contains(&LAB.trim()));
        // This build's set is the release set, plus the lab key only in debug.
        let mut expected = release_trusted();
        if cfg!(debug_assertions) {
            expected.push(LAB.trim());
        }
        assert_eq!(trusted(), expected);
    }
}
