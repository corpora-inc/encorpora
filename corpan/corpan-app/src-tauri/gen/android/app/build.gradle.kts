import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

android {
    namespace = "com.corpora.corpan"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.corpora.corpan"
        minSdk = 26
        targetSdk = 36

        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")

        manifestPlaceholders["usesCleartextTraffic"] = "false"
    }

    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false

            packaging {
                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            isMinifyEnabled = true
            proguardFiles(
                *fileTree(".") { include("**/*.pro") }
                    .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
                    .toList().toTypedArray()
            )
            ndk {
                // SYMBOL_TABLE instead of FULL. Both are accepted by
                // Play Console; SYMBOL_TABLE sidesteps an AGP 8.11
                // quirk observed locally with NDK 28.2 + the universal
                // flavor where `FULL` left
                // `extractUniversalReleaseNativeDebugMetadata/out/`
                // empty and the AAB's
                // `BUNDLE-METADATA/com.android.tools.build.debugsymbols/`
                // directory missing entirely (so Play kept warning
                // "you've not uploaded debug symbols" after 0.12.6 and
                // 0.12.7 uploads). SYMBOL_TABLE gives function names
                // and basic location info — sufficient for Play's
                // crash symbolication. The CMake side (-g and
                // -fno-omit-frame-pointer in
                // plugins/tauri-plugin-stt/android/src/main/cpp/
                // CMakeLists.txt) plus the Rust side
                // ([profile.release] debug = 1, strip = false in
                // src-tauri/Cargo.toml) emit the DWARF that AGP
                // extracts here.
                debugSymbolLevel = "SYMBOL_TABLE"
            }
            // Belt-and-suspenders: explicitly clear keepDebugSymbols
            // for release so the strip task can actually strip every
            // .so. AGP's default is the empty set, but we observed
            // strip producing byte-identical output to its input on
            // 0.12.7 — set this defensively in case anything upstream
            // (Tauri RustPlugin, debugSymbolLevel side-effects, the
            // STT plugin's packaging block) populates it.
            packaging {
                jniLibs {
                    keepDebugSymbols.clear()
                }
            }
        }
    }

    // Java 17 language level for Android toolchain
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }

    // Pin NDK (optional, keep if you rely on this exact version)
    ndkVersion = "28.2.13676358"
}

// Kotlin JVM target = 17
tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
    kotlinOptions.jvmTarget = "17"
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("com.android.billingclient:billing:7.1.1")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = "tauri.build.gradle.kts")


/* BEGIN: corpan patch (idempotent) */
android {
    // Pin modern SDK + NDK. compileSdk must be 36+ for androidx.core 1.17.0
    // (pulled in transitively by tauri-plugin-iap).
    compileSdk = 36
    defaultConfig {
        targetSdk = 36
    }
    ndkVersion = "28.2.13676358"

    // Java 17 language level
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

// Kotlin JVM target = 17 (no plugin block assumptions)
tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
    kotlinOptions.jvmTarget = "17"
}
/* END: corpan patch */
