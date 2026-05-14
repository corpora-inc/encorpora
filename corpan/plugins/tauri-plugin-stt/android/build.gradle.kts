import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// tauri-plugin-stt — Android module.
//
// Phase 0 (in progress): wire whisper.cpp via JNI so the iOS pipeline
// can be ported. The plugin used to be a pure stub that rejected every
// command; we're building it out to feature parity with the Swift
// implementation in `ios/Sources/STTPlugin.swift`.
//
// Native build: src/main/cpp/CMakeLists.txt compiles whisper.cpp
// (vendored under src/main/cpp/whisper.cpp, gitignored) plus a small
// JNI shim into a single libwhisper-jni.so per ABI. Currently arm64-v8a
// only — that covers ~99 % of devices in the field. Adding x86_64 for
// emulator builds is a one-line ndk.abiFilters change once we've
// confirmed the path on real hardware.

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.corpora.stt"
    compileSdk = 36

    defaultConfig {
        minSdk = 23

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        consumerProguardFiles("consumer-rules.pro")

        ndk {
            // Modern Android only. Add "x86_64" if you need emulator
            // builds; armeabi-v7a is dead.
            abiFilters += listOf("arm64-v8a")
        }

        externalNativeBuild {
            cmake {
                cppFlags += listOf("-std=c++17", "-fexceptions", "-frtti")
                arguments += listOf(
                    "-DANDROID_STL=c++_shared",
                )
            }
        }
    }

    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
            version = "3.22.1"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlin {
        compilerOptions {
            jvmTarget = JvmTarget.JVM_1_8
        }
    }

    // c++_shared comes in as a separate runtime .so. Make sure it
    // gets packaged into the APK.
    packaging {
        jniLibs {
            useLegacyPackaging = false
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    // Coroutines for the install + prepare scopes.
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    // Single-file model download from huggingface.co. Picked OkHttp
    // over HttpURLConnection because the progress story is cleaner —
    // we get contentLength + a stable input stream without hand-rolling
    // a buffered reader.
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation(project(":tauri-android"))
}
