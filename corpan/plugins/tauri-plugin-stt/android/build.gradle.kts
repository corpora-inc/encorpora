import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// Android stub for tauri-plugin-stt.
//
// The STT plugin is iOS-only — its real implementation lives in
// `ios/Sources/STTPlugin.swift` and uses WhisperKit, which has no
// Android equivalent we ship to. This Android module exists so that
// `gradlew :app:assembleRelease` can resolve the
// `:tauri-plugin-stt` project dependency and produce a variant.
// Every command rejects with "STT not supported on Android" — and
// in practice these stubs are never invoked at runtime because the
// pronunciation-coach pack is gated to `platforms: ["ios"]` in the
// catalog, so Android users never see it.

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
}

dependencies {
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation(project(":tauri-android"))
}
