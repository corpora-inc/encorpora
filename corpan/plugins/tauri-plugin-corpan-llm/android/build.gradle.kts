// Android build config for the corpan-llm Tauri plugin.
//
// SCAFFOLD ONLY — the polish machine vendors llama.cpp under src/main/cpp/,
// configures the CMakeLists.txt with -DGGML_VULKAN=ON, and finalizes the
// build. The structure here matches tauri-plugin-stt's pattern.

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.corpan.llm"
    compileSdk = 36

    defaultConfig {
        minSdk = 26  // Vulkan 1.1 requires API 26+

        ndk {
            // arm64 only for v1; can add armeabi-v7a later if needed
            abiFilters += listOf("arm64-v8a")
        }

        externalNativeBuild {
            cmake {
                path = file("src/main/cpp/CMakeLists.txt")
                cppFlags += listOf("-std=c++17", "-fexceptions", "-frtti")
                arguments += listOf(
                    "-DANDROID_STL=c++_shared",
                    "-DGGML_VULKAN=ON",
                    "-DGGML_VULKAN_DEBUG=OFF",
                    "-DLLAMA_BUILD_EXAMPLES=OFF",
                    "-DLLAMA_BUILD_TESTS=OFF",
                    "-DLLAMA_BUILD_SERVER=OFF"
                )
            }
        }
    }

    buildFeatures {
        prefab = true
    }

    externalNativeBuild {
        cmake {
            version = "3.22.1"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation(project(":tauri-android"))
}
