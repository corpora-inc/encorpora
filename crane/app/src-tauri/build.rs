fn main() {
    // `bundle.resources` names `voice/`, where scripts/fetch-voice-model.sh puts
    // the speech model for release builds. tauri_build fails on a resource
    // path that does not exist, and a dev checkout has no model, so create the
    // folder empty: the build compiles, and the app shows no microphone.
    std::fs::create_dir_all("voice").expect("failed to create the src-tauri/voice resource folder");
    // Likewise `resources/pack/`, where release-crane.yml places the signed
    // knowledge pack. Without one the app says it carries no pack.
    std::fs::create_dir_all("resources/pack")
        .expect("failed to create the src-tauri/resources/pack folder");
    println!("cargo:rerun-if-changed=resources/pack");
    // Tell src/voice.rs whether this build carries the model, so a build
    // without it never offers a microphone that cannot work.
    let manifest: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string("voice-model.json").expect("voice-model.json"),
    )
    .expect("voice-model.json is JSON");
    let file = manifest["file"]
        .as_str()
        .expect("voice-model.json names a file");
    let bundled = std::path::Path::new("voice").join(file);
    if bundled.is_file() {
        println!("cargo:rustc-env=CRANE_VOICE_BUNDLED=1");
    }
    println!("cargo:rerun-if-changed=voice-model.json");
    println!("cargo:rerun-if-changed=voice");
    println!("cargo:rerun-if-changed={}", bundled.display());
    tauri_build::build()
}
