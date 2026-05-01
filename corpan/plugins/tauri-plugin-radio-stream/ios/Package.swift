// swift-tools-version:5.3

import PackageDescription

let package = Package(
    name: "tauri-plugin-radio-stream",
    platforms: [
        // The `.v15` enum case was added in swift-tools 5.5; we stay on 5.3 to
        // match the audio-keepalive plugin's toolchain. `.v13` declares the
        // *minimum* iOS this package supports — the actual deployment target
        // (iOS 15.0) is controlled by the host app's project.yml/Info.plist.
        .iOS(.v13),
    ],
    products: [
        .library(
            name: "tauri-plugin-radio-stream",
            type: .static,
            targets: ["tauri-plugin-radio-stream"]),
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api")
    ],
    targets: [
        .target(
            name: "tauri-plugin-radio-stream",
            dependencies: [
                .byName(name: "Tauri")
            ],
            path: "Sources"),
    ]
)
