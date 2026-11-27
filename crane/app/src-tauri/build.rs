fn main() {
    // `bundle.resources` names `voice/`, where scripts/fetch-voice-model.sh puts
    // the speech model for release builds. tauri_build fails on a resource
    // path that does not exist, and a dev checkout has no model, so create the
    // folder empty: the build compiles, and the app shows no microphone until
    // the model is fetched.
    std::fs::create_dir_all("voice").expect("failed to create the src-tauri/voice resource folder");
    tauri_build::build()
}
