// swift-tools-version:5.3

import PackageDescription

let package = Package(
    name: "tauri-plugin-admob",
    platforms: [
        .iOS(.v14),
    ],
    products: [
        .library(
            name: "tauri-plugin-admob",
            type: .static,
            targets: ["tauri-plugin-admob"]),
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api"),
        .package(
            url: "https://github.com/googleads/swift-package-manager-google-mobile-ads.git",
            .upToNextMajor(from: "11.2.0")
        ),
    ],
    targets: [
        .target(
            name: "tauri-plugin-admob",
            dependencies: [
                .byName(name: "Tauri"),
                .product(name: "GoogleMobileAds", package: "swift-package-manager-google-mobile-ads"),
            ],
            path: "Sources"),
    ]
)
