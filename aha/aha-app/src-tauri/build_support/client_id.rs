//! Resolves the public Free2Z OAuth client id for the native build. Shared by `build.rs` and the
//! crate's unit tests, so it must stay dependency-free.
//!
//! The environment variable is not enough on its own: `tauri ios build` runs `xcodebuild` with a
//! cleared environment (only HOME, PATH, TERM and TAURI*/WRY*/CARGO_*/RUST_* survive), so the
//! Rust compile inside Xcode's build phase never sees `AHA_FREE2Z_CLIENT_ID`. Release workflows
//! therefore also write the id to `release-config/free2z-client-id` (gitignored) before building,
//! and the build reads it from there on every platform.

/// Environment variable consulted first.
pub const ENV_VAR: &str = "AHA_FREE2Z_CLIENT_ID";
/// Gitignored file, relative to the crate manifest directory, consulted when the env is absent.
pub const FILE: &str = "release-config/free2z-client-id";
/// The variable `build.rs` always sets for rustc; `src/f2z.rs` reads only this.
pub const RESOLVED_VAR: &str = "AHA_FREE2Z_CLIENT_ID_RESOLVED";

/// `Ok(None)` means sign-in is unconfigured (a normal local/dev build). Any malformed value, or an
/// env value that disagrees with the file, is an error so a release can never ship a wrong id.
pub fn resolve(env: Option<&str>, file: Option<&str>) -> Result<Option<String>, String> {
    let env = env.map(str::trim).filter(|v| !v.is_empty());
    let file = file.map(str::trim).filter(|v| !v.is_empty());
    for (source, value) in [(ENV_VAR, env), (FILE, file)] {
        if let Some(value) = value {
            validate(value).map_err(|why| format!("{source}: {why}"))?;
        }
    }
    match (env, file) {
        (Some(e), Some(f)) if e != f => Err(format!(
            "{ENV_VAR} and {FILE} name different Free2Z client ids; remove the stale one"
        )),
        (Some(v), _) | (None, Some(v)) => Ok(Some(v.to_owned())),
        (None, None) => Ok(None),
    }
}

fn validate(value: &str) -> Result<(), String> {
    if !(8..=128).contains(&value.len()) {
        return Err("client id must be 8 to 128 characters".into());
    }
    if !value
        .bytes()
        .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.'))
    {
        return Err("client id may contain only ASCII letters, digits, '-', '_' and '.'".into());
    }
    Ok(())
}
