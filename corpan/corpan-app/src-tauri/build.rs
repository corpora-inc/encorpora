fn main() {
    // Android 16 KB page-size compatibility (Play Store requirement for apps
    // targeting Android 15+; hard enforcement from Nov 2025 / May 2026).
    //
    // `.cargo/config.toml` already sets `-Wl,-z,max-page-size=16384` via
    // `target.<android-triple>.rustflags`, and pins the linker to NDK
    // 28.2.13676358 (16 KB-ready by default). Neither is reliable on its
    // own though:
    //   1. A `CARGO_TARGET_<TRIPLE>_RUSTFLAGS` env var — which tauri-cli's
    //      Android build path can inject — REPLACES config.toml's
    //      `rustflags` array wholesale rather than merging with it, silently
    //      dropping the max-page-size flags.
    //   2. A `CARGO_TARGET_<TRIPLE>_LINKER` env var already exported by a
    //      dev machine's shell profile (observed here: `~/.zshrc` exports
    //      `CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER` pointing at NDK
    //      26.1.10909125, pre-dating our r28 pin) overrides config.toml's
    //      `target.<triple>.linker`, defeating the point of pinning it
    //      there. (Confirmed live: a `tauri android dev` debug build under
    //      the ambient shell env produced libcorpan_lib.so with p_align =
    //      0x1000 despite the config.toml rustflags being correct.)
    //
    // `cargo:rustc-link-arg` from build.rs is ADDITIVE — Cargo always
    // appends it to the rustc/linker invocation regardless of what RUSTFLAGS
    // (env or config.toml) resolve to, and independent of which linker
    // binary ends up being invoked (`-z max-page-size` is standard
    // lld/GNU-ld syntax supported by every NDK toolchain in play here, r26
    // through r29). That makes it immune to both failure modes above. Keep
    // the config.toml rustflags as defense-in-depth; this is the belt.
    //
    // Verify: `llvm-readelf -l target/aarch64-linux-android/*/libcorpan_lib.so
    // | grep LOAD` — the last column (p_align) must be 0x4000, not 0x1000.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("android") {
        println!("cargo:rustc-link-arg=-Wl,-z,max-page-size=16384");
        println!("cargo:rustc-link-arg=-Wl,-z,common-page-size=16384");
    }

    tauri_build::build()
}
