// swift-tools-version:5.3
import PackageDescription

let package = Package(
    name: "tauri-plugin-game-packs",
    platforms: [
        .iOS(.v13),
    ],
    products: [
        .library(
            name: "tauri-plugin-game-packs",
            type: .static,
            targets: ["tauri-plugin-game-packs"]
        ),
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api")
    ],
    targets: [
        .target(
            name: "tauri-plugin-game-packs",
            dependencies: [
                .byName(name: "Tauri")
            ],
            path: "Sources"
        ),
    ]
)
