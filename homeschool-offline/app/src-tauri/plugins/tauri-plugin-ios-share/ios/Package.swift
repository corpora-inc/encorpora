// swift-tools-version:5.5
import PackageDescription

let package = Package(
    name: "tauri-plugin-ios-share",
    platforms: [
        .iOS(.v13)
    ],
    products: [
        .library(name: "tauri-plugin-ios-share", type: .static, targets: ["tauri-plugin-ios-share"])
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api")
    ],
    targets: [
        .target(
            name: "tauri-plugin-ios-share",
            dependencies: [
                .byName(name: "Tauri")
            ],
            path: "Sources"
        )
    ]
)
