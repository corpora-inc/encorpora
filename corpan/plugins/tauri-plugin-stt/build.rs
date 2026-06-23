const COMMANDS: &[&str] = &[
    "prepare",
    "start_session",
    "stop_session",
    "cancel_session",
    "is_available",
    "get_status",
    "wipe_model",
    "install_model",
    "validate_model",
    "list_installed",
    "unload",
    // Tear down the audio engine + AVAudioSession entirely so the
    // iOS mic indicator turns off and `.duckOthers` is released
    // after the pack closes. Distinct from `cancel_session` (which
    // keeps the engine warm for back-to-back recordings).
    "release_audio",
    "register_listener",
    "remove_listener",
];

fn main() {
    // Without explicit rerun-if-changed directives, Cargo treats this
    // build.rs as having no source dependencies — meaning it'll skip
    // rebuilding the plugin on subsequent invocations even when the
    // Swift / Kotlin sources changed. That manifested in the wild as
    // hours of `tauri ios dev` rebuilds that all reused a stale plugin
    // binary; new fields added to Swift Encodable payloads silently
    // never reached the JS side. Explicitly track the ios/ and
    // android/ trees so any source edit forces a recompile.
    println!("cargo:rerun-if-changed=ios");
    println!("cargo:rerun-if-changed=android/src");
    println!("cargo:rerun-if-changed=android/build.gradle.kts");
    println!("cargo:rerun-if-changed=android/AndroidManifest.xml");
    println!("cargo:rerun-if-changed=build.rs");

    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();

    // 0.4.0+: link the locally-vendored whisper.cpp static XCFramework
    // declared as a binaryTarget in iOS/Package.swift. swift-rs builds
    // the Swift target against it (header import works), but it does
    // NOT emit cargo link directives for the binary artifact — so the
    // final cargo link step misses every `_whisper_*` symbol. We emit
    // those directives here.
    //
    // The framework is built as a STATIC archive (`current ar archive`)
    // via `BUILD_STATIC_XCFRAMEWORK=ON ./build-xcframework.sh` in the
    // upstream whisper.cpp repo, so this single link directive is all
    // we need — no runtime embed required (vs. the dynamic
    // MH_DYLIB variant Apple ships in the official release asset,
    // which would also need a "Copy Files" build phase in the Xcode
    // shell project).
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("ios") {
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
            .expect("CARGO_MANIFEST_DIR set by cargo");
        let arch = std::env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();
        let slice = if std::env::var("CARGO_CFG_TARGET_ABI").as_deref() == Ok("sim")
            || arch == "x86_64"
        {
            "ios-arm64_x86_64-simulator"
        } else {
            "ios-arm64"
        };
        let framework_dir =
            format!("{manifest_dir}/ios/whisper.xcframework/{slice}");
        let framework_path = format!("{framework_dir}/whisper.framework/whisper");
        if std::path::Path::new(&framework_path).exists() {
            println!("cargo:rustc-link-search=framework={framework_dir}");
            println!("cargo:rustc-link-lib=framework=whisper");
            // The framework is a C++ static archive; pull in libc++
            // symbols so std::string / std::vector etc. resolve.
            println!("cargo:rustc-link-lib=c++");
            // ggml-metal embeds the metal lib at compile time but
            // still needs the system frameworks at link.
            println!("cargo:rustc-link-lib=framework=Metal");
            println!("cargo:rustc-link-lib=framework=Accelerate");
            println!("cargo:rustc-link-lib=framework=Foundation");
            println!("cargo:rustc-link-lib=framework=CoreML");
            println!("cargo:rerun-if-changed=ios/whisper.xcframework/{slice}/whisper.framework/whisper");
        } else {
            panic!(
                "whisper.cpp XCFramework not found at {framework_path}. \
                 Build it via the script in ios/.gitignore: \
                 git clone --depth 1 --branch v1.8.4 https://github.com/ggml-org/whisper.cpp.git && \
                 cd whisper.cpp && BUILD_STATIC_XCFRAMEWORK=ON ./build-xcframework.sh && \
                 mv build-apple/whisper.xcframework <repo>/corpan/plugins/tauri-plugin-stt/ios/"
            );
        }
    }
}
