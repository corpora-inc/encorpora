import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// tauri-plugin-asr-native — Android module.
//
// Uses ONLY the OS's android.speech.SpeechRecognizer (out-of-process, ~0 added
// app memory). NO JNI / CMake / native libs — unlike tauri-plugin-stt's
// whisper.cpp module. This is a pure-Kotlin plugin.
//
// STUB STATUS: command surface + wire shapes are contract-conformant; the real
// SpeechRecognizer wiring is TODO and reports isAvailable=false until
// implemented + a device build is run.

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.corpora.asrnative"
    compileSdk = 36

    defaultConfig {
        minSdk = 23
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
        }
    }
    kotlinOptions {
        jvmTarget = JvmTarget.JVM_17.target
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation(project(":tauri-android"))
}
