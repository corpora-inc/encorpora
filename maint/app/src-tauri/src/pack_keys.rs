//! Public keys compiled into the app (ed25519, base64 of the raw 32-byte key).
//!
//! - **Packs** (`keys/packs-dev.pub`): the key the development packs are signed
//!   with (the ingest lane's maint-dev set). A release build will carry the
//!   production pack key instead; the swap is this file and the key file.
//! - **Field notes** (`keys/test-fixture.pub`): the public test key the
//!   development hub signs field-note bundles with (`harvest hub --dev-key`).
//!   Debug builds only; a release build trusts its hub's own key.

pub const PACKS: &str = include_str!("../keys/packs-dev.pub");
pub const TEST_FIXTURE: &str = include_str!("../keys/test-fixture.pub");

/// Keys a pack may be signed with.
pub fn packs() -> Vec<&'static str> {
    let mut keys = vec![PACKS.trim()];
    if cfg!(debug_assertions) {
        // The fixture pack the tests open is signed with the test key.
        keys.push(TEST_FIXTURE.trim());
    }
    keys
}

/// Keys a field-note bundle may be signed with.
pub fn field() -> Vec<&'static str> {
    if cfg!(debug_assertions) {
        vec![TEST_FIXTURE.trim()]
    } else {
        vec![]
    }
}
