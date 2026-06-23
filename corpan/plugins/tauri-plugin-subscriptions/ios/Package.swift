// swift-tools-version:5.3
import PackageDescription

let package = Package(
    name: "tauri-plugin-subscriptions",
    platforms: [
        // Keep parity with the sibling plugin (iOS 13). StoreKit 2 calls are
        // gated at the call site via `if #available(iOS 15.0, *)`.
        .iOS(.v13),
    ],
    products: [
        .library(
            name: "tauri-plugin-subscriptions",
            type: .static,
            targets: ["tauri-plugin-subscriptions"]
        ),
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api")
    ],
    targets: [
        .target(
            name: "tauri-plugin-subscriptions",
            dependencies: [
                .byName(name: "Tauri")
            ],
            path: "Sources"
        ),
    ]
)
