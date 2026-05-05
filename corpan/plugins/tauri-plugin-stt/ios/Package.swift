// swift-tools-version:5.9
import PackageDescription

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
        // Pin to 0.13+ but below 1.0 — at v1.0.0 the package was renamed to
        // `argmax-oss-swift` with a different product layout; we'll bump after
        // smoke-testing.
        .package(url: "https://github.com/argmaxinc/WhisperKit.git", from: "0.13.0"),
    ],
    targets: [
        .target(
            name: "tauri-plugin-stt",
            dependencies: [
                .byName(name: "Tauri"),
                .product(name: "WhisperKit", package: "whisperkit"),
            ],
            path: "Sources"),
    ]
)
