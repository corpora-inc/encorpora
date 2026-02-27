// swift-tools-version:5.3

import PackageDescription

let package = Package(
    name: "tauri-plugin-audio-keepalive",
    platforms: [
        .iOS(.v13),
    ],
    products: [
        .library(
            name: "tauri-plugin-audio-keepalive",
            type: .static,
            targets: ["tauri-plugin-audio-keepalive"]),
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api")
    ],
    targets: [
        .target(
            name: "tauri-plugin-audio-keepalive",
            dependencies: [
                .byName(name: "Tauri")
            ],
            path: "Sources"),
    ]
)
