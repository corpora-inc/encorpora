// swift-tools-version:5.9
import PackageDescription

// asr-native uses ONLY Apple frameworks (Speech + AVFoundation) — no vendored
// binary, no XCFramework. SpeechAnalyzer/SpeechTranscriber (iOS 26) with an
// SFSpeechRecognizer fallback (≤25) run out-of-process, so there's nothing to
// embed.
let package = Package(
    name: "tauri-plugin-asr-native",
    platforms: [
        .iOS(.v16),
        .macOS(.v13),
    ],
    products: [
        .library(
            name: "tauri-plugin-asr-native",
            type: .static,
            targets: ["tauri-plugin-asr-native"]),
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api"),
    ],
    targets: [
        .target(
            name: "tauri-plugin-asr-native",
            dependencies: [
                .product(name: "Tauri", package: "Tauri"),
            ],
            path: "Sources"),
    ]
)
