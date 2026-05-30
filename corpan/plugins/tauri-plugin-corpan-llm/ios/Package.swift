// swift-tools-version:5.5
// Package.swift for the corpan-llm Tauri plugin (iOS).
//
// The polish machine will drop the built `llama.xcframework` into
// ios/llama.xcframework/ (or wherever vendor/llama.cpp/build outputs it),
// uncomment the binary target below, and finalize the linker flags.

import PackageDescription

let package = Package(
    name: "tauri-plugin-corpan-llm",
    platforms: [.iOS(.v14)],
    products: [
        .library(
            name: "tauri-plugin-corpan-llm",
            type: .static,
            targets: ["tauri-plugin-corpan-llm"]
        )
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api")
    ],
    targets: [
        // .binaryTarget(
        //     name: "llama",
        //     path: "llama.xcframework"
        // ),
        .target(
            name: "tauri-plugin-corpan-llm",
            dependencies: [
                "Tauri",
                // "llama",
            ],
            path: "Sources",
            linkerSettings: [
                .linkedFramework("Metal"),
                .linkedFramework("MetalPerformanceShaders"),
                .linkedFramework("Accelerate"),
                .linkedFramework("Foundation"),
            ]
        )
    ]
)
