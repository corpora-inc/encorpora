fn main() {
    // `bundle.resources` names `resources/packs/`, where scripts/bundle-packs.sh
    // places the signed packs a build ships. A checkout without them still
    // builds; the app then says it carries no pack.
    std::fs::create_dir_all("resources/packs").expect("failed to create src-tauri/resources/packs");
    println!("cargo:rerun-if-changed=resources/packs");
    tauri_build::build()
}
