// swift-tools-version:5.9
import PackageDescription

// 0.3.0+ uses whisper.cpp instead of WhisperKit. The XCFramework is
// built locally from https://github.com/ggml-org/whisper.cpp v1.8.4
// with `BUILD_STATIC_XCFRAMEWORK=ON ./build-xcframework.sh` — that
// produces a *static* framework (`current ar archive`), which links
// directly into the Tauri Rust dylib with no runtime embed step.
//
// Why not the official `whisper-v1.8.4-xcframework.zip` release asset?
// It's a *dynamic* framework (MH_DYLIB) — links cleanly but iOS dyld
// then fails at app launch because nothing in the Tauri-generated
// Xcode project copies the dylib into the app bundle's `Frameworks/`
// dir. Static sidesteps the embed problem entirely.
//
// Why not ggerganov/whisper.spm? It excludes Metal sources with a
// "can't figure out how to build" TODO and force-defines
// WHISPER_USE_COREML, which would route the encoder through the
// broken MPSGraph path on iPadOS 26.4.x.
//
// The vendored .xcframework is gitignored (184 MB across all slices).
// Regenerate via the script in `ios/.gitignore`'s comment block.
let package = Package(
    name: "tauri-plugin-stt",
    platforms: [
        .iOS(.v16),
        .macOS(.v13),
    ],
    products: [
        .library(
            name: "tauri-plugin-stt",
            type: .static,
            targets: ["tauri-plugin-stt"]),
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api"),
    ],
    targets: [
        .binaryTarget(
            name: "whisper",
            path: "whisper.xcframework"
        ),
        .target(
            name: "tauri-plugin-stt",
            dependencies: [
                .byName(name: "Tauri"),
                .byName(name: "whisper"),
            ],
            path: "Sources"),
    ]
)
